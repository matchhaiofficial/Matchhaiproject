import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { recordZoneAuditEvent } from "./zoneAudit";
import { api, internal } from "./_generated/api";
import { requireKycVerified } from "./kycGate";

// ============================================
// QUERIES
// ============================================

// List resources for a zone, optionally filtered by branchId
export const listResourcesByZoneAndBranch = query({
  args: {
    zoneId: v.id("zones"),
    branchId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.branchId) {
      return await ctx.db
        .query("zoneResources")
        .withIndex("by_zoneId_and_branchId", (q) =>
          q.eq("zoneId", args.zoneId).eq("branchId", args.branchId!)
        )
        .collect();
    }
    return await ctx.db
      .query("zoneResources")
      .withIndex("by_zoneId", (q) => q.eq("zoneId", args.zoneId))
      .collect();
  },
});

// Get zone branches (from the zone's branches array)
export const getZoneBranches = query({
  args: { zoneId: v.id("zones") },
  handler: async (ctx, args) => {
    const zone = await ctx.db.get(args.zoneId);
    if (!zone) return [];

    // Return the branches array from the zone document
    const branches = Array.isArray(zone.branches) ? zone.branches : [];
    return branches.map((b: any, index: number) => ({
      id: b.id || `branch_${index + 1}`,
      branchDisplayName: b.branchDisplayName || b.name || "Branch",
      city: b.city || "",
      areaLabel: b.areaLabel || "",
      addressLine1: b.addressLine1 || b.address || "",
      source: b.source,
    }));
  },
});

// ============================================
// MUTATIONS
// ============================================

const toPositiveInt = (value: unknown) => {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const resourceRoomLabel = (assetType: string, tier: string, index: number) => {
  const label = tier === "ps5" ? "PS5" : tier === "xbox" ? "Xbox" : `${tier.charAt(0).toUpperCase()}${tier.slice(1)} ${assetType === "pc" ? "PCs" : "Consoles"}`;
  const roomIndex = assetType === "pc" ? Math.floor((index - 1) / 5) + 1 : Math.floor((index - 1) / 2) + 1;
  return assetType === "pc" ? `${label} Room ${roomIndex}` : `${label} Bay ${roomIndex}`;
};

const resourceNamePrefix = (assetType: string, tier: string) => {
  if (tier === "ps5") return "PS5";
  if (tier === "xbox") return "Xbox";
  const label = `${tier.charAt(0).toUpperCase()}${tier.slice(1)}`;
  return assetType === "pc" ? `${label} PCs` : `${label} Consoles`;
};

async function validateBookableResources(
  ctx: any,
  input: {
    zoneId: string;
    branchId: string;
    resourceIds: Array<Id<"zoneResources">>;
    allowReuseForRequestId?: Id<"bookingRequests">;
  },
) {
  const seen = new Set<string>();
  const resources: any[] = [];

  for (const resourceId of input.resourceIds) {
    const resource = await ctx.db.get(resourceId);
    if (!resource) {
      throw new Error("One or more selected resources no longer exist.");
    }

    const dedupeKey = String(resourceId);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    if (String(resource.zoneId) !== input.zoneId) {
      throw new Error(`${resource.name || "Selected resource"} does not belong to this venue.`);
    }
    if (String(resource.branchId || "") !== String(input.branchId)) {
      throw new Error(`${resource.name || "Selected resource"} does not belong to the selected branch.`);
    }

    const inAllowedState = ["available", "held"].includes(String(resource.lifecycleStatus || ""));
    const belongsToSameRequest =
      input.allowReuseForRequestId &&
      String(resource.bookingRequestId || "") === String(input.allowReuseForRequestId);
    if (!inAllowedState && !belongsToSameRequest) {
      throw new Error(`${resource.name || "Selected resource"} is no longer available.`);
    }

    resources.push(resource);
  }

  return resources;
}

// Update resource lifecycle status
export const updateResourceLifecycleStatus = mutation({
  args: {
    resourceId: v.id("zoneResources"),
    lifecycleStatus: v.union(
      v.literal("available"),
      v.literal("held"),
      v.literal("booked"),
      v.literal("maintenance")
    ),
    adminUid: v.string(),
    holdRequestId: v.optional(v.string()),
    holdMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireKycVerified(ctx);
    const now = Date.now();
    const resource = await ctx.db.get(args.resourceId);
    if (!resource) {
      throw new Error("Resource not found.");
    }

    await ctx.db.patch(args.resourceId, {
      lifecycleStatus: args.lifecycleStatus,
      updatedAt: now,
    });

    await recordZoneAuditEvent(ctx, {
      zoneId: String(resource.zoneId),
      module: "resources",
      action: "update_resource_status",
      actorUid: args.adminUid,
      targetType: "resource",
      targetId: String(args.resourceId),
      summary: `Updated ${resource.name} to ${args.lifecycleStatus}.`,
      details: {
        branchId: resource.branchId,
        resourceName: resource.name,
        previousStatus: resource.lifecycleStatus,
        nextStatus: args.lifecycleStatus,
        holdRequestId: args.holdRequestId || null,
        holdMinutes: args.holdMinutes || null,
      },
      createdAt: now,
    });

    return true;
  },
});

export const syncBranchResourcesFromPricing = mutation({
  args: {
    zoneId: v.id("zones"),
    branchId: v.string(),
    pricing: v.any(),
    adminUid: v.string(),
  },
  handler: async (ctx, args) => {
    await requireKycVerified(ctx);
    const now = Date.now();
    const resources = await ctx.db
      .query("zoneResources")
      .withIndex("by_zoneId_and_branchId", (q) =>
        q.eq("zoneId", args.zoneId).eq("branchId", args.branchId)
      )
      .collect();

    const configs = [
      { assetType: "pc", tier: "regular", count: toPositiveInt(args.pricing?.pc?.regular?.count) },
      { assetType: "pc", tier: "premium", count: toPositiveInt(args.pricing?.pc?.premium?.count) },
      { assetType: "pc", tier: "elite", count: toPositiveInt(args.pricing?.pc?.elite?.count) },
      { assetType: "console", tier: "regular", count: toPositiveInt(args.pricing?.console?.regular?.count) },
      { assetType: "console", tier: "premium", count: toPositiveInt(args.pricing?.console?.premium?.count) },
      { assetType: "console", tier: "elite", count: toPositiveInt(args.pricing?.console?.elite?.count) },
      { assetType: "console", tier: "ps5", count: toPositiveInt(args.pricing?.console?.ps5?.count) },
      { assetType: "console", tier: "xbox", count: toPositiveInt(args.pricing?.console?.xbox?.count) },
    ];

    const changed: any[] = [];
    for (const config of configs) {
      const current = resources.filter((resource: any) =>
        resource.isActive !== false &&
        String(resource.assetType || "").toLowerCase() === config.assetType &&
        String(resource.tier || "").toLowerCase() === config.tier,
      );
      const delta = config.count - current.length;
      const prefix = resourceNamePrefix(config.assetType, config.tier);

      if (delta > 0) {
        for (let offset = 1; offset <= delta; offset += 1) {
          const nextIndex = current.length + offset;
          await ctx.db.insert("zoneResources", {
            zoneId: args.zoneId,
            branchId: args.branchId,
            kind: "seat",
            name: `${prefix} ${nextIndex}`,
            assetType: config.assetType,
            tier: config.tier,
            roomLabel: resourceRoomLabel(config.assetType, config.tier, nextIndex),
            lifecycleStatus: "available",
            isActive: true,
            createdAt: now,
            updatedAt: now,
          });
        }
        changed.push({ ...config, added: delta, removed: 0 });
      } else if (delta < 0) {
        const removable = current
          .filter((resource: any) =>
            resource.lifecycleStatus === "available" &&
            !resource.bookingRequestId &&
            !resource.matchroomId,
          )
          .sort((left: any, right: any) => Number(right.createdAt || 0) - Number(left.createdAt || 0));
        const removeCount = Math.abs(delta);
        if (removable.length < removeCount) {
          throw new Error(`Cannot reduce ${prefix} to ${config.count}; ${removeCount - removable.length} resource(s) are booked, held, or under maintenance.`);
        }
        for (const resource of removable.slice(0, removeCount)) {
          await ctx.db.delete(resource._id);
        }
        changed.push({ ...config, added: 0, removed: removeCount });
      }
    }

    if (changed.length > 0) {
      await recordZoneAuditEvent(ctx, {
        zoneId: String(args.zoneId),
        module: "resources",
        action: "sync_branch_resources_from_pricing",
        actorUid: args.adminUid,
        targetType: "branch",
        targetId: args.branchId,
        summary: "Synced branch resources from branch inventory changes.",
        details: { branchId: args.branchId, changes: changed },
        createdAt: now,
      });
    }

    return { ok: true, changes: changed };
  },
});

// Allocate resources to a booking request
export const allocateResourcesToRequest = mutation({
  args: {
    zoneId: v.id("zones"),
    branchId: v.string(),
    requestId: v.id("bookingRequests"),
    resourceIds: v.array(v.id("zoneResources")),
    adminUid: v.string(),
  },
  handler: async (ctx, args) => {
    await requireKycVerified(ctx);
    if (args.resourceIds.length === 0) {
      throw new Error("Select at least one resource.");
    }

    const now = Date.now();
    await validateBookableResources(ctx, {
      zoneId: String(args.zoneId),
      branchId: args.branchId,
      resourceIds: args.resourceIds,
    });
    const request = await ctx.db.get(args.requestId);

    // Update each resource to booked status
    for (const resourceId of args.resourceIds) {
      await ctx.db.patch(resourceId, {
        lifecycleStatus: "booked",
        bookingRequestId: args.requestId,
        matchroomId: request?.matchroomId,
        bookedAt: now,
        bookedByUid: args.adminUid,
        updatedAt: now,
      });
    }

    // Update booking request
    await ctx.db.patch(args.requestId, {
      status: "accepted",
      allocatedBranchId: args.branchId,
      allocatedResourceIds: args.resourceIds,
      allocatedAt: now,
      allocatedByUid: args.adminUid,
      updatedAt: now,
    });
    if (request?.userId) {
      await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
        type: "resource.allocation_action",
        toUid: request.userId,
        status: "pending",
        dedupeKey: `resource.allocation_action:${String(args.requestId)}:${String(request.userId)}:${args.resourceIds.map(String).sort().join(",")}`,
        dedupePolicy: "replace_active",
        entity: { kind: "booking_request", id: String(args.requestId) },
        route: "/(player)/inbox",
        title: "Resources allocated",
        body: `Your booking has been allocated ${args.resourceIds.length} resource(s).`,
        data: {
          requestId: String(args.requestId),
          zoneId: String(args.zoneId),
          branchId: args.branchId,
          resourceIds: args.resourceIds.map(String),
          href: "/(player)/inbox",
        },
      });
    }

    const resourceSummaries = await Promise.all(
      args.resourceIds.map(async (resourceId) => {
        const resource = await ctx.db.get(resourceId);
        return resource
          ? {
              id: String(resourceId),
              name: resource.name,
              branchId: resource.branchId,
              assetType: resource.assetType,
            }
          : { id: String(resourceId) };
      }),
    );

    await recordZoneAuditEvent(ctx, {
      zoneId: String(args.zoneId),
      module: "resources",
      action: "allocate_resources",
      actorUid: args.adminUid,
      targetType: "booking_request",
      targetId: String(args.requestId),
      summary: `Allocated ${args.resourceIds.length} resource(s) to booking request.`,
      details: {
        branchId: args.branchId,
        resourceIds: args.resourceIds.map(String),
        resources: resourceSummaries,
        requestUserId: request?.userId ? String(request.userId) : null,
      },
      createdAt: now,
    });

    return true;
  },
});

export const reassignResourcesForRequest = mutation({
  args: {
    zoneId: v.id("zones"),
    branchId: v.string(),
    requestId: v.id("bookingRequests"),
    newResourceIds: v.array(v.id("zoneResources")),
    adminUid: v.string(),
  },
  handler: async (ctx, args) => {
    await requireKycVerified(ctx);
    if (!args.newResourceIds.length) {
      throw new Error("Select at least one resource.");
    }

    const now = Date.now();
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Booking request not found.");
    }
    if (String(request.status || "") !== "accepted" || !request.matchroomId) {
      throw new Error("Only accepted bookings with a matchroom can be reassigned.");
    }

    await validateBookableResources(ctx, {
      zoneId: String(args.zoneId),
      branchId: args.branchId,
      resourceIds: args.newResourceIds,
      allowReuseForRequestId: args.requestId,
    });

    const previousResources = await ctx.db
      .query("zoneResources")
      .withIndex("by_bookingRequestId", (q) => q.eq("bookingRequestId", args.requestId))
      .collect();
    const nextResourceSet = new Set(args.newResourceIds.map((resourceId) => String(resourceId)));

    for (const resource of previousResources) {
      if (nextResourceSet.has(String(resource._id))) continue;
      await ctx.db.patch(resource._id, {
        lifecycleStatus: "available",
        bookingRequestId: undefined,
        matchroomId: undefined,
        bookedAt: undefined,
        bookedByUid: undefined,
        updatedAt: now,
      });
    }

    for (const resourceId of args.newResourceIds) {
      await ctx.db.patch(resourceId, {
        lifecycleStatus: "booked",
        bookingRequestId: args.requestId,
        matchroomId: request.matchroomId,
        bookedAt: now,
        bookedByUid: args.adminUid,
        updatedAt: now,
      });
    }

    await ctx.db.patch(args.requestId, {
      allocatedBranchId: args.branchId,
      allocatedResourceIds: args.newResourceIds,
      allocatedAt: now,
      allocatedByUid: args.adminUid,
      updatedAt: now,
    });

    await ctx.db.patch(request.matchroomId, {
      branchId: args.branchId,
      resourceIds: args.newResourceIds,
      updatedAt: now,
    });

    await recordZoneAuditEvent(ctx, {
      zoneId: String(args.zoneId),
      module: "resources",
      action: "reassign_allocation",
      actorUid: args.adminUid,
      targetType: "booking_request",
      targetId: String(args.requestId),
      summary: `Reassigned ${args.newResourceIds.length} resource(s) for booking request.`,
      details: {
        branchId: args.branchId,
        previousResourceIds: previousResources.map((resource) => String(resource._id)),
        newResourceIds: args.newResourceIds.map(String),
        matchroomId: String(request.matchroomId),
        requestUserId: request.userId ? String(request.userId) : null,
      },
      createdAt: now,
    });

    return true;
  },
});

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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
    const now = Date.now();

    await ctx.db.patch(args.resourceId, {
      lifecycleStatus: args.lifecycleStatus,
      updatedAt: now,
    });

    return true;
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
    if (args.resourceIds.length === 0) {
      throw new Error("Select at least one resource.");
    }

    const now = Date.now();

    // Update each resource to booked status
    for (const resourceId of args.resourceIds) {
      await ctx.db.patch(resourceId, {
        lifecycleStatus: "booked",
        updatedAt: now,
      });
    }

    // Update booking request
    await ctx.db.patch(args.requestId, {
      status: "accepted",
      updatedAt: now,
    });

    // Try to send notification
    const request = await ctx.db.get(args.requestId);
    if (request?.userId) {
      await ctx.db.insert("notifications", {
        type: "booking_request_accepted",
        toUid: request.userId,
        status: "pending",
        title: "Resources allocated",
        body: `Your booking has been allocated ${args.resourceIds.length} resource(s).`,
        data: {
          requestId: String(args.requestId),
          zoneId: String(args.zoneId),
          branchId: args.branchId,
          resourceIds: args.resourceIds.map(String),
        },
        createdAt: now,
        updatedAt: now,
      });
    }

    return true;
  },
});

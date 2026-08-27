import { internalMutation, query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { recordZoneAuditEvent } from "./zoneAudit";
import { requireKycVerified } from "./kycGate";
import { listSuperAdminNotificationRecipients } from "./superAdminAccess";
import { isUserHiddenFromPublic } from "./userVisibility";
import { requireCurrentUser, requireSuperAdmin } from "./authz";

const ZONE_LIVE_NEARBY_NOTIFICATION_TYPE = "zone.live_nearby";
const ZONE_LIVE_NEARBY_NOTIFICATION_BATCH_SIZE = 75;

function toPositiveNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function buildPrimaryBranch(branch: any, fallbackCity?: string) {
  if (!branch) return undefined;
  return {
    branchDisplayName: branch.branchDisplayName || branch.name,
    city: branch.city || fallbackCity,
    areaLabel: branch.areaLabel,
    addressLine1: branch.addressLine1 || branch.address,
    googleMapsUrl: branch.googleMapsUrl,
  };
}

function getBranchCapacity(branch: any) {
  const pricing = branch?.pricing || {};
  const pc = pricing.pc || {};
  const consolePricing = pricing.console || {};
  const pcSeats =
    toPositiveNumber(pc.regular?.count) +
    toPositiveNumber(pc.premium?.count) +
    toPositiveNumber(pc.elite?.count);
  const ps5Seats = toPositiveNumber(consolePricing.ps5?.count);
  const xboxSeats = toPositiveNumber(consolePricing.xbox?.count);
  const tieredConsoleSeats =
    toPositiveNumber(consolePricing.regular?.count) +
    toPositiveNumber(consolePricing.premium?.count) +
    toPositiveNumber(consolePricing.elite?.count);
  const consoleSeats = tieredConsoleSeats + ps5Seats + xboxSeats;

  return {
    pcSeats,
    consoleSeats,
    consolePlatform:
      ps5Seats > 0 && xboxSeats > 0
        ? "ps5+xbox"
        : ps5Seats > 0
          ? "ps5"
          : xboxSeats > 0
            ? "xbox"
            : undefined,
  };
}

function normalizeAudienceToken(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function addAudienceLabel(targets: Map<string, string>, value?: string | null) {
  const label = String(value || "").trim();
  const key = normalizeAudienceToken(label);
  if (key && !targets.has(key)) targets.set(key, label);
}

function getZoneVenueLabel(zone: any) {
  return (
    String(zone?.venueBrandName || "").trim() ||
    String(zone?.name || "").trim() ||
    String(zone?.primaryBranch?.branchDisplayName || "").trim() ||
    "A new MatchHai zone"
  );
}

function getZoneAudienceContext(zone: any) {
  const areas = new Map<string, string>();
  addAudienceLabel(areas, zone?.primaryBranch?.areaLabel);
  for (const branch of Array.isArray(zone?.branches) ? zone.branches : []) {
    addAudienceLabel(areas, branch?.areaLabel);
  }

  const branchCity = (Array.isArray(zone?.branches) ? zone.branches : [])
    .map((branch: any) => String(branch?.city || "").trim())
    .find(Boolean);
  const city = String(zone?.primaryBranch?.city || zone?.city || branchCity || "").trim();
  const areaLabels = Array.from(areas.values());
  const locationLabel = areaLabels[0]
    ? city && normalizeAudienceToken(city) !== normalizeAudienceToken(areaLabels[0])
      ? `${areaLabels[0]}, ${city}`
      : areaLabels[0]
    : city;

  return {
    areaLabels,
    city,
    locationLabel,
    venueLabel: getZoneVenueLabel(zone),
  };
}

function shouldNotifyUserForLiveZone(user: any, input: {
  targetAreaKeys: Set<string>;
  targetCityKey: string;
}) {
  if (!user) return false;
  if (isUserHiddenFromPublic(user)) return false;
  if (String(user.accountStatus || "").toLowerCase() === "suspended") return false;
  if (user.onboardingCompleted !== true) return false;

  const userCityKey = normalizeAudienceToken(user.city);
  if (input.targetCityKey && userCityKey && userCityKey !== input.targetCityKey) {
    return false;
  }

  if (input.targetAreaKeys.size === 0) {
    return Boolean(input.targetCityKey && userCityKey === input.targetCityKey);
  }

  const userAreaKeys = new Set(
    (Array.isArray(user.areasPreferred) ? user.areasPreferred : [])
      .map((area: any) => normalizeAudienceToken(area))
      .filter(Boolean),
  );
  for (const key of input.targetAreaKeys) {
    if (userAreaKeys.has(key)) return true;
  }
  return false;
}

async function scheduleZoneLiveNearbyNotifications(ctx: any, zoneId: Id<"zones">) {
  await ctx.scheduler.runAfter(0, internal.zones.notifyZoneLiveNearbyPlayersBatch, {
    zoneId,
    cursor: null,
  });
}

function buildAggregateCapacity(branches: any[]) {
  const totals = (branches || []).reduce(
    (acc, branch) => {
      const next = getBranchCapacity(branch);
      acc.pcSeats += next.pcSeats;
      acc.consoleSeats += next.consoleSeats;
      if (next.consolePlatform === "ps5+xbox") acc.consolePlatform = "ps5+xbox";
      else if (!acc.consolePlatform && next.consolePlatform) acc.consolePlatform = next.consolePlatform;
      else if (acc.consolePlatform && next.consolePlatform && acc.consolePlatform !== next.consolePlatform) {
        acc.consolePlatform = "ps5+xbox";
      }
      return acc;
    },
    { pcSeats: 0, consoleSeats: 0, consolePlatform: undefined as string | undefined }
  );

  return {
    pcSeats: totals.pcSeats,
    consoleSeats: totals.consoleSeats,
    ...(totals.consolePlatform ? { consolePlatform: totals.consolePlatform } : {}),
  };
}

async function requireZoneOwnerWithKyc(
  ctx: any,
  zoneId: Id<"zones">,
): Promise<{ profile: any; zone: any }> {
  const { profile } = await requireKycVerified(ctx);
  const zone = await ctx.db.get(zoneId);
  if (!zone) throw new Error("Zone not found");
  if (String(zone.ownerUid || "") !== String(profile?._id || "")) {
    throw new Error("You are not authorized to manage this zone.");
  }
  return { profile, zone };
}

// ============================================
// ZONE QUERIES
// ============================================

// Public-safe venue projection. Strips owner identity, internal notes,
// rejection reasons, migration internals, and payout-rate economics so the
// player-facing venue page (and team-challenge rate lookups) never receive
// those over the wire. Customer-facing pricing and intentionally-public
// contact details (contactPhone/contactEmail) are retained.
function buildPublicZoneView(zone: any): any {
  if (!zone) return null;
  const {
    ownerUid: _ownerUid,
    ownerUsername: _ownerUsername,
    ownerFullName: _ownerFullName,
    notes: _notes,
    rejectionReason: _rejectionReason,
    migration: _migration,
    pilotPayoutRate: _pilotPayoutRate,
    normalPayoutRate: _normalPayoutRate,
    ...publicZone
  } = zone;
  return publicZone;
}

// Get zone by ID. Returns the public-safe projection only — the owner zone
// dashboard reads its own zone via `getByOwner`, and super admins via the
// `admin` namespace, so this query never needs to expose internal/payout fields
// to a (potentially anonymous) caller.
export const getById = query({
  args: { zoneId: v.id("zones") },
  handler: async (ctx, args) => {
    return buildPublicZoneView(await ctx.db.get(args.zoneId));
  },
});

// Get zone by ID (string version for compatibility) — public-safe projection.
export const getByIdString = query({
  args: { zoneId: v.string() },
  handler: async (ctx, args) => {
    try {
      const id = args.zoneId as any;
      return buildPublicZoneView(await ctx.db.get(id));
    } catch {
      return null;
    }
  },
});

// Explicit public venue queries for player-facing surfaces. Same allow-listed
// projection; named so callers can't accidentally assume internal fields exist.
export const getPublicVenueById = query({
  args: { zoneId: v.id("zones") },
  handler: async (ctx, args) => {
    return buildPublicZoneView(await ctx.db.get(args.zoneId));
  },
});

export const getPublicVenueByIdString = query({
  args: { zoneId: v.string() },
  handler: async (ctx, args) => {
    try {
      const id = args.zoneId as any;
      return buildPublicZoneView(await ctx.db.get(id));
    } catch {
      return null;
    }
  },
});

// Get zone by owner
export const getByOwner = query({
  args: { ownerUid: v.id("users") },
  handler: async (ctx, args) => {
    const actor = await requireCurrentUser(ctx);
    if (String(actor.user._id) !== String(args.ownerUid)) {
      throw new Error("Not authorized");
    }
    return await ctx.db
      .query("zones")
      .withIndex("by_ownerUid", (q) => q.eq("ownerUid", args.ownerUid))
      .unique();
  },
});

// List active zones
export const listActive = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const zones = await ctx.db
      .query("zones")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .order("desc")
      .take(args.limit || 50);
    return zones.map(buildPublicZoneView);
  },
});

// List pending review zones (for super admin)
export const listPendingReview = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    return await ctx.db
      .query("zones")
      .withIndex("by_status", (q) => q.eq("status", "pending-review"))
      .take(100);
  },
});

export const notifyZoneLiveNearbyPlayersBatch = internalMutation({
  args: {
    zoneId: v.id("zones"),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const zone = await ctx.db.get(args.zoneId);
    if (!zone) return { notified: 0, skipped: "missing_zone" };
    if (zone.status !== "active") return { notified: 0, skipped: "zone_not_active" };

    const context = getZoneAudienceContext(zone);
    const targetAreaKeys = new Set(
      context.areaLabels.map((area) => normalizeAudienceToken(area)).filter(Boolean),
    );
    const targetCityKey = normalizeAudienceToken(context.city);
    if (targetAreaKeys.size === 0 && !targetCityKey) {
      return { notified: 0, skipped: "missing_location" };
    }

    const page = await ctx.db
      .query("users")
      .withIndex("by_accountType_updatedAt", (q: any) => q.eq("accountType", "player"))
      .order("desc")
      .paginate({
        numItems: ZONE_LIVE_NEARBY_NOTIFICATION_BATCH_SIZE,
        cursor: args.cursor || null,
      });

    let notified = 0;
    const notificationErrors: Array<{ userId: string; message: string }> = [];
    for (const user of page.page) {
      if (!shouldNotifyUserForLiveZone(user, { targetAreaKeys, targetCityKey })) continue;

      try {
        await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
          type: ZONE_LIVE_NEARBY_NOTIFICATION_TYPE,
          toUid: user._id,
          recipientRole: "player",
          status: "pending",
          dedupeKey: `${ZONE_LIVE_NEARBY_NOTIFICATION_TYPE}:${String(args.zoneId)}:${String(user._id)}`,
          dedupePolicy: "upsert_active",
          pushPolicy: "eligible",
          route: `/(player)/zones/${String(args.zoneId)}`,
          entity: { kind: "zone", id: String(args.zoneId) },
          entityId: String(args.zoneId),
          title: "New zone is live near you",
          body: `${context.venueLabel} is live now${context.locationLabel ? ` in ${context.locationLabel}` : ""}.`,
          data: {
            zoneId: String(args.zoneId),
            zoneName: context.venueLabel,
            locationLabel: context.locationLabel,
            targetAreas: context.areaLabels,
            targetCity: context.city || null,
            href: `/(player)/zones/${String(args.zoneId)}`,
          },
        });
        notified += 1;
      } catch (error: any) {
        notificationErrors.push({
          userId: String(user._id),
          message: String(error?.message || error || "Failed to notify player."),
        });
      }
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.zones.notifyZoneLiveNearbyPlayersBatch, {
        zoneId: args.zoneId,
        cursor: page.continueCursor,
      });
    }

    return { notified, notificationErrors, isDone: page.isDone };
  },
});

// ============================================
// ZONE MUTATIONS
// ============================================

// Create zone
export const create = mutation({
  args: {
    ownerUid: v.id("users"),
    ownerUsername: v.optional(v.string()),
    ownerFullName: v.optional(v.string()),
    name: v.string(),
    venueBrandName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    type: v.optional(v.union(v.literal("gaming"), v.literal("sports"), v.literal("hybrid"))),
    description: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    phone: v.optional(v.string()),
    games: v.array(v.string()),
    branches: v.array(v.any()),
    defaultPricing: v.optional(
      v.object({
        hourlyRate: v.number(),
        currency: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const actor = await requireCurrentUser(ctx);
    if (String(actor.user._id) !== String(args.ownerUid)) {
      throw new Error("Not authorized");
    }
    const now = Date.now();
    const primaryBranch = buildPrimaryBranch(args.branches[0], args.city);
    const capacity = buildAggregateCapacity(args.branches);
    const firstBranchPricing = args.branches[0]?.pricing;

    const zoneId = await ctx.db.insert("zones", {
      ownerUid: actor.user._id,
      ownerUsername: actor.user.username,
      ownerFullName: actor.user.fullName,
      name: args.name,
      venueBrandName: args.venueBrandName,
      contactEmail: args.contactEmail,
      contactPhone: args.contactPhone,
      type: args.type,
      status: "pending-review",
      description: args.description,
      address: args.address,
      city: args.city,
      phone: args.phone,
      games: args.games,
      branches: args.branches,
      primaryBranch,
      capacity,
      pricing: firstBranchPricing,
      defaultPricing: args.defaultPricing,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "zone.registration_submitted",
      toUid: actor.user._id,
      recipientRole: "zone_admin",
      status: "pending",
      dedupeKey: `zone.registration_submitted:${String(zoneId)}`,
      dedupePolicy: "replace_active",
      route: "/zone/(tabs)/profile",
      entity: { kind: "zone", id: String(zoneId) },
      entityId: String(zoneId),
      title: "Zone registration submitted",
      body: "Your venue registration was submitted and is pending super-admin review.",
      data: {
        zoneId: String(zoneId),
        status: "pending-review",
        href: "/zone/(tabs)/profile",
      },
    });

    const superAdmins = await listSuperAdminNotificationRecipients(ctx);
    for (const superAdmin of superAdmins) {
      await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
        type: "moderation.review_needed",
        toUid: superAdmin._id,
        recipientRole: "super_admin",
        status: "pending",
        dedupeKey: `moderation.review_needed:zone:${String(zoneId)}:${String(superAdmin._id)}`,
        dedupePolicy: "upsert_active",
        route: "/super-admin",
        entity: { kind: "zone", id: String(zoneId) },
        entityId: String(zoneId),
        title: "Zone review needed",
        body: `${args.venueBrandName || args.name} was submitted for review.`,
        data: {
          zoneId: String(zoneId),
          zoneName: args.venueBrandName || args.name,
          href: "/super-admin",
        },
      });
    }

    return zoneId;
  },
});

// Update zone
export const update = mutation({
  args: {
    zoneId: v.id("zones"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    phone: v.optional(v.string()),
    games: v.optional(v.array(v.string())),
    branches: v.optional(v.array(v.any())),
    primaryBranch: v.optional(v.any()),
    ownerUsername: v.optional(v.string()),
    ownerFullName: v.optional(v.string()),
    venueBrandName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    type: v.optional(v.union(v.literal("gaming"), v.literal("sports"), v.literal("hybrid"))),
    pricing: v.optional(v.any()),
    capacity: v.optional(v.any()),
    migration: v.optional(v.any()),
    defaultPricing: v.optional(
      v.object({
        hourlyRate: v.number(),
        currency: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireZoneOwnerWithKyc(ctx, args.zoneId);
    const { zoneId, ...updates } = args;

    const updateData: Record<string, unknown> = { updatedAt: Date.now() };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.address !== undefined) updateData.address = updates.address;
    if (updates.city !== undefined) updateData.city = updates.city;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.games !== undefined) updateData.games = updates.games;
    if (updates.branches !== undefined) {
      updateData.branches = updates.branches;
      if (updates.primaryBranch === undefined) {
        updateData.primaryBranch = buildPrimaryBranch(updates.branches[0], updates.city);
      }
      if (updates.capacity === undefined) {
        updateData.capacity = buildAggregateCapacity(updates.branches);
      }
      if (updates.pricing === undefined) {
        updateData.pricing = updates.branches[0]?.pricing;
      }
    }
    if (updates.primaryBranch !== undefined) updateData.primaryBranch = updates.primaryBranch;
    if (updates.ownerUsername !== undefined) updateData.ownerUsername = updates.ownerUsername;
    if (updates.ownerFullName !== undefined) updateData.ownerFullName = updates.ownerFullName;
    if (updates.venueBrandName !== undefined) updateData.venueBrandName = updates.venueBrandName;
    if (updates.contactEmail !== undefined) updateData.contactEmail = updates.contactEmail;
    if (updates.contactPhone !== undefined) updateData.contactPhone = updates.contactPhone;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.pricing !== undefined) updateData.pricing = updates.pricing;
    if (updates.capacity !== undefined) updateData.capacity = updates.capacity;
    if (updates.migration !== undefined) updateData.migration = updates.migration;
    if (updates.defaultPricing !== undefined) updateData.defaultPricing = updates.defaultPricing;

    await ctx.db.patch(zoneId, updateData);
    return true;
  },
});

export const addBranch = mutation({
  args: {
    zoneId: v.id("zones"),
    branch: v.any(),
  },
  handler: async (ctx, args) => {
    const { zone } = await requireZoneOwnerWithKyc(ctx, args.zoneId);

    const branch = {
      ...args.branch,
      id: args.branch?.id || Math.random().toString(36).slice(2, 10),
    };
    const branches = [...(zone.branches || []), branch];

    await ctx.db.patch(args.zoneId, {
      branches,
      primaryBranch: zone.primaryBranch || {
        branchDisplayName: branch.branchDisplayName || branch.name,
        city: branch.city,
        areaLabel: branch.areaLabel,
        addressLine1: branch.addressLine1 || branch.address,
        googleMapsUrl: branch.googleMapsUrl,
      },
      capacity: buildAggregateCapacity(branches),
      pricing: (branches[0] as any)?.pricing,
      updatedAt: Date.now(),
    });

    return branch.id;
  },
});

export const updateBranch = mutation({
  args: {
    zoneId: v.id("zones"),
    branchId: v.string(),
    updates: v.any(),
  },
  handler: async (ctx, args) => {
    const { zone } = await requireZoneOwnerWithKyc(ctx, args.zoneId);

    const branches = (zone.branches || []).map((branch: any) =>
      branch.id === args.branchId ? { ...branch, ...args.updates, id: branch.id } : branch
    );

    const primary = branches[0];

    await ctx.db.patch(args.zoneId, {
      branches,
      primaryBranch: primary
        ? {
            branchDisplayName: primary.branchDisplayName || primary.name,
            city: primary.city,
            areaLabel: primary.areaLabel,
            addressLine1: primary.addressLine1 || primary.address,
            googleMapsUrl: primary.googleMapsUrl,
          }
        : undefined,
      capacity: buildAggregateCapacity(branches),
      pricing: (branches[0] as any)?.pricing,
      updatedAt: Date.now(),
    });

    return true;
  },
});

export const deleteBranch = mutation({
  args: {
    zoneId: v.id("zones"),
    branchId: v.string(),
  },
  handler: async (ctx, args) => {
    const { zone } = await requireZoneOwnerWithKyc(ctx, args.zoneId);

    const branches = (zone.branches || []).filter((branch: any) => branch.id !== args.branchId);
    const primary = branches[0];

    await ctx.db.patch(args.zoneId, {
      branches,
      primaryBranch: primary
        ? {
            branchDisplayName: primary.branchDisplayName || primary.name,
            city: primary.city,
            areaLabel: primary.areaLabel,
            addressLine1: primary.addressLine1 || primary.address,
            googleMapsUrl: primary.googleMapsUrl,
          }
        : undefined,
      capacity: buildAggregateCapacity(branches),
      pricing: (branches[0] as any)?.pricing,
      updatedAt: Date.now(),
    });

    return true;
  },
});

// Approve zone (super admin)
export const approve = mutation({
  args: { zoneId: v.id("zones") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const zone = await ctx.db.get(args.zoneId);
    if (!zone) throw new Error("Zone not found");
    await ctx.db.patch(args.zoneId, {
      status: "active",
      approvedAt: Date.now(),
      updatedAt: Date.now(),
    });
    if (["pending-review", "approved_pending_migration"].includes(String(zone.status || ""))) {
      await scheduleZoneLiveNearbyNotifications(ctx, args.zoneId);
    }
    return true;
  },
});

// Reject zone (super admin)
export const reject = mutation({
  args: {
    zoneId: v.id("zones"),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const zone = await ctx.db.get(args.zoneId);
    if (!zone) throw new Error("Zone not found");
    await ctx.db.patch(args.zoneId, {
      status: "rejected",
      rejectedAt: Date.now(),
      rejectionReason: args.rejectionReason,
      updatedAt: Date.now(),
    });
    return true;
  },
});

// Suspend zone (super admin)
export const suspend = mutation({
  args: { zoneId: v.id("zones") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const zone = await ctx.db.get(args.zoneId);
    if (!zone) throw new Error("Zone not found");
    await ctx.db.patch(args.zoneId, {
      status: "suspended",
      updatedAt: Date.now(),
    });
    return true;
  },
});

// ============================================
// PRICING RULES
// ============================================

// List pricing rules for zone
export const listPricingRules = query({
  args: { zoneId: v.id("zones") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pricingRules")
      .withIndex("by_zoneId", (q) => q.eq("zoneId", args.zoneId))
      .collect();
  },
});

// Create pricing rule
export const createPricingRule = mutation({
  args: {
    zoneId: v.id("zones"),
    branchId: v.optional(v.string()),
    assetType: v.string(),
    isEnabled: v.boolean(),
    priority: v.number(),
    tier: v.optional(v.string()),
    surface: v.optional(v.string()),
    ruleType: v.optional(v.union(v.literal("percentage_discount"), v.literal("fixed_override"))),
    value: v.optional(v.number()),
    timeStart: v.optional(v.string()),
    timeEnd: v.optional(v.string()),
    daysOfWeek: v.optional(v.array(v.number())),
    validFrom: v.optional(v.string()),
    validTo: v.optional(v.string()),
    priceMultiplier: v.optional(v.number()),
    flatRate: v.optional(v.number()),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    createdByUid: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireZoneOwnerWithKyc(ctx, args.zoneId);
    const now = Date.now();

    const ruleId = await ctx.db.insert("pricingRules", {
      ...args,
      createdByUid: String(profile?._id),
      createdAt: now,
      updatedAt: now,
    });

    await recordZoneAuditEvent(ctx, {
      zoneId: String(args.zoneId),
      module: "pricing",
      action: "create_pricing_rule",
      actorUid: String(profile?._id),
      targetType: "pricing_rule",
      targetId: String(ruleId),
      summary: `Created pricing rule "${args.name || "Untitled rule"}".`,
      details: {
        branchId: args.branchId || null,
        assetType: args.assetType,
        isEnabled: args.isEnabled,
        priority: args.priority,
        tier: args.tier || null,
        surface: args.surface || null,
        ruleType: args.ruleType || null,
        value: args.value ?? null,
        timeStart: args.timeStart || null,
        timeEnd: args.timeEnd || null,
        daysOfWeek: args.daysOfWeek || [],
        validFrom: args.validFrom || null,
        validTo: args.validTo || null,
      },
      createdAt: now,
    });

    return ruleId;
  },
});

// Update pricing rule
export const updatePricingRule = mutation({
  args: {
    ruleId: v.id("pricingRules"),
    updatedByUid: v.optional(v.string()),
    isEnabled: v.optional(v.boolean()),
    priority: v.optional(v.number()),
    tier: v.optional(v.string()),
    surface: v.optional(v.string()),
    ruleType: v.optional(v.union(v.literal("percentage_discount"), v.literal("fixed_override"))),
    value: v.optional(v.number()),
    timeStart: v.optional(v.string()),
    timeEnd: v.optional(v.string()),
    daysOfWeek: v.optional(v.array(v.number())),
    validFrom: v.optional(v.string()),
    validTo: v.optional(v.string()),
    priceMultiplier: v.optional(v.number()),
    flatRate: v.optional(v.number()),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { ruleId, updatedByUid: _updatedByUid, ...updates } = args;
    const existingRule = await ctx.db.get(ruleId);
    if (!existingRule) {
      throw new Error("Pricing rule not found.");
    }
    const { profile } = await requireZoneOwnerWithKyc(ctx, existingRule.zoneId);

    const updateData: Record<string, unknown> = { updatedAt: Date.now() };
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateData[key] = value;
      }
    });

    await ctx.db.patch(ruleId, updateData);

    await recordZoneAuditEvent(ctx, {
      zoneId: String(existingRule.zoneId),
      module: "pricing",
      action: "update_pricing_rule",
      actorUid: String(profile?._id),
      targetType: "pricing_rule",
      targetId: String(ruleId),
      summary: `Updated pricing rule "${existingRule.name || "Untitled rule"}".`,
      details: {
        previous: {
          isEnabled: existingRule.isEnabled,
          priority: existingRule.priority,
          tier: existingRule.tier || null,
          surface: existingRule.surface || null,
          ruleType: existingRule.ruleType || null,
          value: existingRule.value ?? null,
          timeStart: existingRule.timeStart || null,
          timeEnd: existingRule.timeEnd || null,
          daysOfWeek: existingRule.daysOfWeek || [],
          validFrom: existingRule.validFrom || null,
          validTo: existingRule.validTo || null,
        },
        updates,
      },
      createdAt: Number(updateData.updatedAt),
    });
    return true;
  },
});

// Delete pricing rule
export const deletePricingRule = mutation({
  args: {
    ruleId: v.id("pricingRules"),
    deletedByUid: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingRule = await ctx.db.get(args.ruleId);
    if (!existingRule) {
      throw new Error("Pricing rule not found.");
    }
    const { profile } = await requireZoneOwnerWithKyc(ctx, existingRule.zoneId);

    await ctx.db.delete(args.ruleId);

    await recordZoneAuditEvent(ctx, {
      zoneId: String(existingRule.zoneId),
      module: "pricing",
      action: "delete_pricing_rule",
      actorUid: String(profile?._id),
      targetType: "pricing_rule",
      targetId: String(args.ruleId),
      summary: `Deleted pricing rule "${existingRule.name || "Untitled rule"}".`,
      details: {
        branchId: existingRule.branchId || null,
        assetType: existingRule.assetType,
        isEnabled: existingRule.isEnabled,
        priority: existingRule.priority,
      },
    });
    return true;
  },
});

// ============================================
// ZONE RESOURCES
// ============================================

// List resources for zone
export const listResources = query({
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

// Create resource
export const createResource = mutation({
  args: {
    zoneId: v.id("zones"),
    branchId: v.string(),
    kind: v.string(),
    name: v.string(),
    assetType: v.string(),
    tier: v.optional(v.string()),
    surface: v.optional(v.string()),
    roomLabel: v.optional(v.string()),
    capacity: v.optional(v.number()),
    hourlyRate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireZoneOwnerWithKyc(ctx, args.zoneId);
    const now = Date.now();

    const resourceId = await ctx.db.insert("zoneResources", {
      ...args,
      lifecycleStatus: "available",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return resourceId;
  },
});

// Update resource status
export const updateResourceStatus = mutation({
  args: {
    resourceId: v.id("zoneResources"),
    lifecycleStatus: v.union(
      v.literal("available"),
      v.literal("held"),
      v.literal("booked"),
      v.literal("maintenance")
    ),
  },
  handler: async (ctx, args) => {
    const resource = await ctx.db.get(args.resourceId);
    if (!resource) throw new Error("Resource not found");
    await requireZoneOwnerWithKyc(ctx, resource.zoneId);
    await ctx.db.patch(args.resourceId, {
      lifecycleStatus: args.lifecycleStatus,
      updatedAt: Date.now(),
    });
    return true;
  },
});

// Delete resource
export const deleteResource = mutation({
  args: { resourceId: v.id("zoneResources") },
  handler: async (ctx, args) => {
    const resource = await ctx.db.get(args.resourceId);
    if (!resource) throw new Error("Resource not found");
    await requireZoneOwnerWithKyc(ctx, resource.zoneId);
    await ctx.db.delete(args.resourceId);
    return true;
  },
});

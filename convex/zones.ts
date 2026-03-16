import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ============================================
// ZONE QUERIES
// ============================================

// Get zone by ID
export const getById = query({
  args: { zoneId: v.id("zones") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.zoneId);
  },
});

// Get zone by ID (string version for compatibility)
export const getByIdString = query({
  args: { zoneId: v.string() },
  handler: async (ctx, args) => {
    try {
      const id = args.zoneId as any;
      return await ctx.db.get(id);
    } catch {
      return null;
    }
  },
});

// Get zone by owner
export const getByOwner = query({
  args: { ownerUid: v.id("users") },
  handler: async (ctx, args) => {
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
    return await ctx.db
      .query("zones")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(args.limit || 50);
  },
});

// List pending review zones (for super admin)
export const listPendingReview = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("zones")
      .withIndex("by_status", (q) => q.eq("status", "pending-review"))
      .collect();
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
    name: v.string(),
    description: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    phone: v.optional(v.string()),
    games: v.array(v.string()),
    branches: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        address: v.optional(v.string()),
        capacity: v.optional(v.number()),
        isActive: v.optional(v.boolean()),
      })
    ),
    defaultPricing: v.optional(
      v.object({
        hourlyRate: v.number(),
        currency: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const zoneId = await ctx.db.insert("zones", {
      ownerUid: args.ownerUid,
      ownerUsername: args.ownerUsername,
      name: args.name,
      status: "pending-review",
      description: args.description,
      address: args.address,
      city: args.city,
      phone: args.phone,
      games: args.games,
      branches: args.branches,
      defaultPricing: args.defaultPricing,
      createdAt: now,
      updatedAt: now,
    });

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
    branches: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          address: v.optional(v.string()),
          capacity: v.optional(v.number()),
          isActive: v.optional(v.boolean()),
        })
      )
    ),
    defaultPricing: v.optional(
      v.object({
        hourlyRate: v.number(),
        currency: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { zoneId, ...updates } = args;

    const updateData: Record<string, unknown> = { updatedAt: Date.now() };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.address !== undefined) updateData.address = updates.address;
    if (updates.city !== undefined) updateData.city = updates.city;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.games !== undefined) updateData.games = updates.games;
    if (updates.branches !== undefined) updateData.branches = updates.branches;
    if (updates.defaultPricing !== undefined) updateData.defaultPricing = updates.defaultPricing;

    await ctx.db.patch(zoneId, updateData);
    return true;
  },
});

// Approve zone (super admin)
export const approve = mutation({
  args: { zoneId: v.id("zones") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.zoneId, {
      status: "active",
      approvedAt: Date.now(),
      updatedAt: Date.now(),
    });
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
    timeStart: v.optional(v.string()),
    timeEnd: v.optional(v.string()),
    daysOfWeek: v.optional(v.array(v.number())),
    priceMultiplier: v.optional(v.number()),
    flatRate: v.optional(v.number()),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const ruleId = await ctx.db.insert("pricingRules", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });

    return ruleId;
  },
});

// Update pricing rule
export const updatePricingRule = mutation({
  args: {
    ruleId: v.id("pricingRules"),
    isEnabled: v.optional(v.boolean()),
    priority: v.optional(v.number()),
    timeStart: v.optional(v.string()),
    timeEnd: v.optional(v.string()),
    daysOfWeek: v.optional(v.array(v.number())),
    priceMultiplier: v.optional(v.number()),
    flatRate: v.optional(v.number()),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { ruleId, ...updates } = args;

    const updateData: Record<string, unknown> = { updatedAt: Date.now() };
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateData[key] = value;
      }
    });

    await ctx.db.patch(ruleId, updateData);
    return true;
  },
});

// Delete pricing rule
export const deletePricingRule = mutation({
  args: { ruleId: v.id("pricingRules") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.ruleId);
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
    capacity: v.optional(v.number()),
    hourlyRate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const resourceId = await ctx.db.insert("zoneResources", {
      ...args,
      lifecycleStatus: "available",
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
    await ctx.db.delete(args.resourceId);
    return true;
  },
});

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ============================================
// QUERIES
// ============================================

// Get report by ID
export const getById = query({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.reportId);
  },
});

// List reports by reporter
export const listByReporter = query({
  args: { reporterUid: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("reports")
      .withIndex("by_reporterUid", (q) => q.eq("reporterUid", args.reporterUid))
      .order("desc")
      .collect();
  },
});

// List reports by status (for admin)
export const listByStatus = query({
  args: {
    status: v.union(
      v.literal("pending"),
      v.literal("reviewed"),
      v.literal("resolved")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("reports")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .order("desc")
      .collect();
  },
});

// List all pending reports (for admin)
export const listPending = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("reports")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .collect();
  },
});

// ============================================
// MUTATIONS
// ============================================

// Create a report
export const create = mutation({
  args: {
    reporterUid: v.id("users"),
    type: v.union(
      v.literal("matchroom_complaint"),
      v.literal("user_report"),
      v.literal("zone_complaint")
    ),
    matchroomId: v.optional(v.id("matchrooms")),
    reportedUserId: v.optional(v.id("users")),
    zoneId: v.optional(v.id("zones")),
    game: v.optional(v.string()),
    reason: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const reportId = await ctx.db.insert("reports", {
      reporterUid: args.reporterUid,
      type: args.type,
      status: "pending",
      matchroomId: args.matchroomId,
      reportedUserId: args.reportedUserId,
      zoneId: args.zoneId,
      game: args.game,
      reason: args.reason,
      description: args.description,
      createdAt: now,
      updatedAt: now,
    });

    return reportId;
  },
});

// Update report status (admin)
export const updateStatus = mutation({
  args: {
    reportId: v.id("reports"),
    status: v.union(
      v.literal("pending"),
      v.literal("reviewed"),
      v.literal("resolved")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reportId, {
      status: args.status,
      updatedAt: Date.now(),
    });
    return true;
  },
});

// Delete report
export const remove = mutation({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.reportId);
    return true;
  },
});

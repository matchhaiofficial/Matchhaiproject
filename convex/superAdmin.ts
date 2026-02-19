import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser, requireRole } from "./lib/auth";
import { sendNotification } from "./lib/notifications";

export const reviewZoneRegistration = mutation({
  args: {
    zoneId: v.id("zones"),
    decision: v.union(v.literal("approve"), v.literal("deny")),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { role } = await requireUser(ctx);
    requireRole(role, ["superAdmin"]);

    const zone = await ctx.db.get(args.zoneId);
    if (!zone) throw new ConvexError("Zone not found.");

    const now = Date.now();
    if (args.decision === "approve") {
      await ctx.db.patch(zone._id, {
        status: "active",
        rejectionReason: undefined,
        updatedAt: now,
      });

      await sendNotification(ctx, {
        type: "zone_registration_approved",
        toUid: zone.ownerUid,
        status: "pending",
        title: "Venue approved",
        message: "Your venue registration was approved.",
        meta: { zoneId: zone._id },
      });

      return { ok: true };
    }

    await ctx.db.patch(zone._id, {
      status: "rejected",
      rejectionReason: args.rejectionReason ?? "Rejected",
      updatedAt: now,
    });

    await sendNotification(ctx, {
      type: "zone_registration_rejected",
      toUid: zone.ownerUid,
      status: "pending",
      title: "Venue rejected",
      message: args.rejectionReason ?? "Your venue registration was rejected.",
      meta: { zoneId: zone._id },
    });

    return { ok: true };
  },
});

export const setUserRole = mutation({
  args: {
    uid: v.string(),
    role: v.union(v.literal("player"), v.literal("zoneAdmin"), v.literal("superAdmin")),
  },
  handler: async (ctx, args) => {
    const { role } = await requireUser(ctx);
    requireRole(role, ["superAdmin"]);

    const user = await ctx.db
      .query("users")
      .withIndex("by_uid", (q: any) => q.eq("uid", args.uid))
      .unique();
    if (!user) throw new ConvexError("User not found.");

    await ctx.db.patch(user._id, {
      role: args.role,
      updatedAt: Date.now(),
    });

    return { ok: true };
  },
});

export const listReports = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { role } = await requireUser(ctx);
    requireRole(role, ["superAdmin"]);

    if (args.status) {
      return await ctx.db
        .query("reports")
        .withIndex("by_status", (q: any) => q.eq("status", args.status))
        .order("desc")
        .collect();
    }

    return await ctx.db.query("reports").order("desc").collect();
  },
});

export const resolveReport = mutation({
  args: {
    reportId: v.id("reports"),
    status: v.optional(v.string()),
    resolutionNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, role } = await requireUser(ctx);
    requireRole(role, ["superAdmin"]);

    const report = await ctx.db.get(args.reportId);
    if (!report) throw new ConvexError("Report not found.");

    await ctx.db.patch(report._id, {
      status: args.status ?? "resolved",
      resolvedByUid: user.uid,
      resolvedAt: Date.now(),
      updatedAt: Date.now(),
      legacy: {
        ...(report.legacy || {}),
        resolutionNote: args.resolutionNote ?? null,
      },
    });

    return { ok: true };
  },
});

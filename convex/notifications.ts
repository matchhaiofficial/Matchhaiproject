import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";

export const listNotifications = query({
  args: {
    limit: v.optional(v.number()),
    cursorCreatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const limit = Math.min(Math.max(args.limit ?? 30, 1), 100);

    let q = ctx.db
      .query("notifications")
      .withIndex("by_toUid_createdAt", (q) => q.eq("toUid", user.uid))
      .order("desc");

    if (args.cursorCreatedAt) {
      q = q.filter((q) => q.lt(q.field("createdAt"), args.cursorCreatedAt!));
    }

    const items = await q.take(limit);
    const nextCursor =
      items.length > 0 ? (items[items.length - 1].createdAt as number) : null;

    return { items, nextCursor };
  },
});

export const markNotificationRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const notif = await ctx.db.get(args.id);
    if (!notif) return { ok: false, message: "Notification not found." };
    if (notif.toUid !== user.uid) return { ok: false, message: "Not authorized." };

    await ctx.db.patch(args.id, {
      isRead: true,
      status: notif.status === "pending" ? "seen" : notif.status,
      updatedAt: Date.now(),
    });

    return { ok: true };
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireUser(ctx);
    const items = await ctx.db
      .query("notifications")
      .withIndex("by_toUid_createdAt", (q) => q.eq("toUid", user.uid))
      .collect();

    const now = Date.now();
    await Promise.all(
      items.map((item) =>
        ctx.db.patch(item._id, {
          isRead: true,
          status: item.status === "pending" ? "seen" : item.status,
          updatedAt: now,
        })
      )
    );

    return { ok: true };
  },
});

export const deleteNotification = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const notif = await ctx.db.get(args.id);
    if (!notif) return { ok: false, message: "Notification not found." };
    if (notif.toUid !== user.uid) return { ok: false, message: "Not authorized." };
    await ctx.db.delete(args.id);
    return { ok: true };
  },
});

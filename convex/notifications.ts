import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ============================================
// QUERIES
// ============================================

// Get notification by ID
export const getById = query({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.notificationId);
  },
});

// List notifications for user
export const listForUser = query({
  args: {
    userId: v.id("users"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("accepted"),
        v.literal("rejected"),
        v.literal("declined"),
        v.literal("read"),
        v.literal("expired")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let notifications;

    if (args.status) {
      notifications = await ctx.db
        .query("notifications")
        .withIndex("by_toUid_and_status", (q) =>
          q.eq("toUid", args.userId).eq("status", args.status!)
        )
        .order("desc")
        .take(args.limit || 50);
    } else {
      notifications = await ctx.db
        .query("notifications")
        .withIndex("by_toUid", (q) => q.eq("toUid", args.userId))
        .order("desc")
        .take(args.limit || 50);
    }

    // Filter out expired notifications
    const now = Date.now();
    return notifications.filter(
      (n) => !n.expiresAt || n.expiresAt > now
    );
  },
});

// List pending notifications for user (for notification badge count)
export const countPending = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_toUid_and_status", (q) =>
        q.eq("toUid", args.userId).eq("status", "pending")
      )
      .collect();

    const now = Date.now();
    return notifications.filter(
      (n) => !n.expiresAt || n.expiresAt > now
    ).length;
  },
});

// Check for existing notification (dedup)
export const checkExists = query({
  args: { entityKey: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("notifications")
      .withIndex("by_entityKey", (q) => q.eq("entityKey", args.entityKey))
      .unique();

    return existing !== null;
  },
});

// ============================================
// MUTATIONS
// ============================================

// Create a notification
export const create = mutation({
  args: {
    toUid: v.id("users"),
    fromUid: v.optional(v.id("users")),
    fromUsername: v.optional(v.string()),
    type: v.union(
      v.literal("friend_request"),
      v.literal("team_invite"),
      v.literal("team_join_request"),
      v.literal("team_join_decision"),
      v.literal("matchroom_invite"),
      v.literal("match_join_request"),
      v.literal("match_cancelled_admin"),
      v.literal("admin_matchroom_created"),
      v.literal("booking_update"),
      v.literal("challenge_received"),
      v.literal("challenge_accepted"),
      v.literal("challenge_rejected"),
      v.literal("match_booking_captain_approval"),
      v.literal("match_seat_invitation"),
      v.literal("team_match_challenge"),
      v.literal("team_match_challenge_update"),
      v.literal("booking_request_accepted"),
      v.literal("booking_request_rejected"),
      v.literal("booking_counter_offer"),
      v.literal("general")
    ),
    entityKey: v.optional(v.string()),
    entityId: v.optional(v.string()),
    teamId: v.optional(v.id("teams")),
    teamName: v.optional(v.string()),
    matchroomId: v.optional(v.id("matchrooms")),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    data: v.optional(v.any()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check for duplicate if entityKey provided
    if (args.entityKey) {
      const existing = await ctx.db
        .query("notifications")
        .withIndex("by_entityKey", (q) => q.eq("entityKey", args.entityKey))
        .unique();

      if (existing) {
        // Return existing notification ID
        return existing._id;
      }
    }

    const notificationId = await ctx.db.insert("notifications", {
      toUid: args.toUid,
      fromUid: args.fromUid,
      fromUsername: args.fromUsername,
      type: args.type,
      status: "pending",
      entityKey: args.entityKey,
      entityId: args.entityId,
      teamId: args.teamId,
      teamName: args.teamName,
      matchroomId: args.matchroomId,
      title: args.title,
      body: args.body,
      data: args.data,
      expiresAt: args.expiresAt,
      createdAt: now,
      updatedAt: now,
    });

    return notificationId;
  },
});

// Update notification status
export const updateStatus = mutation({
  args: {
    notificationId: v.id("notifications"),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("declined"),
      v.literal("read"),
      v.literal("expired")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.notificationId, {
      status: args.status,
      updatedAt: Date.now(),
    });
    return true;
  },
});

// Mark notification as read
export const markAsRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.notificationId, {
      status: "read",
      updatedAt: Date.now(),
    });
    return true;
  },
});

// Mark all notifications as read for user
export const markAllAsRead = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const pendingNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_toUid_and_status", (q) =>
        q.eq("toUid", args.userId).eq("status", "pending")
      )
      .collect();

    const now = Date.now();
    for (const notification of pendingNotifications) {
      await ctx.db.patch(notification._id, {
        status: "read",
        updatedAt: now,
      });
    }

    return pendingNotifications.length;
  },
});

// Delete notification
export const remove = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.notificationId);
    return true;
  },
});

// Delete all notifications for user
export const removeAllForUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_toUid", (q) => q.eq("toUid", args.userId))
      .collect();

    for (const notification of notifications) {
      await ctx.db.delete(notification._id);
    }

    return notifications.length;
  },
});

// List notifications by sender (outgoing notifications for a user)
export const listByFromUid = query({
  args: {
    fromUid: v.id("users"),
    type: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("accepted"),
        v.literal("rejected"),
        v.literal("declined"),
        v.literal("read"),
        v.literal("expired")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let notifications = await ctx.db
      .query("notifications")
      .withIndex("by_fromUid", (q) => q.eq("fromUid", args.fromUid))
      .order("desc")
      .take(args.limit || 50);

    // Filter by type if provided
    if (args.type) {
      notifications = notifications.filter((n) => n.type === args.type);
    }

    // Filter by status if provided
    if (args.status) {
      notifications = notifications.filter((n) => n.status === args.status);
    }

    return notifications;
  },
});

// List pending join requests for a matchroom (for hosts/admins)
export const listMatchroomJoinRequests = query({
  args: {
    matchroomId: v.id("matchrooms"),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_matchroomId", (q) => q.eq("matchroomId", args.matchroomId))
      .order("desc")
      .collect();

    // Filter to match_join_request type and optionally by status
    let filtered = notifications.filter((n) => n.type === "match_join_request");

    if (args.status) {
      filtered = filtered.filter((n) => n.status === args.status);
    }

    return filtered;
  },
});

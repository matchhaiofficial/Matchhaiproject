import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";

// ============================================
// FRIENDSHIP QUERIES
// ============================================

// List friends for user
export const listFriends = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const friendships = await ctx.db
      .query("friendships")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    // Get friend user data
    const friends = await Promise.all(
      friendships.map(async (f) => {
        const friend = await ctx.db.get(f.friendId);
        return friend
          ? {
              friendshipId: f._id,
              friendId: f.friendId,
              username: f.friendUsername,
              fullName: friend.fullName,
              photoURL: friend.photoURL,
              isOnline: friend.isOnline,
              createdAt: f.createdAt,
            }
          : null;
      })
    );

    return friends.filter((f) => f !== null);
  },
});

// Check if two users are friends
export const areFriends = query({
  args: {
    userId: v.id("users"),
    friendId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const friendship = await ctx.db
      .query("friendships")
      .withIndex("by_userId_and_friendId", (q) =>
        q.eq("userId", args.userId).eq("friendId", args.friendId)
      )
      .unique();

    return friendship !== null;
  },
});

// ============================================
// BLOCK QUERIES
// ============================================

// List blocked users
export const listBlocked = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const blocks = await ctx.db
      .query("userBlocks")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    // Get blocked user data
    const blockedUsers = await Promise.all(
      blocks.map(async (b) => {
        const user = await ctx.db.get(b.blockedUserId);
        return user
          ? {
              blockId: b._id,
              userId: b.blockedUserId,
              username: user.username,
              fullName: user.fullName,
              photoURL: user.photoURL,
              createdAt: b.createdAt,
            }
          : null;
      })
    );

    return blockedUsers.filter((u) => u !== null);
  },
});

// Check if user is blocked
export const isBlocked = query({
  args: {
    userId: v.id("users"),
    blockedUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const block = await ctx.db
      .query("userBlocks")
      .withIndex("by_userId_and_blockedUserId", (q) =>
        q.eq("userId", args.userId).eq("blockedUserId", args.blockedUserId)
      )
      .unique();

    return block !== null;
  },
});

// Check if either user has blocked the other
export const isEitherBlocked = query({
  args: {
    userId1: v.id("users"),
    userId2: v.id("users"),
  },
  handler: async (ctx, args) => {
    const block1 = await ctx.db
      .query("userBlocks")
      .withIndex("by_userId_and_blockedUserId", (q) =>
        q.eq("userId", args.userId1).eq("blockedUserId", args.userId2)
      )
      .unique();

    if (block1) return true;

    const block2 = await ctx.db
      .query("userBlocks")
      .withIndex("by_userId_and_blockedUserId", (q) =>
        q.eq("userId", args.userId2).eq("blockedUserId", args.userId1)
      )
      .unique();

    return block2 !== null;
  },
});

// ============================================
// FRIENDSHIP MUTATIONS
// ============================================

// Send friend request
export const sendFriendRequest = mutation({
  args: {
    fromUid: v.id("users"),
    fromUsername: v.string(),
    toUid: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Check if already friends
    const existingFriendship = await ctx.db
      .query("friendships")
      .withIndex("by_userId_and_friendId", (q) =>
        q.eq("userId", args.fromUid).eq("friendId", args.toUid)
      )
      .unique();

    if (existingFriendship) {
      throw new Error("You are already friends with this user");
    }

    // Check if either has blocked the other
    const blocked1 = await ctx.db
      .query("userBlocks")
      .withIndex("by_userId_and_blockedUserId", (q) =>
        q.eq("userId", args.fromUid).eq("blockedUserId", args.toUid)
      )
      .unique();

    const blocked2 = await ctx.db
      .query("userBlocks")
      .withIndex("by_userId_and_blockedUserId", (q) =>
        q.eq("userId", args.toUid).eq("blockedUserId", args.fromUid)
      )
      .unique();

    if (blocked1 || blocked2) {
      throw new Error("Cannot send friend request - user blocked");
    }

    // Create dedup key
    const entityKey = `friend_request:${args.fromUid}:${args.toUid}`;

    // Check for existing pending request
    const existingRequest = await ctx.db
      .query("notifications")
      .withIndex("by_entityKey", (q) => q.eq("entityKey", entityKey))
      .unique();

    if (existingRequest && existingRequest.status === "pending") {
      throw new Error("Friend request already sent");
    }

    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    // Create notification
    const notificationId = await ctx.db.insert("notifications", {
      toUid: args.toUid,
      fromUid: args.fromUid,
      fromUsername: args.fromUsername,
      type: "friend_request",
      status: "pending",
      entityKey,
      entityId: args.fromUid,
      title: "New Friend Request",
      body: `${args.fromUsername} wants to be your friend`,
      expiresAt: now + sevenDaysMs,
      createdAt: now,
      updatedAt: now,
    });

    return notificationId;
  },
});

// Respond to friend request
export const respondFriendRequest = mutation({
  args: {
    notificationId: v.id("notifications"),
    accept: v.boolean(),
  },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) throw new Error("Notification not found");
    if (notification.type !== "friend_request") {
      throw new Error("Not a friend request");
    }
    if (notification.status !== "pending") {
      throw new Error("Request already responded to");
    }

    const now = Date.now();

    if (args.accept && notification.fromUid) {
      // Get usernames
      const fromUser = await ctx.db.get(notification.fromUid);
      const toUser = await ctx.db.get(notification.toUid);

      if (!fromUser || !toUser) {
        throw new Error("User not found");
      }

      // Create bidirectional friendship
      await ctx.db.insert("friendships", {
        userId: notification.fromUid,
        friendId: notification.toUid,
        friendUsername: toUser.username,
        createdAt: now,
      });

      await ctx.db.insert("friendships", {
        userId: notification.toUid,
        friendId: notification.fromUid,
        friendUsername: fromUser.username,
        createdAt: now,
      });
    }

    // Update notification
    await ctx.db.patch(args.notificationId, {
      status: args.accept ? "accepted" : "rejected",
      updatedAt: now,
    });

    return true;
  },
});

// Remove friend
export const removeFriend = mutation({
  args: {
    userId: v.id("users"),
    friendId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Delete both directions
    const friendship1 = await ctx.db
      .query("friendships")
      .withIndex("by_userId_and_friendId", (q) =>
        q.eq("userId", args.userId).eq("friendId", args.friendId)
      )
      .unique();

    const friendship2 = await ctx.db
      .query("friendships")
      .withIndex("by_userId_and_friendId", (q) =>
        q.eq("userId", args.friendId).eq("friendId", args.userId)
      )
      .unique();

    if (friendship1) await ctx.db.delete(friendship1._id);
    if (friendship2) await ctx.db.delete(friendship2._id);

    return true;
  },
});

// ============================================
// BLOCK MUTATIONS
// ============================================

// Block user
export const blockUser = mutation({
  args: {
    userId: v.id("users"),
    blockedUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Check if already blocked
    const existingBlock = await ctx.db
      .query("userBlocks")
      .withIndex("by_userId_and_blockedUserId", (q) =>
        q.eq("userId", args.userId).eq("blockedUserId", args.blockedUserId)
      )
      .unique();

    if (existingBlock) {
      return existingBlock._id; // Already blocked
    }

    // Remove any existing friendship
    const friendship1 = await ctx.db
      .query("friendships")
      .withIndex("by_userId_and_friendId", (q) =>
        q.eq("userId", args.userId).eq("friendId", args.blockedUserId)
      )
      .unique();

    const friendship2 = await ctx.db
      .query("friendships")
      .withIndex("by_userId_and_friendId", (q) =>
        q.eq("userId", args.blockedUserId).eq("friendId", args.userId)
      )
      .unique();

    if (friendship1) await ctx.db.delete(friendship1._id);
    if (friendship2) await ctx.db.delete(friendship2._id);

    // Create block record
    const blockId = await ctx.db.insert("userBlocks", {
      userId: args.userId,
      blockedUserId: args.blockedUserId,
      createdAt: Date.now(),
    });

    return blockId;
  },
});

// Unblock user
export const unblockUser = mutation({
  args: {
    userId: v.id("users"),
    blockedUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const block = await ctx.db
      .query("userBlocks")
      .withIndex("by_userId_and_blockedUserId", (q) =>
        q.eq("userId", args.userId).eq("blockedUserId", args.blockedUserId)
      )
      .unique();

    if (block) {
      await ctx.db.delete(block._id);
    }

    return true;
  },
});

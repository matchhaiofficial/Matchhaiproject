import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { isUserHiddenFromPublic } from "./userVisibility";

function doesUserPlayGame(friend: any, game: string) {
  switch (game) {
    case "cs2":
      return !!friend?.playsCs2;
    case "cs16":
      return !!friend?.playsCs16;
    case "valorant":
      return !!friend?.playsValorant;
    case "fc25":
    case "fc26":
      return !!friend?.playsFc;
    case "tekken8":
      return !!friend?.playsTekken;
    case "futsal":
      return !!friend?.playsFutsal;
    case "indoor_cricket":
      return !!friend?.playsIndoorCricket;
    case "padel":
      return !!friend?.playsPadel;
    case "pickleball":
      return !!friend?.playsPickleball;
    default:
      return false;
  }
}

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
    const now = Date.now();
    const PRESENCE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
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
              isOnline: !!(friend.isOnline && friend.lastActiveAt && (now - friend.lastActiveAt) < PRESENCE_TIMEOUT_MS),
              playsCs2: !!friend.playsCs2,
              playsCs16: !!friend.playsCs16,
              playsValorant: !!friend.playsValorant,
              playsFc: !!friend.playsFc,
              playsTekken: !!friend.playsTekken,
              playsFutsal: !!friend.playsFutsal,
              playsIndoorCricket: !!friend.playsIndoorCricket,
              playsPadel: !!friend.playsPadel,
              playsPickleball: !!friend.playsPickleball,
              createdAt: f.createdAt,
            }
          : null;
      })
    );

    return friends.filter((f) => f !== null);
  },
});

// List friends who are eligible for a specific game
export const listFriendsForGame = query({
  args: {
    userId: v.id("users"),
    game: v.string(),
  },
  handler: async (ctx, args) => {
    const friendships = await ctx.db
      .query("friendships")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const now = Date.now();
    const PRESENCE_TIMEOUT_MS = 2 * 60 * 1000;
    const friends = await Promise.all(
      friendships.map(async (f) => {
        const friend = await ctx.db.get(f.friendId);
        if (!friend || !doesUserPlayGame(friend, args.game)) return null;

        // Mark users already in an active team for this game (so we can disable inviting them).
        let inTeam = false;
        let teamName: string | null = null;
        try {
          const memberships = await ctx.db
            .query("teamMembers")
            .withIndex("by_userId", (q) => q.eq("odxerId", f.friendId))
            .collect();
          for (const membership of memberships) {
            const team = await ctx.db.get(membership.teamId);
            if (!team) continue;
            if (team.status === "deleted" || Boolean((team as any).deletedAt)) continue;
            if (String(team.game || "").toLowerCase() !== String(args.game || "").toLowerCase()) continue;
            inTeam = true;
            teamName = team.name || null;
            break;
          }
        } catch {
          // Ignore eligibility failures.
        }

        return {
          friendshipId: f._id,
          friendId: f.friendId,
          username: f.friendUsername,
          fullName: friend.fullName,
          photoURL: friend.photoURL,
          isOnline: !!(friend.isOnline && friend.lastActiveAt && (now - friend.lastActiveAt) < PRESENCE_TIMEOUT_MS),
          inTeam,
          teamName,
          playsCs2: !!friend.playsCs2,
          playsCs16: !!friend.playsCs16,
          playsValorant: !!friend.playsValorant,
          playsFc: !!friend.playsFc,
          playsTekken: !!friend.playsTekken,
          playsFutsal: !!friend.playsFutsal,
          playsIndoorCricket: !!friend.playsIndoorCricket,
          playsPadel: !!friend.playsPadel,
          playsPickleball: !!friend.playsPickleball,
          createdAt: f.createdAt,
        };
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
  handler: async (ctx, args): Promise<any> => {
    // Super Admin / hidden accounts are not social entities and cannot be
    // friended (defense-in-depth: they never appear in discovery/search either).
    const target = await ctx.db.get(args.toUid);
    if (!target || isUserHiddenFromPublic(target)) {
      throw new Error("This user is not available.");
    }

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
    const entityKey = `social.friend_request:${args.fromUid}:${args.toUid}`;

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

    const notificationResult: any = await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      toUid: args.toUid,
      fromUid: args.fromUid,
      fromUsername: args.fromUsername,
      type: "social.friend_request",
      status: "pending",
      dedupeKey: entityKey,
      dedupePolicy: "upsert_active",
      entityId: String(args.fromUid),
      route: "/(player)/inbox",
      title: "New Friend Request",
      body: `${args.fromUsername} wants to be your friend`,
      expiresAt: now + sevenDaysMs,
      data: {
        href: "/(player)/inbox",
      },
    });

    return notificationResult.notificationId;
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
    if (!["friend_request", "social.friend_request"].includes(String(notification.type || ""))) {
      throw new Error("Not a friend request");
    }
    if (notification.status !== "pending") {
      throw new Error("Request already responded to");
    }

    const now = Date.now();
    const decision = args.accept ? "accepted" : "rejected";

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
      status: decision,
      updatedAt: now,
    });

    if (notification.fromUid) {
      const responder = await ctx.db.get(notification.toUid);
      await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
        toUid: notification.fromUid,
        fromUid: notification.toUid,
        fromUsername: responder?.username || "Player",
        type: "social.friend_request_result",
        status: "pending",
        dedupeKey: `social.friend_request_result:${String(notification._id)}`,
        dedupePolicy: "replace_active",
        entity: { kind: "friend_request", id: String(notification._id) },
        entityId: String(notification._id),
        route: "/(player)/inbox",
        title: args.accept ? "Friend Request Accepted" : "Friend Request Rejected",
        body: args.accept
          ? `${responder?.username || "A player"} accepted your friend request.`
          : `${responder?.username || "A player"} declined your friend request.`,
        data: {
          href: "/(player)/inbox",
          requestNotificationId: String(notification._id),
          decision,
        },
      });
    }

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

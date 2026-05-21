// src/services/convex/socialService.ts
// Convex-based social service for friends and blocks

import { convex } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { currentUser } from "./authService";
import { getUserFacingErrorMessage } from "../../utils/userFacingErrors";

export interface Friend {
  friendshipId: string;
  friendId: string;
  username: string;
  fullName?: string;
  photoURL?: string;
  isOnline?: boolean;
  createdAt: number;
}

export interface BlockedUser {
  blockId: string;
  userId: string;
  username: string;
  fullName?: string;
  photoURL?: string;
  createdAt: number;
}

type SuccessResult<T> = { ok: true; data?: T; message?: string };
type ErrorResult = { ok: false; message: string };
type Result<T = void> = SuccessResult<T> | ErrorResult;

export interface SendFriendRequestInput {
  toUid: string;
}

export interface RespondFriendRequestInput {
  notificationId: string;
  decision: "accept" | "decline";
}

async function resolveAnyUserId(value: string): Promise<Id<"users"> | null> {
  try {
    const directUser = await convex.query(api.users.getById, {
      userId: value as Id<"users">,
    });
    if (directUser) return directUser._id;
  } catch {
    // Ignore invalid direct-id attempts and fall back to authId lookup.
  }

  try {
    const authUser = await convex.query(api.users.getByAuthId, { authId: value });
    if (authUser) return authUser._id;
  } catch {
    // Ignore lookup failures and return null below.
  }

  return null;
}

async function getCurrentIdentity() {
  const authUser = await currentUser();
  if (!authUser) {
    throw new Error("Not authenticated");
  }

  const convexUser = await convex.query(api.users.getByAuthId, { authId: authUser.id });
  if (!convexUser) {
    throw new Error("User profile not found");
  }

  return {
    authId: authUser.id,
    convexId: convexUser._id,
    username: convexUser.username,
  };
}

/**
 * Get friends list for a user
 */
export async function getFriends(userAuthId: string): Promise<Result<Friend[]>> {
  try {
    const user = await convex.query(api.users.getByAuthId, { authId: userAuthId });
    if (!user) {
      return { ok: false, message: "User not found" };
    }

    const friends = await convex.query(api.social.listFriends, {
      userId: user._id,
    });

    return {
      ok: true,
      data: friends.map((f: any) => ({
        friendshipId: f.friendshipId,
        friendId: f.friendId,
        username: f.username,
        fullName: f.fullName,
        photoURL: f.photoURL,
        isOnline: f.isOnline,
        createdAt: f.createdAt,
      })),
    };
  } catch (error: any) {
    console.error("[socialService] getFriends error:", error);
    return { ok: false, message: "Failed to fetch friends" };
  }
}

/**
 * Check if two users are friends
 */
export async function areFriends(
  userAuthId: string,
  friendAuthId: string
): Promise<Result<boolean>> {
  try {
    const [user, friend] = await Promise.all([
      convex.query(api.users.getByAuthId, { authId: userAuthId }),
      convex.query(api.users.getByAuthId, { authId: friendAuthId }),
    ]);

    if (!user || !friend) {
      return { ok: true, data: false };
    }

    const result = await convex.query(api.social.areFriends, {
      userId: user._id,
      friendId: friend._id,
    });

    return { ok: true, data: result };
  } catch (error: any) {
    console.error("[socialService] areFriends error:", error);
    return { ok: false, message: "Failed to check friendship" };
  }
}

/**
 * Send friend request
 */
export async function sendFriendRequest(
  fromAuthId: string,
  fromUsername: string,
  toAuthId: string
): Promise<Result<{ notificationId: string }>> {
  try {
    const [fromUser, toUser] = await Promise.all([
      convex.query(api.users.getByAuthId, { authId: fromAuthId }),
      convex.query(api.users.getByAuthId, { authId: toAuthId }),
    ]);

    if (!fromUser) {
      return { ok: false, message: "Sender not found" };
    }
    if (!toUser) {
      return { ok: false, message: "Recipient not found" };
    }

    const notificationId = await convex.mutation(api.social.sendFriendRequest, {
      fromUid: fromUser._id,
      fromUsername,
      toUid: toUser._id,
    });

    return { ok: true, data: { notificationId } };
  } catch (error: any) {
    console.error("[socialService] sendFriendRequest error:", error);
    return { ok: false, message: getUserFacingErrorMessage(error, "Failed to send friend request") };
  }
}

export async function sendFriendRequestToUser(
  data: SendFriendRequestInput
): Promise<Result<{ notificationId: string }>> {
  try {
    const me = await getCurrentIdentity();
    const toConvexId = await resolveAnyUserId(data.toUid);

    if (!toConvexId) {
      return { ok: false, message: "Recipient not found" };
    }

    if (String(me.convexId) === String(toConvexId)) {
      return { ok: false, message: "Cannot add self" };
    }

    const notificationId = await convex.mutation(api.social.sendFriendRequest, {
      fromUid: me.convexId,
      fromUsername: me.username,
      toUid: toConvexId,
    });

    return { ok: true, data: { notificationId }, message: "Request sent." };
  } catch (error: any) {
    console.error("[socialService] sendFriendRequestToUser error:", error);
    return { ok: false, message: getUserFacingErrorMessage(error, "Failed to send friend request") };
  }
}

/**
 * Respond to friend request
 */
export async function respondFriendRequest(
  notificationId: string,
  accept: boolean
): Promise<Result> {
  try {
    await convex.mutation(api.social.respondFriendRequest, {
      notificationId: notificationId as Id<"notifications">,
      accept,
    });
    return { ok: true };
  } catch (error: any) {
    console.error("[socialService] respondFriendRequest error:", error);
    return { ok: false, message: getUserFacingErrorMessage(error, "Failed to respond to friend request") };
  }
}

export async function respondFriendRequestDecision(
  data: RespondFriendRequestInput
): Promise<Result> {
  return respondFriendRequest(data.notificationId, data.decision === "accept");
}

/**
 * Remove a friend
 */
export async function removeFriend(
  userAuthId: string,
  friendAuthId: string
): Promise<Result> {
  try {
    const [user, friend] = await Promise.all([
      convex.query(api.users.getByAuthId, { authId: userAuthId }),
      convex.query(api.users.getByAuthId, { authId: friendAuthId }),
    ]);

    if (!user || !friend) {
      return { ok: false, message: "User not found" };
    }

    await convex.mutation(api.social.removeFriend, {
      userId: user._id,
      friendId: friend._id,
    });

    return { ok: true };
  } catch (error: any) {
    console.error("[socialService] removeFriend error:", error);
    return { ok: false, message: "Failed to remove friend" };
  }
}

/**
 * Get blocked users list
 */
export async function getBlockedUsers(userAuthId: string): Promise<Result<BlockedUser[]>> {
  try {
    const user = await convex.query(api.users.getByAuthId, { authId: userAuthId });
    if (!user) {
      return { ok: false, message: "User not found" };
    }

    const blocked = await convex.query(api.social.listBlocked, {
      userId: user._id,
    });

    return {
      ok: true,
      data: blocked.map((b: any) => ({
        blockId: b.blockId,
        userId: b.userId,
        username: b.username,
        fullName: b.fullName,
        photoURL: b.photoURL,
        createdAt: b.createdAt,
      })),
    };
  } catch (error: any) {
    console.error("[socialService] getBlockedUsers error:", error);
    return { ok: false, message: "Failed to fetch blocked users" };
  }
}

/**
 * Check if user has blocked another user
 */
export async function isBlocked(
  userAuthId: string,
  blockedAuthId: string
): Promise<Result<boolean>> {
  try {
    const [user, blocked] = await Promise.all([
      convex.query(api.users.getByAuthId, { authId: userAuthId }),
      convex.query(api.users.getByAuthId, { authId: blockedAuthId }),
    ]);

    if (!user || !blocked) {
      return { ok: true, data: false };
    }

    const result = await convex.query(api.social.isBlocked, {
      userId: user._id,
      blockedUserId: blocked._id,
    });

    return { ok: true, data: result };
  } catch (error: any) {
    console.error("[socialService] isBlocked error:", error);
    return { ok: false, message: "Failed to check block status" };
  }
}

/**
 * Check if either user has blocked the other
 */
export async function isEitherBlocked(
  userAuthId1: string,
  userAuthId2: string
): Promise<Result<boolean>> {
  try {
    const [user1, user2] = await Promise.all([
      convex.query(api.users.getByAuthId, { authId: userAuthId1 }),
      convex.query(api.users.getByAuthId, { authId: userAuthId2 }),
    ]);

    if (!user1 || !user2) {
      return { ok: true, data: false };
    }

    const result = await convex.query(api.social.isEitherBlocked, {
      userId1: user1._id,
      userId2: user2._id,
    });

    return { ok: true, data: result };
  } catch (error: any) {
    console.error("[socialService] isEitherBlocked error:", error);
    return { ok: false, message: "Failed to check block status" };
  }
}

/**
 * Block a user
 */
export async function blockUser(
  userAuthId: string,
  blockedAuthId: string
): Promise<Result<{ blockId: string }>> {
  try {
    const [user, blocked] = await Promise.all([
      convex.query(api.users.getByAuthId, { authId: userAuthId }),
      convex.query(api.users.getByAuthId, { authId: blockedAuthId }),
    ]);

    if (!user) {
      return { ok: false, message: "User not found" };
    }
    if (!blocked) {
      return { ok: false, message: "User to block not found" };
    }

    const blockId = await convex.mutation(api.social.blockUser, {
      userId: user._id,
      blockedUserId: blocked._id,
    });

    return { ok: true, data: { blockId } };
  } catch (error: any) {
    console.error("[socialService] blockUser error:", error);
    return { ok: false, message: "Failed to block user" };
  }
}

/**
 * Unblock a user
 */
export async function unblockUser(
  userAuthId: string,
  blockedAuthId: string
): Promise<Result> {
  try {
    const [user, blocked] = await Promise.all([
      convex.query(api.users.getByAuthId, { authId: userAuthId }),
      convex.query(api.users.getByAuthId, { authId: blockedAuthId }),
    ]);

    if (!user || !blocked) {
      return { ok: false, message: "User not found" };
    }

    await convex.mutation(api.social.unblockUser, {
      userId: user._id,
      blockedUserId: blocked._id,
    });

    return { ok: true };
  } catch (error: any) {
    console.error("[socialService] unblockUser error:", error);
    return { ok: false, message: "Failed to unblock user" };
  }
}

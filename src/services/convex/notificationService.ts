// src/services/convex/notificationService.ts
// Convex-based notification service

import { convex } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

export type NotificationType =
  | "friend_request"
  | "team_invite"
  | "team_join_request"
  | "team_join_decision"
  | "matchroom_invite"
  | "match_join_request"
  | "match_cancelled_admin"
  | "admin_matchroom_created"
  | "booking_update"
  | "challenge_received"
  | "challenge_accepted"
  | "challenge_rejected"
  | "match_booking_captain_approval"
  | "match_seat_invitation"
  | "team_match_challenge"
  | "team_match_challenge_update"
  | "booking_request_accepted"
  | "booking_request_rejected"
  | "booking_counter_offer"
  | "general";

export type NotificationStatus = "pending" | "accepted" | "rejected" | "read" | "expired" | "declined";

export interface Notification {
  id: string;
  _id?: string;
  toUid: string;
  fromUid?: string;
  fromUsername?: string;
  type: NotificationType;
  status: NotificationStatus;
  isRead?: boolean;
  entityKey?: string;
  entityId?: string;
  teamId?: string;
  teamName?: string;
  matchroomId?: string;
  title?: string;
  body?: string;
  message?: string;
  reason?: string;
  meta?: {
    teamId?: string;
    teamName?: string;
    game?: string;
    gameKey?: string;
    requesterSnapshot?: {
      city?: string;
      skillTier?: Record<string, string>;
      linked?: { steam?: boolean; faceit?: boolean; psn?: boolean; xbox?: boolean };
    };
    matchroomId?: string;
    matchroomTitle?: string;
    intentId?: string;
    side?: string;
    role?: string;
    challengeId?: string;
    challengerTeamName?: string;
    opponentTeamName?: string;
    reason?: string;
    note?: string;
  };
  data?: any;
  expiresAt?: number;
  createdAt: number;
  updatedAt?: number;
}

type SuccessResult<T> = { ok: true; data?: T; message?: string };
type ErrorResult = { ok: false; message: string };
type Result<T = void> = SuccessResult<T> | ErrorResult;

/**
 * Transform Convex notification to our interface
 */
function transformNotification(notif: any): Notification {
  return {
    id: notif._id,
    _id: notif._id,
    toUid: notif.toUid,
    fromUid: notif.fromUid,
    fromUsername: notif.fromUsername,
    type: notif.type,
    status: notif.status,
    isRead: notif.status === "read",
    entityKey: notif.entityKey,
    entityId: notif.entityId,
    teamId: notif.teamId,
    teamName: notif.teamName,
    matchroomId: notif.matchroomId,
    title: notif.title,
    body: notif.body,
    message: notif.body,
    meta: notif.data,
    data: notif.data,
    expiresAt: notif.expiresAt,
    createdAt: notif.createdAt,
    updatedAt: notif.updatedAt,
  };
}

/**
 * Get notifications for a user
 */
export async function getNotifications(
  userAuthId: string,
  options?: { status?: NotificationStatus; limit?: number }
): Promise<Result<Notification[]>> {
  try {
    // First get the Convex user ID
    const user = await convex.query(api.users.getByAuthId, { authId: userAuthId });
    if (!user) {
      return { ok: false, message: "User not found" };
    }

    const notifications = await convex.query(api.notifications.listForUser, {
      userId: user._id,
      status: options?.status as any,
      limit: options?.limit,
    });

    return {
      ok: true,
      data: notifications.map(transformNotification),
    };
  } catch (error: any) {
    console.error("[notificationService] getNotifications error:", error);
    return { ok: false, message: "Failed to fetch notifications" };
  }
}

/**
 * Get pending notification count
 */
export async function getPendingCount(userAuthId: string): Promise<Result<number>> {
  try {
    const user = await convex.query(api.users.getByAuthId, { authId: userAuthId });
    if (!user) {
      return { ok: false, message: "User not found" };
    }

    const count = await convex.query(api.notifications.countPending, {
      userId: user._id,
    });

    return { ok: true, data: count };
  } catch (error: any) {
    console.error("[notificationService] getPendingCount error:", error);
    return { ok: false, message: "Failed to count pending notifications" };
  }
}

/**
 * Create a notification
 */
export async function createNotification(data: {
  toUid: string;
  fromUid?: string;
  fromUsername?: string;
  type: NotificationType;
  entityKey?: string;
  entityId?: string;
  teamId?: string;
  teamName?: string;
  matchroomId?: string;
  title?: string;
  body?: string;
  data?: any;
  expiresAt?: number;
}): Promise<Result<{ id: string }>> {
  try {
    // Get Convex user IDs
    const toUser = await convex.query(api.users.getByAuthId, { authId: data.toUid });
    if (!toUser) {
      return { ok: false, message: "Recipient user not found" };
    }

    let fromUserId: Id<"users"> | undefined;
    if (data.fromUid) {
      const fromUser = await convex.query(api.users.getByAuthId, { authId: data.fromUid });
      if (fromUser) {
        fromUserId = fromUser._id;
      }
    }

    const notificationId = await convex.mutation(api.notifications.create, {
      toUid: toUser._id,
      fromUid: fromUserId,
      fromUsername: data.fromUsername,
      type: data.type as any,
      entityKey: data.entityKey,
      entityId: data.entityId,
      teamId: data.teamId as any,
      teamName: data.teamName,
      matchroomId: data.matchroomId as any,
      title: data.title,
      body: data.body,
      data: data.data,
      expiresAt: data.expiresAt,
    });

    return { ok: true, data: { id: notificationId } };
  } catch (error: any) {
    console.error("[notificationService] createNotification error:", error);
    return { ok: false, message: "Failed to create notification" };
  }
}

/**
 * Update notification status
 */
export async function updateNotificationStatus(
  notificationId: string,
  status: NotificationStatus
): Promise<Result> {
  try {
    await convex.mutation(api.notifications.updateStatus, {
      notificationId: notificationId as Id<"notifications">,
      status: status as any,
    });
    return { ok: true };
  } catch (error: any) {
    console.error("[notificationService] updateNotificationStatus error:", error);
    return { ok: false, message: "Failed to update notification status" };
  }
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId: string): Promise<Result> {
  try {
    await convex.mutation(api.notifications.markAsRead, {
      notificationId: notificationId as Id<"notifications">,
    });
    return { ok: true };
  } catch (error: any) {
    console.error("[notificationService] markAsRead error:", error);
    return { ok: false, message: "Failed to mark notification as read" };
  }
}

/**
 * Mark all notifications as read for user
 */
export async function markAllAsRead(userAuthId: string): Promise<Result<number>> {
  try {
    const user = await convex.query(api.users.getByAuthId, { authId: userAuthId });
    if (!user) {
      return { ok: false, message: "User not found" };
    }

    const count = await convex.mutation(api.notifications.markAllAsRead, {
      userId: user._id,
    });

    return { ok: true, data: count };
  } catch (error: any) {
    console.error("[notificationService] markAllAsRead error:", error);
    return { ok: false, message: "Failed to mark all as read" };
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string): Promise<Result> {
  try {
    await convex.mutation(api.notifications.remove, {
      notificationId: notificationId as Id<"notifications">,
    });
    return { ok: true };
  } catch (error: any) {
    console.error("[notificationService] deleteNotification error:", error);
    return { ok: false, message: "Failed to delete notification" };
  }
}

/**
 * Delete all notifications for user
 */
export async function deleteAllNotifications(userAuthId: string): Promise<Result<number>> {
  try {
    const user = await convex.query(api.users.getByAuthId, { authId: userAuthId });
    if (!user) {
      return { ok: false, message: "User not found" };
    }

    const count = await convex.mutation(api.notifications.removeAllForUser, {
      userId: user._id,
    });

    return { ok: true, data: count };
  } catch (error: any) {
    console.error("[notificationService] deleteAllNotifications error:", error);
    return { ok: false, message: "Failed to delete notifications" };
  }
}

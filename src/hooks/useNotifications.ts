// src/hooks/useNotifications.ts
// Convex-based real-time notifications hook

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "../context/AuthContext";

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
  _id: string;
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
 * Custom hook for real-time notifications using Convex
 */
export function useNotifications() {
  const { user } = useAuth();
  const userId = user?._id as Id<"users"> | undefined;

  // Real-time query for notifications
  const rawNotifications = useQuery(
    api.notifications.listForUser,
    userId ? { userId, limit: 100 } : "skip"
  );

  // Mutations
  const markAsReadMutation = useMutation(api.notifications.markAsRead);
  const markAllAsReadMutation = useMutation(api.notifications.markAllAsRead);
  const updateStatusMutation = useMutation(api.notifications.updateStatus);
  const removeMutation = useMutation(api.notifications.remove);
  const removeAllMutation = useMutation(api.notifications.removeAllForUser);

  // Transform notifications
  const notifications: Notification[] = rawNotifications
    ? rawNotifications.map(transformNotification).sort((a, b) => b.createdAt - a.createdAt)
    : [];

  const loading = rawNotifications === undefined;

  // Helper functions
  const markAsRead = async (notificationId: string) => {
    await markAsReadMutation({ notificationId: notificationId as Id<"notifications"> });
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    await markAllAsReadMutation({ userId });
  };

  const updateStatus = async (notificationId: string, status: NotificationStatus) => {
    await updateStatusMutation({
      notificationId: notificationId as Id<"notifications">,
      status: status as any,
    });
  };

  const deleteNotification = async (notificationId: string) => {
    await removeMutation({ notificationId: notificationId as Id<"notifications"> });
  };

  const deleteAllNotifications = async () => {
    if (!userId) return;
    await removeAllMutation({ userId });
  };

  // Pending count (excluding expired)
  const pendingCount = notifications.filter((n) => {
    if (n.status !== "pending") return false;
    if (n.expiresAt && n.expiresAt < Date.now()) return false;
    return true;
  }).length;

  return {
    notifications,
    loading,
    pendingCount,
    markAsRead,
    markAllAsRead,
    updateStatus,
    deleteNotification,
    deleteAllNotifications,
  };
}

/**
 * Hook for pending notification count (badge)
 */
export function useNotificationCount() {
  const { user } = useAuth();
  const userId = user?._id as Id<"users"> | undefined;

  const count = useQuery(
    api.notifications.countPending,
    userId ? { userId } : "skip"
  );

  return count ?? 0;
}

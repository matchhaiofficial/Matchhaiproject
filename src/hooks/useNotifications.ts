// src/hooks/useNotifications.ts
// Convex-based real-time notifications hook

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "../context/AuthContext";

export type NotificationType = string;

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
  isArchived?: boolean;
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
    notificationId?: string;
    entityId?: string;
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
    requestId?: string;
    offerId?: string;
    scheduleOptions?: Array<{
      date: string;
      time: string;
    }>;
    expiresAt?: number;
    zoneId?: string;
    branchId?: string;
    branchName?: string;
    side?: string;
    role?: string;
    slotId?: string;
    targetTeam?: string;
    paymentRequired?: boolean;
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

function normalizeGameKey(value: unknown) {
  const gameKey = String(value || "").trim().toLowerCase();
  return gameKey === "fc25" ? "fc26" : gameKey || undefined;
}

function toStringId(value: unknown) {
  return value == null ? undefined : String(value);
}

function transformNotification(notif: any): Notification {
  const rawMeta = (notif.data || {}) as Record<string, any>;
  const canonicalMeta = {
    ...rawMeta,
    notificationId: toStringId(notif._id) || toStringId(rawMeta.notificationId),
    entityId: toStringId(notif.entityId) || toStringId(rawMeta.entityId),
    teamId: toStringId(notif.teamId) || toStringId(rawMeta.teamId),
    teamName: notif.teamName || rawMeta.teamName,
    matchroomId: toStringId(notif.matchroomId) || toStringId(rawMeta.matchroomId),
    intentId: toStringId(rawMeta.intentId),
    requestId: toStringId(rawMeta.requestId),
    offerId: toStringId(rawMeta.offerId),
    scheduleOptions: Array.isArray(rawMeta.scheduleOptions)
      ? rawMeta.scheduleOptions
          .map((option: any) => ({
            date: String(option?.date || "").trim(),
            time: String(option?.time || "").trim(),
          }))
          .filter((option: { date: string; time: string }) => option.date && option.time)
      : undefined,
    expiresAt: typeof rawMeta.expiresAt === "number" ? rawMeta.expiresAt : undefined,
    zoneId: toStringId(rawMeta.zoneId),
    branchId: toStringId(rawMeta.branchId),
    branchName: rawMeta.branchName,
    side: rawMeta.side || rawMeta.team,
    role: rawMeta.role,
    slotId: toStringId(rawMeta.slotId),
    targetTeam: rawMeta.targetTeam || rawMeta.team,
    paymentRequired: rawMeta.paymentRequired === true,
    gameKey: normalizeGameKey(rawMeta.gameKey || rawMeta.game),
    game: rawMeta.game || rawMeta.gameKey,
    challengeId: toStringId(rawMeta.challengeId),
    fromUid: toStringId(notif.fromUid) || toStringId(rawMeta.fromUid),
    toUid: toStringId(notif.toUid) || toStringId(rawMeta.toUid),
  };

  return {
    id: String(notif._id),
    _id: String(notif._id),
    toUid: String(notif.toUid),
    fromUid: toStringId(notif.fromUid),
    fromUsername: notif.fromUsername,
    type: notif.type,
    status: notif.status,
    isRead: notif.isRead === true,
    isArchived: notif.isArchived === true,
    entityKey: notif.entityKey,
    entityId: canonicalMeta.entityId,
    teamId: canonicalMeta.teamId,
    teamName: notif.teamName,
    matchroomId: canonicalMeta.matchroomId,
    title: notif.title,
    body: notif.body,
    message: notif.body,
    meta: canonicalMeta,
    data: canonicalMeta,
    expiresAt: notif.expiresAt,
    createdAt: notif.createdAt,
    updatedAt: notif.updatedAt,
  };
}

/**
 * Custom hook for real-time notifications using Convex
 */
export function useNotifications(tab: "pending" | "resolved" = "pending") {
  const { user } = useAuth();
  const userId = user?._id as Id<"users"> | undefined;

  const rawNotifications = useQuery(
    api.notifications.listInboxPage,
    userId ? { userId, tab, limit: 100 } : "skip"
  );

  const markAsReadMutation = useMutation(api.notifications.markAsRead);
  const markAllAsReadMutation = useMutation(api.notifications.markAllAsReadFast);
  const markManyAsReadMutation = useMutation(api.notifications.markManyAsRead);
  const updateStatusMutation = useMutation(api.notifications.updateStatus);
  const archiveMutation = useMutation(api.notifications.archive);
  const archiveManyMutation = useMutation(api.notifications.archiveMany);

  const notifications: Notification[] = rawNotifications
    ? rawNotifications
        .map(transformNotification)
        .sort((a: Notification, b: Notification) => b.createdAt - a.createdAt)
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

  const markManyAsRead = async (notificationIds: string[]) => {
    if (!notificationIds.length) return;
    await markManyAsReadMutation({
      notificationIds: notificationIds.map((id) => id as Id<"notifications">),
    });
  };

  const updateStatus = async (notificationId: string, status: NotificationStatus) => {
    await updateStatusMutation({
      notificationId: notificationId as Id<"notifications">,
      status: status as any,
    });
  };

  const deleteNotification = async (notificationId: string) => {
    await archiveMutation({ notificationId: notificationId as Id<"notifications"> });
  };

  const deleteNotifications = async (notificationIds: string[]) => {
    if (!notificationIds.length) return;
    await archiveManyMutation({
      notificationIds: notificationIds.map((id) => id as Id<"notifications">),
    });
  };

  const deleteAllNotifications = async () => {
    if (!userId) return;
    const resolvedIds = notifications
      .filter((item) => item.status !== "pending")
      .map((item) => item.id as Id<"notifications">);
    if (!resolvedIds.length) return;
    await archiveManyMutation({ notificationIds: resolvedIds });
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
    markManyAsRead,
    updateStatus,
    deleteNotification,
    deleteNotifications,
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
    api.notifications.countUnreadFast,
    userId ? { userId } : "skip"
  );

  return count ?? 0;
}

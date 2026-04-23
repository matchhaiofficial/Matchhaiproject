import { useMemo } from "react";

import { Notification } from "../../../src/hooks/useNotifications";

const CHALLENGE_TYPES = new Set([
  "team_match_challenge",
  "team.challenge_received",
  "team_match_challenge_update",
  "team.challenge_updated",
]);

type InboxViewModelParams = {
  notifications: Notification[];
  activeTab: "pending" | "resolved";
};

function isExpiredPendingNotification(item: Notification) {
  if (item.status !== "pending" || !item.expiresAt) return false;
  const expiresMs = typeof item.expiresAt === "number" ? item.expiresAt : Date.now();
  return expiresMs < Date.now();
}

function isRejectedChallengeNotification(item: Notification) {
  return CHALLENGE_TYPES.has(item.type) && item.status === "rejected";
}

function isVisibleInboxNotification(item: Notification) {
  if (isRejectedChallengeNotification(item)) return false;
  if (isExpiredPendingNotification(item)) return false;
  return true;
}

export function useInboxViewModel({
  notifications,
  activeTab,
}: InboxViewModelParams) {
  const unreadIds = useMemo(
    () => notifications.filter((item) => item.isRead === false).map((item) => item.id),
    [notifications],
  );

  const visibleNotifications = useMemo(
    () => notifications.filter(isVisibleInboxNotification),
    [notifications],
  );

  const pendingCount = useMemo(
    () => visibleNotifications.filter((item) => item.status === "pending").length,
    [visibleNotifications],
  );

  const filteredNotifications = useMemo(
    () =>
      visibleNotifications.filter((item) =>
        activeTab === "pending" ? item.status === "pending" : item.status !== "pending",
      ),
    [activeTab, visibleNotifications],
  );

  const resolvedCount = useMemo(
    () => visibleNotifications.filter((item) => item.status !== "pending").length,
    [visibleNotifications],
  );

  return {
    unreadIds,
    hasUnread: unreadIds.length > 0,
    pendingCount,
    filteredNotifications,
    resolvedCount,
  };
}

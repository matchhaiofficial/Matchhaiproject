import { useMemo } from "react";

import { Notification } from "../../../src/hooks/useNotifications";

export type InboxTypeFilter =
  | "all"
  | "matchrooms"
  | "teams"
  | "payments"
  | "support"
  | "reports"
  | "system";

const CHALLENGE_TYPES = new Set([
  "team_match_challenge",
  "team.challenge_received",
  "team_match_challenge_update",
  "team.challenge_updated",
]);

type InboxViewModelParams = {
  notifications: Notification[];
  activeTab: "pending" | "resolved";
  typeFilter?: InboxTypeFilter;
};

function safeText(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

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

export function getInboxNotificationType(item: Notification): Exclude<InboxTypeFilter, "all"> {
  const type = safeText(item.type);
  const entityKey = safeText(item.entityKey);
  const hasTeamId = Boolean(item.teamId || item.meta?.teamId || item.data?.teamId);
  const hasMatchroomId = Boolean(item.matchroomId || item.meta?.matchroomId || item.data?.matchroomId);
  const hasIntentId = Boolean(item.meta?.intentId || item.data?.intentId);

  if (
    type.startsWith("support.") ||
    type.startsWith("support_") ||
    entityKey.startsWith("support.") ||
    entityKey.startsWith("support_")
  ) {
    return "support";
  }

  if (type.startsWith("moderation.") || type.includes("report")) {
    return "reports";
  }

  if (
    type.startsWith("wallet.") ||
    type.startsWith("wallet_") ||
    type.includes("payment_required") ||
    type.includes("payment_result") ||
    type.startsWith("payment.")
  ) {
    return "payments";
  }

  if (
    type.startsWith("team.") ||
    type.startsWith("team_") ||
    entityKey.startsWith("team.") ||
    entityKey.startsWith("team_") ||
    hasTeamId
  ) {
    return "teams";
  }

  if (
    type.startsWith("match.") ||
    type.startsWith("match_") ||
    type.startsWith("booking.") ||
    type.startsWith("booking_") ||
    hasMatchroomId ||
    hasIntentId
  ) {
    return "matchrooms";
  }

  return "system";
}

export function useInboxViewModel({
  notifications,
  activeTab,
  typeFilter = "all",
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

  const tabNotifications = useMemo(
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

  const filteredNotifications = useMemo(
    () =>
      typeFilter === "all"
        ? tabNotifications
        : tabNotifications.filter((item) => getInboxNotificationType(item) === typeFilter),
    [tabNotifications, typeFilter],
  );

  return {
    unreadIds,
    hasUnread: unreadIds.length > 0,
    pendingCount,
    tabNotifications,
    filteredNotifications,
    resolvedCount,
  };
}

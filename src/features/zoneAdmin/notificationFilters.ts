export type ZoneAdminNotificationLike = {
  type?: string | null;
  status?: string | null;
  isRead?: boolean | null;
  recipientRole?: string | null;
  data?: Record<string, any> | null;
};

const ADMIN_NOTIFICATION_KEYWORDS = [
  "admin",
  "booking",
  "match",
  "moderation",
  "resource",
];

export function isVisibleZoneAdminNotification(notification: ZoneAdminNotificationLike) {
  const data = notification.data || {};
  const type = String(notification.type || data.canonicalType || "").toLowerCase();

  return ADMIN_NOTIFICATION_KEYWORDS.some((keyword) => type.includes(keyword));
}

export function getZoneAdminNotificationStatus(notification: ZoneAdminNotificationLike) {
  const status = String(notification.status || "pending").toLowerCase();
  if (notification.isRead === true || status === "read" || status === "seen") {
    return "seen";
  }
  return status || "pending";
}

export function isPendingZoneAdminNotification(notification: ZoneAdminNotificationLike) {
  return isVisibleZoneAdminNotification(notification)
    && getZoneAdminNotificationStatus(notification) === "pending";
}

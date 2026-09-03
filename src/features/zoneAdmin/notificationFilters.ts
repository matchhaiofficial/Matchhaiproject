import { getNotificationCategory, type NotificationCategory } from "../../utils/notificationCategories";

export type ZoneAdminNotificationLike = {
  type?: string | null;
  status?: string | null;
  isRead?: boolean | null;
  recipientRole?: string | null;
  data?: Record<string, any> | null;
};

const ZONE_ADMIN_NOTIFICATION_CATEGORIES = new Set<NotificationCategory>([
  "booking",
  "broadcast",
  "matchroom",
  "report",
  "support",
  "kyc",
  "withdrawal",
  "zone",
]);

const EXCLUDED_RECIPIENT_ROLES = new Set(["player", "super_admin", "super-admin"]);

function getNotificationType(notification: ZoneAdminNotificationLike) {
  const data = notification.data || {};
  const type = String(notification.type || "").toLowerCase();
  if (!type || type === "general" || type === "system.general") {
    return String(data.canonicalType || type).toLowerCase();
  }
  return type;
}

function getRecipientRole(notification: ZoneAdminNotificationLike) {
  const data = notification.data || {};
  return String(notification.recipientRole || data.recipientRole || data.role || "").toLowerCase();
}

export function isVisibleZoneAdminNotification(notification: ZoneAdminNotificationLike) {
  const recipientRole = getRecipientRole(notification);
  if (EXCLUDED_RECIPIENT_ROLES.has(recipientRole)) {
    return false;
  }

  const category = getNotificationCategory(getNotificationType(notification));
  return ZONE_ADMIN_NOTIFICATION_CATEGORIES.has(category);
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

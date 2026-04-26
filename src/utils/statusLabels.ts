import type { ReportStatus } from "../services/convex/reportService";
import type { ZoneLifecycleStatus } from "./zoneLifecycle";

export type StatusToneName = "neutral" | "info" | "success" | "warning" | "danger";

export function formatEnumLabel(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Unknown";
  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getReportStatusLabel(status?: ReportStatus | string | null) {
  switch (status) {
    case "reviewed":
      return "Reviewed";
    case "resolved":
      return "Resolved";
    case "pending":
    default:
      return "Pending";
  }
}

export function getReportStatusTone(status?: ReportStatus | string | null): StatusToneName {
  switch (status) {
    case "resolved":
      return "success";
    case "reviewed":
      return "info";
    case "pending":
    default:
      return "warning";
  }
}

export function getZoneStatusLabel(status?: ZoneLifecycleStatus | string | null) {
  switch (status) {
    case "approved_pending_migration":
      return "Approved pending migration";
    case "active":
      return "Active";
    case "rejected":
      return "Rejected";
    case "suspended":
      return "Suspended";
    case "pending-review":
    default:
      return "Pending review";
  }
}

export function getZoneStatusTone(status?: ZoneLifecycleStatus | string | null): StatusToneName {
  switch (status) {
    case "active":
      return "success";
    case "approved_pending_migration":
      return "info";
    case "pending-review":
      return "warning";
    case "rejected":
    case "suspended":
      return "danger";
    default:
      return "neutral";
  }
}

export function getNotificationStatusLabel(status?: string | null) {
  switch (status) {
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Rejected";
    case "declined":
      return "Declined";
    case "read":
    case "seen":
      return "Seen";
    case "expired":
      return "Expired";
    case "pending":
      return "Pending";
    default:
      return formatEnumLabel(status);
  }
}

export function getNotificationStatusTone(status?: string | null): StatusToneName {
  switch (status) {
    case "accepted":
      return "success";
    case "rejected":
    case "declined":
      return "danger";
    case "pending":
      return "warning";
    case "read":
    case "seen":
    case "expired":
      return "neutral";
    default:
      return "info";
  }
}

export function getBookingIntentStatusLabel(status?: string | null) {
  switch (status) {
    case "pending_approvals":
      return "Pending approvals";
    case "approved_pending_payment":
      return "Approved pending payment";
    case "approved":
      return "Approved";
    case "confirmed":
      return "Confirmed";
    case "expired":
      return "Expired";
    case "rejected":
      return "Rejected";
    case "cancelled":
      return "Cancelled";
    case "draft":
      return "Draft";
    default:
      return formatEnumLabel(status);
  }
}

export function getPaymentStatusLabel(status?: string | null) {
  switch (status) {
    case "paid":
      return "Paid";
    case "unpaid":
      return "Unpaid";
    case "pending":
      return "Pending";
    case "partial":
      return "Partially paid";
    case "refunded":
      return "Refunded";
    case "paid_by_venue":
      return "Paid by venue";
    case "failed":
      return "Failed";
    default:
      return formatEnumLabel(status);
  }
}

export function getResourceLifecycleLabel(status?: string | null) {
  switch (status) {
    case "available":
      return "Available";
    case "held":
      return "Held";
    case "booked":
      return "Booked";
    case "maintenance":
      return "Maintenance";
    default:
      return formatEnumLabel(status);
  }
}

export function getZoneBookingQueueStatusLabel(status?: string | null) {
  switch (status) {
    case "open":
      return "Open";
    case "pending_payment":
      return "Pending payment";
    case "accepted":
      return "Accepted";
    case "expired":
      return "Expired";
    case "cancelled":
      return "Cancelled";
    default:
      return formatEnumLabel(status);
  }
}

export function getCheckoutStatusLabel(status?: string | null) {
  switch (status) {
    case "created":
    case "redirected":
    case "token_received":
    case "pending":
      return "Processing";
    case "paid":
      return "Paid";
    case "expired":
      return "Expired";
    case "failed":
      return "Failed";
    default:
      return formatEnumLabel(status);
  }
}

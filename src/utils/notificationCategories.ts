// Shared notification taxonomy used across the player inbox, zone-admin, and
// super-admin notification surfaces. Single source of truth for mapping a raw
// notification `type` string to a category, a human label, and an icon so new
// notification types render consistently everywhere (and unknown types fall
// back to "System" instead of breaking the UI).

export type NotificationCategory =
  | "matchroom"
  | "booking"
  | "broadcast"
  | "team"
  | "payment"
  | "wallet"
  | "support"
  | "report"
  | "kyc"
  | "zone"
  | "withdrawal"
  | "social"
  | "account"
  | "system";

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  matchroom: "Matchroom",
  booking: "Booking",
  broadcast: "Broadcast",
  team: "Team",
  payment: "Payment",
  wallet: "Wallet",
  support: "Support",
  report: "Report",
  kyc: "KYC",
  zone: "Zone",
  withdrawal: "Withdrawal",
  social: "Social",
  account: "Account",
  system: "System",
};

// Icon names below are all present in src/theme/icons.ts. AppIcon renders null
// for any unknown name, so this is safe even if a name is later removed.
const NOTIFICATION_CATEGORY_ICONS: Record<NotificationCategory, string> = {
  matchroom: "matchroom",
  booking: "bookings",
  broadcast: "broadcast-on-personal",
  team: "teams",
  payment: "payment",
  wallet: "wallet",
  support: "support",
  report: "reports",
  kyc: "verified",
  zone: "zone",
  withdrawal: "account-balance-wallet",
  social: "invite",
  account: "role",
  system: "notifications",
};

export function getNotificationCategory(type?: string | null): NotificationCategory {
  const t = String(type || "").toLowerCase();
  if (!t) return "system";
  // Order matters: payment-ish matchroom types are classified as payment first.
  if (t.startsWith("withdrawal.") || t.startsWith("withdrawal_")) return "withdrawal";
  if (t.startsWith("wallet.") || t.startsWith("wallet_")) return "wallet";
  if (
    t.startsWith("payments.") ||
    t.startsWith("payment.") ||
    t.includes("payment_required") ||
    t.includes("payment_result")
  ) {
    return "payment";
  }
  if (t.startsWith("broadcast.") || t.startsWith("broadcast_")) return "broadcast";
  if (t.startsWith("booking.") || t.startsWith("booking_")) return "booking";
  if (t.startsWith("match.") || t.startsWith("match_")) return "matchroom";
  if (t.startsWith("team.") || t.startsWith("team_")) return "team";
  if (t.startsWith("social.") || t.startsWith("social_")) return "social";
  if (t.startsWith("moderation.") || t.includes("report")) return "report";
  if (t.startsWith("kyc.") || t.startsWith("kyc_")) return "kyc";
  if (t.startsWith("support.") || t.startsWith("support_")) return "support";
  if (t.startsWith("zone.") || t.startsWith("zone_") || t.startsWith("resource.")) return "zone";
  if (t.startsWith("account.") || t.startsWith("operations.")) return "account";
  return "system";
}

// Nicer per-type labels for types that don't already have a bespoke label in a
// surface's own renderer. Falls back to the category label.
const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  "match.reminder_24h": "Match Reminder",
  "match.reminder_2h": "Match Reminder",
  "match.reminder_30m": "Match Reminder",
  "match.result_verification_required": "Result Verification",
  "match.result_disputed": "Result Disputed",
  "match.result_admin_review": "Result Review",
  "match.result_finalized": "Match Result",
  "match.created_nearby": "New Matchroom",
  "zone.live_nearby": "New Zone",
  "match.replacement_needed": "Replacement Needed",
  "match.walkin_replacement_needed": "Walk-in Needed",
  "withdrawal.requested": "Withdrawal Update",
  "withdrawal.approved": "Withdrawal Update",
  "withdrawal.rejected": "Withdrawal Update",
  "withdrawal.review_needed": "Withdrawal Review",
};

export function getNotificationCategoryLabel(type?: string | null): string {
  return NOTIFICATION_CATEGORY_LABELS[getNotificationCategory(type)];
}

export function getNotificationTypeLabel(type?: string | null): string {
  const t = String(type || "").toLowerCase();
  return NOTIFICATION_TYPE_LABELS[t] || getNotificationCategoryLabel(t);
}

export function getNotificationCategoryIcon(type?: string | null): string {
  return NOTIFICATION_CATEGORY_ICONS[getNotificationCategory(type)];
}

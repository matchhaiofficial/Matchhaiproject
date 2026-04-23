export type ZoneAdminModuleId =
  | "bookings_matchrooms"
  | "resources"
  | "pricing_promotions"
  | "support_safety"
  | "insights_security"
  | "venue_settings"
  | "migration_tools"
  | "notifications_center"
  | "audit_security";

export type ZoneBookingStatus =
  | "held"
  | "pending"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "disputed"
  | "closed"
  | "cancelled";

export type ZonePaymentStatus =
  | "pending"
  | "partial"
  | "paid"
  | "refunded"
  | "paid_by_venue";

export type ResourceKind = "seat" | "court";

export type ResourceLifecycleStatus =
  | "available"
  | "held"
  | "booked"
  | "maintenance";

export interface ZoneAdminModule {
  id: ZoneAdminModuleId;
  title: string;
  description: string;
  route: string;
  icon: string;
  tag?: string;
}


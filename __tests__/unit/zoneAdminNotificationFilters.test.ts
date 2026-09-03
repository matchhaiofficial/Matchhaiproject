import {
  getZoneAdminNotificationStatus,
  isPendingZoneAdminNotification,
  isVisibleZoneAdminNotification,
} from "../../src/features/zoneAdmin/notificationFilters";

describe("zone admin notification filters", () => {
  it("shows zone-admin notifications by allowed category", () => {
    expect(isVisibleZoneAdminNotification({ type: "booking.request_submitted", recipientRole: "zone_admin" })).toBe(true);
    expect(isVisibleZoneAdminNotification({ type: "match.join_request", recipientRole: "zone_admin" })).toBe(true);
    expect(isVisibleZoneAdminNotification({ type: "withdrawal.requested", recipientRole: "zone_admin" })).toBe(true);
    expect(isVisibleZoneAdminNotification({ type: "kyc.status_updated", recipientRole: "zone_admin" })).toBe(true);
    expect(isVisibleZoneAdminNotification({ type: "support.ticket_status_changed", recipientRole: "zone_admin" })).toBe(true);
    expect(isVisibleZoneAdminNotification({ type: "zone.status_updated", recipientRole: "zone_admin" })).toBe(true);
    expect(isVisibleZoneAdminNotification({ type: "zone.pilot_started", recipientRole: "zone_admin" })).toBe(true);
    expect(isVisibleZoneAdminNotification({ type: "zone.pilot_ended", recipientRole: "zone_admin" })).toBe(true);
  });

  it("uses canonical type and recipient role from notification data", () => {
    expect(isVisibleZoneAdminNotification({
      type: "general",
      data: {
        canonicalType: "withdrawal.approved",
        recipientRole: "zone_admin",
      },
    })).toBe(true);
  });

  it("excludes player-only and super-admin-only notifications", () => {
    expect(isVisibleZoneAdminNotification({ type: "booking.request_accepted", recipientRole: "player" })).toBe(false);
    expect(isVisibleZoneAdminNotification({ type: "broadcast.offer_received", recipientRole: "player" })).toBe(false);
    expect(isVisibleZoneAdminNotification({ type: "team.invite", recipientRole: "player" })).toBe(false);
    expect(isVisibleZoneAdminNotification({ type: "withdrawal.review_needed", recipientRole: "super_admin" })).toBe(false);
    expect(isVisibleZoneAdminNotification({ type: "kyc.review_needed", recipientRole: "super_admin" })).toBe(false);
    expect(isVisibleZoneAdminNotification({ type: "moderation.review_needed", recipientRole: "super-admin" })).toBe(false);
  });

  it("does not admit unknown or player-only categories without keyword matching", () => {
    expect(isVisibleZoneAdminNotification({ type: "admin_password_changed", recipientRole: "zone_admin" })).toBe(false);
    expect(isVisibleZoneAdminNotification({ type: "social.friend_request", recipientRole: "zone_admin" })).toBe(false);
    expect(isVisibleZoneAdminNotification({ type: "wallet.topup_result", recipientRole: "zone_admin" })).toBe(false);
  });

  it("uses the same visibility predicate for pending badge counts", () => {
    expect(isPendingZoneAdminNotification({ type: "support.admin_reply", recipientRole: "zone_admin", status: "pending" })).toBe(true);
    expect(isPendingZoneAdminNotification({ type: "support.admin_reply", recipientRole: "player", status: "pending" })).toBe(false);
    expect(isPendingZoneAdminNotification({ type: "withdrawal.approved", recipientRole: "zone_admin", isRead: true })).toBe(false);
  });

  it("normalizes read-like statuses to seen", () => {
    expect(getZoneAdminNotificationStatus({ status: "read" })).toBe("seen");
    expect(getZoneAdminNotificationStatus({ status: "seen" })).toBe("seen");
    expect(getZoneAdminNotificationStatus({ status: "pending", isRead: true })).toBe("seen");
  });
});

import {
  APP_ROUTES,
  buildNotificationRoute,
} from "../../src/navigation/routes";

describe("notification deep-link route normalization", () => {
  it("focuses zone booking request notifications when request id exists", () => {
    expect(
      buildNotificationRoute({
        type: "booking.request_submitted",
        recipientRole: "zone_admin",
        data: { requestId: "req_123" },
      }),
    ).toBe(
      "/zone/modules/bookings?segment=requests&requestId=req_123&expandedRequestId=req_123&focusRequestId=req_123",
    );
  });

  it("routes payment required notifications to the pay screen", () => {
    expect(
      buildNotificationRoute({
        type: "match.payment_required",
        route: "/matchrooms/room_1",
        matchroomId: "room_1",
        data: { intentId: "intent_1" },
      }),
    ).toBe("/matchrooms/book/pay/intent_1");
  });

  it("uses safe action fallbacks where focused routes are unsupported", () => {
    expect(
      buildNotificationRoute({
        type: "booking.counter_offer",
        route: "/matchrooms/room_1",
        data: { offerId: "offer_1", requestId: "req_1" },
      }),
    ).toBe(APP_ROUTES.playerInbox);

    expect(
      buildNotificationRoute({
        type: "zone.matchroom_full",
        recipientRole: "zone_admin",
        route: "/matchrooms/room_1",
        data: { matchroomId: "room_1" },
      }),
    ).toBe("/zone/modules/bookings?segment=matchrooms&matchroomId=room_1");
  });

  it("normalizes role-specific KYC, withdrawal, support, and report routes", () => {
    expect(
      buildNotificationRoute({
        type: "kyc.status_updated",
        recipientRole: "zone_admin",
        route: "/zone/profile",
      }),
    ).toBe(APP_ROUTES.zoneProfile);

    expect(
      buildNotificationRoute({
        type: "withdrawal.approved",
        recipientRole: "zone_admin",
        data: { withdrawalId: "wd_1" },
      }),
    ).toBe(APP_ROUTES.zoneWallet);

    expect(
      buildNotificationRoute({
        type: "withdrawal.review_needed",
        recipientRole: "super_admin",
        data: { withdrawalId: "wd_1" },
      }),
    ).toBe(APP_ROUTES.superAdminWithdrawals);

    expect(
      buildNotificationRoute({
        type: "support.new_ticket",
        recipientRole: "super_admin",
        data: { ticketId: "ticket_1" },
      }),
    ).toBe("/super-admin/support-ticket/ticket_1");

    expect(
      buildNotificationRoute({
        type: "moderation.review_needed",
        recipientRole: "super_admin",
        data: { reportId: "report_1" },
      }),
    ).toBe("/super-admin/report/report_1");
  });
});

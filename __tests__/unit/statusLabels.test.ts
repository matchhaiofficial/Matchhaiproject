// Phase 1C — booking intent / payment / zone / notification status labels & tones.
import {
  formatEnumLabel,
  getBookingIntentStatusLabel,
  getPaymentStatusLabel,
  getZoneStatusLabel,
  getZoneStatusTone,
  getNotificationStatusLabel,
  getNotificationStatusTone,
  getCheckoutStatusLabel,
} from "../../src/utils/statusLabels";

describe("formatEnumLabel", () => {
  it("title-cases snake/kebab enums", () => {
    expect(formatEnumLabel("pending_payment")).toBe("Pending Payment");
    expect(formatEnumLabel("approved-pending")).toBe("Approved Pending");
  });
  it("returns Unknown for empty", () => {
    expect(formatEnumLabel("")).toBe("Unknown");
    expect(formatEnumLabel(null)).toBe("Unknown");
  });
});

describe("getBookingIntentStatusLabel (pending/approved/confirmed states)", () => {
  it("maps the lifecycle states", () => {
    expect(getBookingIntentStatusLabel("pending_approvals")).toBe("Pending approvals");
    expect(getBookingIntentStatusLabel("approved_pending_payment")).toBe("Approved pending payment");
    expect(getBookingIntentStatusLabel("confirmed")).toBe("Confirmed");
    expect(getBookingIntentStatusLabel("rejected")).toBe("Rejected");
    expect(getBookingIntentStatusLabel("cancelled")).toBe("Cancelled");
    expect(getBookingIntentStatusLabel("expired")).toBe("Expired");
  });
  it("falls back via formatEnumLabel for unknown", () => {
    expect(getBookingIntentStatusLabel("weird_state")).toBe("Weird State");
  });
});

describe("getPaymentStatusLabel", () => {
  it("maps payment statuses including failed and paid_by_venue", () => {
    expect(getPaymentStatusLabel("paid")).toBe("Paid");
    expect(getPaymentStatusLabel("unpaid")).toBe("Unpaid");
    expect(getPaymentStatusLabel("failed")).toBe("Failed");
    expect(getPaymentStatusLabel("refunded")).toBe("Refunded");
    expect(getPaymentStatusLabel("paid_by_venue")).toBe("Paid by venue");
  });
});

describe("zone status label/tone", () => {
  it("labels lifecycle statuses", () => {
    expect(getZoneStatusLabel("active")).toBe("Active");
    expect(getZoneStatusLabel("pending-review")).toBe("Pending review");
    expect(getZoneStatusLabel("suspended")).toBe("Suspended");
  });
  it("maps tones (success/warning/danger)", () => {
    expect(getZoneStatusTone("active")).toBe("success");
    expect(getZoneStatusTone("pending-review")).toBe("warning");
    expect(getZoneStatusTone("suspended")).toBe("danger");
  });
});

describe("notification status label/tone", () => {
  it("labels accepted/rejected/seen/pending", () => {
    expect(getNotificationStatusLabel("accepted")).toBe("Accepted");
    expect(getNotificationStatusLabel("read")).toBe("Seen");
    expect(getNotificationStatusLabel("pending")).toBe("Pending");
  });
  it("tones reflect outcome", () => {
    expect(getNotificationStatusTone("accepted")).toBe("success");
    expect(getNotificationStatusTone("rejected")).toBe("danger");
    expect(getNotificationStatusTone("pending")).toBe("warning");
  });
});

describe("getCheckoutStatusLabel", () => {
  it("collapses in-flight states to Processing", () => {
    for (const s of ["created", "redirected", "token_received", "pending"]) {
      expect(getCheckoutStatusLabel(s)).toBe("Processing");
    }
    expect(getCheckoutStatusLabel("paid")).toBe("Paid");
    expect(getCheckoutStatusLabel("failed")).toBe("Failed");
  });
});

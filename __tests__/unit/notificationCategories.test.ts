// Phase 1F — notification category mapping, labels, icons, type labels.
import {
  getNotificationCategory,
  getNotificationCategoryLabel,
  getNotificationTypeLabel,
  getNotificationCategoryIcon,
  NOTIFICATION_CATEGORY_LABELS,
} from "../../src/utils/notificationCategories";

describe("getNotificationCategory", () => {
  it("classifies by prefix", () => {
    expect(getNotificationCategory("booking.created")).toBe("booking");
    expect(getNotificationCategory("match.reminder_24h")).toBe("matchroom");
    expect(getNotificationCategory("team_invite")).toBe("team");
    expect(getNotificationCategory("wallet.credited")).toBe("wallet");
    expect(getNotificationCategory("withdrawal.approved")).toBe("withdrawal");
    expect(getNotificationCategory("kyc.verified")).toBe("kyc");
    expect(getNotificationCategory("zone.approved")).toBe("zone");
    expect(getNotificationCategory("social.friend_request")).toBe("social");
  });

  it("prioritizes payment classification for payment-ish types", () => {
    expect(getNotificationCategory("payments.required")).toBe("payment");
    expect(getNotificationCategory("match.payment_required")).toBe("payment");
    expect(getNotificationCategory("match.payment_result")).toBe("payment");
  });

  it("withdrawal and wallet rank above generic", () => {
    expect(getNotificationCategory("withdrawal_review_needed")).toBe("withdrawal");
    expect(getNotificationCategory("wallet_debit")).toBe("wallet");
  });

  it("classifies reports/moderation", () => {
    expect(getNotificationCategory("moderation.flagged")).toBe("report");
    expect(getNotificationCategory("user_report_filed")).toBe("report");
  });

  it("falls back to system for empty/unknown", () => {
    expect(getNotificationCategory("")).toBe("system");
    expect(getNotificationCategory(null)).toBe("system");
    expect(getNotificationCategory("totally_unknown")).toBe("system");
  });
});

describe("labels & icons", () => {
  it("category label resolves from the canonical map", () => {
    expect(getNotificationCategoryLabel("payments.required")).toBe(NOTIFICATION_CATEGORY_LABELS.payment);
    expect(getNotificationCategoryLabel("team.invite")).toBe("Team");
  });

  it("type label prefers bespoke labels then falls back to category", () => {
    expect(getNotificationTypeLabel("match.result_verification_required")).toBe("Result Verification");
    expect(getNotificationTypeLabel("match.result_finalized")).toBe("Match Result");
    // Unknown match.* type falls back to the matchroom category label.
    expect(getNotificationTypeLabel("match.something_new")).toBe("Matchroom");
  });

  it("returns a non-empty icon name for every category", () => {
    expect(getNotificationCategoryIcon("payments.required")).toBeTruthy();
    expect(getNotificationCategoryIcon("unknown")).toBeTruthy();
  });
});

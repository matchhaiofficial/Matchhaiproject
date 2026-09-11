import {
  classifyAnalyticsFailure,
  isOpaqueAnalyticsUserId,
  sanitizeAnalyticsProperties,
} from "../../src/lib/analytics/privacy";

describe("PostHog analytics privacy", () => {
  it("keeps only explicitly allowed, non-PII properties", () => {
    expect(
      sanitizeAnalyticsProperties({
        account_type: "player",
        game: "cs2",
        max_players: 10,
        email: "player@example.com",
        phone: "+923001234567",
        description: "private report text",
        outcome: "success",
      }),
    ).toEqual({
      account_type: "player",
      game: "cs2",
      max_players: 10,
      outcome: "success",
    });
  });

  it("drops contact-like values even when placed under an allowed key", () => {
    expect(sanitizeAnalyticsProperties({ status: "player@example.com" })).toEqual({});
    expect(sanitizeAnalyticsProperties({ status: "+923001234567" })).toEqual({});
  });

  it("accepts opaque database ids but rejects email and phone identifiers", () => {
    expect(isOpaqueAnalyticsUserId("j57abc123def456ghi789")).toBe(true);
    expect(isOpaqueAnalyticsUserId("player@example.com")).toBe(false);
    expect(isOpaqueAnalyticsUserId("+923001234567")).toBe(false);
  });

  it("maps raw failures into bounded categories", () => {
    expect(classifyAnalyticsFailure(new Error("No resources available"))).toBe("availability");
    expect(classifyAnalyticsFailure(new Error("KYC required"))).toBe("kyc_required");
    expect(classifyAnalyticsFailure(new Error("private unexpected detail"))).toBe("unknown");
  });
});

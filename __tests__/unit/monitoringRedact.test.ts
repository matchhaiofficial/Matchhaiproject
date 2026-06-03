// Phase 6 — monitoring redaction: guarantee no PII/secrets are ever forwarded.
import {
  redact,
  pickAllowed,
  isSensitiveKey,
  isAllowedKey,
  hashId,
  REDACTED,
} from "../../src/lib/monitoring/redact";

describe("isSensitiveKey", () => {
  it("catches sensitive key fragments (case/substring insensitive)", () => {
    for (const k of ["cnic", "userPhoneNumber", "contactEmail", "bankAccountNo", "authToken", "password", "providerPayload", "cvv", "otp"]) {
      expect(isSensitiveKey(k)).toBe(true);
    }
  });
  it("treats ids/enums as non-sensitive", () => {
    for (const k of ["userId", "bookingId", "status", "amount"]) {
      expect(isSensitiveKey(k)).toBe(false);
    }
  });
});

describe("redact (deep)", () => {
  it("obfuscates sensitive keys at any depth and keeps safe ones", () => {
    const input = {
      userId: "u1",
      email: "ace@test.com",
      profile: { phone: "+923001234567", cnic: "42101-1", nested: { secret: "x", status: "ok" } },
      providerPayload: { raw: "DO NOT LEAK" },
    };
    const out = redact(input) as any;
    expect(out.userId).toBe("u1");
    expect(out.email).toBe(REDACTED);
    expect(out.profile.phone).toBe(REDACTED);
    expect(out.profile.cnic).toBe(REDACTED);
    expect(out.profile.nested.secret).toBe(REDACTED);
    expect(out.profile.nested.status).toBe("ok");
    expect(out.providerPayload).toBe(REDACTED);
    expect(JSON.stringify(out)).not.toContain("DO NOT LEAK");
    expect(JSON.stringify(out)).not.toContain("ace@test.com");
  });

  it("drops functions and caps very long strings", () => {
    const out = redact({ fn: () => {}, big: "x".repeat(1000) }) as any;
    expect(out.fn).toBe("[function]");
    expect(out.big.length).toBeLessThan(1000);
    expect(out.big).toMatch(/truncated/);
  });
});

describe("pickAllowed (events allowlist mode)", () => {
  it("keeps only allowlisted keys and drops everything else", () => {
    const out = pickAllowed({
      bookingId: "b1",
      status: "confirmed",
      amount: 250,
      email: "ace@test.com",
      randomField: "nope",
    });
    expect(out).toEqual({ bookingId: "b1", status: "confirmed", amount: 250 });
    expect(out.email).toBeUndefined();
    expect(out.randomField).toBeUndefined();
  });
  it("returns {} for nullish input", () => {
    expect(pickAllowed(null)).toEqual({});
    expect(pickAllowed(undefined)).toEqual({});
  });
});

describe("hashId", () => {
  it("is deterministic and non-reversible-looking", () => {
    expect(hashId("user_123")).toBe(hashId("user_123"));
    expect(hashId("user_123")).not.toContain("user_123");
    expect(hashId(null)).toBe("anon");
  });
});

describe("isAllowedKey", () => {
  it("recognizes safe vocabulary", () => {
    expect(isAllowedKey("userId")).toBe(true);
    expect(isAllowedKey("STATUS")).toBe(true);
    expect(isAllowedKey("email")).toBe(false);
  });
});

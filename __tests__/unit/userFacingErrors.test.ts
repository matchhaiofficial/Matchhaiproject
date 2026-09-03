// Phase 1C/E — safe payment/auth error messaging; no raw provider/Convex noise.
import {
  getUserFacingErrorMessage,
  cleanConvexErrorMessage,
  sanitizeToastMessage,
  isAuthSessionError,
  SESSION_EXPIRED_MESSAGE,
  SESSION_VERIFY_MESSAGE,
  DEFAULT_USER_FACING_ERROR,
} from "../../src/utils/userFacingErrors";
import { SLOT_ALREADY_FILLED_PAYMENT_MESSAGE } from "../../src/utils/paymentUiCopy";

describe("isAuthSessionError", () => {
  it("detects session/auth markers", () => {
    expect(isAuthSessionError("Unauthenticated")).toBe(true);
    expect(isAuthSessionError(new Error("Your session has expired"))).toBe(true);
    expect(isAuthSessionError("Authentication required")).toBe(true);
  });
  it("ignores unrelated errors", () => {
    expect(isAuthSessionError("Network timeout")).toBe(false);
  });
});

describe("getUserFacingErrorMessage", () => {
  it("maps session expiry and identity-lookup failures distinctly", () => {
    expect(getUserFacingErrorMessage("Unauthenticated")).toBe(SESSION_EXPIRED_MESSAGE);
    expect(getUserFacingErrorMessage("Authentication required")).toBe(SESSION_VERIFY_MESSAGE);
  });

  it("maps slot-taken to the safe slot-filled copy", () => {
    expect(getUserFacingErrorMessage("The selected slot is no longer available")).toBe(
      SLOT_ALREADY_FILLED_PAYMENT_MESSAGE,
    );
  });

  it("maps known Easypaisa provider errors to friendly copy (no raw payload)", () => {
    const enabled = getUserFacingErrorMessage("PAYMENT METHOD NOT ENABLED");
    expect(enabled).toMatch(/Easypaisa is unavailable/i);
    const noAccount = getUserFacingErrorMessage("ACCOUNT DOES NOT EXIST");
    expect(noAccount).toMatch(/account was not found/i);
  });

  it("falls back to the default message for empty input", () => {
    expect(getUserFacingErrorMessage("")).toBe(DEFAULT_USER_FACING_ERROR);
  });
});

describe("cleanConvexErrorMessage", () => {
  it("strips Convex/transport noise and request ids", () => {
    const raw =
      "[CONVEX M(bookings:create)] [Request ID: abc123] Server Error Uncaught ConvexError: Slot already taken at handler (../convex/bookings.ts:10) Called by client";
    const cleaned = cleanConvexErrorMessage(raw);
    expect(cleaned).not.toMatch(/CONVEX|Request ID|Server Error|Called by client|at handler/i);
    expect(cleaned).toContain("Slot already taken");
  });
});

describe("sanitizeToastMessage", () => {
  it("passes through clean user-friendly messages untouched", () => {
    expect(sanitizeToastMessage("Booking confirmed!")).toBe("Booking confirmed!");
  });
  it("sanitizes messages containing technical markers", () => {
    const out = sanitizeToastMessage("[CONVEX] Server Error something internal");
    expect(out).not.toMatch(/CONVEX|Server Error/i);
  });
  it("returns default for blank", () => {
    expect(sanitizeToastMessage("   ")).toBe(DEFAULT_USER_FACING_ERROR);
  });
});

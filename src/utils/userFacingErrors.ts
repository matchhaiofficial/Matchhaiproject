import { SLOT_ALREADY_FILLED_PAYMENT_MESSAGE } from "./paymentUiCopy";

export const DEFAULT_USER_FACING_ERROR =
  "Something went wrong. Please try again.";

export const SESSION_EXPIRED_MESSAGE =
  "Your session has expired. Please log in again.";

export const SESSION_VERIFY_MESSAGE =
  "We could not verify your session. Please refresh and try again.";

// True session / token failures: token absent, expired, or explicitly signed-out.
const SESSION_EXPIRED_MARKER =
  /\bunauthenticated\b|not authenticated|please sign in|please log ?in|sign in to continue|session (?:has )?expired|authentication expired/i;

// Identity-lookup failures: token present but backend could not match a user record.
// Distinct from session expiry — the user IS authenticated but the lookup failed.
const AUTH_REQUIRED_MARKER = /\bauthentication required\b/i;

// Combined marker used by isAuthSessionError (retry logic, etc.)
const AUTH_SESSION_ERROR_MARKER = new RegExp(
  `${SESSION_EXPIRED_MARKER.source}|${AUTH_REQUIRED_MARKER.source}`,
  "i",
);

export function isAuthSessionError(error: unknown): boolean {
  return AUTH_SESSION_ERROR_MARKER.test(getRawErrorMessage(error));
}

const TECHNICAL_ERROR_MARKER =
  /\[CONVEX|\[Request ID:|Called by client|Server Error|Uncaught (?:ConvexError|Error)|at handler\b/i;

const KNOWN_PAYMENT_ERROR_MARKER =
  /ACCOUNT DOES N[O']?T? EXIST|ACCOUNT DOES NO EXIST|PAYMENT METHOD NOT ENABLED/i;

function getRawErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return String((error as { message: string }).message);
  }

  if (error && typeof error === "object") return "";
  return error == null ? "" : String(error);
}

function cleanErrorTransportNoise(message: string): string {
  return message
    .replace(/\[CONVEX[^\]]*\]\s*/gi, "")
    .replace(/\[Request ID:[^\]]*\]\s*/gi, "")
    .replace(/\bServer Error\b/gi, "")
    .replace(/\bUncaught (?:ConvexError|Error):\s*/gi, "")
    .replace(/\bat handler\s*\([^)]*\)/gi, "")
    .split("Called by client")[0]
    .trim()
    .replace(/\s+/g, " ");
}

export function cleanConvexErrorMessage(
  error: unknown,
  fallback = DEFAULT_USER_FACING_ERROR,
): string {
  return cleanErrorTransportNoise(getRawErrorMessage(error)) || fallback;
}

export function getUserFacingErrorMessage(
  error: unknown,
  fallback = DEFAULT_USER_FACING_ERROR,
): string {
  const raw = getRawErrorMessage(error);

  if (SESSION_EXPIRED_MARKER.test(raw)) {
    return SESSION_EXPIRED_MESSAGE;
  }
  if (AUTH_REQUIRED_MARKER.test(raw)) {
    return SESSION_VERIFY_MESSAGE;
  }

  if (/slot is no longer available|selected slot is no longer available/i.test(raw)) {
    return SLOT_ALREADY_FILLED_PAYMENT_MESSAGE;
  }

  if (/PAYMENT METHOD NOT ENABLED/i.test(raw)) {
    return "Easypaisa is unavailable right now. Try again or use MatchHai Wallet.";
  }

  if (/ACCOUNT DOES N[O']?T? EXIST|ACCOUNT DOES NO EXIST/i.test(raw)) {
    return "This Easypaisa account was not found. Check the number and try again.";
  }

  return cleanConvexErrorMessage(raw, fallback);
}

export function sanitizeToastMessage(message: string): string {
  const raw = getRawErrorMessage(message);
  if (!raw.trim()) return DEFAULT_USER_FACING_ERROR;

  if (
    !TECHNICAL_ERROR_MARKER.test(raw) &&
    !KNOWN_PAYMENT_ERROR_MARKER.test(raw)
  ) {
    return raw;
  }

  return getUserFacingErrorMessage(raw);
}

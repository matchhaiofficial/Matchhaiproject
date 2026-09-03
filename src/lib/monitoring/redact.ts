/**
 * Redaction helpers for the monitoring layer.
 *
 * GOAL: guarantee that no PII / secrets ever leave the app through a
 * monitoring provider (Sentry) or the local Logger. These functions are pure
 * and exported so they can be unit-tested in isolation.
 *
 * Rules enforced:
 *  - A denylist of sensitive key fragments is ALWAYS obfuscated, regardless of
 *    nesting depth (cnic, phone, email, bankAccount, token, password,
 *    providerPayload, secret, ...).
 *  - For monitoring breadcrumbs/events we additionally support an allowlist
 *    mode (`pickAllowed`) that keeps ONLY known-safe keys (ids / enums).
 *  - Strings are length-capped; objects/arrays are size-capped to avoid huge
 *    payloads.
 */

/** Marker written in place of a redacted value. */
export const REDACTED = "[redacted]";

/**
 * Key fragments that must never be reported. Matching is case-insensitive and
 * substring-based, so `userPhoneNumber`, `contactEmail`, `bankAccountNo`, etc.
 * are all caught. Keep this list conservative — when in doubt, redact.
 */
export const SENSITIVE_KEY_FRAGMENTS: readonly string[] = [
  "cnic",
  "nic",
  "phone",
  "mobile",
  "msisdn",
  "email",
  "bankaccount",
  "accountnumber",
  "accountno",
  "iban",
  "card",
  "cvv",
  "token",
  "password",
  "passcode",
  "pin",
  "secret",
  "apikey",
  "authorization",
  "auth",
  "credential",
  "providerpayload",
  "rawpayload",
  "payload",
  "otp",
  "address",
  "fullname",
  "dob",
];

/**
 * Allowlist of field keys considered safe to forward verbatim in monitoring
 * events. These are ids, enums, counts, flags and timing values — never PII.
 * `events.ts` builds payloads from this vocabulary.
 */
export const SAFE_KEY_ALLOWLIST: readonly string[] = [
  "userId",
  "userIdHash",
  "actorId",
  "captainId",
  "opponentId",
  "bookingId",
  "bookingIntentId",
  "paymentId",
  "transactionId",
  "orderId",
  "matchroomId",
  "roomId",
  "matchId",
  "teamId",
  "challengeId",
  "resultId",
  "notificationId",
  "gameId",
  "venueId",
  "slotId",
  "screen",
  "route",
  "routeKey",
  "actionKey",
  "status",
  "state",
  "stage",
  "step",
  "reason",
  "code",
  "errorCode",
  "method",
  "provider",
  "type",
  "kind",
  "level",
  "outcome",
  "result",
  "verified",
  "locked",
  "expired",
  "success",
  "ok",
  "count",
  "attempt",
  "retries",
  "amount",
  "currency",
  "durationMs",
  "elapsedMs",
  "latencyMs",
  "thresholdMs",
  "statusCode",
  "httpStatus",
  "endpoint",
  "name",
  "event",
  "ts",
  "env",
];

const MAX_STRING_LEN = 256;
const MAX_OBJECT_KEYS = 40;
const MAX_ARRAY_ITEMS = 25;
const MAX_DEPTH = 6;

/** Case-insensitive substring check against the sensitive denylist. */
export function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase();
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) => k.includes(fragment));
}

/** Whether a key is on the safe allowlist (exact, case-insensitive). */
export function isAllowedKey(key: string): boolean {
  const k = key.toLowerCase();
  return SAFE_KEY_ALLOWLIST.some((allowed) => allowed.toLowerCase() === k);
}

/**
 * Hash an identifier (e.g. a userId) into a short non-reversible token so it
 * can be correlated across events without exposing the raw value. Uses a small
 * FNV-1a variant — sufficient for log correlation, NOT cryptographic.
 */
export function hashId(value: string | number | null | undefined): string {
  if (value == null) return "anon";
  const str = String(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Unsigned, base36, fixed-ish width.
  return `h_${(hash >>> 0).toString(36)}`;
}

function capString(value: string): string {
  return value.length > MAX_STRING_LEN ? `${value.slice(0, MAX_STRING_LEN)}…[truncated]` : value;
}

/**
 * Deeply redact a value: obfuscate sensitive keys, cap sizes, drop functions.
 * Does NOT apply the allowlist — use this for arbitrary context attached to an
 * exception where we want to keep most fields but still guarantee no secrets.
 */
export function redact(value: unknown, key?: string, depth = 0): unknown {
  if (key && isSensitiveKey(key)) return REDACTED;
  if (value == null) return value;

  const t = typeof value;
  if (t === "function") return "[function]";
  if (t === "string") return capString(value as string);
  if (t === "number" || t === "boolean") return value;
  if (t === "bigint") return `${(value as bigint).toString()}n`;
  if (t === "symbol") return "[symbol]";

  if (depth >= MAX_DEPTH) return "[max-depth]";

  if (value instanceof Error) {
    return { name: value.name, message: capString(value.message) };
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => redact(item, undefined, depth + 1));
  }

  if (t === "object") {
    const out: Record<string, unknown> = {};
    const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_OBJECT_KEYS);
    for (const [k, v] of entries) {
      out[k] = isSensitiveKey(k) ? REDACTED : redact(v, k, depth + 1);
    }
    return out;
  }

  return String(value);
}

/**
 * Allowlist-mode redaction for monitoring EVENTS: returns a flat-ish object
 * containing only allowlisted keys (recursively redacted for safety). Anything
 * not on the allowlist is dropped entirely. This is the strictest mode and is
 * what domain event loggers funnel through.
 */
export function pickAllowed(
  input: Record<string, unknown> | undefined | null,
): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (!isAllowedKey(k)) continue;
    if (isSensitiveKey(k)) continue; // defence in depth
    out[k] = redact(v, k);
  }
  return out;
}

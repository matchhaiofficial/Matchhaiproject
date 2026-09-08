export type AnalyticsPrimitive = string | number | boolean | null;
export type AnalyticsProperties = Record<string, AnalyticsPrimitive | undefined>;

const ALLOWED_PROPERTY_KEYS = new Set([
  "account_type",
  "auth_method",
  "booking_source",
  "created",
  "environment",
  "failure_category",
  "format",
  "game",
  "identifier_type",
  "kyc_role",
  "location_mode",
  "max_players",
  "outcome",
  "payment_mode",
  "report_type",
  "resource_asset_type",
  "resource_tier",
  "route",
  "series_type",
  "stage",
  "status",
  "step",
  "team_mode",
]);

const MAX_VALUE_LENGTH = 80;

export function isOpaqueAnalyticsUserId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 128) return false;
  if (normalized.includes("@")) return false;
  if (/^\+?\d[\d\s()-]{8,}$/.test(normalized)) return false;
  return true;
}

function sanitizeValue(value: unknown): AnalyticsPrimitive | undefined {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;

  const normalized = value.trim().slice(0, MAX_VALUE_LENGTH);
  if (!normalized || normalized.includes("@")) return undefined;
  if (/^\+?\d[\d\s()-]{8,}$/.test(normalized)) return undefined;
  return normalized;
}

export function sanitizeAnalyticsProperties(
  properties?: Record<string, unknown> | null,
): Record<string, AnalyticsPrimitive> {
  if (!properties) return {};
  const safe: Record<string, AnalyticsPrimitive> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!ALLOWED_PROPERTY_KEYS.has(key)) continue;
    const sanitized = sanitizeValue(value);
    if (sanitized !== undefined) safe[key] = sanitized;
  }
  return safe;
}

export function classifyAnalyticsFailure(error: unknown): string {
  const message = String(
    typeof error === "object" && error && "message" in error ? (error as { message?: unknown }).message : error,
  ).toLowerCase();

  if (message.includes("kyc") || message.includes("identity verification")) return "kyc_required";
  if (message.includes("otp") || message.includes("verification code")) return "otp_failed";
  if (message.includes("not authenticated") || message.includes("session")) return "authentication";
  if (message.includes("block")) return "blocked_user";
  if (message.includes("wallet") || message.includes("balance")) return "wallet";
  if (message.includes("payment") || message.includes("easypaisa")) return "payment";
  if (message.includes("resource") || message.includes("available") || message.includes("capacity"))
    return "availability";
  if (message.includes("time") || message.includes("schedule") || message.includes("hours")) return "schedule";
  if (message.includes("network") || message.includes("fetch") || message.includes("timed out")) return "network";
  if (message.includes("required") || message.includes("invalid") || message.includes("select")) return "validation";
  if (message.includes("already")) return "duplicate";
  return "unknown";
}

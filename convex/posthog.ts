const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

type ServerAnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

const ALLOWED_SERVER_PROPERTY_KEYS = new Set([
  "amount",
  "currency",
  "environment",
  "kyc_role",
  "payment_kind",
  "provider",
  "source",
  "status",
]);

function safeDistinctId(value: unknown): string | null {
  const id = String(value || "").trim();
  if (id.length < 8 || id.length > 128 || id.includes("@")) return null;
  if (/^\+?\d[\d\s()-]{8,}$/.test(id)) return null;
  return id;
}

function safeProperties(input: ServerAnalyticsProperties) {
  return Object.fromEntries(
    Object.entries(input)
      .filter(([key, value]) => ALLOWED_SERVER_PROPERTY_KEYS.has(key) && value !== undefined)
      .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 80) : value]),
  );
}

/** Best-effort capture for existing Convex actions/HTTP handlers. Never throws or writes to Convex. */
export async function captureServerAnalytics(input: {
  distinctId: unknown;
  event: string;
  properties?: ServerAnalyticsProperties;
}): Promise<void> {
  const projectToken = String(process.env.POSTHOG_PROJECT_TOKEN || "").trim();
  const distinctId = safeDistinctId(input.distinctId);
  if (!/^phc_[A-Za-z0-9]+$/.test(projectToken) || !distinctId) return;

  const host = String(process.env.POSTHOG_HOST || DEFAULT_POSTHOG_HOST).replace(/\/$/, "");
  try {
    await fetch(`${host}/i/v0/e/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(800),
      body: JSON.stringify({
        api_key: projectToken,
        distinct_id: distinctId,
        event: input.event,
        properties: safeProperties({
          ...input.properties,
          environment: process.env.APP_ENV || "development",
          source: "convex",
        }),
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // Provider latency or downtime must never alter the product operation.
  }
}

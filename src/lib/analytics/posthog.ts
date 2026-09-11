import PostHog from "posthog-react-native";

import { AnalyticsProperties, isOpaqueAnalyticsUserId, sanitizeAnalyticsProperties } from "./privacy";

const PROJECT_TOKEN = (process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN || "").trim();
const HOST = (process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").trim();
const ENVIRONMENT = (process.env.EXPO_PUBLIC_ENV || (__DEV__ ? "development" : "production")).trim();

export const isPostHogConfigured = /^phc_[A-Za-z0-9]+$/.test(PROJECT_TOKEN);

if (__DEV__ && !isPostHogConfigured) {
  console.warn(
    "EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN is configured",
  );
}

export const posthog = new PostHog(PROJECT_TOKEN || "phc_disabled", {
  host: HOST,
  disabled: !isPostHogConfigured,
  captureAppLifecycleEvents: true,
  disableGeoip: true,
  enableSessionReplay: false,
  preloadFeatureFlags: false,
  sendFeatureFlagEvent: false,
  disableRemoteFeatureFlags: true,
  flushAt: 20,
  flushInterval: 10_000,
  maxBatchSize: 100,
  maxQueueSize: 1_000,
  requestTimeout: 8_000,
  fetchRetryCount: 2,
  fetchRetryDelay: 1_000,
});

export function captureAnalyticsEvent(event: string, properties?: AnalyticsProperties): void {
  if (!isPostHogConfigured) return;
  try {
    posthog.capture(event, {
      ...sanitizeAnalyticsProperties(properties),
      environment: ENVIRONMENT,
    });
  } catch {
    // Analytics must never affect a product flow.
  }
}

export function identifyAnalyticsUser(userId: unknown, properties?: AnalyticsProperties): void {
  if (!isPostHogConfigured || !isOpaqueAnalyticsUserId(userId)) return;
  try {
    posthog.identify(userId, sanitizeAnalyticsProperties(properties));
  } catch {
    // Identity telemetry is best-effort and must not affect authentication.
  }
}

export function resetAnalyticsIdentity(): void {
  if (!isPostHogConfigured) return;
  try {
    posthog.reset();
  } catch {
    // Logout must still complete if analytics storage is unavailable.
  }
}

export function captureAnalyticsScreen(route: string): void {
  if (!isPostHogConfigured) return;
  const safeRoute = route.replace(/[^A-Za-z0-9_/[\]().-]/g, "").slice(0, 120);
  if (!safeRoute) return;
  try {
    posthog.screen(safeRoute, { route: safeRoute, environment: ENVIRONMENT });
  } catch {
    // Navigation must never depend on analytics.
  }
}

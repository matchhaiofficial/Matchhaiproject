export type EasypaisaCapability = {
  available: boolean;
  environment: "production" | "staging" | "unconfigured";
  hostedFallbackEnabled: boolean;
  reason: string;
};

/**
 * Resolve provider readiness without exposing credentials. An environment is
 * never inferred: callers must explicitly configure production or staging.
 */
export function resolveEasypaisaCapability(
  env: Record<string, string | undefined>,
): EasypaisaCapability {
  const configuredEnvironment = String(env.EASYPAISA_ENV || "").trim().toLowerCase();
  const environment = configuredEnvironment === "production" || configuredEnvironment === "staging"
    ? configuredEnvironment
    : "unconfigured";
  const explicitlyEnabled = env.EASYPAISA_ENABLED === "1";
  const hostedFallbackEnabled = explicitlyEnabled && environment !== "unconfigured" && env.EASYPAISA_HOSTED_FALLBACK_ENABLED === "1";
  const hasSiteUrl = Boolean(String(env.EXPO_PUBLIC_CONVEX_SITE_URL || env.CONVEX_SITE_URL || "").trim());
  const hasStoreId = Boolean(String(env.EASYPAISA_STORE_ID || "").trim());
  const hasRestCredentials = Boolean(
    String(env.EASYPAISA_API_USERNAME || "").trim() &&
      String(env.EASYPAISA_API_PASSWORD || "").trim(),
  );

  if (environment === "unconfigured") {
    return {
      available: false,
      environment,
      hostedFallbackEnabled: false,
      reason: "Easypaisa payments are temporarily unavailable.",
    };
  }
  if (!explicitlyEnabled) {
    return {
      available: false,
      environment,
      hostedFallbackEnabled: false,
      reason: "Easypaisa payments are temporarily unavailable.",
    };
  }
  if (!hasSiteUrl || !hasStoreId || !hasRestCredentials) {
    return {
      available: false,
      environment,
      hostedFallbackEnabled,
      reason: "Easypaisa payments are temporarily unavailable.",
    };
  }

  return {
    available: true,
    environment,
    hostedFallbackEnabled,
    reason: "Easypaisa is ready for configured provider operations.",
  };
}

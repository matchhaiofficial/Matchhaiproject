import { ConvexReactClient } from "convex/react";

const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL;
const APP_ENV = String(process.env.EXPO_PUBLIC_ENV || "development").trim().toLowerCase();

type ConvexUrlValidationOptions = {
  appEnv?: string;
  deploymentClass?: string;
  allowedUrls?: string;
};

function normalizeConvexOrigin(value: string): string | null {
  try {
    const parsed = new URL(value.trim());
    if (
      parsed.protocol !== "https:"
      || parsed.username
      || parsed.password
      || parsed.port
      || (parsed.pathname !== "" && parsed.pathname !== "/")
      || parsed.search
      || parsed.hash
      || !/^[a-z0-9]+(?:-[a-z0-9]+)*\.convex\.cloud$/i.test(parsed.hostname)
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function parseAllowedConvexOrigins(value: string | undefined): Set<string> {
  return new Set(
    String(value || "")
      .split(",")
      .map((entry) => normalizeConvexOrigin(entry))
      .filter((entry): entry is string => Boolean(entry)),
  );
}

// Fail clearly instead of silently constructing a client against an empty or
// placeholder backend URL (CR-04). A build/QA run with missing or unreplaced
// production config should be obvious, not a silent no-backend app.
export function assertConvexUrl(
  url: string | undefined,
  options: ConvexUrlValidationOptions = {},
): asserts url is string {
  const appEnv = String(options.appEnv ?? APP_ENV).trim().toLowerCase();
  const deploymentClass = String(
    options.deploymentClass ?? process.env.EXPO_PUBLIC_CONVEX_DEPLOYMENT_CLASS ?? "",
  ).trim().toLowerCase();
  const rawAllowedUrls = options.allowedUrls ?? process.env.EXPO_PUBLIC_CONVEX_ALLOWED_URLS;
  const allowedUrls = parseAllowedConvexOrigins(rawAllowedUrls);
  const normalizedUrl = url ? normalizeConvexOrigin(url) : null;

  if (!normalizedUrl || String(url).includes("REPLACE_WITH_")) {
    throw new Error(
      "[convex] EXPO_PUBLIC_CONVEX_URL must be an explicit HTTPS Convex cloud URL " +
        "without a path, query, or placeholder.",
    );
  }

  const isProductionBuild = appEnv === "production" || appEnv === "prod";
  if (isProductionBuild) {
    if (deploymentClass !== "production") {
      throw new Error(
        "[convex] Production builds must declare EXPO_PUBLIC_CONVEX_DEPLOYMENT_CLASS=production.",
      );
    }
    if (!allowedUrls.size || !allowedUrls.has(normalizedUrl)) {
      throw new Error(
        "[convex] Production builds must allowlist their exact production Convex URL " +
          "through EXPO_PUBLIC_CONVEX_ALLOWED_URLS.",
      );
    }
  } else if (deploymentClass === "production") {
    throw new Error(
      "[convex] A non-production build cannot declare a production Convex deployment class.",
    );
  }

  if (rawAllowedUrls?.trim() && !allowedUrls.size) {
    throw new Error(
      "[convex] EXPO_PUBLIC_CONVEX_ALLOWED_URLS contains no valid Convex cloud URLs.",
    );
  }
  if (allowedUrls.size && !allowedUrls.has(normalizedUrl)) {
    throw new Error(
      "[convex] EXPO_PUBLIC_CONVEX_URL is outside EXPO_PUBLIC_CONVEX_ALLOWED_URLS.",
    );
  }
}

export function createConvexClient() {
  assertConvexUrl(CONVEX_URL);
  return new ConvexReactClient(CONVEX_URL, {
    unsavedChangesWarning: false,
  });
}

// The "active" Convex client used by direct (non-React) service calls.
//
// AuthenticatedConvexProvider creates a fresh, auth-bridged client per session
// (to avoid Convex sync-version crashes across login/logout) and registers it
// here via setActiveConvexClient(). Service functions that run outside the React
// tree must use this same client so their queries/mutations carry the signed-in
// user's auth token. Before the provider registers a client, this defaults to a
// standalone (unauthenticated) instance so module-load-time calls still work.
let activeConvexClient: ConvexReactClient = createConvexClient();

export function setActiveConvexClient(client: ConvexReactClient): void {
  activeConvexClient = client;
}

export function getConvexClient(): ConvexReactClient {
  return activeConvexClient;
}

// Backwards-compatible export. This Proxy transparently forwards every property
// access (query/mutation/action/watchQuery/etc.) to whichever client is
// currently active, so existing `import { convex }` callers always use the
// authenticated, per-session client without any code changes.
export const convex: ConvexReactClient = new Proxy({} as ConvexReactClient, {
  get(_target, property) {
    const client = getConvexClient() as any;
    const value = client[property];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

// Types will be available after running `npx convex dev`
// Re-export will be: export type { Id, Doc } from "../../convex/_generated/dataModel";

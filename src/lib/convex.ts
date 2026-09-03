import { ConvexReactClient } from "convex/react";

const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL;

// Fail clearly instead of silently constructing a client against an empty or
// placeholder backend URL (CR-04). A build/QA run with missing or unreplaced
// production config should be obvious, not a silent no-backend app.
function assertConvexUrl(url: string | undefined): asserts url is string {
  if (!url || url.includes("REPLACE_WITH_")) {
    throw new Error(
      "[convex] EXPO_PUBLIC_CONVEX_URL is not configured for this build profile. " +
        "Set the correct Convex deployment URL (see eas.json env per profile).",
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

import { ConvexReactClient } from "convex/react";

const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL;

if (!CONVEX_URL) {
  console.warn("[convex] EXPO_PUBLIC_CONVEX_URL is not set");
}

export function createConvexClient() {
  return new ConvexReactClient(CONVEX_URL || "", {
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

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

// Shared client for direct service calls outside React provider auth context.
export const convex = createConvexClient();

// Types will be available after running `npx convex dev`
// Re-export will be: export type { Id, Doc } from "../../convex/_generated/dataModel";

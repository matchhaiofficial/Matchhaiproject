import { ConvexReactClient } from "convex/react";

const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL;

if (!CONVEX_URL) {
  console.warn("[convex] EXPO_PUBLIC_CONVEX_URL is not set");
}

// Create the Convex client singleton
export const convex = new ConvexReactClient(CONVEX_URL || "", {
  unsavedChangesWarning: false,
});

// Types will be available after running `npx convex dev`
// Re-export will be: export type { Id, Doc } from "../../convex/_generated/dataModel";

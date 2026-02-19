import { ConvexReactClient } from "convex/react";

export const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL ?? "";

export const convex =
  convexUrl.length > 0 ? new ConvexReactClient(convexUrl) : null;

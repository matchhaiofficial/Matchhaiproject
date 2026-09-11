import { PostHogProvider } from "posthog-react-native";
import type { PropsWithChildren } from "react";

import { posthog } from "../lib/analytics/posthog";

export default function AnalyticsProvider({ children }: PropsWithChildren) {
  return (
    <PostHogProvider client={posthog} debug={__DEV__} autocapture={{ captureScreens: false, captureTouches: false }}>
      {children}
    </PostHogProvider>
  );
}

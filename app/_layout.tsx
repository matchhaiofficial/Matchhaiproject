// app/_layout.tsx
export const unstable_settings = { initialRouteName: "index" };

import * as Linking from "expo-linking";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { LogBox, View } from "react-native";

// Suppress the keep-awake error in development (Expo internal issue)
LogBox.ignoreLogs([
  "Unable to activate keep awake",
  "Uncaught (in promise, id: 0) Error: Unable to activate keep awake",
  // Easypaisa failures are user-facing via toasts; don't show LogBox overlays for them.
  "[CONVEX A(easypaisa:startCheckout)]",
  "[CONVEX A(easypaisa:syncTransactionStatus)]",
  // PSN lookup failures are handled by the verification toast.
  "[CONVEX A(externalApis:verifyPsnProfile)]",
]);

if (__DEV__) {
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const text = args.map((item) => String(item ?? "")).join(" ");
    if (text.includes("Unable to activate keep awake")) {
      return;
    }
    if (
      text.includes("[CONVEX A(easypaisa:startCheckout)]") ||
      text.includes("[CONVEX A(easypaisa:syncTransactionStatus)]") ||
      text.includes("[CONVEX A(externalApis:verifyPsnProfile)]")
    ) {
      return;
    }
    originalConsoleError(...args);
  };
}

// Fonts
import { Lora_400Regular, useFonts as useLora } from "@expo-google-fonts/lora";
import { Martel_400Regular, useFonts as useMartel } from "@expo-google-fonts/martel";
import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  useFonts as useMontserrat,
} from "@expo-google-fonts/montserrat";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts as useInter
} from "@expo-google-fonts/inter";

// Theme + Auth provider + Toast
import Toast from "react-native-toast-message";
import AuthProvider from "../src/context/AuthContext";
import AppErrorBoundary from "../src/components/AppErrorBoundary";
import { initMonitoring } from "../src/lib/monitoring";
import NotificationRuntimeBridge from "../src/components/NotificationRuntimeBridge";
import PushRegistrationBridge from "../src/components/PushRegistrationBridge";
import MatchResultGate from "../src/components/MatchResultGate";
import AuthenticatedConvexProvider from "../src/providers/AuthenticatedConvexProvider";
import InAppAlertProvider from "../src/providers/InAppAlertProvider";
import { useToast } from "../src/hooks/useToast";
import { COLORS } from "../src/theme";
import { toastConfig } from "../src/ui/toastConfig";

export default function RootLayout() {
  const [montLoaded] = useMontserrat({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
  });
  const [loraLoaded] = useLora({ Lora_400Regular });
  const [martelLoaded] = useMartel({ Martel_400Regular });
  const [interLoaded] = useInter({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold
  });

  const ready = montLoaded && loraLoaded && martelLoaded && interLoaded;
  const { showToast } = useToast();

  useEffect(() => {
    // Initialise provider-agnostic monitoring once, BEFORE the keep-awake
    // filter below captures the global handler — this way monitoring's handler
    // becomes the "previous" handler the filter chains to, so both run.
    initMonitoring();

    const globalAny = globalThis as any;
    const errorUtils = globalAny.ErrorUtils;
    const previousGlobalErrorHandler =
      typeof errorUtils?.getGlobalHandler === "function"
        ? errorUtils.getGlobalHandler()
        : null;
    const previousUnhandled = globalAny.onunhandledrejection;

    if (typeof errorUtils?.setGlobalHandler === "function") {
      errorUtils.setGlobalHandler((error: any, isFatal: boolean) => {
        const message = String(error?.message || error || "");
        if (message.includes("Unable to activate keep awake")) {
          return;
        }
        if (typeof previousGlobalErrorHandler === "function") {
          previousGlobalErrorHandler(error, isFatal);
        }
      });
    }

    globalAny.onunhandledrejection = (event: any) => {
      const reason = event?.reason;
      const message = String(reason?.message || reason || "");
      if (message.includes("Unable to activate keep awake")) {
        event?.preventDefault?.();
        return;
      }
      if (typeof previousUnhandled === "function") {
        previousUnhandled(event);
      }
    };

    const handleDeepLink = (event: { url: string }) => {
      const { url } = event;

      const parsed = Linking.parse(url);

      const path = parsed.path; // e.g. "oauth"
      const params = parsed.queryParams || {};

      if (path === "oauth") {
        const provider = (params.provider as string | undefined) || "Provider";
        const error = params.error as string | undefined;
        const nickname = params.nickname as string | undefined;
        const faceitId = params.faceitId as string | undefined;
        const steamId = params.steamId as string | undefined;

        if (error) {
          showToast({
            type: "error",
            title: "Social login failed",
            message: `${provider}: ${decodeURIComponent(error)}`,
          });
          return;
        }

        if (provider === "faceit" || provider === "steam") {
          const providerLabel = provider === "faceit" ? "FACEIT" : "Steam";
          // Never echo externally-supplied provider IDs/nicknames into a
          // production toast — keep that detail to dev diagnostics only.
          if (__DEV__) {
            showToast({
              type: "success",
              title: `${providerLabel} login callback`,
              message: `nickname=${nickname || ""} · faceitId=${faceitId || ""} · steamId=${steamId || ""}`,
            });
          } else {
            showToast({
              type: "success",
              title: "Account linked",
              message: `Your ${providerLabel} account was connected.`,
            });
          }
        } else if (__DEV__) {
          showToast({
            type: "info",
            title: "OAuth callback",
            message: `Unknown provider: ${provider}`,
          });
        }
      }
    };

    const sub = Linking.addEventListener("url", handleDeepLink);
    return () => {
      if (typeof errorUtils?.setGlobalHandler === "function" && previousGlobalErrorHandler) {
        errorUtils.setGlobalHandler(previousGlobalErrorHandler);
      }
      globalAny.onunhandledrejection = previousUnhandled;
      sub.remove();
    };
  }, [showToast]);

  if (!ready) return null;

  return (
    <AppErrorBoundary>
      <AuthenticatedConvexProvider>
        <AuthProvider>
          <InAppAlertProvider>
            <View style={{ flex: 1, backgroundColor: COLORS.backgroundDark }}>
              <StatusBar style="light" translucent backgroundColor="transparent" />
              <NotificationRuntimeBridge />
              <PushRegistrationBridge />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: COLORS.backgroundDark },
                }}
              />
              <MatchResultGate />
              <Toast config={toastConfig} />
            </View>
          </InAppAlertProvider>
        </AuthProvider>
      </AuthenticatedConvexProvider>
    </AppErrorBoundary>
  );
}


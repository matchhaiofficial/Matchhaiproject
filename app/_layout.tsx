// app/_layout.tsx
export const unstable_settings = { initialRouteName: "auth/login" };

import * as Linking from "expo-linking";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { LogBox, Text, View } from "react-native";
import { router } from "expo-router";
import {
  addNotificationResponseReceivedListener,
  getLastNotificationResponseAsync,
} from "expo-notifications/build/NotificationsEmitter";
import { ConvexAuthProvider, useAuthActions } from "@convex-dev/auth/react";

// Suppress the keep-awake error in development (Expo internal issue)
LogBox.ignoreLogs([
  "Unable to activate keep awake",
  "Uncaught (in promise, id: 0) Error: Unable to activate keep awake",
]);

if (__DEV__) {
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const text = args.map((item) => String(item ?? "")).join(" ");
    if (text.includes("Unable to activate keep awake")) {
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
import InAppNotificationBridge from "../src/components/InAppNotificationBridge";
import { useToast } from "../src/hooks/useToast";
import {
  ensureLocalNotificationsConfigured,
  requestLocalNotificationPermissions,
} from "../src/services/localNotifications";
import { COLORS } from "../src/theme";
import { toastConfig } from "../src/ui/toastConfig";
import { convex } from "../src/config/convexClient";
import { convexAuthStorage } from "../src/config/convexAuthStorage";
import { clearConvexAuthStorage } from "../src/utils/convexAuth";

function ForceSignOutOnStart() {
  const { signOut } = useAuthActions();
  const ranRef = React.useRef(false);

  useEffect(() => {
    if (process.env.EXPO_PUBLIC_FORCE_SIGN_OUT !== "1") return;
    if (ranRef.current) return;
    ranRef.current = true;

    void signOut()
      .catch(() => null)
      .finally(() => {
        void clearConvexAuthStorage();
      });
  }, [signOut]);

  return null;
}

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
      console.log("[Linking] Received URL:", url);

      const parsed = Linking.parse(url);
      console.log("[Linking] Parsed:", parsed);

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

        if (provider === "faceit") {
          showToast({
            type: "success",
            title: "FACEIT login callback",
            message: `nickname=${nickname || ""} · faceitId=${faceitId || ""}`,
          });
        } else if (provider === "steam") {
          showToast({
            type: "success",
            title: "Steam login callback",
            message: `steamId=${steamId || ""}`,
          });
        } else {
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

  useEffect(() => {
    ensureLocalNotificationsConfigured()
      .then(() => requestLocalNotificationPermissions())
      .catch(() => {
        // Ignore notification setup failures in development/simulator environments.
      });

    const sub = addNotificationResponseReceivedListener((response) => {
      const data: any = response?.notification?.request?.content?.data || {};
      const href = data?.href;
      if (typeof href === "string" && href.length) {
        router.push(href as any);
      }
    });

    getLastNotificationResponseAsync()
      .then((response) => {
        const data: any = response?.notification?.request?.content?.data || {};
        const href = data?.href;
        if (typeof href === "string" && href.length) {
          router.push(href as any);
        }
      })
      .catch(() => null);

    return () => sub.remove();
  }, []);

  if (!ready) return null;
  if (!convex) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ color: COLORS.text, textAlign: "center" }}>
          Missing EXPO_PUBLIC_CONVEX_URL. Add it to your environment before starting the app.
        </Text>
      </View>
    );
  }

  return (
    <ConvexAuthProvider client={convex} storage={convexAuthStorage}>
      <AuthProvider>
        <ForceSignOutOnStart />
        <View style={{ flex: 1, backgroundColor: COLORS.background }}>
          <StatusBar style="light" translucent backgroundColor="transparent" />
          <InAppNotificationBridge />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: COLORS.background },
            }}
          />
          {/* Global toast host */}
          <Toast config={toastConfig} />
        </View>
      </AuthProvider>
    </ConvexAuthProvider>
  );
}

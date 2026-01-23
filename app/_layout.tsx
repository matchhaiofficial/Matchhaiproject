// app/_layout.tsx
export const unstable_settings = { initialRouteName: "auth/login" };

import * as Linking from "expo-linking";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { LogBox, View } from "react-native";

// Suppress the keep-awake error in development (Expo internal issue)
LogBox.ignoreLogs(['Unable to activate keep awake']);

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
      sub.remove();
    };
  }, [showToast]);

  if (!ready) return null;

  return (
    <AuthProvider>
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        <StatusBar style="light" translucent backgroundColor="transparent" />
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
  );
}

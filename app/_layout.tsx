// app/_layout.tsx

export const unstable_settings = { initialRouteName: "auth/login" };

import * as Linking from "expo-linking";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { Alert, View } from "react-native";

// Fonts
import { Lora_400Regular, useFonts as useLora } from "@expo-google-fonts/lora";
import { Martel_400Regular, useFonts as useMartel } from "@expo-google-fonts/martel";
import {
  Montserrat_700Bold,
  useFonts as useMontserrat,
} from "@expo-google-fonts/montserrat";

// Theme + Auth provider
import AuthProvider from "../src/context/AuthContext";
import { COLORS } from "../src/theme";

export default function RootLayout() {
  const [montLoaded] = useMontserrat({ Montserrat_700Bold });
  const [loraLoaded] = useLora({ Lora_400Regular });
  const [martelLoaded] = useMartel({ Martel_400Regular });

  const ready = montLoaded && loraLoaded && martelLoaded;

  // ❗ Hooks must be called unconditionally, so this useEffect
  // must come BEFORE any `if (!ready) return null;`
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const { url } = event;
      console.log("[Linking] Received URL:", url);

      const parsed = Linking.parse(url);
      console.log("[Linking] Parsed:", parsed);

      const path = parsed.path; // e.g. "oauth"
      const params = parsed.queryParams || {};

      if (path === "oauth") {
        const provider = params.provider as string | undefined;
        const error = params.error as string | undefined;
        const nickname = params.nickname as string | undefined;
        const faceitId = params.faceitId as string | undefined;
        const steamId = params.steamId as string | undefined;

        if (error) {
          Alert.alert(
            "Social login failed",
            `${provider || "Provider"}: ${decodeURIComponent(error)}`
          );
          return;
        }

        if (provider === "faceit") {
          Alert.alert(
            "FACEIT login callback",
            `nickname=${nickname || ""}\nfaceitId=${faceitId || ""}`
          );
          // TODO: later -> use Firebase custom token + navigate to /home
        } else if (provider === "steam") {
          Alert.alert("Steam login callback", `steamId=${steamId || ""}`);
        } else {
          Alert.alert("OAuth callback", `Unknown provider: ${provider}`);
        }
      }
    };

    const sub = Linking.addEventListener("url", handleDeepLink);
    return () => {
      sub.remove();
    };
  }, []); // runs once

  if (!ready) return null;

  return (
    <AuthProvider>
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: COLORS.background },
          }}
        />
      </View>
    </AuthProvider>
  );
}

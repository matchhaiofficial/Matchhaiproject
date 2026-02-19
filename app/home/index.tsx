// app/home/index.tsx
import { Redirect, router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { useAuthActions } from "@convex-dev/auth/react";

import { useAuth } from "../../src/context/AuthContext";
import { getUserRole } from "../../src/utils/role";
import { COLORS, FONTS } from "../../src/theme";
import styles from "./home.styles";

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { signOut } = useAuthActions();
  const [signingOut, setSigningOut] = useState(false);

  const role = getUserRole(user);

  useEffect(() => {
    if (!authLoading && !user) {
      console.log("[Home] no user -> redirecting to /auth/login");
      router.replace("/auth/login");
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (!authLoading && user) {
      if (role === "superAdmin") {
        router.replace("/super-admin/(tabs)");
        return;
      }
      if (role === "zoneAdmin") {
        router.replace("/zone/(tabs)");
      }
    }
  }, [authLoading, role, user]);

  if (authLoading) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  if (!user) {
    return null;
  }

  const name = user.displayName || "";
  const email = user.email || "";

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch (error: any) {
      Alert.alert("Logout Failed", error?.message || "Please try again.");
    } finally {
      setSigningOut(false);
    }
  };

  const fallbackHref =
    role === "superAdmin"
      ? "/super-admin/(tabs)"
      : role === "zoneAdmin"
        ? "/zone/(tabs)"
        : "/(player)/(tabs)";

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Hi{name ? `, ${name}` : ""}</Text>
      <Text style={styles.sub}>Signed in as {email}</Text>

      <View style={styles.card}>
        <Text style={styles.sub}>Redirecting to Dashboard...</Text>
      </View>

      <Redirect href={fallbackHref as any} />

      <Pressable
        onPress={handleLogout}
        disabled={signingOut}
        style={({ pressed }) => [
          {
            backgroundColor: COLORS.accent,
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: "center",
            marginTop: 20,
          },
          pressed && !signingOut && { opacity: 0.92 },
        ]}
        android_ripple={{ color: "rgba(255,255,255,0.08)" }}
      >
        {signingOut ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: COLORS.text, fontSize: 16, fontFamily: FONTS.montserratBold }}>
            Logout
          </Text>
        )}
      </Pressable>
    </View>
  );
}

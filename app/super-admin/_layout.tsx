// app/super-admin/_layout.tsx
import { Redirect, Stack } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "../../src/context/AuthContext";
import { getUserRole } from "../../src/utils/role";
import { COLORS } from "../../src/theme";
import Logger from "../../src/utils/logger";

export default function SuperAdminLayout() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/auth/login" />;
  }

  const role = getUserRole(user);
  if (role !== "superAdmin") {
    Logger.warn("SuperAdminLayout", "Access denied: user is not a super-admin", {
      role,
    });
    return <Redirect href="/auth/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="request/[id]" options={{ presentation: "modal" }} />
    </Stack>
  );
}

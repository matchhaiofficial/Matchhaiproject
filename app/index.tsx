// app/index.tsx
import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "../src/context/AuthContext";
import { getUserRole } from "../src/utils/role";
import { COLORS } from "../src/theme";

export default function IndexGate() {
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

  if (role === "superAdmin") {
    return <Redirect href={"/super-admin" as any} />;
  }

  if (role === "zoneAdmin") {
    return <Redirect href="/zone/(tabs)" />;
  }

  return <Redirect href="/(player)/(tabs)" />;
}

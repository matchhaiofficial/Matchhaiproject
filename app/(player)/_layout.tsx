import { Redirect, Stack } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "../../src/context/AuthContext";
import { APP_ROUTES } from "../../src/navigation/routes";
import { COLORS } from "../../src/theme";
import { getDefaultSignedInRoute, isZoneAccount, isSuperAdminProfile } from "../../src/utils/accountRouting";

export default function PlayerLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.backgroundDark,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href={APP_ROUTES.authLogin} />;
  }

  if (isSuperAdminProfile(user) || isZoneAccount(user)) {
    return <Redirect href={getDefaultSignedInRoute(user) as any} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.backgroundDark },
      }}
    />
  );
}

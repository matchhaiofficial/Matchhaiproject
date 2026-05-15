import { Redirect, Stack } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "../../src/context/AuthContext";
import { APP_ROUTES } from "../../src/navigation/routes";
import { useLoginFormStore } from "../../src/store/loginFormStore";
import { useOnboardingStore } from "../../src/store/onboardingStore";
import { COLORS } from "../../src/theme";
import { getDefaultSignedInRoute, isZoneAccount, isSuperAdminProfile } from "../../src/utils/accountRouting";

export default function PlayerLayout() {
  const { user, loading } = useAuth();
  const resetLoginForm = useLoginFormStore((state) => state.reset);
  const registrationPhase = useOnboardingStore((state) => state.registrationPhase);
  const resetOnboarding = useOnboardingStore((state) => state.resetAll);
  const isSuperAdmin = isSuperAdminProfile(user);
  const isZoneUser = isZoneAccount(user);

  useEffect(() => {
    if (!loading && user && !isSuperAdmin && !isZoneUser && registrationPhase === "success") {
      resetOnboarding();
    }
    if (!loading && user && !isSuperAdmin && !isZoneUser) {
      resetLoginForm();
    }
  }, [isSuperAdmin, isZoneUser, loading, registrationPhase, resetLoginForm, resetOnboarding, user]);

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

  if (isSuperAdmin || isZoneUser) {
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

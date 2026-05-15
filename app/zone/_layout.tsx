import { Redirect, Stack } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "../../src/context/AuthContext";
import { useLoginFormStore } from "../../src/store/loginFormStore";
import { useZoneOnboardingStore } from "../../src/store/zoneOnboardingStore";
import { COLORS } from "../../src/theme";
import { isSuperAdminProfile, isZoneAccount } from "../../src/utils/accountRouting";

export default function ZoneLayout() {
    const { user, loading } = useAuth();
    const resetLoginForm = useLoginFormStore((state) => state.reset);
    const registrationPhase = useZoneOnboardingStore((state) => state.registrationPhase);
    const resetOnboarding = useZoneOnboardingStore((state) => state.resetAll);
    const isZoneUser = isZoneAccount(user);
    const isSuperAdmin = isSuperAdminProfile(user);

    useEffect(() => {
        if (!loading && user && isZoneUser && registrationPhase === "success") {
            resetOnboarding();
        }
        if (!loading && user && isZoneUser) {
            resetLoginForm();
        }
    }, [isZoneUser, loading, registrationPhase, resetLoginForm, resetOnboarding, user]);

    // Show loading while checking auth state
    if (loading) {
        return (
            <View style={{ flex: 1, backgroundColor: COLORS.backgroundDark, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={COLORS.accent} />
            </View>
        );
    }

    // Redirect to login if not authenticated
    if (!user) {
        return <Redirect href="/auth/login" />;
    }

    if (!isZoneUser && !isSuperAdmin) {
        return <Redirect href="/(player)/(tabs)" />;
    }

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: COLORS.backgroundDark },
            }}
        >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modules" options={{ headerShown: false }} />
            <Stack.Screen name="profile/edit" options={{ headerShown: false }} />
            <Stack.Screen name="report/[id]" options={{ presentation: "modal", headerShown: false }} />
            <Stack.Screen name="branch/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="branch/new" options={{ presentation: "modal", headerShown: false }} />
        </Stack>
    );
}

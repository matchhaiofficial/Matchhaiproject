import { Redirect, Stack } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "../../src/context/AuthContext";
import { getUserRole } from "../../src/utils/role";
import { COLORS } from "../../src/theme";

export default function ZoneLayout() {
    const { user, loading } = useAuth();
    const role = getUserRole(user);

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

    if (role !== "zoneAdmin" && role !== "superAdmin") {
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
            <Stack.Screen name="branch/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="branch/new" options={{ presentation: "modal", headerShown: false }} />
        </Stack>
    );
}

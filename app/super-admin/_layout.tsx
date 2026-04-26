// app/super-admin/_layout.tsx
import { Redirect, Stack } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "../../src/context/AuthContext";
import { COLORS } from "../../src/theme";
import { isSuperAdminProfile } from "../../src/utils/accountRouting";
import Logger from "../../src/utils/logger";

export default function SuperAdminLayout() {
    const { user, loading: authLoading } = useAuth();

    // Show loading while checking auth state or profile
    if (authLoading) {
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

    // Redirect if not super-admin
    const isSuperAdmin = isSuperAdminProfile(user);

    if (!isSuperAdmin) {
        Logger.warn("SuperAdminLayout", "Access denied: user is not a super-admin", { role: user?.role });
        return <Redirect href="/auth/login" />;
    }

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: COLORS.backgroundDark },
            }}
        >
            <Stack.Screen name="(tabs)/index" options={{ headerShown: false }} />
            <Stack.Screen name="easypaisa" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="request/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="report/[id]" options={{ presentation: 'modal', headerShown: false }} />
        </Stack>
    );
}


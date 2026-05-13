// app/super-admin/_layout.tsx
import { Redirect, Stack } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "../../src/context/AuthContext";
import { COLORS } from "../../src/theme";
import { isSuperAdminProfile } from "../../src/utils/accountRouting";
import Logger from "../../src/utils/logger";
import {
    recordSuperAdminAccessDenied,
    recordSuperAdminRouteAccess,
} from "../../src/services/convex/superAdminService";

export default function SuperAdminLayout() {
    const { user, loading: authLoading } = useAuth();
    const isSuperAdmin = isSuperAdminProfile(user);

    useEffect(() => {
        if (authLoading || !user) return;
        if (isSuperAdmin) {
            void recordSuperAdminRouteAccess("/super-admin");
            return;
        }
        Logger.warn("SuperAdminLayout", "Access denied: user is not a super-admin", { role: user?.role });
        void recordSuperAdminAccessDenied("/super-admin", "not_authorized");
    }, [authLoading, isSuperAdmin, user]);

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

    if (!isSuperAdmin) {
        return <Redirect href="/auth/login" />;
    }

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: COLORS.backgroundDark },
            }}
        >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="easypaisa" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="request/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="report/[id]" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="support-tickets" options={{ headerShown: false }} />
            <Stack.Screen name="support-ticket/[id]" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="audit-logs" options={{ headerShown: false }} />
            <Stack.Screen name="matchrooms" options={{ headerShown: false }} />
            <Stack.Screen name="matchroom/[id]" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="support" options={{ presentation: 'modal', headerShown: false }} />
        </Stack>
    );
}


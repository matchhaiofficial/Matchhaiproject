// app/super-admin/_layout.tsx
import { Redirect, Stack } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "../../src/context/AuthContext";
import { getUserProfile, UserProfile } from "../../src/services/userService";
import { COLORS } from "../../src/theme";
import Logger from "../../src/utils/logger";

export default function SuperAdminLayout() {
    const { user, loading: authLoading } = useAuth();
    const [profile, setProfile] = React.useState<UserProfile | null>(null);
    const [profileLoading, setProfileLoading] = React.useState(true);

    React.useEffect(() => {
        async function loadProfile() {
            if (user) {
                const res = await getUserProfile(user.uid);
                if (res.ok) {
                    setProfile(res.data);
                }
            }
            setProfileLoading(false);
        }
        loadProfile();
    }, [user]);

    // Show loading while checking auth state or profile
    if (authLoading || (!!user && profileLoading)) {
        return (
            <View style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={COLORS.accent} />
            </View>
        );
    }

    // Redirect to login if not authenticated
    if (!user) {
        return <Redirect href="/auth/login" />;
    }

    // Redirect if not super-admin
    const isSuperAdmin = profile?.role === "super-admin" ||
        (user?.email && user.email.toLowerCase() === "superadmin@matchhai.com") ||
        user?.uid === "jM2JZrPNNNahPb844rHmr0MQKYo1";

    if (!isSuperAdmin) {
        Logger.warn("SuperAdminLayout", "Access denied: user is not a super-admin", { role: profile?.role });
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
            <Stack.Screen name="request/[id]" options={{ presentation: 'modal' }} />
        </Stack>
    );
}

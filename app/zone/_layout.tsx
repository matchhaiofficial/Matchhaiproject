import { Redirect, Stack } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "../../src/context/AuthContext";
import { COLORS } from "../../src/theme";
import Logger from "../../src/utils/logger";

export default function ZoneLayout() {
    const { user, loading } = useAuth();

    React.useEffect(() => {
        Logger.debug('ZoneLayout', 'Mounting zone layout');
        return () => Logger.debug('ZoneLayout', 'Unmounting zone layout');
    }, []);

    // Show loading while checking auth state
    if (loading) {
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

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: COLORS.background },
            }}
        >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
    );
}

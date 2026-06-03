import { Redirect, Stack } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "../../src/context/AuthContext";
import { APP_ROUTES } from "../../src/navigation/routes";
import { COLORS } from "../../src/theme";

export default function MatchroomsLayout() {
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

    // Matchroom links (incl. shared deep links / QR) require a session. The
    // backend still enforces per-viewer access (getById returns a public-safe
    // projection to non-members and null to outsiders of private rooms); this
    // guard just sends logged-out users through login first. Zone admins and
    // super admins are intentionally allowed (owning-zone check-in / oversight).
    if (!user) {
        return <Redirect href={APP_ROUTES.authLogin} />;
    }

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: COLORS.backgroundDark },
                animation: "slide_from_right",
            }}
        >
            <Stack.Screen name="create/index" options={{ presentation: "card" }} />
            <Stack.Screen name="[id]" />
        </Stack>
    );
}

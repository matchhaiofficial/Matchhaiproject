import { Stack } from "expo-router";
import React from "react";
import { COLORS } from "../../src/theme";

export default function MatchroomsLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: COLORS.background },
                animation: "slide_from_right",
            }}
        >
            <Stack.Screen name="create/index" options={{ presentation: "card" }} />
            <Stack.Screen name="[id]" />
        </Stack>
    );
}

import { Stack } from "expo-router";
import React from "react";
import { COLORS } from "../../src/theme";

export default function TeamsLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: COLORS.background }
            }}
        >
            <Stack.Screen name="create" />
            <Stack.Screen name="[id]" />
        </Stack>
    );
}

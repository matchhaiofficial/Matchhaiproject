import { Stack } from "expo-router";
import React from "react";
import { COLORS } from "../../src/theme";

export default function TeamsLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: COLORS.backgroundDark }
            }}
        >
            <Stack.Screen name="create" />
            <Stack.Screen name="[id]" />
            <Stack.Screen name="challenges" />
            <Stack.Screen name="challenge" />
            <Stack.Screen name="challenge-chat" />
            <Stack.Screen name="challenge-create" />
        </Stack>
    );
}


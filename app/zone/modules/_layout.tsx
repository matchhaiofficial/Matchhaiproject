import { Stack } from "expo-router";
import React from "react";
import { COLORS } from "../../../src/theme";

export default function ZoneModulesLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: COLORS.backgroundDark },
                animation: "slide_from_right",
            }}
        />
    );
}

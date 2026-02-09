import { MaterialIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, FONTS } from "../../../src/theme";

export default function ZoneTabsLayout() {
    const insets = useSafeAreaInsets();
    const hideZoneTabBar = process.env.EXPO_PUBLIC_HIDE_TAB_BAR === "1";

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarHideOnKeyboard: true,
                tabBarStyle: hideZoneTabBar
                    ? { display: "none" }
                    : {
                        backgroundColor: COLORS.cardDark,
                        borderTopWidth: 1,
                        borderTopColor: "rgba(255,255,255,0.1)",
                        height: 65 + insets.bottom,
                        paddingBottom: insets.bottom + 8,
                        paddingTop: 12,
                        paddingHorizontal: 16,
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                        elevation: 10,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: -4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                    },
                tabBarActiveTintColor: COLORS.accent,
                tabBarInactiveTintColor: COLORS.textSecondary,
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: "600",
                    fontFamily: FONTS.interMedium,
                    marginTop: 4,
                },
                tabBarIconStyle: {
                    marginTop: 4,
                },
                tabBarItemStyle: {
                    paddingVertical: 4,
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: "Home",
                    tabBarIcon: ({ color }) => (
                        <MaterialIcons name="home" size={24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="branches"
                options={{
                    title: "Branches",
                    tabBarIcon: ({ color }) => (
                        <MaterialIcons name="store" size={24} color={color} />
                    ),
                }}
            />
            {/* Hide style files from navigation */}
            <Tabs.Screen
                name="_zone-dashboard.styles"
                options={{
                    href: null,
                }}
            />
            <Tabs.Screen
                name="dashboard.styles"
                options={{
                    href: null,
                }}
            />
            <Tabs.Screen
                name="branches.styles"
                options={{
                    href: null,
                }}
            />
        </Tabs>
    );
}

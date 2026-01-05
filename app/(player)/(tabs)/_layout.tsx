import { MaterialIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS } from "../../../src/theme";

export default function PlayerTabsLayout() {
    const insets = useSafeAreaInsets();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    position: 'absolute',
                    backgroundColor: COLORS.cardDark,
                    borderTopWidth: 1,
                    borderTopColor: 'rgba(255,255,255,0.1)',
                    height: 65 + insets.bottom,
                    paddingBottom: insets.bottom + 8,
                    paddingTop: 12,
                    paddingHorizontal: 16,
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    elevation: 10,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    bottom: 0,
                    left: 0,
                    right: 0,
                },
                tabBarActiveTintColor: COLORS.accent,
                tabBarInactiveTintColor: COLORS.textSecondary,
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
                    fontFamily: "Inter_500Medium",
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
                        <MaterialIcons
                            name="home"
                            size={24}
                            color={color}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="matchrooms"
                options={{
                    title: "Rooms",
                    tabBarIcon: ({ color }) => (
                        <MaterialIcons
                            name="sports-esports"
                            size={24}
                            color={color}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="find-players"
                options={{
                    title: "Find Players",
                    tabBarIcon: ({ color }) => (
                        <MaterialIcons
                            name="people"
                            size={24}
                            color={color}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="teams"
                options={{
                    title: "Teams",
                    tabBarIcon: ({ color }) => (
                        <MaterialIcons
                            name="groups"
                            size={24}
                            color={color}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: "Profile",
                    tabBarIcon: ({ color }) => (
                        <MaterialIcons
                            name="person"
                            size={24}
                            color={color}
                        />
                    ),
                }}
            />
            {/* Hide style files and other unwanted routes from navigation */}
            <Tabs.Screen
                name="_dashboard.styles"
                options={{
                    href: null,
                }}
            />
            <Tabs.Screen
                name="teams.styles"
                options={{
                    href: null,
                }}
            />
            <Tabs.Screen
                name="find-players.styles"
                options={{
                    href: null,
                }}
            />
            <Tabs.Screen
                name="profile.styles"
                options={{
                    href: null,
                }}
            />
            <Tabs.Screen
                name="matchrooms.styles"
                options={{
                    href: null,
                }}
            />
            <Tabs.Screen
                name="live.styles"
                options={{
                    href: null,
                }}
            />
            <Tabs.Screen
                name="live"
                options={{
                    href: null,
                }}
            />
        </Tabs >
    );
}

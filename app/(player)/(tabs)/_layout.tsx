import { MaterialIcons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../../src/context/AuthContext";
import { COLORS, FONTS } from "../../../src/theme";

export default function PlayerTabsLayout() {
    const insets = useSafeAreaInsets();
    const { user, loading } = useAuth();

    // ✅ If super-admin, force redirect to their dashboard
    const isSuperAdmin = (user?.email && user.email.toLowerCase() === "superadmin@matchhai.com") ||
        user?.uid === "jM2JZrPNNNahPb844rHmr0MQKYo1";

    if (!loading && isSuperAdmin) {
        return <Redirect href="/super-admin/(tabs)" />;
    }

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
                        <MaterialIcons
                            name="home"
                            size={24}
                            color={color}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="discover"
                options={{
                    title: "Discover",
                    tabBarIcon: ({ color }) => (
                        <MaterialIcons
                            name="explore"
                            size={24}
                            color={color}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="matchrooms"
                options={{
                    href: null,
                }}
            />
            <Tabs.Screen
                name="find-players"
                options={{
                    href: null,
                }}
            />
            <Tabs.Screen
                name="teams"
                options={{
                    href: null,
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
                name="discover.styles"
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

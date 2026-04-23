import { Redirect, Tabs } from "expo-router";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "../../../src/components/AppIcon";
import { useAuth } from "../../../src/context/AuthContext";
import { COLORS, FONTS } from "../../../src/theme";
import { getDefaultSignedInRoute, isSuperAdminProfile, isZoneAccount } from "../../../src/utils/accountRouting";
import { hasVerifiedEmail } from "../../../src/utils/emailVerificationGate";

const HIDE_PLAYER_TAB_BAR = process.env.EXPO_PUBLIC_HIDE_TAB_BAR === '1';
const TAB_BAR_BASE_HEIGHT = 65;
const TAB_BAR_EXTRA_BOTTOM_PADDING = 18;

export default function PlayerTabsLayout() {
    const insets = useSafeAreaInsets();
    const { user, authUser, loading } = useAuth();

    // ✅ If super-admin, force redirect to their dashboard
    const isSuperAdmin = isSuperAdminProfile(user);
    const isZoneUser = isZoneAccount(user);
    const emailVerified = hasVerifiedEmail(authUser);

    if (!loading && (isSuperAdmin || isZoneUser)) {
        return <Redirect href={getDefaultSignedInRoute(user) as any} />;
    }

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarHideOnKeyboard: true,
                tabBarStyle: HIDE_PLAYER_TAB_BAR
                    ? { display: 'none' }
                    : {
                        backgroundColor: COLORS.cardDark,
                        borderTopWidth: 1,
                        borderTopColor: 'rgba(255,255,255,0.1)',
                        height: TAB_BAR_BASE_HEIGHT + insets.bottom + TAB_BAR_EXTRA_BOTTOM_PADDING,
                        paddingBottom: insets.bottom + TAB_BAR_EXTRA_BOTTOM_PADDING,
                        paddingTop: 12,
                        paddingHorizontal: 16,
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                        elevation: 10,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: -4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
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
                        <AppIcon
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
                    href: emailVerified ? undefined : null,
                    title: "Discover",
                    tabBarIcon: ({ color }) => (
                        <AppIcon
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
                        <AppIcon
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
                name="discover.styles"
                options={{
                    href: null,
                }}
            />
        </Tabs >
    );
}

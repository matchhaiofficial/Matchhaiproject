import { MaterialIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS } from "../../../src/theme";
import Logger from "../../../src/utils/logger";

export default function ZoneTabsLayout() {
    const insets = useSafeAreaInsets();

    React.useEffect(() => {
        Logger.debug('ZoneTabsLayout', 'Mounting zone tabs layout');
    }, []);

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    position: 'absolute',
                    backgroundColor: COLORS.cardDark,
                    borderTopWidth: 1,
                    borderTopColor: COLORS.overlayMedium,
                    height: 65 + insets.bottom,
                    paddingBottom: insets.bottom + 8,
                    paddingTop: 12,
                    paddingHorizontal: 16,
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    // Elevated design
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 10,
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
                    title: "Dashboard",
                    tabBarIcon: ({ color }) => (
                        <MaterialIcons name="dashboard" size={24} color={color} />
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
        </Tabs>
    );
}

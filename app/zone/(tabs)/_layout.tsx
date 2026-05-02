import { Tabs } from "expo-router";
import React from "react";
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

import { AppIcon } from "../../../src/components/AppIcon";
import { COLORS, FONTS } from "../../../src/theme";

// Responsive helpers (mirrors PlayerTabsLayout)
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const isSmall = SCREEN_WIDTH < 360;
const isLarge = SCREEN_WIDTH >= 428;

const TAB_BAR_H = isSmall ? 58 : 64;
const ICON_SIZE = isSmall ? 20 : 23;
const LABEL_SIZE = isSmall ? 9 : 10;
const H_PADDING = isSmall ? 10 : isLarge ? 28 : 16;
const PILL_R = 22;

// Tab definitions
type TabDef = { name: string; label: string; icon: string };

const TABS: TabDef[] = [
    { name: "index", label: "Home", icon: "home" },
    { name: "branches", label: "Branches", icon: "store" },
];

// Custom Tab Bar
function ZoneCustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const insets = useSafeAreaInsets();

    const hideZoneTabBar = process.env.EXPO_PUBLIC_HIDE_TAB_BAR === "1";
    if (hideZoneTabBar) return null;

    // Only render routes that exist in our TABS list (hides style files etc.)
    const visibleRoutes = state.routes.filter((route) =>
        TABS.some((t) => t.name === route.name)
    );

    const bottomPad = Math.max(insets.bottom, 8);

    return (
        <View
            pointerEvents="box-none"
            style={[
                styles.outerWrap,
                { paddingBottom: bottomPad, paddingHorizontal: H_PADDING },
            ]}
        >
            {/* Soft glow behind pill */}
            <View style={styles.glow} />

            {/* Floating pill */}
            <View style={styles.pill}>
                {/* Glass highlight on top edge */}
                <View style={styles.pillHighlight} />

                {visibleRoutes.map((route) => {
                    const focusedIndex = state.routes.findIndex((r) => r.key === route.key);
                    const isFocused = state.index === focusedIndex;

                    const def = TABS.find((t) => t.name === route.name)!;
                    const label = def.label;
                    const icon = def.icon;

                    const handlePress = () => {
                        const event = navigation.emit({
                            type: "tabPress",
                            target: route.key,
                            canPreventDefault: true,
                        });
                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }
                    };

                    return (
                        <Pressable
                            key={route.key}
                            onPress={handlePress}
                            style={styles.tabItem}
                            android_ripple={{ color: "transparent", borderless: true }}
                        >
                            {isFocused && <View style={styles.activeChip} />}

                            <View style={[styles.iconRow, isFocused && styles.iconRowActive]}>
                                <AppIcon
                                    name={icon as any}
                                    size={ICON_SIZE}
                                    color={isFocused ? COLORS.accent : "rgba(255,255,255,0.38)"}
                                />
                            </View>

                            <Text
                                numberOfLines={1}
                                style={[
                                    styles.label,
                                    { fontSize: LABEL_SIZE },
                                    isFocused ? styles.labelActive : styles.labelInactive,
                                ]}
                            >
                                {label}
                            </Text>

                            {isFocused && <View style={styles.underlineBar} />}
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

// Layout
export default function ZoneTabsLayout() {
    return (
        <Tabs
            tabBar={(props) => <ZoneCustomTabBar {...props} />}
            screenOptions={{
                headerShown: false,
                tabBarHideOnKeyboard: true,
            }}
        >
            <Tabs.Screen
                name="index"
                options={{ title: "Home" }}
            />
            <Tabs.Screen
                name="branches"
                options={{ title: "Branches" }}
            />
            {/* Hide style files from navigation — unchanged */}
            <Tabs.Screen name="_zone-dashboard.styles" options={{ href: null }} />
            <Tabs.Screen name="dashboard.styles" options={{ href: null }} />
            <Tabs.Screen name="branches.styles" options={{ href: null }} />
        </Tabs>
    );
}

// Styles (identical tokens to PlayerTabsLayout)
const styles = StyleSheet.create({
    outerWrap: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: "center",
        pointerEvents: "box-none",
        paddingTop: 8,
        backgroundColor: COLORS.backgroundDark,
    },

    glow: {
        position: "absolute",
        bottom: 0,
        left: H_PADDING + 20,
        right: H_PADDING + 20,
        height: TAB_BAR_H + 24,
        backgroundColor: COLORS.accent,
        opacity: 0.06,
        borderRadius: PILL_R + 8,
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
    },

    pill: {
        width: "100%",
        height: TAB_BAR_H,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.cardDark,
        borderRadius: PILL_R,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255,255,255,0.1)",
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 16,
        elevation: 20,
    },

    pillHighlight: {
        position: "absolute",
        top: 0,
        left: 24,
        right: 24,
        height: 1,
        backgroundColor: "rgba(255,255,255,0.12)",
        borderRadius: 1,
    },

    tabItem: {
        flex: 1,
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 6,
        paddingBottom: 4,
        position: "relative",
    },

    activeChip: {
        position: "absolute",
        top: 6,
        bottom: 6,
        left: 8,
        right: 8,
        backgroundColor: "rgba(66,165,245,0.1)",
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(66,165,245,0.22)",
    },

    iconRow: {
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 2,
    },
    iconRowActive: {
        transform: [{ translateY: -1 }],
    },

    label: {
        fontFamily: FONTS.montserratMedium,
        letterSpacing: 0.2,
        textAlign: "center",
    },
    labelActive: {
        color: COLORS.accent,
        fontWeight: "700",
    },
    labelInactive: {
        color: "rgba(255,255,255,0.38)",
        fontWeight: "500",
    },

    underlineBar: {
        position: "absolute",
        bottom: 4,
        width: 20,
        height: 3,
        borderRadius: 2,
        backgroundColor: COLORS.accent,
        opacity: 0.85,
    },
});

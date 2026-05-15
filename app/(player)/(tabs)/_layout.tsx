import { Redirect, Tabs } from "expo-router";
import { useQuery } from "convex/react";
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

import { AppIcon, type AppIconName } from "../../../src/components/AppIcon";
import { useAuth } from "../../../src/context/AuthContext";
import { COLORS, FONTS } from "../../../src/theme";
import { getSystemBottomInset } from "../../../src/utils/bottomChrome";
import {
    getDefaultSignedInRoute,
    isSuperAdminProfile,
    isZoneAccount,
} from "../../../src/utils/accountRouting";
import { isKycAccessAllowed } from "../../../src/utils/verificationGate";
import { api } from "../../../convex/_generated/api";

const HIDE_PLAYER_TAB_BAR = process.env.EXPO_PUBLIC_HIDE_TAB_BAR === "1";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const isSmall = SCREEN_WIDTH < 360;
const isLarge = SCREEN_WIDTH >= 428;

const TAB_BAR_H = isSmall ? 58 : 64;
const ICON_SIZE = isSmall ? 20 : 23;
const LABEL_SIZE = isSmall ? 9 : 10;
const H_PADDING = isSmall ? 10 : isLarge ? 28 : 16;
const PILL_R = 22;

type TabDef = { name: string; label: string; icon: AppIconName };

const TABS: TabDef[] = [
    { name: "index", label: "Home", icon: "home" },
    { name: "discover", label: "Discover", icon: "discover" },
    { name: "profile", label: "Profile", icon: "profile" },
];

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const insets = useSafeAreaInsets();

    if (HIDE_PLAYER_TAB_BAR) return null;

    const visibleRoutes = state.routes.filter((route) => {
        if (!TABS.some((tab) => tab.name === route.name)) return false;

        const opts = descriptors[route.key]?.options as any;
        if (opts?.tabBarButton !== undefined) {
            try {
                const result = opts.tabBarButton({});
                if (result === null) return false;
            } catch {
                return false;
            }
        }

        return true;
    });

    const bottomPad = Math.max(getSystemBottomInset(insets.bottom), 8);

    return (
        <View
            pointerEvents="box-none"
            style={[
                styles.outerWrap,
                { paddingBottom: bottomPad, paddingHorizontal: H_PADDING },
            ]}
        >
            <View style={styles.glow} />

            <View style={styles.pill}>
                <View style={styles.pillHighlight} />

                {visibleRoutes.map((route) => {
                    const focusedIndex = state.routes.findIndex((item) => item.key === route.key);
                    const isFocused = state.index === focusedIndex;
                    const def = TABS.find((tab) => tab.name === route.name)!;

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
                                    name={def.icon}
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
                                {def.label}
                            </Text>

                            {isFocused && <View style={styles.underlineBar} />}
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

export default function PlayerTabsLayout() {
    const { user, loading } = useAuth();
    const insets = useSafeAreaInsets();

    const isSuperAdmin = isSuperAdminProfile(user);
    const isZoneUser = isZoneAccount(user);
    const currentKyc = useQuery(api.kyc.getCurrentUserKyc);
    const verificationDocLoading = Boolean(user?.identityVerificationId) && currentKyc === undefined;
    const kycStatus = currentKyc?.status || user?.kycVerificationStatus;
    const kycAccessAllowed =
        isKycAccessAllowed(kycStatus) &&
        !verificationDocLoading &&
        (!currentKyc || isKycAccessAllowed(currentKyc.status));
    const bottomPad = Math.max(getSystemBottomInset(insets.bottom), 8);
    const tabBarClearance = HIDE_PLAYER_TAB_BAR ? 0 : TAB_BAR_H + bottomPad;

    if (!loading && (isSuperAdmin || isZoneUser)) {
        return <Redirect href={getDefaultSignedInRoute(user) as any} />;
    }

    return (
        <Tabs
            tabBar={(props) => <CustomTabBar {...props} />}
            screenOptions={{
                headerShown: false,
                tabBarHideOnKeyboard: true,
                sceneStyle: {
                    backgroundColor: COLORS.backgroundDark,
                    paddingBottom: tabBarClearance,
                },
            }}
        >
            <Tabs.Screen name="index" options={{ title: "Home" }} />
            <Tabs.Screen
                name="discover"
                options={{
                    href: kycAccessAllowed ? undefined : null,
                    title: "Discover",
                }}
            />
            <Tabs.Screen name="matchrooms" options={{ href: null }} />
            <Tabs.Screen name="teams" options={{ href: null }} />
            <Tabs.Screen name="profile" options={{ title: "Profile" }} />
            <Tabs.Screen name="_dashboard.styles" options={{ href: null }} />
            <Tabs.Screen name="teams.styles" options={{ href: null }} />
            <Tabs.Screen name="profile.styles" options={{ href: null }} />
            <Tabs.Screen name="matchrooms.styles" options={{ href: null }} />
            <Tabs.Screen name="discover.styles" options={{ href: null }} />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    outerWrap: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: "center",
        pointerEvents: "box-none",
        paddingTop: 0,
        backgroundColor: "transparent",
    },

    glow: {
        position: "absolute",
        bottom: 0,
        left: H_PADDING + 20,
        right: H_PADDING + 20,
        height: TAB_BAR_H + 24,
        backgroundColor: "transparent",
        opacity: 0,
        borderRadius: PILL_R + 8,
        shadowOpacity: 0,
        shadowRadius: 0,
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
        shadowOpacity: 0,
        elevation: 0,
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

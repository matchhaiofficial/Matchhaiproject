import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import React from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon, type AppIconName } from "../../../src/components/AppIcon";
import { COLORS, FONTS } from "../../../src/theme";
import { getSystemBottomInset } from "../../../src/utils/bottomChrome";

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
  { name: "index", label: "Dashboard", icon: "dashboard" },
  { name: "payments", label: "Payments", icon: "paymentWallet" },
  { name: "reports", label: "Reports", icon: "reports" },
  { name: "profile", label: "Profile", icon: "profile" },
];

function SuperAdminTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  if (process.env.EXPO_PUBLIC_HIDE_TAB_BAR === "1") return null;
  const visibleRoutes = state.routes.filter((route) => TABS.some((tab) => tab.name === route.name));
  const bottomPad = Math.max(getSystemBottomInset(insets.bottom), 8);

  return (
    <View pointerEvents="box-none" style={[styles.outerWrap, { paddingBottom: bottomPad, paddingHorizontal: H_PADDING }]}>
      <View style={styles.pill}>
        <View style={styles.pillHighlight} />
        {visibleRoutes.map((route) => {
          const focusedIndex = state.routes.findIndex((item) => item.key === route.key);
          const isFocused = state.index === focusedIndex;
          const def = TABS.find((tab) => tab.name === route.name)!;
          return (
            <Pressable
              key={route.key}
              onPress={() => {
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={styles.tabItem}
              android_ripple={{ color: "transparent", borderless: true }}
            >
              {isFocused ? <View style={styles.activeChip} /> : null}
              <View style={[styles.iconRow, isFocused && styles.iconRowActive]}>
                <AppIcon name={def.icon} size={ICON_SIZE} color={isFocused ? COLORS.accent : "rgba(255,255,255,0.38)"} />
              </View>
              <Text
                numberOfLines={1}
                style={[styles.label, { fontSize: LABEL_SIZE }, isFocused ? styles.labelActive : styles.labelInactive]}
              >
                {def.label}
              </Text>
              {isFocused ? <View style={styles.underlineBar} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function SuperAdminTabsLayout() {
  return (
    <Tabs tabBar={(props) => <SuperAdminTabBar {...props} />} screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true }}>
      <Tabs.Screen name="index" options={{ title: "Dashboard" }} />
      <Tabs.Screen name="payments" options={{ title: "Payments" }} />
      <Tabs.Screen name="reports" options={{ title: "Reports" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      <Tabs.Screen name="index.styles" options={{ href: null }} />
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
    backgroundColor: COLORS.backgroundDark,
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
  },
  tabItem: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 6,
    paddingBottom: 4,
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

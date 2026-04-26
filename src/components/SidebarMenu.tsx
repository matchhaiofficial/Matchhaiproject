import React, { useMemo } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppDrawer } from "./AppModalPrimitives";
import { AppIcon, type AppIconName } from "./AppIcon";
import { AppImage } from "./AppImage";
import { useAuth } from "../context/AuthContext";
import { COLORS, FONTS, SPACING } from "../theme";

type SidebarItem = {
  label: string;
  icon: AppIconName;
  onPress: () => void;
};

type SidebarMenuProps = {
  visible: boolean;
  onClose: () => void;
  items: SidebarItem[];
};

const DRAWER_WIDTH = Math.min(420, Math.round(Dimensions.get("window").width * 0.94));

export default function SidebarMenu({ visible, onClose, items }: SidebarMenuProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const displayName = user?.fullName || "Player";
  const username = user?.username ? `@${user.username}` : "MatchHai Player";

  const avatarSource = useMemo(
    () => ({
      uri:
        user?.photoURL ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=2c2c2c&color=fff&size=128`,
    }),
    [displayName, user?.photoURL]
  );

  const headerPadding = useMemo(
    () => ({ paddingTop: Math.max(insets.top + 8, SPACING.lg) }),
    [insets.top]
  );

  // Split items: last item (Logout) gets special treatment if it's a danger action
  const mainItems = items.slice(0, -1);
  const lastItem = items[items.length - 1];
  const isLastItemDanger = lastItem?.label?.toLowerCase().includes("logout");

  return (
    <AppDrawer visible={visible} onClose={onClose} drawerStyle={styles.drawer}>
      <View style={[styles.drawerContent, headerPadding]}>

        {/* ── Header ── */}
        <View style={styles.header}>
          {/* Avatar with online ring */}
          <View style={styles.avatarWrapper}>
            <AppImage source={avatarSource} style={styles.avatar} />
            <View style={styles.onlineRing} />
            <View style={styles.onlineDot} />
          </View>

          <View style={styles.headerText}>
            <Text style={styles.displayName} numberOfLines={1} ellipsizeMode="tail">
              {displayName}
            </Text>
            <View style={styles.usernamePill}>
              <Text style={styles.usernameText} numberOfLines={1}>
                {username}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}
          >
            <AppIcon name="close" size="md" />
          </Pressable>
        </View>

        {/* ── Divider ── */}
        <View style={styles.divider} />

        {/* ── Menu Items ── */}
        <ScrollView
          style={styles.menuScroll}
          contentContainerStyle={[
            styles.menuList,
            { paddingBottom: insets.bottom + SPACING.lg },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionLabel}>NAVIGATION</Text>

          {mainItems.map((item, index) => (
            <Pressable
              key={item.label}
              onPress={() => {
                onClose();
                item.onPress();
              }}
              style={({ pressed }) => [
                styles.menuItem,
                pressed && styles.menuItemPressed,
              ]}
            >
              {/* Icon badge */}
              <View style={styles.menuIconWrap}>
                <AppIcon name={item.icon} size="md" tone="accent" />
              </View>

              <Text style={styles.menuText} numberOfLines={1} ellipsizeMode="tail">
                {item.label}
              </Text>

              <View style={styles.chevronWrap}>
                <AppIcon name="chevron-right" size="sm" tone="muted" />
              </View>
            </Pressable>
          ))}

          {/* ── Bottom action (e.g. Logout) ── */}
          {lastItem && (
            <>
              <View style={[styles.divider, { marginVertical: SPACING.md }]} />
              <Pressable
                onPress={() => {
                  onClose();
                  lastItem.onPress();
                }}
                style={({ pressed }) => [
                  styles.menuItem,
                  styles.dangerItem,
                  pressed && styles.dangerItemPressed,
                ]}
              >
                <View style={[styles.menuIconWrap, styles.dangerIconWrap]}>
                  <AppIcon
                    name={lastItem.icon}
                    size="md"
                    color={isLastItemDanger ? COLORS.error : undefined}
                    tone={isLastItemDanger ? undefined : "accent"}
                  />
                </View>
                <Text
                  style={[
                    styles.menuText,
                    isLastItemDanger && styles.dangerText,
                  ]}
                  numberOfLines={1}
                >
                  {lastItem.label}
                </Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </View>
    </AppDrawer>
  );
}

const styles = StyleSheet.create({
  drawer: {
    width: DRAWER_WIDTH,
    flex: 1,
    paddingHorizontal: 0,
  },
  drawerContent: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  avatarWrapper: {
    position: "relative",
    marginRight: SPACING.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  onlineRing: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.cardBorder,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
  },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4caf50",
    borderWidth: 2,
    borderColor: "#111",
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  displayName: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 17,
    letterSpacing: 0.2,
  },
  usernamePill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(66,165,245,0.12)",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(66,165,245,0.2)",
  },
  usernameText: {
    color: COLORS.accent,
    fontFamily: FONTS.martelRegular,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.overlayLight,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  closeButtonPressed: {
    opacity: 0.6,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  // ── Divider ──
  divider: {
    height: 1,
    backgroundColor: COLORS.cardBorder,
    marginHorizontal: -SPACING.sm,
    opacity: 0.6,
  },

  // ── Section label ──
  sectionLabel: {
    color: COLORS.muted,
    fontFamily: FONTS.martelRegular,
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
    paddingLeft: 2,
  },

  // ── Menu ──
  menuScroll: {
    flex: 1,
  },
  menuList: {
    gap: 6,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 12,
    backgroundColor: COLORS.overlayLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  menuItemPressed: {
    backgroundColor: "rgba(66,165,245,0.08)",
    borderColor: "rgba(66,165,245,0.25)",
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(66,165,245,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "rgba(66,165,245,0.15)",
  },
  menuText: {
    flex: 1,
    color: COLORS.text,
    fontFamily: FONTS.montserratMedium,
    fontSize: 14,
    letterSpacing: 0.1,
  },
  chevronWrap: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.4,
  },

  // ── Danger / Logout item ──
  dangerItem: {
    backgroundColor: "rgba(239,83,80,0.05)",
    borderColor: "rgba(239,83,80,0.15)",
  },
  dangerItemPressed: {
    backgroundColor: "rgba(239,83,80,0.1)",
    borderColor: "rgba(239,83,80,0.3)",
  },
  dangerIconWrap: {
    backgroundColor: "rgba(239,83,80,0.1)",
    borderColor: "rgba(239,83,80,0.2)",
  },
  dangerText: {
    color: COLORS.error,
  },
});
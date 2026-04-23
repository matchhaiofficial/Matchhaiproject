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
  const avatarSource = useMemo(
    () => ({
      uri:
        user?.photoURL ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=2c2c2c&color=fff&size=128`,
    }),
    [displayName, user?.photoURL]
  );

  const headerPadding = useMemo(
    () => ({ paddingTop: Math.max(insets.top, SPACING.lg) }),
    [insets.top]
  );

  return (
    <AppDrawer visible={visible} onClose={onClose} drawerStyle={styles.drawer}>
      <View style={[styles.drawerContent, headerPadding]}>
        <View style={styles.header}>
          <AppImage source={avatarSource} style={styles.avatar} />
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
              {displayName}
            </Text>
            <Text style={styles.subtitle}>Dashboard</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <AppIcon name="close" size="md" />
          </Pressable>
        </View>

        <ScrollView
          style={styles.menuScroll}
          contentContainerStyle={[styles.menuList, { paddingBottom: SPACING.md }]}
          showsVerticalScrollIndicator={false}
        >
          {items.map((item) => (
            <Pressable
              key={item.label}
              onPress={() => {
                onClose();
                item.onPress();
              }}
              style={styles.menuItem}
            >
              <View style={styles.menuIconWrap}>
                <AppIcon name={item.icon} size="md" tone="accent" />
              </View>
              <Text style={styles.menuText} numberOfLines={1} ellipsizeMode="tail">
                {item.label}
              </Text>
              <AppIcon
                style={styles.chevron}
                name="chevron-right"
                size="md"
                tone="muted"
              />
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </AppDrawer>
  );
}

const styles = StyleSheet.create({
  drawer: {
    width: DRAWER_WIDTH,
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  drawerContent: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  headerText: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  title: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 16,
  },
  subtitle: {
    color: COLORS.muted,
    fontFamily: FONTS.martelRegular,
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.overlayLight,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  menuScroll: {
    flex: 1,
  },
  menuList: {
    gap: SPACING.sm,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: COLORS.overlayLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  menuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(66,165,245,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
  },
  menuText: {
    flex: 1,
    color: COLORS.text,
    fontFamily: FONTS.montserratMedium,
    fontSize: 14,
    marginRight: SPACING.sm,
  },
  chevron: {
    flexShrink: 0,
  },
});

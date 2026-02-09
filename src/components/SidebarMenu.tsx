import { MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../context/AuthContext";
import { COLORS, FONTS, SPACING } from "../theme";

type SidebarItem = {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
};

type SidebarMenuProps = {
  visible: boolean;
  onClose: () => void;
  items: SidebarItem[];
  title?: string;
};

const DRAWER_WIDTH = Math.min(320, Math.round(Dimensions.get("window").width * 0.82));

export default function SidebarMenu({ visible, onClose, items, title = "Menu" }: SidebarMenuProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: visible ? 0 : -DRAWER_WIDTH,
      duration: visible ? 220 : 180,
      useNativeDriver: true,
    }).start();
  }, [visible, translateX]);

  const displayName = user?.displayName || "Player";
  const avatarUri = user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=2c2c2c&color=fff&size=128`;

  const headerPadding = useMemo(
    () => ({ paddingTop: Math.max(insets.top, SPACING.lg) }),
    [insets.top]
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Animated.View style={[styles.drawer, headerPadding, { transform: [{ translateX }] }]}>
          <View style={styles.header}>
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
            <View style={styles.headerText}>
              <Text style={styles.title}>{displayName}</Text>
              <Text style={styles.subtitle}>Dashboard</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>{title}</Text>

          <ScrollView
            style={styles.menuScroll}
            contentContainerStyle={[styles.menuList, { paddingBottom: SPACING.md }]}
            showsVerticalScrollIndicator={false}
          >
            {items.map((item) => (
              <TouchableOpacity
                key={item.label}
                onPress={() => {
                  onClose();
                  item.onPress();
                }}
                activeOpacity={0.85}
                style={styles.menuItem}
              >
                <View style={styles.menuIconWrap}>
                  <MaterialIcons name={item.icon} size={20} color={COLORS.accent} />
                </View>
                <Text style={styles.menuText}>{item.label}</Text>
                <MaterialIcons name="chevron-right" size={20} color={COLORS.muted} />
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SPACING.lg) }]}>
            <Text style={styles.footerHint}>Swipe or tap outside to close</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    flexDirection: "row",
  },
  backdrop: {
    flex: 1,
  },
  drawer: {
    width: DRAWER_WIDTH,
    backgroundColor: COLORS.cardDark,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    paddingHorizontal: SPACING.lg,
    borderRightWidth: 1,
    borderRightColor: COLORS.cardBorder,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 4, height: 0 },
    elevation: 8,
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
  },
  sectionLabel: {
    color: COLORS.muted,
    fontFamily: FONTS.martelRegular,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: SPACING.sm,
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
    paddingHorizontal: 12,
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
  },
  footer: {
    marginTop: SPACING.lg,
  },
  footerHint: {
    color: COLORS.muted,
    fontFamily: FONTS.martelRegular,
    fontSize: 11,
  },
});

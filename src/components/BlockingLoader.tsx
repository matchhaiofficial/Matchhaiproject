import React from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, View } from "react-native";

import { COLORS, FONTS, SPACING, TEXT_SIZES } from "../theme";

export function BlockingLoader({
  visible,
  label = "Please wait...",
}: {
  visible: boolean;
  label?: string;
}) {
  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible
      statusBarTranslucent
      navigationBarTranslucent={false}
    >
      <View style={styles.overlay} accessibilityRole="progressbar">
        <View style={styles.card}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.label}>{label}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 10, 10, 0.8)",
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
  },
  card: {
    width: "100%",
    maxWidth: 280,
    borderRadius: 14,
    backgroundColor: COLORS.cardDark,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    alignItems: "center",
    gap: SPACING.md,
  },
  label: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.body,
    textAlign: "center",
  },
});


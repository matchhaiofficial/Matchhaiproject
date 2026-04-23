import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppDialog, AppModalBody, AppModalFooter, AppModalHeader } from "./AppModalPrimitives";
import { AppIcon } from "./AppIcon";
import { AppButton } from "./AppPrimitives";
import { COLORS, FONTS, RADII, SPACING } from "../theme";

type Props = {
  visible: boolean;
  gameLabel: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function GameActivationPromptModal({
  visible,
  gameLabel,
  loading = false,
  onClose,
  onConfirm,
}: Props) {
  return (
    <AppDialog visible={visible} onClose={onClose} dismissDisabled={loading} cardStyle={styles.card}>
      <AppModalHeader title={`Enable ${gameLabel}`} onClose={onClose} closeDisabled={loading} />
      <AppModalBody contentContainerStyle={styles.content}>
        <View style={styles.sectionCard}>
          <View style={styles.iconWrap}>
            <AppIcon name="sports-esports" size={24} color={COLORS.accent} />
          </View>
          <Text style={styles.message}>
            This game is turned off in your profile. Turn it on to continue joining this matchroom.
          </Text>
        </View>
      </AppModalBody>
      <AppModalFooter style={styles.footer}>
        <View style={styles.actions}>
          <AppButton variant="secondary" onPress={onClose} disabled={loading} style={styles.actionButton}>
            Cancel
          </AppButton>
          <AppButton onPress={onConfirm} disabled={loading} loading={loading} style={styles.actionButton}>
            Turn On
          </AppButton>
        </View>
      </AppModalFooter>
    </AppDialog>
  );
}

const styles = StyleSheet.create({
  card: {
    maxWidth: 420,
  },
  content: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  sectionCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.xl,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.overlayLight,
    marginBottom: SPACING.md,
  },
  title: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 20,
  },
  message: {
    marginTop: SPACING.sm,
    color: COLORS.textSecondary,
    fontFamily: FONTS.martelRegular,
    fontSize: 13,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  footer: {
    paddingHorizontal: SPACING.xl,
  },
  actionButton: {
    flex: 1,
  },
});

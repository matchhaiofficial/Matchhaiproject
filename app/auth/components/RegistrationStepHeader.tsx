import React from "react";
import { StyleSheet, Text, View } from "react-native";

import AppHeader from "../../../src/components/AppHeader";
import { COLORS, FONTS, SPACING, TEXT_SIZES } from "../../../src/theme";

type RegistrationStepHeaderProps = {
  title: string;
  subtitle: string;
  stepTitle: string;
  stepSubtitle: string;
  progress: `${number}%` | number;
  onBack?: () => void;
};

export default function RegistrationStepHeader({
  title,
  subtitle,
  stepTitle,
  stepSubtitle,
  progress,
  onBack,
}: RegistrationStepHeaderProps) {
  return (
    <View style={styles.wrapper}>
      <AppHeader title={title} subtitle={subtitle} onBack={onBack} inlineTitle />
      <View style={styles.stepperWrapper}>
        <View style={styles.stepperTopRow}>
          <View>
            <Text style={styles.stepperTitle}>{stepTitle}</Text>
            <Text style={styles.stepperSubtitle}>{stepSubtitle}</Text>
          </View>
        </View>
        <View style={styles.stepperBar}>
          <View style={[styles.stepperBarFill, { width: progress as any }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: SPACING.lg,
  },
  stepperWrapper: {
    marginBottom: SPACING.md,
  },
  stepperTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  stepperTitle: {
    color: COLORS.text,
    fontFamily: FONTS.montserratSemiBold,
    fontSize: TEXT_SIZES.label,
  },
  stepperSubtitle: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
    marginTop: 2,
  },
  stepperBar: {
    height: 4,
    borderRadius: 999,
    backgroundColor: COLORS.inputBorder,
    overflow: "hidden",
  },
  stepperBarFill: {
    height: "100%",
    backgroundColor: COLORS.accent,
  },
});

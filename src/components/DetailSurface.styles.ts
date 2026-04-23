import { StyleSheet } from "react-native";

import {
  COLORS,
  FONTS,
  SHADOWS,
  SPACING,
  STATUS_TONES,
  TEXT_SIZES,
} from "../theme";

export default StyleSheet.create({
  sectionCard: {
    ...SHADOWS.cardSoft,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionHeaderCompact: {
    marginBottom: SPACING.sm,
  },
  sectionHeaderText: {
    flex: 1,
    gap: SPACING.xs,
  },
  sectionTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.lg,
  },
  sectionSubtitle: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
    lineHeight: 18,
  },
  keyValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.overlayLight,
  },
  keyValueRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  keyValueLabel: {
    flex: 1,
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.body,
  },
  keyValueValue: {
    flexShrink: 1,
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.body,
    textAlign: "right",
  },
  keyValueValueAccent: {
    color: COLORS.accent,
  },
  keyValueValueSuccess: {
    color: STATUS_TONES.success.text,
  },
  keyValueValueWarning: {
    color: STATUS_TONES.warning.text,
  },
  keyValueValueDanger: {
    color: STATUS_TONES.danger.text,
  },
});

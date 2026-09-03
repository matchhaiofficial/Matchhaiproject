import { StyleSheet } from "react-native";

import {
  COLORS,
  CONTROL_SIZES,
  CTA,
  FONTS,
  RADII,
  SHADOWS,
  SPACING,
  STATUS_TONES,
  SURFACES,
  TEXT_SIZES,
} from "../theme";

export default StyleSheet.create({
  cardBase: {
    backgroundColor: SURFACES.card,
    borderRadius: CONTROL_SIZES.cardRadius,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.lg,
  },
  cardSoft: {
    backgroundColor: SURFACES.cardAlt,
  },
  cardElevated: {
    ...SHADOWS.cardSoft,
  },
  cardEmpty: {
    alignItems: "center",
  },
  buttonBase: {
    minHeight: CONTROL_SIZES.buttonMd,
    borderRadius: RADII.lg,
    paddingHorizontal: SPACING.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: SPACING.xs,
  },
  buttonSm: {
    minHeight: CONTROL_SIZES.buttonSm,
    paddingHorizontal: SPACING.md,
  },
  buttonMd: {
    minHeight: CONTROL_SIZES.buttonMd,
  },
  buttonLg: {
    minHeight: CONTROL_SIZES.buttonLg,
  },
  buttonPrimary: {
    ...CTA.primaryButton,
  },
  buttonSecondary: {
    backgroundColor: SURFACES.strong,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  buttonGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  buttonDanger: {
    backgroundColor: STATUS_TONES.danger.background,
    borderWidth: 1,
    borderColor: STATUS_TONES.danger.border,
  },
  buttonSuccess: {
    backgroundColor: STATUS_TONES.success.background,
    borderWidth: 1,
    borderColor: STATUS_TONES.success.border,
  },
  buttonDisabled: {
    opacity: 0.55,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
  },
  buttonTextBase: {
    fontFamily: FONTS.interSemiBold,
    fontSize: TEXT_SIZES.label,
  },
  buttonTextPrimary: {
    color: "#FFFFFF",
  },
  buttonTextSecondary: {
    color: COLORS.text,
  },
  buttonTextGhost: {
    color: COLORS.text,
  },
  buttonTextDanger: {
    color: STATUS_TONES.danger.text,
  },
  buttonTextSuccess: {
    color: STATUS_TONES.success.text,
  },
  pillBase: {
    alignSelf: "flex-start",
    flexShrink: 0,
    minHeight: CONTROL_SIZES.chipMd,
    borderRadius: RADII.pill,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    justifyContent: "center",
  },
  pillText: {
    fontFamily: FONTS.interSemiBold,
    fontSize: 11,
    textTransform: "uppercase",
  },
  pillTextNoCaps: {
    textTransform: "none",
  },
});

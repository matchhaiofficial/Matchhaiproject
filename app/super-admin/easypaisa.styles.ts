import { StyleSheet } from "react-native";

import { COLORS, FONTS, RADII, SPACING, TEXT_SIZES } from "../../src/theme";

export default StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.backgroundDark,
  },
  content: {
    paddingBottom: SPACING.xxl + 24,
    gap: SPACING.lg,
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  controlsCard: {
    gap: SPACING.md,
  },
  searchInput: {
    minHeight: 48,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.inputBackground,
    paddingHorizontal: SPACING.md,
    color: COLORS.text,
    fontFamily: FONTS.interRegular,
    fontSize: TEXT_SIZES.input,
  },
  helperText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interRegular,
    fontSize: TEXT_SIZES.caption,
  },
  actionsRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  infoStack: {
    gap: SPACING.sm,
  },
  payloadSection: {
    gap: SPACING.sm,
  },
  payloadLabel: {
    color: COLORS.text,
    fontFamily: FONTS.interSemiBold,
    fontSize: TEXT_SIZES.label,
  },
  payloadBox: {
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.inputBackground,
    padding: SPACING.md,
  },
  payloadText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.montserratRegular,
    fontSize: TEXT_SIZES.caption,
    lineHeight: 18,
  },
});

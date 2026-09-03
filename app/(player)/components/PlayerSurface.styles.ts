import { StyleSheet } from "react-native";

import { COLORS, FONTS, SPACING, TEXT_SIZES } from "../../../src/theme";

export default StyleSheet.create({
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    flex: 1,
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.lg,
  },
  sectionAction: {
    color: COLORS.accent,
    fontFamily: FONTS.interSemiBold,
    fontSize: TEXT_SIZES.caption,
  },
  emptyCard: {
    alignItems: "center",
  },
  emptyTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.subheading,
    textAlign: "center",
  },
  emptyDescription: {
    marginTop: SPACING.sm,
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption + 1,
    lineHeight: 20,
    textAlign: "center",
  },
  emptyAction: {
    marginTop: SPACING.md,
    alignSelf: "stretch",
  },
});

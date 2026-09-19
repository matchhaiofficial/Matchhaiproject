import { StyleSheet } from "react-native";

import { COLORS, FONTS, SPACING } from "../../src/theme";

export default StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.backgroundDark,
  },
  tabs: {
    marginBottom: SPACING.lg,
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingBottom: SPACING.xxl,
    gap: SPACING.md,
  },
  cardPressed: {
    opacity: 0.9,
  },
  reportCard: {
    gap: SPACING.sm,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.md,
  },
  reason: {
    flex: 1,
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 16,
  },
  meta: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.martelRegular,
    fontSize: 12,
  },
  description: {
    color: COLORS.text,
    fontFamily: FONTS.martelRegular,
    fontSize: 13,
    lineHeight: 20,
  },
  linkHint: {
    marginTop: SPACING.xs,
    color: COLORS.accent,
    fontFamily: FONTS.interSemiBold,
    fontSize: 12,
  },
  emptyTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 18,
    textAlign: "center",
  },
  emptyText: {
    marginTop: SPACING.sm,
    color: COLORS.textSecondary,
    fontFamily: FONTS.martelRegular,
    fontSize: 13,
    textAlign: "center",
  },
});

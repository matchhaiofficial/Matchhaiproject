import { StyleSheet } from "react-native";

import { COLORS, FONTS, SPACING } from "../../../src/theme";

export default StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.backgroundDark,
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
  },
  emptyTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 18,
    textAlign: "center",
  },
  content: {
    paddingBottom: SPACING.xxl,
    gap: SPACING.md,
  },
  detailCard: {
    gap: SPACING.sm,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  reason: {
    flex: 1,
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 18,
  },
  meta: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.martelRegular,
    fontSize: 13,
  },
  description: {
    marginTop: SPACING.sm,
    color: COLORS.text,
    fontFamily: FONTS.martelRegular,
    fontSize: 14,
    lineHeight: 22,
  },
  placeholder: {
    marginTop: SPACING.sm,
    color: COLORS.textSecondary,
    fontFamily: FONTS.martelRegular,
    fontSize: 13,
  },
  noteTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 16,
  },
  noteText: {
    marginTop: SPACING.xs,
    color: COLORS.textSecondary,
    fontFamily: FONTS.martelRegular,
    fontSize: 13,
    lineHeight: 20,
  },
  updateLabel: {
    marginTop: SPACING.sm,
    color: COLORS.text,
    fontFamily: FONTS.interSemiBold,
    fontSize: 13,
  },
});

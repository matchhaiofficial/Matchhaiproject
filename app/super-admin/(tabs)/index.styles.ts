import { StyleSheet } from "react-native";

import { COLORS, FONTS, RADII, SPACING, TEXT_SIZES } from "../../../src/theme";

export default StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.backgroundDark,
  },
  screenContent: {
    paddingTop: 0,
  },
  headerBar: {
    marginBottom: SPACING.sm,
  },
  contentWrap: {
    flex: 1,
  },
  container: {
    gap: SPACING.md,
    paddingTop: SPACING.xs,
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCard: {
    overflow: "hidden",
    gap: SPACING.md,
  },
  heroAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: COLORS.accent,
  },
  heroMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    paddingLeft: SPACING.xs,
  },
  heroAvatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${COLORS.accent}22`,
    borderWidth: 1,
    borderColor: `${COLORS.accent}44`,
  },
  heroAvatarText: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.lg,
  },
  heroTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  heroLabel: {
    color: COLORS.accent,
    fontFamily: FONTS.interSemiBold,
    fontSize: TEXT_SIZES.caption,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.xl,
    marginTop: 2,
  },
  heroSubtitle: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
    lineHeight: 18,
    marginTop: 4,
  },
  heroStatusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
    paddingLeft: SPACING.xs,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
  },
  metricCard: {
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 132,
    justifyContent: "space-between",
  },
  metricTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  metricIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  metricValue: {
    flex: 1,
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.xl,
    textAlign: "right",
  },
  metricLabel: {
    color: COLORS.text,
    fontFamily: FONTS.interSemiBold,
    fontSize: TEXT_SIZES.label,
    marginTop: SPACING.sm,
  },
  metricDetail: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
    lineHeight: 17,
    marginTop: 4,
  },
  quickActionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
  },
  matchList: {
    gap: SPACING.md,
  },
  matchCardPressable: {
    borderRadius: RADII.lg,
  },
  pressed: {
    opacity: 0.9,
  },
  matchCard: {
    gap: SPACING.sm,
  },
  matchCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  matchTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  matchGame: {
    color: COLORS.accent,
    fontFamily: FONTS.interSemiBold,
    fontSize: TEXT_SIZES.caption,
  },
  matchTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.label,
    marginTop: 2,
  },
  matchMetaRow: {
    gap: SPACING.xs,
  },
  matchMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  matchMetaText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
  },
  matchFooterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  matchFooterText: {
    color: COLORS.muted,
    fontFamily: FONTS.interSemiBold,
    fontSize: TEXT_SIZES.caption,
  },
});

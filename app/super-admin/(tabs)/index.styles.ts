import { StyleSheet } from "react-native";

import { COLORS, CONTROL_SIZES, FONTS, RADII, SPACING, TEXT_SIZES } from "../../../src/theme";

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
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardDark,
    alignItems: "center",
    justifyContent: "center",
  },
  contentWrap: {
    flex: 1,
  },
  container: {
    paddingTop: SPACING.xs,
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  profileCard: {
    width: "100%",
    borderRadius: CONTROL_SIZES.cardRadius + 2,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.lg,
    backgroundColor: COLORS.cardDark,
  },
  profileTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  profileAccentBar: {
    width: 42,
    height: 4,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.accent,
    marginBottom: SPACING.md,
  },
  avatarContainer: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: `${COLORS.accent}55`,
    marginRight: SPACING.md,
  },
  avatarText: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.lg,
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.successBright,
    borderWidth: 2,
    borderColor: COLORS.backgroundDark,
  },
  profileTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  welcomeText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interMedium,
    fontSize: 11,
    marginBottom: 4,
  },
  username: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 21,
  },
  profileSubtitle: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interRegular,
    fontSize: TEXT_SIZES.caption,
    lineHeight: 18,
    marginTop: 4,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  section: {
    marginTop: SPACING.xl,
  },
  operationsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  operationTilePressable: {
    width: "48.5%",
    marginBottom: SPACING.md,
    borderRadius: CONTROL_SIZES.cardRadius + 2,
  },
  operationTile: {
    minHeight: 116,
    borderRadius: CONTROL_SIZES.cardRadius + 2,
    justifyContent: "space-between",
    borderColor: COLORS.cardBorder,
    padding: SPACING.md + 2,
  },
  operationIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 18,
  },
  operationTitle: {
    color: COLORS.text,
    fontFamily: FONTS.interSemiBold,
    fontSize: 16,
  },
  operationBadge: {
    position: "absolute",
    right: SPACING.md,
    top: SPACING.md,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.overlayLight,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  operationBadgeText: {
    color: COLORS.text,
    fontFamily: FONTS.interSemiBold,
    fontSize: 11,
  },
  snapshotPanel: {
    width: "100%",
    gap: SPACING.sm,
  },
  metricCard: {
    width: "100%",
    minHeight: 86,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    paddingVertical: SPACING.md,
  },
  metricIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  metricTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  metricLabel: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.label,
  },
  metricDetail: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interRegular,
    fontSize: TEXT_SIZES.caption,
    lineHeight: 16,
    marginTop: 3,
  },
  metricValue: {
    maxWidth: 96,
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.xl,
    textAlign: "right",
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

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
  headerActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
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
  notificationBadge: {
    position: "absolute",
    top: -5,
    right: -7,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.error,
    borderWidth: 2,
    borderColor: COLORS.backgroundDark,
  },
  notificationBadgeText: {
    color: "#fff",
    fontFamily: FONTS.heading,
    fontSize: 11,
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
    rowGap: SPACING.md,
  },
  quickActionCard: {
    width: "48.5%",
  },
  quickActionPaymentsIcon: {
    backgroundColor: `${COLORS.warning}18`,
    borderColor: `${COLORS.warning}44`,
  },
  quickActionWithdrawalsIcon: {
    backgroundColor: `${COLORS.success}18`,
    borderColor: `${COLORS.success}44`,
  },
  quickActionReportsIcon: {
    backgroundColor: `${COLORS.error}18`,
    borderColor: `${COLORS.error}44`,
  },
  quickActionZonesIcon: {
    backgroundColor: `${COLORS.warning}18`,
    borderColor: `${COLORS.warning}44`,
  },
  snapshotPanel: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: SPACING.sm,
  },
  metricCard: {
    width: "48.5%",
    flex: 0,
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

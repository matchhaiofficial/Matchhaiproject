import { StyleSheet } from "react-native";

import {
  COLORS,
  FONTS,
  RADII,
  SHADOWS,
  SPACING,
  SURFACES,
  TEXT_SIZES,
} from "../theme";

export default StyleSheet.create({
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionHeaderCompact: {
    marginBottom: SPACING.sm,
  },
  sectionHeaderText: {
    flex: 1,
    minWidth: 0,
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
    marginTop: 4,
    lineHeight: 18,
  },
  sectionAction: {
    color: COLORS.accent,
    fontFamily: FONTS.interSemiBold,
    fontSize: TEXT_SIZES.caption,
  },
  metricCard: {
    flex: 1,
    minWidth: 150,
    gap: SPACING.sm,
  },
  metricCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  metricIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${COLORS.accent}14`,
    borderWidth: 1,
    borderColor: `${COLORS.accent}44`,
  },
  metricValue: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 24,
  },
  metricLabel: {
    color: COLORS.text,
    fontFamily: FONTS.interSemiBold,
    fontSize: TEXT_SIZES.label,
  },
  metricSubtitle: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
    lineHeight: 18,
  },
  quickActionPressable: {
    flex: 1,
    minWidth: 150,
  },
  pressedCard: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  quickActionCard: {
    minHeight: 152,
    justifyContent: "space-between",
  },
  adminQuickActionCard: {
    justifyContent: "flex-start",  // ← don't stretch, stack from top
    gap: 8,
  },
  quickActionTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  quickActionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  quickActionTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.label,
    marginTop: SPACING.md,
  },
  quickActionDescription: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
    lineHeight: 18,
    marginTop: 4,
  },
  listCard: {
    gap: SPACING.md,
  },
  listCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  listCardHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  listCardTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.lg,
  },
  listCardSubtitle: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
    lineHeight: 18,
    marginTop: 4,
  },
  infoStack: {
    gap: SPACING.sm,
  },
  infoLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  infoLabel: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption + 1,
    flex: 1,
  },
  infoValue: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption + 1,
    flex: 1,
    textAlign: "right",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  emptyCard: {
    paddingVertical: SPACING.xl,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SURFACES.muted,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.lg,
    textAlign: "center",
  },
  emptyDescription: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption + 1,
    textAlign: "center",
    lineHeight: 20,
    marginTop: SPACING.sm,
  },
  noticeCard: {
    ...SHADOWS.cardSoft,
  },
});

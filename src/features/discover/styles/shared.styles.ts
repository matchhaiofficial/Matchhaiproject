import { StyleSheet } from "react-native";

import { COLORS, FONTS, SPACING, TEXT_SIZES } from "../../../theme";

export default StyleSheet.create({
  shell: {
    flex: 1,
  },
  discoverCard: {
    marginBottom: SPACING.md,
  },
  discoverCardPressed: {
    opacity: 0.92,
  },
  filterToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    backgroundColor: COLORS.background,
  },
  filterToggleText: {
    fontFamily: FONTS.heading,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  filtersPanel: {
    backgroundColor: COLORS.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    paddingVertical: 12,
    paddingBottom: 20,
  },
  filterSection: {
    marginBottom: 12,
  },
  filterLabel: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.heading,
    fontSize: 12,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  filterOptionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.cardBackground,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm - 1,
    minHeight: 38,
    maxWidth: "100%",
  },
  optionChipActive: {
    backgroundColor: COLORS.cardDark,
    borderColor: COLORS.accent,
  },
  optionChipPressed: {
    opacity: 0.88,
  },
  optionChipText: {
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.label - 1,
  },
  optionChipTextActive: {
    color: COLORS.text,
  },
  resultsCount: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  resultsCountText: {
    color: COLORS.textSecondary,
    fontSize: TEXT_SIZES.caption,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    marginBottom: SPACING.lg,
    opacity: 0.6,
  },
  emptyTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.subheading,
    marginBottom: SPACING.sm,
    textAlign: "center",
  },
  emptyText: {
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.body,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 300,
  },
  inlineTag: {
    alignSelf: "flex-start",
    minHeight: 24,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: "center",
  },
  inlineTagNeutral: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.divider,
  },
  inlineTagAccent: {
    backgroundColor: "rgba(66, 165, 245, 0.1)",
    borderColor: "rgba(66, 165, 245, 0.3)",
  },
  inlineTagSuccess: {
    backgroundColor: "rgba(0, 230, 118, 0.08)",
    borderColor: "rgba(0, 230, 118, 0.25)",
  },
  inlineTagWarning: {
    backgroundColor: "rgba(255, 152, 0, 0.1)",
    borderColor: "rgba(255, 152, 0, 0.28)",
  },
  inlineTagDanger: {
    backgroundColor: "rgba(239, 83, 80, 0.12)",
    borderColor: "rgba(239, 83, 80, 0.26)",
  },
  inlineTagGhost: {
    backgroundColor: "transparent",
    borderColor: COLORS.divider,
  },
  inlineTagText: {
    fontFamily: FONTS.heading,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  inlineTagTextNeutral: {
    color: COLORS.textSecondary,
  },
  inlineTagTextAccent: {
    color: COLORS.accent,
  },
  inlineTagTextSuccess: {
    color: COLORS.successBright,
  },
  inlineTagTextWarning: {
    color: COLORS.warning,
  },
  inlineTagTextDanger: {
    color: COLORS.error,
  },
  inlineTagTextGhost: {
    color: COLORS.textSecondary,
  },
  actionChip: {
    minHeight: 32,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  actionChipPressed: {
    opacity: 0.9,
  },
  actionChipAccent: {
    backgroundColor: "rgba(66, 165, 245, 0.1)",
    borderColor: COLORS.accent,
  },
  actionChipNeutral: {
    backgroundColor: COLORS.overlayMedium,
    borderColor: "transparent",
  },
  actionChipSuccess: {
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    borderColor: COLORS.success,
  },
  actionChipWarning: {
    backgroundColor: "rgba(255, 152, 0, 0.1)",
    borderColor: COLORS.warning,
  },
  actionChipDanger: {
    backgroundColor: "rgba(239, 83, 80, 0.12)",
    borderColor: COLORS.error,
  },
  actionChipText: {
    fontFamily: FONTS.heading,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  actionChipTextAccent: {
    color: COLORS.accent,
  },
  actionChipTextNeutral: {
    color: COLORS.text,
  },
  actionChipTextSuccess: {
    color: COLORS.success,
  },
  actionChipTextWarning: {
    color: COLORS.warning,
  },
  actionChipTextDanger: {
    color: COLORS.error,
  },
});

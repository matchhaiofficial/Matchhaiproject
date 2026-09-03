import { StyleSheet } from "react-native";

import { COLORS, CONTROL_SIZES, FONTS, RADII, SPACING, SURFACES, TEXT_SIZES } from "../../../theme";

export default StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.backgroundDark,
  },
  screenContent: {
    paddingTop: SPACING.sm,
    paddingBottom: 0,
  },
  header: {
    marginBottom: SPACING.sm,
  },
  scrollContent: {
    paddingBottom: SPACING.xl,
    gap: SPACING.xl,
  },
  scrollContentWithBottomAction: {
    paddingBottom: 120,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: SPACING.md,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interMedium,
    fontSize: 13,
  },
  errorWrap: {
    flex: 1,
    justifyContent: "center",
  },
  errorCard: {
    gap: SPACING.md,
  },
  stateTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.lg,
  },
  stateText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 20,
  },
  section: {
    gap: SPACING.md,
  },
  heroCard: {
    gap: SPACING.md,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  heroTitleWrap: {
    flex: 1,
    minWidth: 0,
    gap: SPACING.xs,
  },
  heroEyebrow: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interSemiBold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
  },
  heroSubtitle: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interRegular,
    fontSize: 13,
    lineHeight: 19,
  },
  heroChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  sectionTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.lg,
  },
  sectionHelper: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interRegular,
    fontSize: 12,
    lineHeight: 18,
  },
  branchCard: {
    gap: SPACING.md,
  },
  branchHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  branchTitleWrap: {
    flex: 1,
    gap: 6,
  },
  branchLabel: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interSemiBold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  branchTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "700",
  },
  branchMeta: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interRegular,
    fontSize: 12,
  },
  branchSelectorWrap: {
    gap: SPACING.sm,
  },
  branchSelectorLabel: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interSemiBold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  branchPillRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: SPACING.sm,
    paddingRight: SPACING.sm,
  },
  branchPill: {
    maxWidth: 220,
    minHeight: 48,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.overlayLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: 0,
    justifyContent: "center",
  },
  branchPillActive: {
    borderColor: COLORS.accent,
    backgroundColor: "rgba(66, 165, 245, 0.16)",
  },
  branchPillPressed: {
    opacity: 0.9,
  },
  branchPillText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interSemiBold,
    fontSize: 13,
    flexShrink: 0,
  },
  branchPillTextActive: {
    color: COLORS.text,
  },
  branchPillMeta: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interRegular,
    fontSize: 11,
    flexShrink: 1,
  },
  branchPillMetaActive: {
    color: COLORS.accent,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  addressText: {
    flex: 1,
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 21,
  },
  subAddressText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interRegular,
    fontSize: 12,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  actionButton: {
    flexGrow: 1,
  },
  actionButtonCompact: {
    minHeight: CONTROL_SIZES.buttonSm,
  },
  helperRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  helperText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontFamily: FONTS.interRegular,
    fontSize: 12,
    lineHeight: 18,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  resourcesGrid: {
    gap: SPACING.sm,
  },
  resourceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: SURFACES.cardAlt,
    borderRadius: CONTROL_SIZES.cardRadius,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  resourceIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.overlayLight,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  resourceTextWrap: {
    flex: 1,
    gap: 3,
  },
  resourceLabel: {
    color: COLORS.text,
    fontFamily: FONTS.interSemiBold,
    fontSize: 14,
  },
  resourceCount: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interRegular,
    fontSize: 12,
  },
  pricingTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.md,
  },
  pricingGroupCard: {
    gap: SPACING.sm,
  },
  pricingGroupTitle: {
    color: COLORS.accent,
    fontFamily: FONTS.interSemiBold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  pricingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  pricingRowFirst: {
    paddingTop: 0,
    borderTopWidth: 0,
  },
  pricingRowLabelWrap: {
    flex: 1,
    gap: 2,
  },
  pricingRowLabel: {
    color: COLORS.text,
    fontFamily: FONTS.interSemiBold,
    fontSize: 13,
  },
  pricingRowMeta: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interRegular,
    fontSize: 12,
  },
  pcSpecsWrap: {
    marginTop: SPACING.xs,
    gap: 4,
  },
  pcSpecRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  pcSpecLabel: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interMedium,
    fontSize: 11,
  },
  pcSpecValue: {
    color: COLORS.text,
    fontFamily: FONTS.interRegular,
    fontSize: 11,
  },
  pricingValue: {
    color: COLORS.successBright,
    fontFamily: FONTS.interSemiBold,
    fontSize: 13,
  },
  infoCard: {
    gap: SPACING.md,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  infoTextWrap: {
    flex: 1,
    gap: 2,
  },
  infoLabel: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interMedium,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  infoValue: {
    color: COLORS.text,
    fontFamily: FONTS.interRegular,
    fontSize: 14,
    lineHeight: 20,
  },
  supportRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  supportCopy: {
    flex: 1,
    gap: 4,
  },
  supportTitle: {
    color: COLORS.text,
    fontFamily: FONTS.interSemiBold,
    fontSize: 13,
  },
  supportText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interRegular,
    fontSize: 12,
    lineHeight: 18,
  },
  actionBar: {
    marginTop: SPACING.xs,
  },
  actionBarCard: {
    gap: SPACING.md,
  },
  actionBarTextWrap: {
    gap: 6,
  },
  actionBarTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 20,
  },
  actionBarText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 20,
  },
  emptyCard: {
    alignItems: "center",
    gap: SPACING.sm,
  },
  emptyTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.subheading,
    textAlign: "center",
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interRegular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});

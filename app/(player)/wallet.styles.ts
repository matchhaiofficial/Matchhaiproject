import { StyleSheet } from "react-native";
import {
    COLORS,
    FONTS,
    RADII,
    SHADOWS,
    SPACING,
    TEXT_SIZES,
} from "../../src/theme";

export default StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.backgroundDark,
  },
  tabs: {
    marginBottom: SPACING.md,
  },
  content: {
    paddingBottom: SPACING.xxl,
    gap: SPACING.md,
  },
  loaderWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  balanceCard: {
    borderColor: COLORS.accent + "55",
  },
  balanceLabel: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: 12,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  balanceValue: {
    color: COLORS.accent,
    fontFamily: FONTS.heading,
    fontSize: 30,
  },
  addFundsCard: {
    gap: SPACING.sm,
  },
  addFundsTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 15,
    marginBottom: 2,
  },
  addFundsSubtext: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: 12,
    marginBottom: SPACING.sm,
  },
  quickAmountRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: SPACING.sm,
  },
  quickAmountBtn: {
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADII.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: SPACING.xs,
    marginBottom: SPACING.xs,
    backgroundColor: COLORS.overlayLight,
  },
  quickAmountBtnActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent + "16",
  },
  quickAmountBtnPressed: {
    opacity: 0.85,
  },
  quickAmountText: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 12,
    fontWeight: "700",
  },
  addFundsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  amountInput: {
    flex: 1,
    height: 48,
    minHeight: 48,
    backgroundColor: COLORS.overlayLight,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADII.md,
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 0,
    marginRight: SPACING.sm,
    textAlignVertical: "center",
  },
  addFundsBtn: {
    height: 48,
    minHeight: 48,
    minWidth: 92,
  },
  addFundsBtnDisabled: {
    opacity: 0.6,
  },
  addFundsBtnPressed: {
    opacity: 0.85,
  },
  addFundsBtnText: {
    color: "#FFF",
    fontFamily: FONTS.heading,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  summaryCard: {},
  summaryTitle: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: 12,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  summaryValue: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 30,
  },
  summarySubText: {
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: 12,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  statCard: {
    width: "48.5%",
    minHeight: 80,
    justifyContent: "center",
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: 11,
    marginBottom: 4,
  },
  statValue: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 18,
  },
  statHelperText: {
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 4,
  },
  transactionCard: {
    gap: SPACING.xs,
  },
  transactionTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  transactionTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 14,
    flex: 1,
    marginRight: SPACING.sm,
  },
  transactionAmount: {
    color: COLORS.successBright,
    fontFamily: FONTS.heading,
    fontSize: 13,
  },
  transactionMeta: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: 12,
    marginBottom: 2,
  },
  statusPill: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADII.pill,
    borderWidth: 1,
  },
  statusText: {
    fontFamily: FONTS.body,
    fontSize: 10,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  emptyCard: {
    alignItems: "center",
  },
  emptyTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 16,
    marginBottom: 6,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: 13,
    textAlign: "center",
  },
  phoneDialogCard: {
    width: "100%",
    maxWidth: 420,
    ...SHADOWS.cardElevated,
  },
  phoneDialogContent: {
    // Let the modal body size to content; the modal primitive caps overall height and scrolls as needed.
  },
  phoneModalContent: {
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  phoneAmountLabel: {
    fontSize: TEXT_SIZES.body,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    lineHeight: 22,
  },
  phoneSectionLabel: {
    color: COLORS.text,
    fontFamily: FONTS.interSemiBold,
    fontSize: 13,
    marginTop: 2,
  },
  phoneInput: {
    marginRight: 0,
    backgroundColor: COLORS.cardBackground,
    borderColor: COLORS.inputBorder,
    minHeight: 48,
  },
  phoneFooter: {
    paddingHorizontal: SPACING.xl,
  },
  phoneActionsRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  phoneActionBtn: {
    flex: 1,
  },
});

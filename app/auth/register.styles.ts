import { StyleSheet } from "react-native";

import {
  COLORS,
  CONTROL_SIZES,
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
  container: {
    flexGrow: 1,
    gap: SPACING.sm,
  },

  stepperWrapper: {
    marginBottom: SPACING.md,
  },
  stepperTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  stepperTitle: {
    color: COLORS.text,
    fontFamily: FONTS.montserratSemiBold,
    fontSize: TEXT_SIZES.label,
  },
  stepperSubtitle: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
    marginTop: 2,
  },
  stepperBar: {
    height: 4,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.inputBorder,
    overflow: "hidden",
  },
  stepperBarFill: {
    height: "100%",
    backgroundColor: COLORS.accent,
  },
  stepperDotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  stepperDot: {
    width: 8,
    height: 8,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.inputBorder,
  },
  stepperDotActive: {
    backgroundColor: COLORS.accent,
  },

  heading: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.xxl,
    lineHeight: 32,
    marginBottom: SPACING.xs,
  },
  sub: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.body,
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },

  fieldGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    color: "rgba(253, 253, 253, 0.85)",
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.label - 1,
    marginBottom: SPACING.xs,
  },
  twoColumnRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  inputBox: {
    backgroundColor: COLORS.inputBackground,
    borderRadius: CONTROL_SIZES.cardRadius,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    minHeight: CONTROL_SIZES.inputMd,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  prefixIcon: {
    marginRight: SPACING.sm,
    opacity: 0.95,
  },
  suffixIcon: {
    marginLeft: SPACING.sm,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.input,
    paddingVertical: SPACING.sm + 1,
  },
  inputPlaceholderOverlay: {
    position: "absolute",
    left: 44,
    right: 108,
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.body,
  },
  focusBar: {
    position: "absolute",
    left: SPACING.md - 2,
    right: SPACING.md - 2,
    bottom: SPACING.xs + 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: COLORS.accent,
    opacity: 0,
  },

  helperTextRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.xs,
  },
  helperText: {
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
    lineHeight: 16,
  },
  helperOk: {
    color: COLORS.success,
  },
  helperWarning: {
    color: COLORS.warning,
  },
  helperError: {
    color: COLORS.error,
  },
  errorText: {
    color: COLORS.error,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
    lineHeight: 16,
    marginTop: SPACING.xs,
  },
  emailSuffix: {
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.input,
    marginLeft: SPACING.xs,
  },

  passwordStrengthWrapper: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  strengthMeterTrack: {
    height: 4,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.inputBorder,
    overflow: "hidden",
  },
  strengthMeterFill: {
    height: "100%",
    borderRadius: RADII.pill,
  },
  strengthLabel: {
    marginTop: SPACING.xs,
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
  },
  passwordRequirementsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.lg,
    marginTop: SPACING.xs,
  },
  requirementColumn: {
    flex: 1,
  },
  passwordRequirementText: {
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
    lineHeight: 16,
    color: COLORS.muted,
    marginBottom: 2,
  },
  passwordRequirementTextDone: {
    color: COLORS.success,
  },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.cardBackground,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 1,
  },
  optionChipActive: {
    backgroundColor: `${COLORS.accent}1F`,
    borderColor: `${COLORS.accent}AA`,
  },
  optionChipText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.label - 1,
  },
  optionChipTextActive: {
    color: COLORS.text,
  },

  buttonShadowWrapper: {
    width: "100%",
    marginTop: SPACING.lg,
  },
  buttonShadowWrapperActive: {
    ...SHADOWS.accentStrong,
  },
  primaryBtn: {
    minHeight: CONTROL_SIZES.buttonLg,
    borderRadius: RADII.xl,
    backgroundColor: COLORS.accent,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
  },
  primaryBtnDisabled: {
    backgroundColor: COLORS.disabled,
    borderColor: "rgba(255,255,255,0.08)",
  },
  primaryBtnText: {
    color: COLORS.text,
    fontFamily: FONTS.interSemiBold,
    fontSize: TEXT_SIZES.body,
  },
  secondaryBtn: {
    minHeight: CONTROL_SIZES.buttonMd,
    borderRadius: RADII.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.accent,
    backgroundColor: "transparent",
  },
  secondaryBtnText: {
    color: COLORS.accent,
    fontFamily: FONTS.interSemiBold,
    fontSize: TEXT_SIZES.label,
  },
  buttonStack: {
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  bottomText: {
    color: COLORS.muted,
    textAlign: "center",
    marginTop: SPACING.md,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.label - 1,
  },
  backLinkWrapper: {
    alignSelf: "center",
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  backLinkText: {
    color: COLORS.accent,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.label - 1,
  },

  summaryCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: CONTROL_SIZES.cardRadius,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.lg,
  },
  summaryHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.xs,
  },
  summaryTitle: {
    color: COLORS.text,
    fontFamily: FONTS.montserratSemiBold,
    fontSize: TEXT_SIZES.label,
  },
  summaryRow: {
    flexDirection: "row",
    marginTop: SPACING.xs,
  },
  summaryLabel: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
    marginBottom: 2,
  },
  summaryValue: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.label - 1,
    lineHeight: 18,
  },
  faceitSummaryRow: {
    marginTop: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
  },
  faceitLevelIcon: {
    width: 24,
    height: 24,
    marginLeft: SPACING.sm,
  },
  summaryChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs + 1,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.overlayMedium,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
  },
  summaryChipText: {
    color: COLORS.text,
    fontFamily: FONTS.interMedium,
    fontSize: TEXT_SIZES.caption,
  },

  platformCard: {
    backgroundColor: COLORS.cardDark,
    borderRadius: CONTROL_SIZES.cardRadius,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.md,
  },
  platformHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  platformIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.overlayLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
  },
  platformTitle: {
    color: COLORS.text,
    fontFamily: FONTS.montserratSemiBold,
    fontSize: TEXT_SIZES.body,
  },
  platformSubtitle: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
    lineHeight: 16,
    marginTop: 2,
  },
  platformConnectedBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADII.pill,
    backgroundColor: "#1e3a2f",
    color: "#9be7c4",
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption - 1,
  },
  platformButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.overlayLight,
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  platformButtonInline: {
    marginTop: 0,
    paddingVertical: SPACING.sm + 1,
    paddingHorizontal: SPACING.md,
    minWidth: 96,
  },
  platformButtonActive: {
    borderColor: COLORS.accent,
    backgroundColor: `${COLORS.accent}22`,
  },
  platformButtonActiveSteam: {
    borderColor: COLORS.steamBorder,
    backgroundColor: "#102233",
  },
  platformButtonActiveFaceit: {
    borderColor: COLORS.faceitBorder,
    backgroundColor: "#3b2318",
  },
  platformButtonText: {
    color: COLORS.text,
    fontFamily: FONTS.interSemiBold,
    fontSize: TEXT_SIZES.label,
  },

  reviewSectionCard: {
    backgroundColor: COLORS.cardDark,
    borderRadius: CONTROL_SIZES.cardRadius,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.md,
  },
  reviewSectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  reviewSectionTitle: {
    color: COLORS.text,
    fontFamily: FONTS.montserratSemiBold,
    fontSize: TEXT_SIZES.body,
  },
  reviewEditLink: {
    color: COLORS.accent,
    fontFamily: FONTS.interSemiBold,
    fontSize: TEXT_SIZES.caption,
  },
  reviewRow: {
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.overlayLight,
  },
  reviewLabel: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
    marginBottom: 4,
  },
  reviewValue: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.body,
    lineHeight: 21,
  },
  reviewValueOk: {
    color: COLORS.success,
  },
  reviewValueMuted: {
    color: COLORS.muted,
  },
  reviewGameBlock: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.overlayLight,
  },
  reviewGameHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.xs,
  },
  reviewGameTitle: {
    color: COLORS.text,
    fontFamily: FONTS.montserratSemiBold,
    fontSize: TEXT_SIZES.body,
  },
  summaryCardList: {
    gap: SPACING.sm,
  },
  reviewCard: {
    backgroundColor: COLORS.inputBackground,
    borderRadius: RADII.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
  },
  reviewGroupTitle: {
    color: COLORS.text,
    fontFamily: FONTS.interSemiBold,
    fontSize: TEXT_SIZES.label,
    marginBottom: SPACING.xs,
  },
  emptyStateCard: {
    backgroundColor: COLORS.overlayLight,
    borderRadius: CONTROL_SIZES.cardRadius,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    padding: SPACING.lg,
    alignItems: "flex-start",
  },
  emptyStateTitle: {
    color: COLORS.text,
    fontFamily: FONTS.montserratSemiBold,
    fontSize: TEXT_SIZES.body,
    marginBottom: SPACING.xs,
  },
  emptyStateText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.label,
    lineHeight: 20,
  },

  termsWrapper: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  termsHeading: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.subheading,
    marginBottom: SPACING.sm,
  },
  termRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: SPACING.md,
  },
  termBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.surface,
    marginRight: SPACING.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  termBoxChecked: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent,
  },
  termBoxInner: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: COLORS.text,
  },
  termText: {
    flex: 1,
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.body - 1,
    lineHeight: 21,
  },
  termLink: {
    color: COLORS.accent,
    textDecorationLine: "underline",
  },

  card: {
    backgroundColor: COLORS.cardDark,
    borderRadius: CONTROL_SIZES.cardRadius,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.md,
  },
  cardTitle: {
    color: COLORS.text,
    fontFamily: FONTS.montserratSemiBold,
    fontSize: TEXT_SIZES.body,
    marginBottom: SPACING.md,
  },

  requirementBanner: {
    backgroundColor: COLORS.overlayLight,
    borderRadius: CONTROL_SIZES.cardRadius,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
  },
  requirementTitle: {
    color: COLORS.text,
    fontFamily: FONTS.montserratSemiBold,
    fontSize: TEXT_SIZES.label,
    marginBottom: 4,
  },
  requirementText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
    lineHeight: 18,
  },
  requirementMet: {
    borderColor: `${COLORS.success}44`,
    backgroundColor: `${COLORS.success}14`,
  },
  requirementMetTitle: {
    color: COLORS.success,
  },
  cooldownText: {
    color: COLORS.error,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
    textAlign: "center",
    marginTop: SPACING.sm,
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 10, 10, 0.95)",
    zIndex: 9999,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
  },
  loadingContent: {
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingSpinner: {
    marginBottom: SPACING.lg,
    height: 64,
    width: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingPhaseTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.subheading,
    textAlign: "center",
    marginBottom: SPACING.md,
  },
  progressStep: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.sm,
    width: "100%",
  },
  progressStepLine: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginVertical: SPACING.sm,
    width: "100%",
  },
  progressIcon: {
    marginRight: SPACING.sm,
  },
  progressText: {
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.body - 2,
  },
  progressTextActive: {
    color: COLORS.text,
  },
  progressTextDone: {
    color: COLORS.success,
  },
});

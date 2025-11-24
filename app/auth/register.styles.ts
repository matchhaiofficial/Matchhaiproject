// app/auth/register.styles.ts
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
    backgroundColor: COLORS.background,
  },
  container: {
    flexGrow: 1,
    padding: SPACING.screenPadding,
    justifyContent: "center",
  },

  // ---- Stepper ----
  stepperWrapper: {
    marginBottom: SPACING.lg + 4, // ~20
  },
  stepperTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm, // 8
  },
  stepperTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.subheading + 2, // ~18
  },
  stepperSubtitle: {
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
  },
  stepperBar: {
    height: 4,
    borderRadius: 999,
    backgroundColor: "#3a3a3a",
    overflow: "hidden",
  },
  stepperBarFill: {
    height: "100%",
    backgroundColor: COLORS.accent,
  },
  stepperDotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: SPACING.sm, // 8
  },
  stepperDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#414141",
    marginHorizontal: 3,
  },
  stepperDotActive: {
    backgroundColor: COLORS.accent,
  },

  // ---- Headings ----
  heading: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.heading - 2,
    marginBottom: SPACING.xs,
  },
  sub: {
    color: COLORS.muted,
    fontFamily: FONTS.subheading,
    fontSize: TEXT_SIZES.subheading - 2,
    marginBottom: SPACING.lg + 2,
  },

  // ---- Fields ----
  fieldGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    color: "rgba(253, 253, 253, 0.85)",
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.label - 1,
    marginBottom: SPACING.xs,
  },

  inputBox: {
    backgroundColor: COLORS.inputBackground,
    borderRadius: RADII.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  prefixIcon: {
    marginRight: SPACING.sm,
    opacity: 0.9,
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

  inputBoxValidShadow: {
    ...SHADOWS.accentSoft,
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
  },
  helperOk: {
    color: COLORS.success,
  },
  helperWarning: {
    color: "#ffb74d",
  },
  helperError: {
    color: COLORS.error,
  },
  errorText: {
    color: COLORS.error,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
    marginTop: SPACING.xs,
  },

  // ---- Email suffix ----
  emailSuffix: {
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.input,
    marginLeft: SPACING.xs,
  },

  // ---- Password strength + requirements ----
  passwordStrengthWrapper: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  strengthMeterTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: "#3a3a3a",
    overflow: "hidden",
  },
  strengthMeterFill: {
    height: "100%",
    borderRadius: 999,
  },
  strengthLabel: {
    marginTop: SPACING.xs,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
  },
  passwordRequirementsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: SPACING.xs,
  },
  requirementColumn: {
    flex: 1,
  },
  passwordRequirementText: {
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
    color: COLORS.muted,
    marginBottom: 2,
  },
  passwordRequirementTextDone: {
    color: COLORS.success,
  },

  // ---- Chips / options (Step 2) ----
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: SPACING.sm,
  },
  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.cardBackground,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm - 1,
    marginRight: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  optionChipActive: {
    backgroundColor: "#1e2a38",
    borderColor: COLORS.accent,
  },
  optionChipText: {
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.label - 1,
  },
  optionChipTextActive: {
    color: COLORS.text,
  },

  // ---- Button ----
  buttonShadowWrapper: {
    width: "100%",
    marginTop: SPACING.lg,
  },
  buttonShadowWrapperActive: {
    ...SHADOWS.accentStrong,
  },

  primaryBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: RADII.lg,
    paddingVertical: SPACING.lg - 2,
    alignItems: "center",
  },
  primaryBtnDisabled: {
    backgroundColor: COLORS.inputBorder,
  },
  primaryBtnText: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.body,
  },

  bottomText: {
    color: COLORS.muted,
    textAlign: "center",
    marginTop: SPACING.sm,
    fontFamily: FONTS.body,
  },

  // ---- Back links between steps ----
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

  // ---- Step 3 summary card ----
  summaryCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: RADII.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: "#333",
    marginBottom: SPACING.lg,
  },
  summaryHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.xs,
  },
  summaryTitle: {
    color: COLORS.text,
    fontFamily: FONTS.subheading,
    fontSize: TEXT_SIZES.label - 1,
  },
  summaryRow: {
    flexDirection: "row",
    marginTop: SPACING.xs,
  },
  summaryLabel: {
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
    marginBottom: 2,
  },
  summaryValue: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.label - 1,
  },
  summaryChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 999,
    backgroundColor: "#243447",
    marginRight: SPACING.xs,
    marginTop: 2,
  },
  summaryChipText: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
  },

  // ---- Step 3 platform cards ----
  platformCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: RADII.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: "#333",
    marginBottom: SPACING.md,
  },
  platformHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  platformIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: COLORS.inputBackground,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.sm + 2,
  },
  platformTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.body,
  },
  platformSubtitle: {
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
    marginTop: 2,
  },
  platformConnectedBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#1e3a2f",
    color: "#9be7c4",
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption - 1,
  },

  platformButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.cardBackground,
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  platformButtonActive: {
    borderColor: COLORS.accent,
    backgroundColor: "#1e2a38",
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
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.body,
  },

  // ---- Step 4 review sections ----
  reviewSectionCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: RADII.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: "#333",
    marginBottom: SPACING.md,
  },
  reviewSectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  reviewSectionTitle: {
    color: COLORS.text,
    fontFamily: FONTS.subheading,
    fontSize: TEXT_SIZES.label,
  },
  reviewEditLink: {
    color: COLORS.accent,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.xs,
  },
  reviewLabel: {
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
  },
  reviewValue: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.label - 1,
    maxWidth: "60%",
    textAlign: "right",
  },
  reviewValueOk: {
    color: COLORS.success,
  },
  reviewValueMuted: {
    color: "#757575",
  },
  reviewGameBlock: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  reviewGameHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.xs,
  },
  reviewGameTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.body,
  },

  // ---- Terms & consent ----
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
    marginBottom: SPACING.sm,
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
  },
  termLink: {
    color: COLORS.accent,
    textDecorationLine: "underline",
  },
});

import { StyleSheet } from "react-native";
import { COLORS, FONTS, RADII, SHADOWS, SPACING, TEXT_SIZES } from "../../src/theme";

export default StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  container: {
    flexGrow: 1,
    padding: SPACING.screenPadding,
    paddingBottom: SPACING.xl + 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.lg,
  },
  heading: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.heading - 2,
  },
  sub: {
    color: COLORS.muted,
    fontFamily: FONTS.subheading,
    fontSize: TEXT_SIZES.subheading,
    marginTop: SPACING.xs,
  },
  card: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: RADII.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    marginBottom: SPACING.lg,
  },
  label: {
    color: COLORS.text,
    fontFamily: FONTS.subheading,
    fontSize: TEXT_SIZES.label,
    marginBottom: SPACING.xs,
  },
  helperText: {
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
    marginTop: SPACING.xs,
  },
  inputBox: {
    backgroundColor: COLORS.inputBackground,
    borderRadius: RADII.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.input,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: SPACING.sm,
  },
  chip: {
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
  chipActive: {
    backgroundColor: "#1e2a38",
    borderColor: COLORS.accent,
  },
  chipText: {
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.label - 1,
  },
  chipTextActive: {
    color: COLORS.text,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
  },
  badge: {
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  badgeText: {
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
  },
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
  secondaryLink: {
    color: COLORS.accent,
    fontFamily: FONTS.subheading,
    fontSize: TEXT_SIZES.body,
  },
  offerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADII.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    marginBottom: SPACING.md,
  },
  offerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
  },
  offerTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.subheading,
  },
  offerMeta: {
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
  },
  offerBadge: {
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
  },
  offerBadgeText: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
  },
  offerFooter: {
    marginTop: SPACING.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  muted: {
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
  },
});

// app/auth/login.styles.ts
import { StyleSheet } from 'react-native';
import {
  COLORS,
  FONTS,
  RADII,
  SHADOWS,
  SPACING,
  TEXT_SIZES,
} from '../../src/theme';

export default StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  container: {
    flexGrow: 1,
    padding: SPACING.screenPadding,
    justifyContent: 'center',
  },

  heading: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.heading,
    marginBottom: SPACING.xs + 2, // ~6
    textAlign: 'center',
  },

  sub: {
    color: COLORS.muted,
    fontFamily: FONTS.subheading,
    fontSize: TEXT_SIZES.subheading,
    marginBottom: SPACING.lg + 2, // ~18
    textAlign: 'center',
  },

  fieldGroup: {
    marginBottom: SPACING.md, // 12
  },

  label: {
    color: 'rgba(253, 253, 253, 0.8)',
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.label,
    marginBottom: SPACING.xs + 2, // ~6
  },

  inputBox: {
    backgroundColor: COLORS.inputBackground,
    borderRadius: RADII.md, // 12
    paddingHorizontal: SPACING.md, // 12
    paddingVertical: SPACING.xs, // 4
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  prefixIcon: {
    marginRight: SPACING.sm, // 8
    opacity: 0.9,
  },

  suffixIcon: {
    marginLeft: SPACING.sm, // 8
  },

  input: {
    flex: 1,
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.input,
    paddingVertical: SPACING.sm + 2, // ~10
  },

  inputBoxValidShadow: {
    ...SHADOWS.accentSoft,
  },

  focusBar: {
    position: 'absolute',
    left: SPACING.md - 2,       // ~10
    right: SPACING.md - 2,
    bottom: SPACING.xs + 2,     // ~6
    height: 2,
    borderRadius: 1,
    backgroundColor: COLORS.accent,
    opacity: 0,
  },

  forgotRow: {
    marginTop: SPACING.xs,         // 4
    marginBottom: SPACING.lg + 2,  // ~18
    alignItems: 'flex-end',
  },

  forgotText: {
    color: COLORS.accent,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.label,
    fontWeight: '500',
  },

  buttonShadowWrapper: {
    width: '100%',
    marginTop: SPACING.xs, // 4
  },

  buttonShadowWrapperActive: {
    ...SHADOWS.accentStrong,
  },

  primaryBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: RADII.lg, // 14
    paddingVertical: SPACING.lg - 2, // ~14
    alignItems: 'center',
  },

  primaryBtnDisabled: {
    backgroundColor: COLORS.inputBorder,
  },

  primaryBtnText: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.body, // 15/16ish
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xl,      // 20
    marginBottom: SPACING.md,   // 12
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.divider,
  },

  dividerText: {
    marginHorizontal: SPACING.sm + 2, // ~10
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption, // 12
  },

  socialButtonsWrapper: {
    marginBottom: SPACING.lg, // 16
  },

  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADII.md, // 12
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.cardBackground,
    paddingVertical: SPACING.md, // 12
    marginBottom: SPACING.sm, // 8
  },

  socialIcon: {
    marginRight: SPACING.sm + 2, // ~10
  },

  socialBtnText: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.body,
  },

  socialSteam: {
    borderColor: COLORS.steamBorder,
  },

  socialFaceit: {
    borderColor: COLORS.faceitBorder,
  },

  socialEA: {
    borderColor: COLORS.eaBorder,
  },

  bottomText: {
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: SPACING.sm, // 8
    fontFamily: FONTS.body,
  },
});
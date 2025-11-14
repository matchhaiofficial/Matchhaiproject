// app/auth/register/Step1BasicInfo.styles.ts
import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SHADOWS, SPACING } from '../../../src/theme';

export default StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flexGrow: 1,
    padding: SPACING.screenPadding,
    paddingBottom: SPACING.xxl,
  },

  heading: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 24,
    marginBottom: SPACING.xs,
  },
  sub: {
    color: COLORS.muted,
    fontFamily: FONTS.subheading,
    fontSize: 14,
    marginBottom: SPACING.xl,
  },

  fieldGroup: {
    marginBottom: SPACING.lg,
  },
  label: {
    color: 'rgba(253, 253, 253, 0.85)',
    fontFamily: FONTS.body,
    fontSize: 13,
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
    flexDirection: 'row',
    alignItems: 'center',
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
    fontSize: 15,
    paddingVertical: 9,
  },

  inputBoxValidShadow: {
    ...SHADOWS.accentSoft,
  },

  focusBar: {
    position: 'absolute',
    left: SPACING.md - 2,
    right: SPACING.md - 2,
    bottom: SPACING.xs,
    height: 2,
    borderRadius: 1,
    backgroundColor: COLORS.accent,
    opacity: 0,
  },

  helperTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  helperText: {
    fontFamily: FONTS.body,
    fontSize: 11,
  },
  helperOk: {
    color: '#8bc34a',
  },
  helperWarning: {
    color: '#ffb74d',
  },
  helperError: {
    color: COLORS.error,
  },

  buttonShadowWrapper: {
    width: '100%',
    marginTop: SPACING.xl,
  },
  buttonShadowWrapperActive: {
    ...SHADOWS.accentStrong,
  },

  primaryBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: RADII.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnDisabled: {
    backgroundColor: COLORS.inputBorder,
  },
  primaryBtnText: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 16,
  },

  bottomText: {
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: SPACING.lg,
    fontFamily: FONTS.body,
  },
});
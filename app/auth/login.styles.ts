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
    // justifyContent intentionally removed to avoid keyboard/focus jumping
  },

  heading: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.heading,
    marginBottom: SPACING.xs + 2,
    textAlign: 'center',
  },

  sub: {
    color: COLORS.muted,
    fontFamily: FONTS.subheading,
    fontSize: TEXT_SIZES.subheading,
    marginBottom: SPACING.lg + 2,
    textAlign: 'center',
  },

  // NEW: role toggle row
  roleToggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  roleChip: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    marginHorizontal: SPACING.xs,
    backgroundColor: COLORS.cardBackground,
  },
  roleChipActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent + '22', // subtle tint
  },
  roleChipText: {
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.label,
    color: COLORS.muted,
  },
  roleChipTextActive: {
    color: COLORS.text,
  },

  fieldGroup: {
    marginBottom: SPACING.md,
  },

  label: {
    color: 'rgba(253, 253, 253, 0.8)',
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.label,
    marginBottom: SPACING.xs + 2,
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
    fontSize: TEXT_SIZES.input,
    paddingVertical: SPACING.sm + 2,
  },

  inputBoxValidShadow: {
    ...SHADOWS.accentSoft,
  },

  focusBar: {
    position: 'absolute',
    left: SPACING.md - 2,
    right: SPACING.md - 2,
    bottom: SPACING.xs + 2,
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
    fontSize: TEXT_SIZES.caption,
  },
  helperWarning: {
    color: '#ffb74d',
  },

  errorText: {
    marginTop: SPACING.xs,
    color: COLORS.error,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
  },

  // 🔐 Password requirement grid
  passwordHintGrid: {
    marginTop: SPACING.xs,
  },
  passwordHintRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  passwordHintItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.sm,
  },
  passwordHintIcon: {
    marginRight: 4,
    fontSize: 12,
  },
  passwordHintIconDone: {
    color: '#66bb6a', // green
  },
  passwordHintIconPending: {
    color: '#e57373', // red-ish
  },
  passwordHintText: {
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
  },
  passwordHintTextDone: {
    color: COLORS.text,
  },
  passwordHintTextPending: {
    color: COLORS.muted,
  },

  // 🔋 Password strength meter
  strengthWrapper: {
    marginTop: SPACING.xs,
  },
  strengthBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#444',
    overflow: 'hidden',
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  strengthLabel: {
    marginTop: 4,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
    color: COLORS.muted,
  },

  forgotRow: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg + 2,
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
    marginTop: SPACING.xs,
  },

  buttonShadowWrapperActive: {
    ...SHADOWS.accentStrong,
  },

  primaryBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: RADII.lg,
    paddingVertical: SPACING.lg - 2,
    alignItems: 'center',
  },

  primaryBtnDisabled: {
    backgroundColor: COLORS.inputBorder,
  },

  primaryBtnText: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.body,
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.divider,
  },

  dividerText: {
    marginHorizontal: SPACING.sm + 2,
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
  },

  socialButtonsWrapper: {
    marginBottom: SPACING.lg,
  },

  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.cardBackground,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.sm,
  },

  socialIcon: {
    marginRight: SPACING.sm + 2,
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
    marginTop: SPACING.sm,
    fontFamily: FONTS.body,
  },
  bottomLink: {
    color: COLORS.accent,
    fontFamily: FONTS.body,
    marginTop: SPACING.sm,
    marginLeft: SPACING.xs,
    fontWeight: 'bold',
  },
});

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
  section: {
    marginBottom: SPACING.xxl,
  },
  sectionTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 16,
    marginBottom: SPACING.xs,
  },
  sectionHelper: {
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: 13,
    marginBottom: SPACING.md,
    lineHeight: 18,
  },
  gamesList: {
    marginTop: SPACING.sm,
  },
  gameCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    ...SHADOWS.accentSoft,
  },
  gameCardSelected: {
    borderColor: COLORS.accent,
    backgroundColor: '#2c3a4a',
  },
  gameThumbnail: {
    width: 56,
    height: 56,
    borderRadius: RADII.md,
    marginRight: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  gameContent: {
    flex: 1,
  },
  gameTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 15,
  },
  gameDescription: {
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: 12,
    marginTop: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: RADII.sm,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  errorText: {
    color: COLORS.error,
    fontFamily: FONTS.body,
    fontSize: 12,
    marginTop: SPACING.xs,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: RADII.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  secondaryBtnText: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 15,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: COLORS.accent,
    borderRadius: RADII.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginLeft: SPACING.sm,
  },
  primaryBtnDisabled: {
    backgroundColor: COLORS.inputBorder,
  },
  primaryBtnText: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 16,
  },
});

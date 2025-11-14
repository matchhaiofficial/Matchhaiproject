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
  summaryCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: RADII.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    ...SHADOWS.accentSoft,
  },
  summaryTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 16,
    marginBottom: SPACING.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  summaryLabel: {
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: 13,
  },
  summaryValue: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 15,
    marginLeft: SPACING.sm,
  },
  summaryGames: {
    marginTop: SPACING.sm,
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SPACING.sm,
  },
  tag: {
    backgroundColor: '#324354',
    borderRadius: RADII.sm,
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    marginRight: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  tagText: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 12,
  },
  placeholderBox: {
    backgroundColor: COLORS.surface,
    borderRadius: RADII.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    marginBottom: SPACING.xl,
  },
  placeholderTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 16,
    marginBottom: SPACING.sm,
  },
  placeholderBody: {
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 20,
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

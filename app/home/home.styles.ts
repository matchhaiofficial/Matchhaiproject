// app/home/home.styles.ts
import { StyleSheet } from 'react-native';
import {
  COLORS,
  FONTS,
  RADII,
  SPACING,
  TEXT_SIZES,
} from '../../src/theme';

export default StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.screenPadding,
  },

  header: {
    marginBottom: SPACING.xxl,
  },

  title: {
    color: COLORS.text,
    fontSize: TEXT_SIZES.heading,
    fontWeight: 'bold',
    fontFamily: FONTS.heading,
  },

  sub: {
    color: COLORS.muted,
    fontSize: TEXT_SIZES.subheading,
    fontFamily: FONTS.subheading,
    marginTop: SPACING.xs,
  },

  cardList: {
    gap: SPACING.lg,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.cardBackground,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },

  cardPressed: {
    opacity: 0.92,
  },

  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.lg,
  },

  cardContent: {
    flex: 1,
  },

  cardTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
  },

  cardSubtitle: {
    color: COLORS.muted,
    fontSize: TEXT_SIZES.label,
  },

  spacer: {
    flex: 1,
  },

  logoutButton: {
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.divider,
    borderRadius: RADII.lg,
    paddingVertical: SPACING.lg - 2,
    alignItems: 'center',
    marginTop: SPACING.xl,
  },

  logoutButtonPressed: {
    opacity: 0.92,
  },

  logoutButtonText: {
    color: COLORS.error,
    fontSize: TEXT_SIZES.subheading,
    fontWeight: '600',
  },
});
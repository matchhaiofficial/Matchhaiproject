import { StyleSheet } from 'react-native';

import { COLORS, FONTS, RADII, SPACING } from '../theme';

export default StyleSheet.create({
  wrapper: {
    marginBottom: SPACING.xl,
  },
  headerRow: {
    marginBottom: SPACING.sm,
  },
  title: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 18,
  },
  subtitle: {
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: 12,
    marginTop: 2,
  },
  progressBar: {
    height: 4,
    borderRadius: RADII.lg,
    backgroundColor: '#3a3a3a',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#414141',
    marginHorizontal: 3,
  },
  dotActive: {
    backgroundColor: COLORS.accent,
  },
});

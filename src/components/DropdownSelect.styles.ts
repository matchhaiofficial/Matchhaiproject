import { StyleSheet } from 'react-native';

import { COLORS, FONTS, RADII, SHADOWS, SPACING } from '../theme';

export default StyleSheet.create({
  label: {
    color: 'rgba(253, 253, 253, 0.85)',
    fontFamily: FONTS.body,
    fontSize: 13,
    marginBottom: SPACING.xs,
  },
  trigger: {
    backgroundColor: COLORS.inputBackground,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  valueText: {
    flex: 1,
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 15,
  },
  placeholderText: {
    flex: 1,
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: 15,
  },
  chevron: {
    marginLeft: SPACING.sm,
  },
  errorText: {
    color: COLORS.error,
    fontFamily: FONTS.body,
    fontSize: 12,
    marginTop: SPACING.xs,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalCard: {
    position: 'absolute',
    left: SPACING.screenPadding,
    right: SPACING.screenPadding,
    top: '25%',
    backgroundColor: COLORS.surface,
    borderRadius: RADII.lg,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    ...SHADOWS.accentSoft,
  },
  modalTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 18,
    marginBottom: SPACING.md,
  },
  optionsContainer: {
    paddingBottom: SPACING.sm,
  },
  optionRow: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADII.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionRowSelected: {
    backgroundColor: '#323d49',
  },
  optionLabel: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 15,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: SPACING.xs,
  },
});

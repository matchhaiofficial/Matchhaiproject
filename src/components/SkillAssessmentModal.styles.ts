import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SHADOWS, SPACING, TEXT_SIZES } from '../theme';

export default StyleSheet.create({
    container: {
        ...SHADOWS.cardElevated,
    },
    content: {
        paddingTop: SPACING.lg,
        paddingBottom: SPACING.md,
    },
    questionSection: {
        marginBottom: SPACING.xl,
    },
    questionLabel: {
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.bold,
        color: COLORS.text,
        marginBottom: SPACING.md,
        lineHeight: 22,
    },
    optionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
    },
    option: {
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: RADII.pill,
        backgroundColor: COLORS.cardBackground,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        marginBottom: SPACING.xs,
        flexGrow: 1,
        alignItems: 'center',
    },
    optionSelected: {
        backgroundColor: '#1e2a38',
        borderColor: COLORS.accent,
    },
    optionText: {
        fontSize: TEXT_SIZES.label - 1,
        color: COLORS.muted,
        fontFamily: FONTS.body,
        textAlign: 'center',
    },
    optionTextSelected: {
        color: COLORS.text,
        fontFamily: FONTS.bold,
    },
    footer: {
        paddingHorizontal: SPACING.xl,
    },
    submitButton: {
        minHeight: 50,
    },
    submitButtonDisabled: {
        opacity: 0.7,
    },
});

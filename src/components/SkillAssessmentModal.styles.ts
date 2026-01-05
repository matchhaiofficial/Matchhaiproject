import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SHADOWS, SPACING, TEXT_SIZES } from '../theme';

export default StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: COLORS.cardBackground,
        borderTopLeftRadius: RADII.xl,
        borderTopRightRadius: RADII.xl,
        maxHeight: '85%',
        ...SHADOWS.cardElevated,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.lg,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
    },
    title: {
        fontSize: TEXT_SIZES.subheading,
        fontFamily: FONTS.heading,
        color: COLORS.text,
    },
    subtitle: {
        fontSize: TEXT_SIZES.caption,
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
    },
    closeButton: {
        padding: SPACING.xs,
    },
    content: {
        padding: SPACING.lg,
    },
    questionSection: {
        marginBottom: SPACING.xl,
    },
    questionLabel: {
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.bold,
        color: COLORS.text,
        marginBottom: SPACING.md,
    },
    optionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
    },
    option: {
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm + 2,
        borderRadius: RADII.md,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        marginBottom: SPACING.xs,
        flexGrow: 1,
        alignItems: 'center',
    },
    optionSelected: {
        backgroundColor: 'rgba(66, 165, 245, 0.15)', // transparent accent
        borderColor: COLORS.accent,
    },
    optionText: {
        fontSize: TEXT_SIZES.body,
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
    },
    optionTextSelected: {
        color: COLORS.accent,
        fontFamily: FONTS.bold,
    },
    footer: {
        padding: SPACING.lg,
        borderTopWidth: 1,
        borderTopColor: COLORS.divider,
    },
    submitButton: {
        backgroundColor: COLORS.accent,
        paddingVertical: SPACING.md,
        borderRadius: RADII.lg,
        alignItems: 'center',
    },
    submitButtonDisabled: {
        backgroundColor: COLORS.disabled,
        opacity: 0.7,
    },
    submitButtonText: {
        color: '#FFF',
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.bold,
        textTransform: 'uppercase',
    },
});

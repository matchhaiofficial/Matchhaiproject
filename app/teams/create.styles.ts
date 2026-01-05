import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SHADOWS, SPACING, TEXT_SIZES } from '../../src/theme';

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        padding: SPACING.lg,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
    },
    backButton: {
        marginRight: SPACING.lg,
    },
    headerTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.xl,
    },
    scrollContent: {
        padding: SPACING.screenPadding,
    },
    section: {
        marginBottom: SPACING.xxl,
    },
    sectionLabel: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.label,
        marginBottom: SPACING.sm,
    },
    inputBox: {
        backgroundColor: COLORS.inputBackground,
        borderRadius: RADII.md,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        paddingHorizontal: SPACING.md,
    },
    input: {
        color: COLORS.text,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.input,
        paddingVertical: SPACING.md,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    helperText: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
        marginTop: SPACING.xs,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
    },
    // Chip styles matching matchroom creation
    optionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        backgroundColor: COLORS.cardBackground,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm - 1,
        marginRight: SPACING.sm,
        marginBottom: SPACING.sm,
    },
    optionChipActive: {
        backgroundColor: '#1e2a38',
        borderColor: COLORS.accent,
    },
    optionChipText: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.label - 1,
    },
    optionChipTextActive: {
        color: COLORS.text,
    },

    buttonWrapper: {
        padding: SPACING.screenPadding,
        borderTopWidth: 1,
        borderTopColor: COLORS.divider,
    },
    primaryButton: {
        backgroundColor: COLORS.accent,
        paddingVertical: SPACING.lg,
        borderRadius: RADII.md,
        alignItems: 'center',
        ...SHADOWS.accentStrong,
    },
    primaryButtonDisabled: {
        opacity: 0.6,
    },
    primaryButtonText: {
        color: '#FFF',
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.body,
    },
});

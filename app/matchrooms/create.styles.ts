import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SHADOWS, SPACING, TEXT_SIZES } from '../../src/theme';

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.backgroundDark,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.screenPadding,
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.overlayLight,
        backgroundColor: COLORS.backgroundDark,
    },
    backButton: {
        marginRight: SPACING.md,
        padding: 4,
    },
    headerTitle: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.subheading,
        fontFamily: FONTS.heading,
    },
    content: {
        padding: SPACING.screenPadding,
        paddingBottom: 100,
    },

    // Form Sections
    section: {
        marginBottom: SPACING.xl,
    },
    sectionTitle: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.heading,
        marginBottom: SPACING.sm,
    },
    label: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.body,
        marginBottom: 6,
    },

    // Inputs
    input: {
        backgroundColor: COLORS.cardDark,
        color: COLORS.text,
        padding: SPACING.md,
        borderRadius: RADII.sm,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.body,
    },
    textArea: {
        minHeight: 100,
        textAlignVertical: 'top',
    },

    // Game Selection
    gamesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
    },
    gameChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: RADII.sm,
        backgroundColor: COLORS.cardDark,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    gameChipActive: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
    },
    gameChipText: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.body,
        fontWeight: '600',
    },
    gameChipTextActive: {
        color: '#FFF',
    },

    // Roles Input
    roleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.sm,
        gap: SPACING.sm,
    },
    roleInput: {
        flex: 2,
    },
    countInput: {
        flex: 1,
    },
    addRoleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: SPACING.sm,
    },
    addRoleText: {
        color: COLORS.accent,
        marginLeft: 4,
        fontWeight: '600',
    },

    // Footer Actions
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.cardDark,
        padding: SPACING.screenPadding,
        borderTopWidth: 1,
        borderTopColor: COLORS.overlayLight,
        paddingBottom: SPACING.lg + 20, // Safe area
        zIndex: 10000,
        elevation: 10000,
    },
    createButton: {
        backgroundColor: COLORS.accent,
        paddingVertical: 14,
        borderRadius: RADII.md,
        alignItems: 'center',
        ...SHADOWS.accentStrong,
    },
    createButtonText: {
        color: '#FFF',
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.heading,
        fontWeight: 'bold',
    },
    disabledButton: {
        opacity: 0.6,
    },
});

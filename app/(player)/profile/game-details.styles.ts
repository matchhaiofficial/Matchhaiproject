import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SHADOWS, SPACING, TEXT_SIZES } from '../../../src/theme';

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.screenPadding,
        paddingTop: SPACING.xl,
        paddingBottom: SPACING.lg,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
        backgroundColor: COLORS.background,
    },
    backButton: {
        marginRight: SPACING.md,
        padding: SPACING.xs,
        borderRadius: RADII.sm,
    },
    headerTitle: {
        flex: 1,
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.subheading,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    saveButton: {
        minHeight: 38,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm - 1,
        backgroundColor: COLORS.accent,
        borderRadius: RADII.md,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.accentSoft,
    },
    saveButtonText: {
        color: '#FFF', // Always white on accent
        fontSize: TEXT_SIZES.label,
        fontFamily: FONTS.bold,
        textTransform: 'uppercase',
    },
    saveButtonDisabled: {
        backgroundColor: COLORS.cardBorder,
        opacity: 0.5,
        elevation: 0,
    },
    saveButtonPressed: {
        opacity: 0.9,
    },

    scrollContent: {
        padding: SPACING.screenPadding,
        paddingBottom: 100,
    },

    sectionTitle: {
        color: COLORS.text,
        fontFamily: FONTS.bold,
        fontSize: TEXT_SIZES.subheading,
        marginBottom: SPACING.md,
        marginTop: SPACING.xl,
    },

    // Skill Stats Card
    statsCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: RADII.lg,
        padding: SPACING.lg,
        marginBottom: SPACING.xl,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    statsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.md,
    },
    statsLabel: {
        color: COLORS.muted,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.bold,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        color: COLORS.accent,
        fontSize: 24, // Large value
        fontFamily: FONTS.heading,
        marginBottom: SPACING.xs,
    },
    statCaption: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.body,
    },
    faceitLevelIcon: {
        width: 48,
        height: 48,
        marginBottom: SPACING.xs,
    },
    rankBadge: {
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        backgroundColor: COLORS.surface,
        borderRadius: RADII.sm,
        borderWidth: 1,
        borderColor: COLORS.divider,
    },
    rankText: {
        color: COLORS.text,
        fontFamily: FONTS.bold,
        fontSize: TEXT_SIZES.body,
    },

    // Toggle Row
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.cardDark,
        padding: SPACING.lg,
        borderRadius: RADII.lg,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        marginBottom: SPACING.lg,
    },
    toggleLabel: {
        fontSize: TEXT_SIZES.body,
        color: COLORS.text,
        fontFamily: FONTS.bold,
    },

    // Chips
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
        marginTop: SPACING.xs,
    },
    chip: {
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        borderRadius: RADII.pill,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
    },
    chipActive: {
        backgroundColor: 'rgba(66, 165, 245, 0.15)', // transparent accent
        borderColor: COLORS.accent,
    },
    chipText: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.body,
    },
    chipTextActive: {
        color: COLORS.accent,
        fontFamily: FONTS.bold,
    },

    // Field Group
    fieldGroup: {
        marginBottom: SPACING.xl,
    },
    label: {
        color: COLORS.muted,
        fontSize: TEXT_SIZES.label,
        fontFamily: FONTS.bold,
        textTransform: 'uppercase',
        marginBottom: SPACING.sm,
        letterSpacing: 0.5,
    },

    // Help Text
    helpText: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.caption,
        marginTop: SPACING.sm,
        fontStyle: 'italic',
    },

    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
    },
    // New Styles
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.background,
    },
    verifiedCaption: {
        color: COLORS.muted,
        fontSize: 12,
        fontFamily: FONTS.body,
        marginTop: 12,
    },
});

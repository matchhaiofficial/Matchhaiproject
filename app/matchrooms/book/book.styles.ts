import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SHADOWS, SPACING, TEXT_SIZES } from '../../../src/theme';

export default StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.backgroundDark,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
        paddingBottom: 120,
    },
    section: {
        marginBottom: SPACING.xl,
    },
    sectionTitle: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.lg,
        fontFamily: FONTS.heading,
        marginBottom: SPACING.md,
    },

    // Side Selection
    sideContainer: {
        flexDirection: 'row',
        gap: SPACING.md,
        marginBottom: SPACING.xl,
    },
    sideCard: {
        flex: 1,
        backgroundColor: COLORS.cardDark,
        borderRadius: 20,
        padding: SPACING.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        ...SHADOWS.cardElevated,
    },
    sideCardActive: {
        borderColor: COLORS.accent,
    },
    sideLabel: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.heading,
        marginBottom: SPACING.xs,
        textTransform: 'uppercase',
    },
    sideName: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.xl,
        fontFamily: FONTS.heading,
    },
    sideNameActive: {
        color: COLORS.accent,
    },

    // Slot Grid
    slotGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.md,
    },
    slotItem: {
        width: '47%',
        backgroundColor: COLORS.cardDark,
        borderRadius: 16,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        ...SHADOWS.cardSoft,
    },
    slotSelected: {
        borderColor: COLORS.accent,
        backgroundColor: COLORS.accent + '15',
    },
    slotOccupied: {
        opacity: 0.5,
        backgroundColor: COLORS.overlayLight,
    },
    slotText: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.body,
    },
    slotTextSelected: {
        color: COLORS.accent,
        fontWeight: 'bold',
    },

    // Footer
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.cardDark,
        padding: SPACING.screenPadding,
        borderTopWidth: 1,
        borderTopColor: COLORS.overlayLight,
        paddingBottom: SPACING.lg + 20,
        zIndex: 10000,
        elevation: 10000,
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    priceLabel: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.body,
    },
    priceValue: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.xl,
        fontFamily: FONTS.heading,
    },
    primaryButton: {
        backgroundColor: COLORS.accent,
        height: 56,
        borderRadius: RADII.lg,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: SPACING.sm,
        ...SHADOWS.accentStrong,
    },
    primaryButtonDisabled: {
        backgroundColor: COLORS.disabled,
        shadowOpacity: 0,
        elevation: 0,
    },
    primaryButtonText: {
        color: '#FFF',
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.heading,
        fontWeight: 'bold',
    },
    activeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: COLORS.accent,
        marginTop: 8,
    },

    // Team Selection Cards
    teamTeamCard: {
        width: 150,
        marginRight: 12,
        backgroundColor: COLORS.cardDark,
        borderRadius: 16,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        ...SHADOWS.cardSoft,
    },
    teamTeamCardActive: {
        borderColor: COLORS.accent,
        backgroundColor: COLORS.accent + '10',
    },
    teamTeamCardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    teamTeamName: {
        color: COLORS.text,
        fontSize: 14,
        fontFamily: FONTS.heading,
        flex: 1,
        marginRight: 4,
    },
    teamTeamLabel: {
        color: COLORS.textSecondary,
        fontSize: 10,
        fontFamily: FONTS.body,
    },
});

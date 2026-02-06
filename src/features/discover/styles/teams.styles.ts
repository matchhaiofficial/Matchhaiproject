import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SHADOWS, SPACING, TEXT_SIZES } from '../../../theme';

export default StyleSheet.create({
    loadingContainer: {
        flex: 1,
        backgroundColor: COLORS.background,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Mode toggle (My / Discover)
    segmentTabs: {
        marginBottom: SPACING.md,
    },

    // Filters
    filterToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        backgroundColor: COLORS.background,
    },
    filterToggleText: {
        fontFamily: FONTS.heading,
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    filtersPanel: {
        backgroundColor: COLORS.cardBackground,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
        paddingVertical: 12,
        paddingBottom: 20,
    },
    filterSection: {
        marginBottom: 12,
    },
    filterLabel: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.heading,
        fontSize: 12,
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    filterOptionsScroll: {
        flexGrow: 0,
    },
    filterOptionsContent: {
        flexGrow: 1,
    },
    optionChip: {
        flex: 1,
        minWidth: 120,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
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

    // Results + list
    resultsCount: {
        paddingTop: SPACING.md,
        paddingBottom: SPACING.sm,
    },
    resultsCountText: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.caption,
    },
    listContent: {
        alignItems: 'stretch',
    },

    // Team card
    teamCard: {
        width: '100%',
        backgroundColor: COLORS.cardDark,
        borderRadius: 20,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        ...SHADOWS.cardElevated,
    },
    teamTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    teamGame: {
        color: COLORS.accent,
        fontSize: 11,
        fontFamily: FONTS.heading,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    memberCountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: RADII.sm,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    memberCountText: {
        color: COLORS.textSecondary,
        fontSize: 11,
        marginLeft: 4,
    },
    teamTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    teamName: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: 18,
        flex: 1,
        marginRight: 8,
    },
    viewBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: COLORS.overlayMedium,
    },
    viewBtnText: {
        color: COLORS.text,
        fontSize: 11,
        fontFamily: FONTS.heading,
    },
    requestedBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.warning,
        backgroundColor: 'rgba(255, 152, 0, 0.1)',
    },
    requestedBtnText: {
        color: COLORS.warning,
        fontSize: 11,
        fontFamily: FONTS.heading,
    },
    fullBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.error,
        backgroundColor: 'rgba(239, 83, 80, 0.12)',
    },
    fullBtnText: {
        color: COLORS.error,
        fontSize: 11,
        fontFamily: FONTS.heading,
    },
    requestBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.accent,
        backgroundColor: 'rgba(66, 165, 245, 0.1)',
    },
    requestBtnText: {
        color: COLORS.accent,
        fontSize: 11,
        fontFamily: FONTS.heading,
    },
    teamBottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    captainRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    captainText: {
        color: COLORS.textSecondary,
        fontSize: 11,
        marginLeft: 4,
    },
    statsTag: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    statsText: {
        color: COLORS.textSecondary,
        fontSize: 10,
        fontFamily: FONTS.heading,
        textTransform: 'uppercase',
    },

    // Empty
    emptyState: {
        alignItems: 'center',
        marginTop: 60,
    },
    emptyIcon: {
        opacity: 0.6,
        marginBottom: SPACING.lg,
    },
    emptyTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.subheading,
        marginBottom: SPACING.sm,
    },
    emptyText: {
        color: COLORS.muted,
        textAlign: 'center',
        maxWidth: 300,
        lineHeight: 20,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.body,
    },
});

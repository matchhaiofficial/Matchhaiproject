import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SHADOWS, SPACING, TEXT_SIZES } from '../../../src/theme';

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        padding: SPACING.screenPadding,
        paddingBottom: SPACING.lg,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
    },
    headerTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.heading,
        marginBottom: SPACING.lg,
    },
    // Segment Toggle (Aligned with Dash/Matchrooms)
    segmentToggle: {
        flexDirection: 'row',
        backgroundColor: COLORS.cardDark,
        borderRadius: 16,
        padding: 4,
        marginBottom: SPACING.md,
        height: 48,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    toggleButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
    },
    toggleButtonActive: {
        backgroundColor: COLORS.accent,
    },
    toggleButtonText: {
        color: COLORS.textSecondary,
        fontSize: 14,
        fontFamily: FONTS.heading,
        fontWeight: '600',
    },
    toggleButtonTextActive: {
        color: '#FFF',
    },

    // Search Bar (matching Find Match)
    searchBar: {
        backgroundColor: COLORS.inputBackground,
        borderRadius: RADII.md,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
        marginVertical: SPACING.sm,
        height: 48,
    },
    searchInput: {
        flex: 1,
        color: COLORS.text,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.input,
        paddingVertical: 0,
        paddingHorizontal: SPACING.sm,
    },

    // Option Chips (matching Find Match)
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

    // Collapsible Filters Panel
    filtersPanel: {
        backgroundColor: COLORS.cardBackground,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
        paddingVertical: 12,
    },
    filterSection: {
        marginBottom: 12,
        paddingHorizontal: 16,
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

    listContent: {
        paddingHorizontal: SPACING.screenPadding,
        paddingBottom: 100, // Matched with matchrooms.styles
    },

    // Results Count
    resultsCount: {
        paddingHorizontal: SPACING.screenPadding,
        paddingTop: SPACING.md,
        paddingBottom: SPACING.sm,
    },
    resultsCountText: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.caption,
    },

    // Structured card inspired by MatchroomCard (nearbyCard style)
    teamCard: {
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
        color: COLORS.muted,
        fontFamily: FONTS.heading,
        fontSize: 10,
        marginLeft: 4,
    },
    teamTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
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
        borderWidth: 1,
        borderColor: COLORS.accent,
        backgroundColor: 'rgba(66, 165, 245, 0.1)',
    },
    viewBtnText: {
        color: COLORS.accent,
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    requestBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(66, 165, 245, 0.15)',
        borderWidth: 1,
        borderColor: COLORS.accent,
    },
    requestBtnText: {
        color: COLORS.accent,
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    fullBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    fullBtnText: {
        color: COLORS.muted,
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    requestedBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 152, 0, 0.1)',
        borderWidth: 1,
        borderColor: COLORS.warning,
    },
    requestedBtnText: {
        color: COLORS.warning,
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    teamDetailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    teamDescription: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: 13,
        lineHeight: 18,
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
        color: COLORS.muted,
        fontSize: 11,
        fontFamily: FONTS.body,
        marginLeft: 4,
        fontWeight: '600',
    },
    statsTag: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        backgroundColor: 'rgba(0, 230, 118, 0.05)',
        borderColor: 'rgba(0, 230, 118, 0.2)',
    },
    statsText: {
        color: COLORS.successBright,
        fontSize: 10,
        fontFamily: FONTS.body,
        fontWeight: '700',
    },

    // FAB
    fab: {
        position: 'absolute',
        bottom: 120, // Sync with Matchrooms (120)
        right: SPACING.screenPadding,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: COLORS.accent,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 8,
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        zIndex: 10000, // Higher than TabBar (9999)
    },

    emptyState: {
        alignItems: 'center',
        marginTop: 100,
        paddingHorizontal: 40,
    },
    emptyIcon: {
        marginBottom: SPACING.xl,
        opacity: 0.8,
    },
    emptyTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.xl,
        marginBottom: SPACING.md,
    },
    emptyText: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.body,
        textAlign: 'center',
        lineHeight: 22,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.background,
    },
});


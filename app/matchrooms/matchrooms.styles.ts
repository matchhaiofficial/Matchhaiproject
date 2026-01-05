import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SPACING, TEXT_SIZES } from '../../src/theme';

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        paddingBottom: 100,
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
    headerSubtitle: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.body,
    },

    // Search Bar (matching Find Players)
    searchBar: {
        backgroundColor: COLORS.inputBackground,
        borderRadius: RADII.md,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
        marginBottom: SPACING.lg,
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

    // Filters (matching Find Players)
    filterContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
    },
    filtersPanel: {
        paddingHorizontal: SPACING.screenPadding,
        paddingTop: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
        paddingBottom: SPACING.sm,
    },
    filterChip: {
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
    filterChipActive: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
    },
    filterText: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.body,
        fontWeight: '600',
    },
    filterTextActive: {
        color: '#FFF',
    },

    // List content
    listContent: {
        paddingHorizontal: SPACING.screenPadding,
        paddingBottom: 100,
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

    // Option Chip styles (matching Find Players exactly)
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

    // AI Recommended Section
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.md,
    },
    sectionTitle: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.subheading,
        fontFamily: FONTS.heading,
    },
    aiBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(66, 165, 245, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: RADII.sm,
        borderWidth: 1,
        borderColor: 'rgba(66, 165, 245, 0.3)',
    },
    aiText: {
        color: COLORS.accent,
        fontSize: 10,
        fontWeight: 'bold',
        marginLeft: 4,
    },

    // -------------------------------------------------------------------------
    // New Matchroom Card Styles (Replicating NearbyCard from Dashboard)
    // -------------------------------------------------------------------------

    // -------------------------------------------------------------------------
    // New Matchroom Card Styles (Replicating NearbyCard from Dashboard)
    // -------------------------------------------------------------------------
    nearbyCard: {
        backgroundColor: COLORS.cardDark,
        borderRadius: 20,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    nearbyGame: {
        color: COLORS.accent,
        fontSize: 11,
        fontFamily: FONTS.heading,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: 10,
    },
    nearbyTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    nearbyTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: 16,
        flex: 1,
        marginRight: 8,
    },
    bookSlotBtn: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.accent,
        backgroundColor: 'rgba(66, 165, 245, 0.1)',
    },
    bookSlotText: {
        color: COLORS.accent,
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    nearbyInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    nearbyDistance: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    nearbyDistanceText: {
        color: COLORS.textSecondary,
        fontSize: 11,
        fontFamily: FONTS.body,
        marginLeft: 4,
        fontWeight: '600',
    },
    nearbyTime: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    nearbyTimeText: {
        color: COLORS.textSecondary,
        fontSize: 11,
        fontFamily: FONTS.body,
        marginLeft: 4,
        fontWeight: '600',
    },
    nearbyBottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    roleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'nowrap',
        overflow: 'hidden',
        flex: 1,
        marginRight: 8,
    },
    roleTag: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        marginRight: 6,
        backgroundColor: 'rgba(239, 83, 80, 0.1)',
        borderColor: 'rgba(239, 83, 80, 0.3)',
    },
    roleText: {
        color: COLORS.error,
        fontSize: 10,
        fontFamily: FONTS.body,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    skillTag: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        marginRight: 6,
        backgroundColor: 'rgba(66, 165, 245, 0.1)', // Accent color low opacity
        borderColor: 'rgba(66, 165, 245, 0.3)',
    },
    skillText: {
        color: COLORS.accent,
        fontSize: 10,
        fontFamily: FONTS.body,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    moreRolesText: {
        color: COLORS.textSecondary,
        fontSize: 10,
        fontWeight: '600',
    },
    priceTagContainer: {
        backgroundColor: 'rgba(0, 230, 118, 0.15)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(0, 230, 118, 0.3)',
    },
    priceTagText: {
        color: COLORS.successBright,
        fontFamily: FONTS.heading,
        fontSize: 13,
        fontWeight: '700',
    },
    // Skill Score Badge (from RecommendedCard)
    matchScoreBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: RADII.sm,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    matchScoreText: {
        color: '#FFF',
        fontSize: TEXT_SIZES.xs,
        fontWeight: '700',
        marginLeft: 4,
    },

    // Game Chip Container
    gameChipsContainer: {
        marginBottom: SPACING.sm,
    },

    // Game Chip (inline-safe version)
    gameChip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        backgroundColor: COLORS.cardBackground,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        marginRight: SPACING.sm,
        minHeight: 36,
    },
    gameChipActive: {
        borderColor: COLORS.accent,
        backgroundColor: '#1e2a38',
    },
    gameChipText: {
        color: COLORS.muted,
        fontSize: TEXT_SIZES.body,
    },
    gameChipTextActive: {
        color: COLORS.text,
    },

    // Filter Label
    filterLabel: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.xs,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },

    // Filter Section
    filterSection: {
        marginBottom: SPACING.md,
    },

    // Location Dropdown
    locationDropdown: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.md,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm + 2,
    },
    locationDropdownActive: {
        borderColor: COLORS.accent,
    },
    locationDropdownText: {
        color: COLORS.textSecondary,
    },
    locationDropdownTextActive: {
        color: COLORS.text,
    },

    // FAB
    fab: {
        position: 'absolute',
        bottom: 120,
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
        zIndex: 10000,
    },

    // Modal Overlay
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.cardDark,
        borderTopLeftRadius: RADII.xl,
        borderTopRightRadius: RADII.xl,
        maxHeight: '70%',
        paddingBottom: 30,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.cardBorder,
    },
    modalTitle: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.subheading,
        fontWeight: '600',
    },
    modalSearchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.inputBackground,
        margin: SPACING.md,
        paddingHorizontal: SPACING.md,
        borderRadius: RADII.sm,
    },
    modalSearchInput: {
        flex: 1,
        color: COLORS.text,
        paddingVertical: 12,
        marginLeft: SPACING.sm,
    },
    modalListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm + 4,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.cardBorder,
    },
    modalListItemText: {
        color: COLORS.text,
    },
    modalListItemTextActive: {
        color: COLORS.accent,
        fontWeight: '600',
    },

    // Empty State
    emptyState: {
        alignItems: 'center',
        marginTop: 40,
        padding: SPACING.lg,
    },
    emptyStateIcon: {
        marginBottom: SPACING.md,
    },
    emptyStateTitle: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.subheading,
        fontWeight: 'bold',
    },
    emptyStateSubtitle: {
        color: COLORS.muted,
        textAlign: 'center',
        marginTop: SPACING.sm,
    },

    // Loading Container
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

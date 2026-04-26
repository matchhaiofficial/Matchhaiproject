import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SPACING, TEXT_SIZES } from '../../../theme';

export default StyleSheet.create({
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.background,
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
    locationDropdown: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        paddingHorizontal: 15,
        height: 50,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
    },
    locationDropdownActive: {
        borderColor: COLORS.accent,
        backgroundColor: COLORS.accent + '10',
    },
    locationDropdownText: {
        color: COLORS.text,
        fontSize: 15,
    },
    locationDropdownTextActive: {
        color: COLORS.accent,
        fontFamily: FONTS.heading,
        fontWeight: 'bold',
    },

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

    // Empty
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
        paddingHorizontal: 40,
    },
    emptyStateIcon: {
        marginBottom: 20,
        opacity: 0.8,
    },
    emptyStateTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 8,
    },
    emptyStateSubtitle: {
        fontSize: 14,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        maxHeight: '80%',
    },
    modalBodyContent: {
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.lg,
        paddingBottom: SPACING.md,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    modalSearchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.cardBackground,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
    },
    modalSearchInput: {
        flex: 1,
        marginLeft: 10,
        color: COLORS.text,
        fontSize: 15,
    },
    modalListItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
    },
    modalListItemText: {
        fontSize: 16,
        color: COLORS.text,
    },
    modalListItemTextActive: {
        color: COLORS.accent,
        fontFamily: FONTS.heading,
        fontWeight: 'bold',
    },
});

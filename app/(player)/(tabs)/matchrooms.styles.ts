import { Dimensions, Platform, StyleSheet } from 'react-native';
import { COLORS, SHADOWS, SPACING } from '../../../src/theme';

const { width } = Dimensions.get('window');

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 20 : 10,
        paddingBottom: 15,
        backgroundColor: COLORS.background,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 20,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        paddingHorizontal: 15,
        height: 50,
        ...SHADOWS.cardSoft,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        paddingHorizontal: 15,
        height: 50,
        ...SHADOWS.cardSoft,
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        color: COLORS.text,
        fontSize: 16,
    },
    filterIcon: {
        padding: 5,
    },
    filterToggle: {
        marginLeft: 10,
    },
    filterOptionsScroll: {
        flexGrow: 0,
    },
    filtersPanel: {
        paddingHorizontal: 20,
        paddingBottom: 10,
        backgroundColor: COLORS.background,
    },
    filterSection: {
        marginBottom: 15,
    },
    filterLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 8,
    },
    optionChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: COLORS.overlayLight,
        marginRight: 8,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        marginBottom: 5,
    },
    optionChipActive: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
    },
    optionChipText: {
        color: COLORS.textSecondary,
        fontSize: 13,
        fontWeight: '600',
    },
    optionChipTextActive: {
        color: '#FFFFFF',
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
        fontWeight: '600',
    },
    resultsCount: {
        paddingHorizontal: 20,
        paddingBottom: 10,
    },
    resultsCountText: {
        fontSize: 13,
        color: COLORS.textSecondary,
    },
    listContent: {
        padding: 12,
        paddingBottom: 100,
    },
    emptyState: {
        flex: 1,
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
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    emptySubtitle: {
        fontSize: 14,
        color: COLORS.muted,
    },
    gameFiltersScroll: {
        marginTop: SPACING.sm,
    },
    gameFiltersContent: {
        paddingRight: SPACING.md,
    },
    fabWrapper: {
        position: 'absolute',
        bottom: 120,
        right: 24,
        zIndex: 1000,
    },
    fab: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: COLORS.accent,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.cardElevated,
    },
    resetButton: {
        padding: 5,
    },
    resetButtonText: {
        color: COLORS.accent,
        fontSize: 14,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        padding: 20,
        maxHeight: '80%',
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
        backgroundColor: COLORS.background,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
        marginBottom: 15,
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
        fontWeight: '600',
    }
});

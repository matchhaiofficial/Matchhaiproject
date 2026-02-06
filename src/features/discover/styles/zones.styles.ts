import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SHADOWS, SPACING, TEXT_SIZES } from '../../../theme';

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        alignItems: 'stretch',
    },
    resultsCount: {
        paddingTop: SPACING.md,
        paddingBottom: SPACING.sm,
    },
    resultsCountText: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.caption,
    },
    card: {
        width: '100%',
        backgroundColor: COLORS.cardBackground,
        borderRadius: RADII.lg,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        ...SHADOWS.cardElevated,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: SPACING.sm,
    },
    cardIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(66, 165, 245, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
    },
    cardTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: 16,
        fontWeight: 'bold',
    },
    cardSubtitle: {
        color: COLORS.textSecondary,
        fontSize: 12,
        marginLeft: 4,
        flex: 1,
    },
    priceTag: {
        backgroundColor: 'rgba(0, 230, 118, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(0, 230, 118, 0.3)',
    },
    priceText: {
        color: COLORS.success,
        fontSize: 10,
        fontWeight: 'bold',
    },
    tagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 4,
        gap: 8,
    },
    tag: {
        backgroundColor: COLORS.background,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: COLORS.divider,
    },
    tagText: {
        color: COLORS.textSecondary,
        fontSize: 10,
        fontFamily: FONTS.body,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
    },
    emptyIcon: {
        marginBottom: SPACING.md,
        opacity: 0.5,
    },
    emptyTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: 18,
        marginBottom: SPACING.sm,
    },
    emptySubtitle: {
        color: COLORS.muted,
        textAlign: 'center',
    },
});

const filterStyles = StyleSheet.create({
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
});

export { filterStyles };
export default styles;

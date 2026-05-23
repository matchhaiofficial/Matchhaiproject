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
        paddingBottom: SPACING.md,
        backgroundColor: COLORS.backgroundDark,
    },
    backButton: {
        padding: 8,
        marginRight: 8,
        marginLeft: -8,
    },
    headerTitle: {
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.xl,
        color: COLORS.text,
        flex: 1,
    },
    tabContainer: {
        flexDirection: 'row',
        paddingVertical: SPACING.md,
        gap: SPACING.sm,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: RADII.md,
        backgroundColor: COLORS.cardDark,
        borderWidth: 1,
        borderColor: COLORS.overlayLight,
    },
    tabPressed: {
        opacity: 0.88,
    },
    activeTab: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
    },
    tabText: {
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.body,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    activeTabText: {
        color: '#FFF',
    },
    filterBar: {
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginBottom: SPACING.md,
    },
    searchBar: {
        flex: 1,
        height: 48,
        backgroundColor: COLORS.inputBackground,
        borderRadius: RADII.md,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
    },
    searchInput: {
        flex: 1,
        color: COLORS.text,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.input,
        paddingVertical: 0,
        paddingHorizontal: SPACING.sm,
    },
    filterButton: {
        width: 48,
        height: 48,
        borderRadius: RADII.md,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        backgroundColor: COLORS.overlayLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterButtonPressed: {
        opacity: 0.88,
    },
    filterBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: COLORS.accent,
        borderWidth: 2,
        borderColor: COLORS.backgroundDark,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    filterBadgeText: {
        color: '#FFF',
        fontFamily: FONTS.heading,
        fontSize: 10,
        fontWeight: '700',
    },
    listContent: {
        paddingBottom: 100,
    },
    sectionTitle: {
        fontFamily: FONTS.subheading,
        fontSize: TEXT_SIZES.subheading,
        color: COLORS.text,
        marginBottom: SPACING.sm,
        marginTop: SPACING.md,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.body,
        color: COLORS.textSecondary,
        marginTop: SPACING.sm,
        textAlign: 'center',
    },
    matchCard: {
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.lg,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.overlayLight,
        ...SHADOWS.cardElevated,
    },
    matchCardPressed: {
        opacity: 0.92,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: SPACING.sm,
    },
    gameBadge: {
        backgroundColor: COLORS.overlayMedium,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: RADII.sm,
    },
    gameText: {
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
        color: COLORS.accent,
        fontWeight: 'bold',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: RADII.sm,
    },
    statusBadgeOpen: {
        backgroundColor: COLORS.success,
    },
    statusBadgeLocked: {
        backgroundColor: COLORS.warning,
    },
    statusBadgeExpired: {
        backgroundColor: '#FF5722',
    },
    statusBadgeDefault: {
        backgroundColor: COLORS.muted,
    },
    statusText: {
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
        fontWeight: 'bold',
        color: '#FFF',
    },
    cardTitle: {
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.subheading,
        color: COLORS.text,
        marginBottom: 4,
    },
    cardDetails: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    detailText: {
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
        color: COLORS.textSecondary,
        marginLeft: 4,
        marginRight: 12,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: SPACING.xs,
        paddingTop: SPACING.sm,
        borderTopWidth: 1,
        borderTopColor: COLORS.divider,
    },
    roleText: {
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
        color: COLORS.accent,
        fontWeight: '600',
    },
    viewButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    emptyIcon: {
        color: COLORS.overlayLight,
    },
    fabIcon: {
        color: '#FFF',
    },
    viewButtonText: {
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
        color: COLORS.textSecondary,
        marginRight: 4,
    },
    tabButtonActiveText: {
        color: '#FFF',
    },
    loadingContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.backgroundDark,
    },
    filterDrawer: {
        flex: 1,
    },
    filterDrawerContent: {
        flex: 1,
    },
    filterDrawerBody: {
        paddingTop: SPACING.sm,
        gap: SPACING.md,
    },
    filterDrawerFooter: {
        backgroundColor: COLORS.cardDark,
    },
    filterDrawerFooterRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    filterDrawerFooterButton: {
        flex: 1,
    },
    filterSection: {
        gap: SPACING.xs,
    },
    filterSectionLabel: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.interSemiBold,
        fontSize: 12,
        textTransform: 'uppercase',
    },
    filterChipWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
    },
    filterChip: {
        minHeight: 38,
        paddingHorizontal: SPACING.md,
        paddingVertical: 8,
        borderRadius: RADII.pill,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        backgroundColor: COLORS.overlayLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterChipActive: {
        borderColor: COLORS.accent,
        backgroundColor: COLORS.accent + '16',
    },
    filterChipText: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: 12,
        fontWeight: '600',
    },
    filterChipTextActive: {
        color: COLORS.accent,
    },
});

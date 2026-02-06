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
        backgroundColor: COLORS.background,
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
    viewButtonText: {
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
        color: COLORS.textSecondary,
        marginRight: 4,
    },
    loadingContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.background,
    },
});

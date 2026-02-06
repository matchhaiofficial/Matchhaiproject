import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SHADOWS, SPACING, TEXT_SIZES } from '../../../theme';

export default StyleSheet.create({
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
        marginBottom: 5,
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
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.background,
    },

    // Player Card
    playerCard: {
        width: '100%',
        backgroundColor: COLORS.cardDark,
        borderRadius: 20,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        ...SHADOWS.cardElevated,
        minHeight: 90,
    },
    playerAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: COLORS.background,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
        position: 'relative',
        borderWidth: 1,
        borderColor: COLORS.divider,
    },
    playerAvatarText: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: 20,
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: COLORS.success,
        borderWidth: 2,
        borderColor: COLORS.cardDark,
    },
    playerInfo: {
        flex: 1,
    },
    playerName: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: 18,
        marginBottom: 4,
    },
    gameTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    gameTag: {
        backgroundColor: 'rgba(66, 165, 245, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(66, 165, 245, 0.3)',
    },
    gameTagText: {
        color: COLORS.accent,
        fontFamily: FONTS.heading,
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    skillTag: {
        backgroundColor: 'rgba(0, 230, 118, 0.05)',
        borderColor: 'rgba(0, 230, 118, 0.2)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
    },
    skillTagText: {
        color: COLORS.successBright,
        fontSize: 10,
        fontFamily: FONTS.heading,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    faceitIcon: {
        width: 25,
        height: 25,
        marginLeft: 4,
    },
    actionBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.accent,
        backgroundColor: 'rgba(66, 165, 245, 0.1)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    actionBtnText: {
        color: COLORS.accent,
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    pendingBtn: {
        borderColor: COLORS.warning,
        backgroundColor: 'rgba(255, 152, 0, 0.1)',
    },
    pendingBtnText: {
        color: COLORS.warning,
    },
    friendBtn: {
        borderColor: COLORS.success,
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
    },
    friendBtnText: {
        color: COLORS.success,
    },

    // Empty State
    emptyState: {
        alignItems: 'center',
        marginTop: 60,
    },
    emptyIcon: {
        opacity: 0.5,
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
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.body,
        textAlign: 'center',
        maxWidth: 300,
        lineHeight: 20,
    },
});

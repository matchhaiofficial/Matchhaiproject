import { StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING, TEXT_SIZES } from '../../../theme';

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
        minHeight: 90,
    },
    playerCardBody: {
        flexDirection: 'row',
        alignItems: 'center',
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
    playerMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 6,
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
    faceitIcon: {
        width: 25,
        height: 25,
        marginLeft: 4,
    },
});

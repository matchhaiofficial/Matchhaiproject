// app/matchrooms/index.styles.ts
import { StyleSheet } from 'react-native';
import {
    COLORS,
    RADII,
    SPACING,
    TEXT_SIZES
} from '../../src/theme';

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.background,
    },

    header: {
        padding: SPACING.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },

    headerTextContainer: {
        flex: 1,
    },

    headerTitle: {
        color: COLORS.text,
        fontSize: 24,
        fontWeight: 'bold',
    },

    headerSubtitle: {
        color: COLORS.muted,
        fontSize: TEXT_SIZES.label,
        marginTop: SPACING.xs,
    },

    createButton: {
        backgroundColor: COLORS.accent,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },

    createButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: TEXT_SIZES.label,
    },

    filterChipsContainer: {
        paddingHorizontal: SPACING.lg,
        marginBottom: SPACING.lg,
        flexDirection: 'row',
        gap: SPACING.sm,
    },

    filterChip: {
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs + 2,
        borderRadius: RADII.lg,
        borderWidth: 1,
        borderColor: COLORS.divider,
    },

    filterChipActive: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
    },

    filterChipText: {
        fontSize: TEXT_SIZES.caption,
    },

    filterChipTextActive: {
        color: '#fff',
    },

    listContainer: {
        padding: SPACING.lg,
    },

    roomCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: RADII.md,
        padding: SPACING.lg,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.divider,
    },

    roomCardPressed: {
        opacity: 0.92,
    },

    roomHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.sm,
    },

    roomBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },

    roomGameBadge: {
        backgroundColor: COLORS.accent,
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: RADII.sm,
    },

    roomGameText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: TEXT_SIZES.caption,
        textTransform: 'uppercase',
    },

    roomPlayerCount: {
        color: COLORS.muted,
        fontSize: TEXT_SIZES.caption,
    },

    roomTitle: {
        color: COLORS.text,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: SPACING.xs,
    },

    roomDescription: {
        color: COLORS.muted,
        fontSize: TEXT_SIZES.label,
        marginBottom: SPACING.md,
    },

    roomFooter: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    hostAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: COLORS.divider,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.sm,
    },

    hostAvatarText: {
        color: COLORS.text,
        fontSize: 10,
    },

    hostName: {
        color: COLORS.muted,
        fontSize: TEXT_SIZES.caption,
    },

    emptyState: {
        alignItems: 'center',
        marginTop: 40,
    },

    emptyStateText: {
        color: COLORS.muted,
        fontSize: TEXT_SIZES.label,
        textAlign: 'center',
    },

    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

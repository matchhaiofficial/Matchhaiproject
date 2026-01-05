import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SHADOWS, SPACING, TEXT_SIZES } from '../../src/theme';

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.screenPadding,
        paddingTop: SPACING.md,
        paddingBottom: SPACING.lg,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
        backgroundColor: COLORS.background,
    },
    backButton: {
        marginRight: SPACING.md,
        padding: SPACING.xs,
        borderRadius: RADII.sm,
    },
    headerTitle: {
        flex: 1,
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.heading,
        fontWeight: '700',
    },

    // Modern Tab System
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        marginHorizontal: SPACING.screenPadding,
        marginTop: SPACING.md,
        borderRadius: RADII.md,
        padding: 4,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: RADII.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    activeTab: {
        backgroundColor: COLORS.cardDark,
        ...SHADOWS.cardSoft,
    },
    tabText: {
        fontFamily: FONTS.body,
        fontSize: 13,
        color: COLORS.muted,
        fontWeight: '600',
    },
    activeTabText: {
        color: COLORS.accent,
        fontWeight: '700',
    },

    // Notification List
    listContent: {
        padding: SPACING.screenPadding,
        paddingTop: SPACING.lg,
    },

    // Notification Card
    notificationCard: {
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.lg,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        ...SHADOWS.cardSoft,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
    },
    headerInfo: {
        flex: 1,
    },
    typeText: {
        color: COLORS.text,
        fontSize: 14,
        fontFamily: FONTS.bold,
        fontWeight: '600',
    },
    timeText: {
        color: COLORS.muted,
        fontSize: 11,
        fontFamily: FONTS.body,
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: RADII.pill,
    },
    statusText: {
        fontSize: 10,
        fontFamily: FONTS.bold,
        textTransform: 'uppercase',
    },

    // Body
    cardBody: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        padding: SPACING.md,
        borderRadius: RADII.md,
        marginBottom: SPACING.sm,
    },
    messageText: {
        color: COLORS.textSecondary,
        fontSize: 14,
        lineHeight: 20,
        fontFamily: FONTS.body,
    },
    highlightText: {
        color: COLORS.accent,
        fontWeight: '700',
    },

    // Actions
    actionRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
        marginTop: SPACING.xs,
    },
    acceptButton: {
        flex: 1,
        height: 40,
        borderRadius: RADII.md,
        backgroundColor: COLORS.success,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.accentSoft,
    },
    declineButton: {
        flex: 1,
        height: 40,
        borderRadius: RADII.md,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: COLORS.error,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: '#FFF',
        fontFamily: FONTS.bold,
        fontSize: 13,
        textTransform: 'uppercase',
    },
    declineButtonText: {
        color: COLORS.error,
        fontFamily: FONTS.bold,
        fontSize: 13,
        textTransform: 'uppercase',
    },

    // Empty State
    emptyContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.lg,
    },
    emptyTitle: {
        color: COLORS.text,
        fontSize: 18,
        fontFamily: FONTS.heading,
        fontWeight: '700',
        marginBottom: 8,
    },
    emptySubtitle: {
        color: COLORS.muted,
        fontSize: 14,
        fontFamily: FONTS.body,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
});

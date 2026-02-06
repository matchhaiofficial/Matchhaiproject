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

    segmentTabs: {
        marginTop: SPACING.md,
    },

    // Notification List
    listContent: {
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
        minHeight: 44,
        borderRadius: RADII.md,
        backgroundColor: COLORS.success,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.accentSoft,
    },
    declineButton: {
        flex: 1,
        minHeight: 44,
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
    // Clear History Button
    clearHistoryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
        paddingVertical: SPACING.sm - 1,
        paddingHorizontal: SPACING.lg,
        marginHorizontal: SPACING.screenPadding,
        marginTop: SPACING.md,
        backgroundColor: 'rgba(239, 83, 80, 0.08)',
        borderRadius: RADII.md,
        borderWidth: 1,
        borderColor: 'rgba(239, 83, 80, 0.2)',
    },
    clearHistoryText: {
        color: COLORS.error,
        marginLeft: SPACING.sm,
        fontFamily: FONTS.bold,
        fontSize: 13,
        fontWeight: '600',
    },
});

import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SHADOWS, SPACING, TEXT_SIZES } from '../../../src/theme';

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.backgroundDark,
    },
    scrollContent: {
        paddingBottom: 100,
    },

    // 🔵 Zone Overview Header
    header: {
        paddingHorizontal: SPACING.screenPadding,
        paddingTop: SPACING.xl + 10,
        paddingBottom: SPACING.lg,
        backgroundColor: COLORS.backgroundDark,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.overlayLight,
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    zoneNameContainer: {
        flex: 1,
    },
    zoneLabel: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.caption - 1,
        fontFamily: FONTS.body,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    zoneName: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.xxl,
        fontFamily: FONTS.heading,
        marginTop: 2,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
        paddingVertical: 6,
        borderRadius: RADII.pill,
        backgroundColor: COLORS.overlayLight,
        borderWidth: 1,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    statusText: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.body,
        fontWeight: '600',
    },
    quickStatsRow: {
        flexDirection: 'row',
        gap: SPACING.md,
        marginTop: SPACING.md,
    },
    quickStatItem: {
        flex: 1,
    },
    quickStatLabel: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.xs,
        fontFamily: FONTS.body,
    },
    quickStatValue: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.xl - 2, // ~18
        fontFamily: FONTS.heading,
        marginTop: 2,
    },

    // 🔔 Critical Alerts
    section: {
        marginTop: SPACING.xl,
        paddingHorizontal: SPACING.screenPadding,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    sectionTitle: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.xl - 2, // ~18
        fontFamily: FONTS.heading,
        letterSpacing: 0.5,
    },
    seeAllText: {
        color: COLORS.accent,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.body,
        fontWeight: '600',
    },
    alertCard: {
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.md,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
        borderLeftWidth: 3,
        flexDirection: 'row',
        alignItems: 'center',
        ...SHADOWS.cardElevated,
    },
    alertIcon: {
        marginRight: SPACING.md,
    },
    alertContent: {
        flex: 1,
    },
    alertText: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.body - 2, // ~13
        fontFamily: FONTS.body,
        lineHeight: 18,
    },
    alertTime: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.xs,
        marginTop: 2,
    },
    alertAction: {
        marginLeft: SPACING.sm,
    },

    // 📅 Today's Matches Timeline
    timelineContainer: {
        marginTop: SPACING.md,
    },
    timelineScroll: {
        paddingRight: SPACING.screenPadding,
    },
    matchTimelineCard: {
        width: 280,
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.md,
        padding: SPACING.md,
        marginRight: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    matchTimeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    matchTime: {
        color: COLORS.accent,
        fontSize: TEXT_SIZES.subheading,
        fontFamily: FONTS.heading,
    },
    matchStatusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    matchStatusText: {
        fontSize: TEXT_SIZES.xs,
        fontFamily: FONTS.body,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    matchGameTitle: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.heading,
        marginBottom: 4,
    },
    matchDetail: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.body,
    },
    matchActions: {
        flexDirection: 'row',
        marginTop: SPACING.md,
        gap: SPACING.sm,
    },
    matchActionBtn: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: RADII.sm,
        borderWidth: 1,
        borderColor: COLORS.accent,
        alignItems: 'center',
    },
    matchActionText: {
        color: COLORS.accent,
        fontSize: TEXT_SIZES.caption - 1,
        fontFamily: FONTS.body,
        fontWeight: '600',
    },

    // 💬 Incoming Requests
    requestCard: {
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.md,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    requestHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: SPACING.sm,
    },
    requestUserInfo: {
        flex: 1,
    },
    requestUserName: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.subheading,
        fontFamily: FONTS.heading,
    },
    requestUserRole: {
        color: COLORS.accent,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.body,
        marginTop: 2,
    },
    requestDetailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
    },
    requestDetailText: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.body,
        marginLeft: 6,
    },
    requestActions: {
        flexDirection: 'row',
        marginTop: SPACING.md,
        gap: SPACING.sm,
    },
    requestActionPrimary: {
        flex: 2,
        backgroundColor: COLORS.accent,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: RADII.sm,
        alignItems: 'center',
    },
    requestActionSecondary: {
        flex: 1,
        backgroundColor: 'transparent',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: RADII.sm,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        alignItems: 'center',
    },
    requestActionPrimaryText: {
        color: '#FFF',
        fontSize: TEXT_SIZES.body - 2,
        fontFamily: FONTS.body,
        fontWeight: '700',
    },
    requestActionSecondaryText: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.body - 2,
        fontFamily: FONTS.body,
        fontWeight: '600',
    },

    // 🏷️ Bookings
    bookingCard: {
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.md,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    bookingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.sm,
    },
    bookingTitle: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.heading,
    },
    bookingPaymentBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    bookingPaymentText: {
        fontSize: TEXT_SIZES.xs,
        fontFamily: FONTS.body,
        fontWeight: '700',
    },

    // 🔴 Live Match Control
    liveMatchCard: {
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.md,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        borderWidth: 2,
        borderColor: COLORS.successBright,
    },
    liveMatchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    livePulse: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: COLORS.successBright,
        marginRight: 8,
    },
    liveMatchTitle: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.subheading,
        fontFamily: FONTS.heading,
    },
    liveMatchStats: {
        flexDirection: 'row',
        gap: SPACING.md,
        marginTop: SPACING.sm,
    },
    liveStatItem: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.03)',
        padding: SPACING.sm,
        borderRadius: RADII.sm,
    },
    liveStatLabel: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.xs,
    },
    liveStatValue: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.subheading,
        fontFamily: FONTS.heading,
        marginTop: 2,
    },

    // 🖥️ Court/PC Grid
    courtGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.md,
        marginTop: SPACING.md,
    },
    courtCard: {
        width: '48%',
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.md,
        padding: SPACING.md,
        borderWidth: 1,
        alignItems: 'center',
    },
    courtName: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.label,
        fontFamily: FONTS.heading,
        marginTop: 6,
    },
    courtStatus: {
        fontSize: TEXT_SIZES.caption - 1,
        fontFamily: FONTS.body,
        marginTop: 2,
    },

    // 💳 Payment Widget
    paymentWidget: {
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.md,
        padding: SPACING.lg,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.overlayMedium,
    },
    paymentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.sm,
    },
    paymentLabel: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.body,
    },
    paymentValue: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.subheading,
        fontFamily: FONTS.heading,
    },
    paymentDivider: {
        height: 1,
        backgroundColor: COLORS.overlayLight,
        marginVertical: SPACING.sm,
    },
    paymentTotal: {
        fontSize: TEXT_SIZES.xxl,
        color: COLORS.successBright,
        fontFamily: FONTS.heading,
    },

    // 📊 Analytics
    analyticsCard: {
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.md,
        padding: SPACING.md,
        marginBottom: SPACING.md,
    },
    analyticsMetric: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.sm,
    },
    metricLabel: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.body - 2,
        fontFamily: FONTS.body,
    },
    metricValue: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.heading,
    },
    aiInsightCard: {
        backgroundColor: 'rgba(66, 165, 245, 0.1)',
        borderRadius: RADII.md,
        padding: SPACING.md,
        marginTop: SPACING.sm,
        borderWidth: 1,
        borderColor: 'rgba(66, 165, 245, 0.3)',
    },
    aiInsightText: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.body - 2,
        fontFamily: FONTS.body,
        lineHeight: 18,
    },

    // Empty State
    emptyState: {
        padding: SPACING.xl,
        alignItems: 'center',
    },
    emptyStateIcon: {
        marginBottom: SPACING.md,
    },
    emptyStateText: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.label,
        fontFamily: FONTS.body,
        textAlign: 'center',
    },
});

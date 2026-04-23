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
        paddingBottom: SPACING.lg,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
        backgroundColor: COLORS.backgroundDark,
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
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pendingCardSpacer: {
        marginBottom: 12,
    },

    markAllReadButton: {
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    markAllReadText: {
        color: COLORS.accent,
        fontSize: 13,
        fontWeight: '700',
    },

    // Notification Card
    notificationCard: {
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.lg,
        padding: SPACING.md + 2,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        ...SHADOWS.cardSoft,
    },
    notificationCardNoMargin: {
        marginBottom: 0,
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
    iconContainerInfo: {
        backgroundColor: 'rgba(66, 165, 245, 0.1)',
    },
    iconContainerSuccess: {
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.accent,
        position: "absolute",
        left: -4,
        top: "50%",
        marginTop: -4,
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
        backgroundColor: 'rgba(255, 255, 255, 0.035)',
        padding: SPACING.md,
        borderRadius: RADII.md + 2,
        marginBottom: SPACING.sm,
    },
    messageWrap: {
        width: '100%',
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
    inlineLinkText: {
        color: COLORS.text,
        fontWeight: '600',
        textDecorationLine: 'underline',
        textDecorationColor: 'rgba(255,255,255,0.3)',
    },
    challengeGameText: {
        color: COLORS.accent,
        fontWeight: '700',
    },
    requestMetaBox: {
        marginTop: 8,
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: RADII.sm,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    requestMetaText: {
        fontSize: 12,
        color: COLORS.muted,
        fontFamily: FONTS.body,
    },
    contextChipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 10,
    },
    contextChip: {
        minHeight: 32,
        borderRadius: RADII.pill,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: 'rgba(66, 165, 245, 0.3)',
        backgroundColor: 'rgba(66, 165, 245, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 5,
    },
    contextChipText: {
        color: COLORS.accent,
        fontSize: 12,
        fontFamily: FONTS.bold,
    },

    // Actions
    actionRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
        marginTop: SPACING.xs,
    },
    counterOfferOptionRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
        marginTop: 10,
        marginBottom: 0,
        alignItems: "center",
    },
    counterOfferOptionTextWrap: {
        flex: 1,
    },
    requestMetaMarginTop: {
        marginTop: 10,
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
    openChallengeButton: {
        flex: 1,
        minHeight: 44,
        borderRadius: RADII.md,
        backgroundColor: COLORS.accent,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.accentSoft,
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
        alignSelf: 'stretch',
        width: '100%',
        minHeight: 44,
        paddingVertical: SPACING.sm - 1,
        paddingHorizontal: SPACING.lg,
        marginTop: SPACING.md,
        backgroundColor: 'rgba(239, 83, 80, 0.08)',
        borderRadius: RADII.md,
        borderWidth: 1,
        borderColor: 'rgba(239, 83, 80, 0.2)',
    },
    clearHistoryContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    clearHistoryText: {
        color: COLORS.error,
        marginLeft: SPACING.sm,
        fontFamily: FONTS.bold,
        fontSize: 13,
        fontWeight: '600',
    },
});


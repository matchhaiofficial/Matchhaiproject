import { StyleSheet } from 'react-native';
import { COLORS, CTA, FONTS, RADII, SHADOWS, SPACING, TEXT_SIZES } from '../../../src/theme';

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.backgroundDark,
    },
    screenContent: {
        paddingBottom: 0,
    },
    body: {
        flex: 1,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: SPACING.xxl,
    },

    // Profile Card
    profileCard: {
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.lg,
        padding: SPACING.lg,
        marginTop: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        width: '100%',
        ...SHADOWS.cardSoft,
    },
    profileHeaderRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        width: '100%',
        minWidth: 0,
    },
    avatar: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: COLORS.accent,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.lg,
        borderWidth: 2,
        borderColor: COLORS.divider,
        flexShrink: 0,
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 40,
    },
    onlineBadge: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: COLORS.success,
        borderWidth: 2,
        borderColor: COLORS.cardDark,
    },
    profileName: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.subheading,
        fontFamily: FONTS.heading,
        fontWeight: '600',
    },
    profileUsername: {
        color: COLORS.muted,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.body,
        marginTop: 2,
    },
    profileHeaderContent: {
        flex: 1,
        minWidth: 0,
    },
    profileIdentityBlock: {
        minWidth: 0,
    },
    profileBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: SPACING.xs,
        gap: SPACING.sm,
        flexWrap: 'wrap',
        minWidth: 0,
    },
    summaryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 30,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 6,
        borderRadius: RADII.pill,
        borderWidth: 1,
        minWidth: 0,
    },
    summaryBadgeAccent: {
        backgroundColor: 'rgba(66, 165, 245, 0.12)',
        borderColor: 'rgba(66, 165, 245, 0.28)',
    },
    summaryBadgeSuccess: {
        backgroundColor: 'rgba(76, 175, 80, 0.12)',
        borderColor: 'rgba(76, 175, 80, 0.32)',
    },
    summaryBadgeNeutral: {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderColor: COLORS.cardBorder,
    },
    summaryBadgeText: {
        color: COLORS.text,
        fontSize: 11,
        fontFamily: FONTS.bold,
        textTransform: 'uppercase',
        flexShrink: 1,
        minWidth: 0,
    },
    summaryDivider: {
        width: '100%',
        height: 1,
        backgroundColor: COLORS.divider,
        opacity: 0.6,
        marginTop: SPACING.md,
        marginBottom: SPACING.md,
    },
    summaryMetricRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
        width: '100%',
    },
    summaryMetricCard: {
        flex: 1,
        minWidth: 140,
        backgroundColor: 'rgba(255, 255, 255, 0.035)',
        borderRadius: RADII.md,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
    },
    summaryMetricLabel: {
        color: COLORS.muted,
        fontSize: 10,
        fontFamily: FONTS.bold,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    summaryMetricInline: {
        flexDirection: 'row',
        alignItems: 'center',
        minWidth: 0,
        gap: 6,
    },
    summaryMetricValue: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.body,
        fontWeight: '600',
        flexShrink: 1,
        minWidth: 0,
    },
    infoPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 34,
        paddingHorizontal: SPACING.md,
        paddingVertical: 8,
        borderRadius: RADII.pill,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        minWidth: 0,
        flexShrink: 1,
    },
    infoPillText: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.body,
        fontWeight: '500',
        flexShrink: 1,
        minWidth: 0,
    },

    // Action Section
    actionContainer: {
        width: '100%',
        marginTop: SPACING.md,
    },
    actionRow: {
        width: '100%',
        marginTop: SPACING.md,
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: SPACING.sm,
    },
    primaryActionSlot: {
        flex: 4,
        minWidth: 0,
    },
    secondaryActionSlot: {
        flex: 1,
        minWidth: 0,
    },
    primaryActionButton: {
        width: '100%',
    },
    primaryActionSurface: {
        width: '100%',
    },
    reportButton: {
        marginTop: 12,
        backgroundColor: 'rgba(239, 83, 80, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(239, 83, 80, 0.28)',
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
    },
    reportButtonText: {
        color: COLORS.error,
    },
    reportIconButton: {
        width: '100%',
        minHeight: 54,
        backgroundColor: 'rgba(239, 83, 80, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(239, 83, 80, 0.28)',
        paddingHorizontal: 0,
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
    },
    mainButton: {
        width: '100%',
        ...CTA.primaryButton,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    mainButtonText: {
        ...CTA.primaryButtonText,
        textTransform: 'uppercase',
        marginLeft: SPACING.sm,
    },
    statusBadge: {
        minHeight: 54,
        borderRadius: RADII.md,
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
    },
    friendBadge: {
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        borderColor: COLORS.success,
    },
    pendingBadge: {
        backgroundColor: 'rgba(255, 193, 7, 0.1)',
        borderColor: COLORS.warning,
    },
    statusBadgeText: {
        fontFamily: FONTS.bold,
        fontSize: TEXT_SIZES.label,
        textTransform: 'uppercase',
        marginLeft: SPACING.sm,
    },

    // Section Styling
    section: {
        marginTop: SPACING.xl,
    },
    sectionPadding: {
        width: '100%',
    },
    gamesScrollContainer: {
        paddingBottom: SPACING.sm,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    sectionTitle: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.subheading,
        fontFamily: FONTS.heading,
    },
    sectionLink: {
        color: COLORS.accent,
        fontSize: TEXT_SIZES.caption,
        fontWeight: '600',
    },

    // Area Chips
    areaChipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
    },
    areaChip: {
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.pill,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm - 2,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    areaChipText: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.caption,
    },

    // Empty State
    emptyState: {
        alignItems: 'center',
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.md,
        padding: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        borderStyle: 'dashed',
    },
    emptyText: {
        color: COLORS.muted,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.body,
        textAlign: 'center',
        marginBottom: SPACING.md,
    },
    emptyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceHighlight,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: RADII.md,
        borderWidth: 1,
        borderColor: COLORS.accent,
    },
    emptyButtonText: {
        color: COLORS.accent,
        fontSize: TEXT_SIZES.label,
        fontWeight: '600',
    },

    // Loading
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.backgroundDark,
    },

    // Chip-based Game Selection
    chipRow: {
        flexDirection: 'row',
    },
    optionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: RADII.pill,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        backgroundColor: COLORS.cardBackground,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginRight: SPACING.sm,
    },
    optionChipActive: {
        backgroundColor: 'rgba(66, 165, 245, 0.15)',
        borderColor: COLORS.accent,
    },
    optionChipText: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: 13,
    },
    optionChipTextActive: {
        color: COLORS.text,
        fontFamily: FONTS.bold,
    },

    // Stats Card
    statsCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: RADII.lg,
        padding: SPACING.lg,
        marginTop: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    statsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    statsHeaderTitle: {
        color: COLORS.muted,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.bold,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    tierBadge: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: 2,
        backgroundColor: COLORS.surface,
        borderRadius: RADII.xs,
        borderWidth: 1,
        borderColor: COLORS.divider,
    },
    tierText: {
        color: COLORS.accent,
        fontFamily: FONTS.bold,
        fontSize: 10,
        textTransform: 'uppercase',
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
    },
    statLabelGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    statLabel: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.body,
    },
    statValue: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.bold,
    },

    // Platform Cards
    platformCard: {
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.md,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        flexDirection: 'row',
        alignItems: 'center',
    },
    platformIcon: {
        width: 36,
        height: 36,
        borderRadius: RADII.sm,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
    },
    platformInfo: {
        flex: 1,
    },
    platformName: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.body,
        fontWeight: '600',
    },
    platformValue: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.body,
    },
    emptyPlatformsText: {
        color: COLORS.muted,
        fontSize: TEXT_SIZES.caption,
        fontStyle: 'italic',
        marginTop: SPACING.xs,
    },

    // --- New Enhanced Profile Styles ---

    // Primary Skill Card
    primarySkillCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: RADII.lg,
        padding: SPACING.lg,
        marginTop: SPACING.md,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        width: '100%',
        ...SHADOWS.cardSoft,
    },
    skillTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    skillSource: {
        color: COLORS.muted,
        fontSize: 10,
        fontFamily: FONTS.bold,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    ratingMainRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.lg,
    },
    ratingCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: COLORS.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: COLORS.accent,
    },
    ratingValue: {
        color: COLORS.text,
        fontSize: 24,
        fontFamily: FONTS.bold,
    },
    ratingInfo: {
        flex: 1,
    },
    tierName: {
        fontSize: 18,
        fontFamily: FONTS.heading,
        color: COLORS.accent,
        marginBottom: 2,
    },
    confidenceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    confidenceText: {
        fontSize: 11,
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
    },

    // Stats Grid for Primary Card
    primaryStatsGrid: {
        flexDirection: 'row',
        marginTop: SPACING.lg,
        paddingTop: SPACING.md,
        borderTopWidth: 1,
        borderTopColor: COLORS.divider,
        justifyContent: 'space-between',
        gap: SPACING.md,
    },
    primaryStatBox: {
        alignItems: 'center',
        flex: 1,
    },
    primaryStatLabel: {
        fontSize: 10,
        color: COLORS.muted,
        fontFamily: FONTS.heading,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    primaryStatValue: {
        fontSize: 14,
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontWeight: '700',
    },

    // Mutual Context Chips
    contextChip: {
        backgroundColor: 'rgba(66, 165, 245, 0.08)',
        borderColor: 'rgba(66, 165, 245, 0.2)',
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: RADII.pill,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        maxWidth: '100%',
        minWidth: 0,
    },
    contextText: {
        color: COLORS.accent,
        fontSize: 11,
        fontFamily: FONTS.bold,
        flexShrink: 1,
    },

    // Enhanced Platform Styles
    badge: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
        marginLeft: SPACING.sm,
    },
    verifiedBadge: {
        backgroundColor: 'rgba(0, 230, 118, 0.1)',
    },
    verifiedBadgeText: {
        color: COLORS.successBright,
        fontSize: 9,
        fontFamily: FONTS.bold,
        textTransform: 'uppercase',
    },
    syncButton: {
        padding: 8,
        borderRadius: RADII.sm,
        backgroundColor: COLORS.surfaceHighlight,
    },
    notConnected: {
        opacity: 0.6,
        borderStyle: 'dashed',
    },

    // Trend Indicators
    trendIcon: {
        marginLeft: 4,
    },
    trendUp: {
        color: COLORS.success,
    },
    trendStable: {
        color: COLORS.muted,
    },
    trendDown: {
        color: COLORS.error,
    },
    // New Styles
    mutualContextRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        width: '100%',
        marginTop: SPACING.md,
        justifyContent: 'flex-start',
        gap: SPACING.sm,
    },
    notFoundContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    notFoundText: {
        color: COLORS.text,
        fontSize: 18,
        marginTop: 16,
        fontFamily: FONTS.body,
    },
    backButtonLarge: {
        marginTop: 20,
    },
    backButtonTextLarge: {
        color: COLORS.accent,
        fontSize: 16,
        fontFamily: FONTS.bold,
    },
});

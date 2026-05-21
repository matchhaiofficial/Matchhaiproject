import { StyleSheet } from 'react-native';
import { COLORS, CTA, FONTS, RADII, SHADOWS, SPACING, TEXT_SIZES } from '../../src/theme';

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.backgroundDark,
    },
    screenContent: {
        paddingBottom: 0,
        paddingHorizontal: 0,
    },
    pageHeader: {
        paddingHorizontal: SPACING.screenPadding,
    },
    headerActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING.md,
    },
    body: {
        flex: 1,
    },
    scroll: {
        flex: 1,
    },
    deletedBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: SPACING.md,
        backgroundColor: `${COLORS.warning}14`,
        borderWidth: 1,
        borderColor: `${COLORS.warning}55`,
        borderRadius: RADII.lg,
        padding: SPACING.md,
        marginBottom: SPACING.md,
    },
    deletedBannerTextWrap: {
        flex: 1,
        minWidth: 0,
    },
    deletedBannerTitle: {
        color: COLORS.warning,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.label,
        marginBottom: 2,
    },
    deletedBannerText: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
        lineHeight: 18,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    backButton: {
        marginRight: SPACING.lg,
    },
    headerTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.xl,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: COLORS.backgroundDark,
        alignItems: "center",
        justifyContent: "center",
    },

    // Team Header
    teamNameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        gap: SPACING.sm,
        marginBottom: SPACING.xs,
    },
    editNameIcon: {
        marginLeft: SPACING.sm,
        padding: 4,
    },
    teamHeader: {
        marginTop: SPACING.md,
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.xl + 4,
        paddingBottom: SPACING.xl,
        alignItems: 'center',
        backgroundColor: '#1C1C1F',
        borderRadius: RADII.xl,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.11)',
        shadowColor: '#000',
        shadowOpacity: 0.34,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 5,
        width: '100%',
    },
    teamHeaderAccent: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 4,
        backgroundColor: COLORS.accent,
        opacity: 0.8,
        borderTopLeftRadius: RADII.xl,
        borderTopRightRadius: RADII.xl,
    },
    teamLogoLarge: {
        width: 84,
        height: 84,
        borderRadius: 42,
        backgroundColor: '#121316',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.lg,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        // Allow the edit badge to sit slightly outside the circle (like profile avatar).
        overflow: 'visible',
    },
    teamLogoLargeCaptain: {
        borderColor: COLORS.accent,
    },
    logoPressed: {
        opacity: 0.88,
    },
    logoEditBadge: {
        position: 'absolute',
        right: -2,
        bottom: -2,
        backgroundColor: COLORS.accent,
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: COLORS.backgroundDark,
    },
    teamLogoImage: {
        width: 84,
        height: 84,
        borderRadius: 42,
        overflow: "hidden",
    },
    teamLogoTextLarge: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: 34,
        letterSpacing: 0,
    },
    teamNameLarge: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: 28,
        marginBottom: SPACING.xs,
        textAlign: 'center',
        flexShrink: 1,
        maxWidth: '100%',
        letterSpacing: 0,
    },
    gameBadge: {
        backgroundColor: COLORS.accent,
        paddingHorizontal: SPACING.md,
        paddingVertical: 4,
        borderRadius: RADII.md,
        marginBottom: SPACING.md,
    },
    gameBadgeText: {
        color: '#FFF',
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.caption,
    },
    description: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: 15,
        textAlign: 'center',
        maxWidth: 290,
        lineHeight: 21,
        marginBottom: SPACING.lg,
    },
    deletedPill: {
        marginTop: SPACING.sm,
        marginBottom: SPACING.sm,
    },
    occupancyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        marginTop: SPACING.sm,
    },
    occupancyActionRow: {
        width: '100%',
        marginTop: SPACING.sm,
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: SPACING.sm,
    },
    occupancyInfoPill: {
        flex: 1,
        minWidth: 0,
        minHeight: 50,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.xs,
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        borderRadius: RADII.lg,
        paddingHorizontal: SPACING.md,
    },
    reportActionSlot: {
        width: 54,
        flexShrink: 0,
    },
    reportIconButton: {
        width: '100%',
        minHeight: 50,
        backgroundColor: 'rgba(239, 83, 80, 0.11)',
        borderWidth: 1,
        borderColor: 'rgba(239, 83, 80, 0.32)',
        borderRadius: RADII.lg,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 0,
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
    },
    occupancyText: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.label,
        letterSpacing: 0,
    },
    occupancyFullPill: {
        marginLeft: SPACING.sm,
        alignSelf: "center",
        minHeight: 24,
        paddingVertical: 4,
        paddingHorizontal: SPACING.sm,
    },
    occupancyFullPillText: {
        fontSize: 10,
        letterSpacing: 0.2,
    },
    fullBadge: {
        marginLeft: SPACING.sm,
        color: COLORS.error,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.caption,
        backgroundColor: 'rgba(239, 83, 80, 0.15)',
        paddingHorizontal: SPACING.xs,
        paddingVertical: 2,
        borderRadius: RADII.xs,
    },
    memberBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        backgroundColor: 'rgba(76, 175, 80, 0.15)',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        borderRadius: RADII.md,
        marginTop: SPACING.md,
    },
    memberBadgeText: {
        color: COLORS.success,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.caption,
    },

    // Stats
    statsCard: {
        marginTop: SPACING.lg,
        padding: SPACING.lg,
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.lg,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        ...SHADOWS.cardSoft,
        width: '100%',
    },
    statsTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.subheading,
        marginBottom: SPACING.lg,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.xxl,
    },
    statLabel: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
        marginTop: 4,
    },
    divider: {
        width: 1,
        backgroundColor: COLORS.divider,
    },

    // Roster
    rosterSection: {
        marginTop: SPACING.lg,
        width: '100%',
    },
    rosterTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.xl,
        marginBottom: SPACING.lg,
    },
    rosterItem: {
        backgroundColor: COLORS.surface,
        padding: SPACING.lg,
        borderRadius: RADII.md,
        marginBottom: SPACING.sm,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    rosterAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.backgroundDark,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.divider,
    },
    rosterAvatarText: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.subheading,
    },
    rosterInfo: {
        flex: 1,
    },
    rosterNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rosterName: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.subheading,
    },
    captainBadge: {
        backgroundColor: 'rgba(255, 193, 7, 0.15)',
        paddingHorizontal: SPACING.sm,
        paddingVertical: 2,
        borderRadius: RADII.xs,
        marginLeft: SPACING.sm,
        borderWidth: 1,
        borderColor: 'rgba(255, 193, 7, 0.3)',
    },
    captainText: {
        color: '#FFC107',
        fontFamily: FONTS.heading,
        fontSize: 10,
    },

    // Actions
    actionButtonWrapper: {
        padding: SPACING.lg,
        borderTopWidth: 1,
        borderTopColor: COLORS.divider,
    },
    leaveButton: {
        backgroundColor: COLORS.error,
        minHeight: CTA.primaryButton.minHeight,
        borderRadius: CTA.primaryButton.borderRadius,
        alignItems: 'center',
        justifyContent: 'center',
    },
    leaveButtonText: {
        ...CTA.primaryButtonText,
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: SPACING.lg,
    },
    modalContent: {
        backgroundColor: COLORS.surface,
        borderRadius: RADII.md,
        padding: SPACING.lg,
        maxHeight: '80%',
    },
    modalTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.xl,
    },

    // New Requests Section
    requestSection: {
        marginTop: SPACING.lg,
        padding: SPACING.lg,
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.lg,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        ...SHADOWS.cardSoft,
    },
    requestTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.xl,
        marginBottom: SPACING.md,
    },
    requestCard: {
        backgroundColor: COLORS.surface,
        padding: SPACING.md,
        borderRadius: RADII.md,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        ...SHADOWS.cardSoft,
    },
    requestHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    requestUser: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.body,
    },
    requestSnapshot: {
        marginBottom: SPACING.md,
    },
    snapshotText: {
        color: COLORS.muted,
        fontSize: TEXT_SIZES.caption,
        lineHeight: 16,
    },
    requestActions: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    acceptBtn: {
        flex: 1,
        backgroundColor: COLORS.success,
        paddingVertical: 8,
        borderRadius: RADII.sm,
        alignItems: 'center',
    },
    rejectBtn: {
        flex: 1,
        backgroundColor: COLORS.surfaceHighlight,
        paddingVertical: 8,
        borderRadius: RADII.sm,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.divider,
    },
    actionText: {
        color: '#FFF',
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.caption,
    },
    rejectText: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.caption,
    },

    // Member Menu Actions
    memberActions: {
        flexDirection: 'row',
        gap: SPACING.sm,
        marginLeft: 'auto',
    },
    memberActionBtn: {
        padding: SPACING.sm,
    },

    // Join Button States
    joinButton: {
        backgroundColor: COLORS.accent,
        paddingVertical: SPACING.lg,
        borderRadius: RADII.md,
        alignItems: 'center',
    },
    joinButtonDisabled: {
        backgroundColor: COLORS.muted,
        opacity: 0.6,
    },
    joinButtonText: {
        color: '#FFF',
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.body,
    },
    pendingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 193, 7, 0.1)',
        padding: SPACING.md,
        borderRadius: RADII.md,
        borderWidth: 1,
        borderColor: 'rgba(255, 193, 7, 0.3)',
    },
    pendingText: {
        color: '#FFC107',
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.body,
        marginLeft: SPACING.sm,
    },

    // Bottom Action Bar
    actionBar: {
        width: '100%',
    },
    actionBarSpacing: {
        marginTop: SPACING.lg,
    },
    actionBarContent: {
        width: '100%',
    },
    footerActionRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: SPACING.sm,
    },
    footerActionButton: {
        flex: 1,
        marginBottom: 0,
    },
    actionButton: {
        ...CTA.primaryButton,
    },
    actionButtonDisabled: {
        backgroundColor: COLORS.surfaceHighlight,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.lg,
        borderRadius: RADII.md,
        borderWidth: 1,
        borderColor: COLORS.divider,
    },
    actionButtonText: {
        ...CTA.primaryButtonText,
    },
    challengeButton: {
        backgroundColor: "rgba(0, 230, 118, 0.18)",
        borderWidth: 1,
        borderColor: COLORS.successBright,
        minHeight: CTA.primaryButton.minHeight,
        borderRadius: CTA.primaryButton.borderRadius,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: SPACING.sm,
    },
    challengeButtonDisabled: {
        opacity: 0.55,
        borderColor: COLORS.divider,
    },
    challengeButtonText: {
        color: COLORS.successBright,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.body,
    },
    actionButtonTextDisabled: {
        color: COLORS.muted,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.subheading,
    },
    helperText: {
        color: COLORS.muted,
        fontSize: TEXT_SIZES.caption,
        textAlign: 'center',
        marginTop: SPACING.sm,
        lineHeight: 16,
    },
    // Inline style replacements
    headerIcon: {
        padding: 0,
    },
    headerIconPressed: {
        opacity: 0.7,
    },
    gamePill: {
        alignSelf: 'center',
        marginBottom: SPACING.md,
        paddingHorizontal: SPACING.md,
        minHeight: 30,
        backgroundColor: 'rgba(33, 150, 243, 0.12)',
    },
    memberPill: {
        alignSelf: 'center',
        marginTop: SPACING.md,
        minHeight: 28,
        paddingHorizontal: SPACING.md,
        paddingVertical: 5,
        backgroundColor: 'rgba(0, 230, 118, 0.09)',
        borderColor: 'rgba(0, 230, 118, 0.28)',
    },
    memberPillText: {
        color: COLORS.successBright,
        fontFamily: FONTS.heading,
        fontSize: 12,
        letterSpacing: 0,
    },
    statPrimary: {
        color: COLORS.accent,
    },
    statSuccess: {
        color: COLORS.success,
    },
    statError: {
        color: COLORS.error,
    },
    scrollContent: {
        paddingHorizontal: SPACING.screenPadding,
        paddingBottom: SPACING.xl,
    },
    scrollContentWithBottomAction: {
        paddingBottom: 112,
    },
    renameDialogCard: {
        width: "85%",
        backgroundColor: COLORS.surfaceHighlight,
    },
    renameDialogContent: {
        paddingTop: SPACING.lg,
        paddingBottom: SPACING.md,
    },
    renameInput: {
        backgroundColor: COLORS.backgroundDark,
        color: COLORS.text,
        padding: 14,
        borderRadius: RADII.md,
        marginBottom: SPACING.xl,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        fontSize: 16,
    },
    renameActions: {
        flexDirection: "row",
        gap: SPACING.sm,
    },
    memberDialogCard: {
        width: "88%",
        backgroundColor: COLORS.surfaceHighlight,
    },
    memberDialogContent: {
        paddingTop: SPACING.lg,
        paddingBottom: SPACING.md,
        gap: SPACING.sm,
    },
    confirmationDialogContent: {
        paddingTop: SPACING.lg,
        paddingBottom: SPACING.md,
    },
    confirmationMessage: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.body,
        lineHeight: 22,
    },
    confirmationActions: {
        flexDirection: "row",
        gap: SPACING.sm,
    },
    confirmationActionButton: {
        flex: 1,
        minHeight: 44,
    },
    confirmationCancelButton: {
        backgroundColor: COLORS.overlayLight,
        borderColor: COLORS.overlayLight,
    },
    dialogFooter: {
        paddingHorizontal: SPACING.xl,
    },
    roleRequiredSheet: {
        backgroundColor: COLORS.surfaceHighlight,
    },
    roleRequiredContent: {
        paddingTop: SPACING.lg,
        paddingBottom: SPACING.lg,
    },
    roleRequiredMessage: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.body,
        lineHeight: 22,
    },
    roleRequiredFooter: {
        paddingHorizontal: SPACING.xl,
    },
    roleRequiredActions: {
        flexDirection: "row",
        gap: SPACING.sm,
    },
    roleRequiredActionButton: {
        flex: 1,
        minHeight: 52,
    },
});



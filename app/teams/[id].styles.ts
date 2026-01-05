import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SHADOWS, SPACING, TEXT_SIZES } from '../../src/theme';

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
        backgroundColor: COLORS.background,
        alignItems: "center",
        justifyContent: "center",
    },

    // Team Header
    teamHeader: {
        marginHorizontal: SPACING.screenPadding,
        marginTop: SPACING.md,
        padding: SPACING.xl,
        alignItems: 'center',
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.lg,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        ...SHADOWS.cardSoft,
    },
    teamLogoLarge: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.background,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.lg,
        borderWidth: 2,
        borderColor: COLORS.divider,
    },
    teamLogoImage: {
        width: 80,
        height: 80,
        borderRadius: 40,
    },
    teamLogoTextLarge: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: 32,
    },
    teamNameLarge: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.heading,
        marginBottom: SPACING.sm,
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
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.body,
        textAlign: 'center',
        maxWidth: 300,
        lineHeight: 20,
        marginBottom: SPACING.md,
    },
    occupancyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        marginTop: SPACING.sm,
    },
    occupancyText: {
        color: COLORS.muted,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.label,
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
        marginHorizontal: SPACING.screenPadding,
        marginTop: SPACING.lg,
        padding: SPACING.lg,
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.lg,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        ...SHADOWS.cardSoft,
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
        marginHorizontal: SPACING.screenPadding,
        marginTop: SPACING.lg,
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
        backgroundColor: COLORS.background,
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
        paddingVertical: SPACING.lg,
        borderRadius: RADII.md,
        alignItems: 'center',
    },
    leaveButtonText: {
        color: '#FFF',
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.body,
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
        padding: SPACING.lg,
        backgroundColor: 'rgba(74, 158, 255, 0.05)',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
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

    // Modern Action Bar (Bottom Sticky)
    actionBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.surface,
        padding: SPACING.lg,
        borderTopWidth: 1,
        borderTopColor: COLORS.divider,
        ...SHADOWS.cardElevated,
    },
    actionButton: {
        backgroundColor: COLORS.accent,
        paddingVertical: SPACING.lg,
        borderRadius: RADII.md,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.accentSoft,
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
        color: '#FFF',
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.subheading,
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
        marginRight: 16,
    },
    footerSpacer: {
        height: 120,
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
});


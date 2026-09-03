import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SHADOWS, SPACING, TEXT_SIZES } from '../../../src/theme';

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.backgroundDark,
    },
    screenContent: {
        paddingTop: 10,
        paddingBottom: 0,
    },
    contentWrap: {
        flex: 1,
    },
    scroll: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: SPACING.md,
        backgroundColor: COLORS.backgroundDark,
    },
    headerTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.heading,
    },
    headerIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        backgroundColor: COLORS.cardDark,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    scrollContent: {
        paddingTop: 0,
    },

    // Profile Card
    profileCard: {
        marginTop: 0,
        alignItems: 'center',
        ...SHADOWS.cardSoft,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.accent,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.md,
    },
    avatarImage: {
        width: "100%",
        height: "100%",
        borderRadius: 40,
    },
    avatarText: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.xxl,
        fontFamily: FONTS.heading,
        fontWeight: '700',
    },
    profileName: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.subheading,
        fontFamily: FONTS.heading,
        fontWeight: '600',
        marginBottom: SPACING.xs,
    },
    profileUsername: {
        color: COLORS.muted,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.body,
        marginBottom: SPACING.xs,
    },
    profileEmail: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.body,
    },
    profileMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: SPACING.sm,
        gap: SPACING.md,
    },
    profileMetaItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    profileMetaText: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.caption,
        marginLeft: SPACING.xs,
    },
    editButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.accent,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        borderRadius: RADII.md,
        marginTop: SPACING.lg,
    },
    editButtonText: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.label,
        fontFamily: FONTS.body,
        fontWeight: '600',
        marginLeft: SPACING.sm,
    },

    // Inactive Game Card (grayed out)
    gameCardInactive: {
        marginRight: SPACING.md,
        width: 280,
        height: 80,
        opacity: 0.7,
    },
    gameCardInactiveInner: {
        flexDirection: 'row',
        alignItems: 'center',
        height: '100%',
        backgroundColor: COLORS.cardBackground,
        borderStyle: 'dashed',
    },
    gameIconInactive: {
        width: 60,
        height: 60,
        borderRadius: RADII.sm,
        backgroundColor: COLORS.overlayLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
    },
    gameNameInactive: {
        color: COLORS.muted,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.body,
    },
    gameAddText: {
        color: COLORS.accent,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.body,
        marginTop: 2,
    },

    // Section
    section: {
        marginTop: SPACING.xl,
    },
    sectionHorizontal: {
        marginTop: SPACING.xl,
    },
    sectionPadding: {},
    gamesScrollContainer: {
        paddingBottom: SPACING.sm,
    },
    sectionAddButton: {
        minHeight: 42,
        paddingHorizontal: SPACING.lg,
        borderRadius: RADII.xl,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.accent,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        ...SHADOWS.accentSoft,
    },
    sectionAddText: {
        color: '#FFFFFF',
        fontSize: TEXT_SIZES.label,
        fontFamily: FONTS.interSemiBold,
        letterSpacing: 0.2,
    },

    // Game Card
    gameCard: {
        marginRight: SPACING.md,
        width: 280,
        height: 80,
    },
    gameCardInner: {
        flexDirection: 'row',
        alignItems: 'center',
        height: '100%',
        overflow: 'hidden',
    },
    gameIcon: {
        width: 64,
        height: 64,
        borderRadius: RADII.md,
        backgroundColor: COLORS.overlayMedium,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
        flexShrink: 0,
    },
    gameInfo: {
        flex: 1,
        minWidth: 0,
    },
    gameTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        minWidth: 0,
        marginBottom: SPACING.xs,
    },
    gameName: {
        flexShrink: 1,
        minWidth: 0,
        color: COLORS.text,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.heading,
        fontWeight: '600',
    },
    gameBadge: {
        flexShrink: 0,
        marginLeft: SPACING.xs,
    },
    gameRole: {
        color: COLORS.muted,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.body,
    },
    secondaryStat: {
        color: COLORS.accent,
        fontSize: TEXT_SIZES.xs,
        fontFamily: FONTS.body,
        marginTop: 2,
    },
    gameSkill: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    faceitIcon: {
        width: 28,
        height: 28,
    },
    faceitElo: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.caption,
        fontWeight: '600',
        marginLeft: SPACING.xs,
    },
    gameEditIcon: {
        padding: SPACING.xs,
        marginLeft: SPACING.xs,
    },
    syncText: {
        fontSize: 10,
        marginTop: 2,
        color: COLORS.muted,
        fontFamily: FONTS.body,
    },
    psnIconContainer: {
        backgroundColor: 'rgba(0, 48, 135, 0.1)',
        borderColor: '#003087',
        borderWidth: 1,
    },

    // Add Game Card (dashed border)
    addGameCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: RADII.md,
        padding: SPACING.lg,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.accent,
        borderStyle: 'dashed',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addGameText: {
        color: COLORS.accent,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.body,
        marginLeft: SPACING.sm,
    },

    // Platform Links
    platformCard: {
        marginBottom: SPACING.sm,
    },
    platformCardInner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
    },
    platformIcon: {
        width: 36,
        height: 36,
        borderRadius: RADII.sm,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
    },
    steamIcon: {
        backgroundColor: 'rgba(102, 192, 244, 0.1)',
        borderWidth: 1,
        borderColor: COLORS.steamBorder,
    },
    faceitPlatformIcon: {
        backgroundColor: 'rgba(255, 85, 0, 0.1)',
        borderWidth: 1,
        borderColor: COLORS.faceitBorder,
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
    },
    platformNotLinked: {
        color: COLORS.muted,
        fontSize: TEXT_SIZES.caption,
        fontStyle: 'italic',
    },
    platformLinkButton: {
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        borderRadius: RADII.sm,
        backgroundColor: COLORS.overlayMedium,
    },
    platformLinkText: {
        color: COLORS.accent,
        fontSize: TEXT_SIZES.caption,
        fontWeight: '600',
    },

    // Team Card
    teamCard: {
        marginBottom: SPACING.sm,
    },
    teamCardInner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
    },
    teamIcon: {
        width: 40,
        height: 40,
        borderRadius: RADII.sm,
        backgroundColor: 'rgba(156, 39, 176, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
    },
    teamInfo: {
        flex: 1,
    },
    teamName: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.heading,
        fontWeight: '600',
        marginBottom: SPACING.xs,
    },
    teamGame: {
        color: COLORS.muted,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.body,
    },
    teamMembers: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.xs,
    },

    // Match Card
    matchCard: {
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.md,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    matchHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    matchGame: {
        color: COLORS.accent,
        fontSize: TEXT_SIZES.xs,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    matchDate: {
        color: COLORS.muted,
        fontSize: TEXT_SIZES.xs,
    },
    matchTitle: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.heading,
        marginBottom: SPACING.xs,
    },
    matchLocation: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.caption,
    },

    // Area Chips
    areaChipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
    },
    areaChip: {
    },
    areaChipText: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.label - 1,
        fontFamily: FONTS.body,
        fontWeight: '500',
        textTransform: 'none',
    },

    // Empty State
    emptyState: {
        borderStyle: 'dashed',
    },
    emptyText: {
        color: COLORS.muted,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.body,
        textAlign: 'center',
        marginBottom: SPACING.md,
    },

    // Settings Section
    settingsSection: {
        marginTop: SPACING.xl,
    },
    settingsItem: {
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.md,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        flexDirection: 'row',
        alignItems: 'center',
    },
    settingsItemIcon: {
        width: 36,
        height: 36,
        borderRadius: RADII.sm,
        backgroundColor: COLORS.overlayMedium,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
    },
    settingsItemText: {
        flex: 1,
        color: COLORS.text,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.body,
    },

    // Logout Button
    logoutButton: {
        marginTop: SPACING.xl,
        marginBottom: SPACING.lg,
        flexDirection: 'row',
    },
    logoutButtonText: {
        color: COLORS.error,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.body,
        fontWeight: '600',
        marginLeft: SPACING.sm,
    },

    // Loading
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.backgroundDark,
    },
    flex1: {
        flex: 1,
    },
    yellowIcon: {
        marginRight: 4,
    },
});


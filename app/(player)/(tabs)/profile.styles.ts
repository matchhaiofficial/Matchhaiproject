import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SPACING, TEXT_SIZES } from '../../../src/theme';

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.screenPadding,
        paddingBottom: SPACING.lg,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
    },
    headerTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.heading,
    },
    headerIcon: {
        padding: SPACING.xs,
    },

    scrollContent: {
        paddingBottom: 160,
    },

    // Profile Card
    profileCard: {
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.lg,
        padding: SPACING.lg,
        marginHorizontal: SPACING.screenPadding,
        marginTop: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        alignItems: 'center',
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
        backgroundColor: COLORS.cardBackground,
        borderRadius: RADII.md,
        padding: SPACING.md,
        marginRight: SPACING.md,
        width: 280,
        height: 80,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        borderStyle: 'dashed',
        flexDirection: 'row',
        alignItems: 'center',
        opacity: 0.7,
    },
    gameIconInactive: {
        width: 40,
        height: 40,
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
        marginLeft: 'auto',
    },

    // Section
    section: {
        marginTop: SPACING.xl,
    },
    sectionHorizontal: {
        marginTop: SPACING.xl,
    },
    sectionPadding: {
        paddingHorizontal: SPACING.screenPadding,
    },
    gamesScrollContainer: {
        paddingHorizontal: SPACING.screenPadding,
        paddingBottom: SPACING.sm,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
        paddingHorizontal: SPACING.screenPadding,
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
    sectionAddButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.overlayMedium,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        borderRadius: RADII.md,
    },
    sectionAddText: {
        color: COLORS.accent,
        fontSize: TEXT_SIZES.caption,
        marginLeft: SPACING.xs,
    },

    // Game Card
    gameCard: {
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.md,
        padding: SPACING.md,
        marginRight: SPACING.md,
        width: 280,
        height: 80,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        flexDirection: 'row',
        alignItems: 'center',
    },
    gameIcon: {
        width: 40,
        height: 40,
        borderRadius: RADII.sm,
        backgroundColor: COLORS.overlayMedium,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
    },
    gameInfo: {
        flex: 1,
    },
    gameName: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.heading,
        fontWeight: '600',
        marginBottom: SPACING.xs,
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
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.md,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        flexDirection: 'row',
        alignItems: 'center',
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
        backgroundColor: COLORS.cardBackground,
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
        backgroundColor: COLORS.overlayMedium,
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

    // Settings Section
    settingsSection: {
        marginTop: SPACING.xl,
        paddingHorizontal: SPACING.screenPadding,
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
        backgroundColor: 'rgba(239, 83, 80, 0.1)',
        borderRadius: RADII.md,
        padding: SPACING.md,
        marginHorizontal: SPACING.screenPadding,
        marginTop: SPACING.xl,
        marginBottom: SPACING.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(239, 83, 80, 0.3)',
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
        backgroundColor: COLORS.background,
    },
});

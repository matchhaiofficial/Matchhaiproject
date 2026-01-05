import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SHADOWS, SPACING, TEXT_SIZES } from '../../../src/theme';

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
    },
    scrollContent: {
        paddingBottom: 100,
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
        ...SHADOWS.cardElevated,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.accent,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.md,
        borderWidth: 2,
        borderColor: COLORS.divider,
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
        marginBottom: SPACING.xs,
    },
    profileUsername: {
        color: COLORS.muted,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.body,
        marginBottom: SPACING.xs,
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
        fontFamily: FONTS.body,
    },

    // Action Section
    actionContainer: {
        width: '100%',
        marginTop: SPACING.lg,
    },
    mainButton: {
        height: 44,
        borderRadius: RADII.md,
        backgroundColor: COLORS.accent,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        ...SHADOWS.accentSoft,
    },
    mainButtonText: {
        color: '#FFF',
        fontFamily: FONTS.bold,
        fontSize: TEXT_SIZES.label,
        textTransform: 'uppercase',
        marginLeft: SPACING.sm,
    },
    statusBadge: {
        height: 44,
        borderRadius: RADII.md,
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
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
        paddingHorizontal: SPACING.screenPadding,
    },
    sectionTitle: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.subheading,
        fontFamily: FONTS.heading,
        marginBottom: SPACING.md,
    },

    // Chip-based Game Selection
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
        marginBottom: SPACING.md,
    },
    optionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: RADII.pill,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        backgroundColor: COLORS.cardBackground,
        paddingHorizontal: SPACING.md,
        paddingVertical: 6,
    },
    optionChipActive: {
        backgroundColor: 'rgba(66, 165, 245, 0.15)',
        borderColor: COLORS.accent,
    },
    optionChipText: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
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
});

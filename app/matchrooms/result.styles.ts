// app/matchrooms/result.styles.ts
import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SHADOWS, SPACING, TEXT_SIZES } from '../../src/theme';

export default StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.backgroundDark,
    },

    scrollContent: {
        padding: SPACING.screenPadding,
        paddingBottom: SPACING.screenPadding + SPACING.xxl,
    },
    scrollContentInsideScreen: {
        paddingHorizontal: 0,
        paddingTop: 0,
    },

    header: {
        marginBottom: SPACING.xl,
    },
    appHeader: {
        paddingHorizontal: SPACING.screenPadding,
        marginBottom: 0,
    },

    title: {
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.xxl,
        color: COLORS.text,
        marginBottom: SPACING.xs,
    },

    subtitle: {
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.body,
        color: COLORS.muted,
        lineHeight: 22,
    },

    matchInfoCard: {
        backgroundColor: COLORS.surface,
        borderRadius: RADII.lg,
        padding: SPACING.lg,
        marginBottom: SPACING.xl,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },

    matchInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },

    matchInfoLabel: {
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.label,
        color: COLORS.muted,
        marginRight: SPACING.xs,
    },

    matchInfoValue: {
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.label,
        color: COLORS.text,
    },

    sectionLabel: {
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.subheading,
        color: COLORS.text,
        marginBottom: SPACING.md,
    },

    teamCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: RADII.md,
        padding: SPACING.lg,
        marginBottom: SPACING.md,
        borderWidth: 2,
        borderColor: COLORS.cardBorder,
    },
    teamCardPressed: {
        opacity: 0.92,
    },

    teamCardSelected: {
        borderColor: COLORS.accent,
        backgroundColor: 'rgba(66, 165, 245, 0.08)',
    },

    teamCardDisabled: {
        opacity: 0.5,
    },

    teamHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACING.md,
    },

    teamName: {
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.subheading,
        color: COLORS.text,
    },
    teamTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    captainStar: {
        marginLeft: 8,
    },
    selectedIcon: {
        color: COLORS.accent,
    },

    teamPlayers: {
        marginTop: SPACING.xs,
    },

    playerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.xs,
    },

    playerDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.muted,
        marginRight: SPACING.sm,
    },

    playerName: {
        fontFamily: FONTS.interRegular,
        fontSize: TEXT_SIZES.label,
        color: COLORS.textSecondary,
    },

    submitButton: {
        backgroundColor: COLORS.accent,
        borderRadius: RADII.md,
        paddingVertical: SPACING.lg,
        alignItems: 'center',
        marginTop: SPACING.xl,
        ...SHADOWS.accentSoft,
    },
    submitButtonPressed: {
        opacity: 0.9,
    },

    submitButtonDisabled: {
        backgroundColor: COLORS.muted,
        opacity: 0.5,
    },

    submitButtonText: {
        fontFamily: FONTS.interSemiBold,
        fontSize: TEXT_SIZES.subheading,
        color: COLORS.backgroundDark,
    },

    alreadySubmittedCard: {
        backgroundColor: COLORS.overlayLight,
        borderRadius: RADII.md,
        padding: SPACING.lg,
        marginBottom: SPACING.xl,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.success,
    },

    alreadySubmittedTitle: {
        fontFamily: FONTS.interSemiBold,
        fontSize: TEXT_SIZES.subheading,
        color: COLORS.success,
        marginBottom: SPACING.xs,
    },

    alreadySubmittedText: {
        fontFamily: FONTS.interRegular,
        fontSize: TEXT_SIZES.label,
        color: COLORS.muted,
        lineHeight: 20,
    },

    statusCard: {
        backgroundColor: COLORS.surface,
        borderRadius: RADII.md,
        padding: SPACING.lg,
        marginTop: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },

    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },

    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: SPACING.sm,
    },

    statusDotPending: {
        backgroundColor: COLORS.warning,
    },

    statusDotSuccess: {
        backgroundColor: COLORS.success,
    },

    statusDotDisputed: {
        backgroundColor: COLORS.error,
    },

    statusText: {
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.label,
        color: COLORS.text,
    },

    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },

    loadingText: {
        fontFamily: FONTS.interMedium,
        fontSize: TEXT_SIZES.body,
        color: COLORS.muted,
        marginTop: SPACING.md,
    },

    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.screenPadding,
    },

    errorText: {
        fontFamily: FONTS.interMedium,
        fontSize: TEXT_SIZES.body,
        color: COLORS.error,
        textAlign: 'center',
        marginTop: SPACING.md,
    },

    backButton: {
        padding: SPACING.sm,
        marginBottom: SPACING.md,
    },
});


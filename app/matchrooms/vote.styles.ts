// app/matchrooms/vote.styles.ts
import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SHADOWS, SPACING, TEXT_SIZES } from '../../src/theme';

export default StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.backgroundDark,
    },

    scrollContent: {
        padding: SPACING.screenPadding,
    },

    header: {
        marginBottom: SPACING.xxl,
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

    disputeCard: {
        backgroundColor: COLORS.surface,
        borderRadius: RADII.lg,
        padding: SPACING.lg,
        marginBottom: SPACING.xl,
        borderWidth: 1,
        borderLeftWidth: 4,
        borderColor: COLORS.cardBorder,
        borderLeftColor: COLORS.warning,
    },

    disputeTitle: {
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.subheading,
        color: COLORS.warning,
        marginBottom: SPACING.sm,
    },

    disputeText: {
        fontFamily: FONTS.interRegular,
        fontSize: TEXT_SIZES.label,
        color: COLORS.muted,
        lineHeight: 20,
    },

    captainReports: {
        flexDirection: 'row',
        gap: SPACING.md,
        marginTop: SPACING.md,
    },

    captainReport: {
        flex: 1,
        backgroundColor: COLORS.overlayLight,
        borderRadius: RADII.sm,
        padding: SPACING.sm,
    },

    captainLabel: {
        fontFamily: FONTS.interMedium,
        fontSize: TEXT_SIZES.caption,
        color: COLORS.muted,
        marginBottom: SPACING.xs,
    },

    captainChoice: {
        fontFamily: FONTS.interSemiBold,
        fontSize: TEXT_SIZES.label,
        color: COLORS.text,
    },

    sectionLabel: {
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.subheading,
        color: COLORS.text,
        marginBottom: SPACING.md,
    },

    voteOption: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: RADII.md,
        padding: SPACING.lg,
        marginBottom: SPACING.md,
        borderWidth: 2,
        borderColor: COLORS.cardBorder,
    },
    voteOptionPressed: {
        opacity: 0.92,
    },

    voteOptionSelected: {
        borderColor: COLORS.accent,
        backgroundColor: 'rgba(66, 165, 245, 0.08)',
    },

    voteOptionDisabled: {
        opacity: 0.5,
    },

    voteHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    voteTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    selectedIcon: {
        marginLeft: 8,
        color: COLORS.accent,
    },

    voteTeamName: {
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.subheading,
        color: COLORS.text,
    },

    voteCount: {
        backgroundColor: COLORS.overlayLight,
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs - 2,
        borderRadius: RADII.pill,
    },

    voteCountText: {
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.caption,
        color: COLORS.accent,
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
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.subheading,
        color: COLORS.backgroundDark,
    },

    alreadyVotedCard: {
        backgroundColor: COLORS.overlayLight,
        borderRadius: RADII.md,
        padding: SPACING.lg,
        marginBottom: SPACING.xl,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.success,
    },

    alreadyVotedTitle: {
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.subheading,
        color: COLORS.success,
        marginBottom: SPACING.xs,
    },

    alreadyVotedText: {
        fontFamily: FONTS.interRegular,
        fontSize: TEXT_SIZES.label,
        color: COLORS.muted,
        lineHeight: 20,
    },

    progressCard: {
        backgroundColor: COLORS.surface,
        borderRadius: RADII.md,
        padding: SPACING.lg,
        marginTop: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },

    progressLabel: {
        fontFamily: FONTS.interMedium,
        fontSize: TEXT_SIZES.label,
        color: COLORS.muted,
        marginBottom: SPACING.sm,
    },

    progressBar: {
        height: 8,
        backgroundColor: COLORS.cardBorder,
        borderRadius: RADII.pill,
        overflow: 'hidden',
    },

    progressFill: {
        height: '100%',
        backgroundColor: COLORS.accent,
    },

    progressText: {
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.label,
        color: COLORS.text,
        marginTop: SPACING.xs,
        textAlign: 'center',
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

    deadlineText: {
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
        color: COLORS.warning,
        marginTop: SPACING.sm,
        textAlign: 'center',
    },
});


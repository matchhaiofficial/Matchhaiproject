// src/components/SkillBadge.styles.ts
import { StyleSheet } from 'react-native';
import { COLORS, RADII, SPACING, TEXT_SIZES } from '../theme';

export default StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.xs,
        paddingHorizontal: SPACING.md,
        backgroundColor: COLORS.overlayLight,
        borderRadius: RADII.md,
        borderWidth: 1,
        alignSelf: 'flex-start',
    },

    containerBeginner: {
        borderColor: COLORS.muted,
        backgroundColor: 'rgba(189, 189, 189, 0.08)',
    },

    containerIntermediate: {
        borderColor: COLORS.success,
        backgroundColor: 'rgba(76, 175, 80, 0.12)',
    },

    containerAdvanced: {
        borderColor: COLORS.accent,
        backgroundColor: 'rgba(66, 165, 245, 0.12)',
    },

    containerPro: {
        borderColor: '#9c27b0',
        backgroundColor: 'rgba(156, 39, 176, 0.12)',
    },

    containerElite: {
        borderColor: '#ffd700',
        backgroundColor: 'rgba(255, 215, 0, 0.15)',
    },

    // Compact size
    containerCompact: {
        paddingVertical: SPACING.xs - 2,
        paddingHorizontal: SPACING.sm,
    },

    // Large size
    // Large size
    containerLarge: {
        paddingVertical: 6,
        paddingHorizontal: SPACING.md,
    },

    icon: {
        marginRight: SPACING.xs,
    },

    text: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: TEXT_SIZES.label,
        color: COLORS.text,
    },

    textBeginner: {
        color: COLORS.muted,
    },

    textIntermediate: {
        color: COLORS.success,
    },

    textAdvanced: {
        color: COLORS.accent,
    },

    textPro: {
        color: '#b968c7',
    },

    textElite: {
        color: '#ffd700',
    },

    textCompact: {
        fontSize: TEXT_SIZES.caption,
    },

    textLarge: {
        fontSize: TEXT_SIZES.body + 2,
    },

    rating: {
        fontFamily: 'Inter_500Medium',
        marginLeft: SPACING.xs,
        fontSize: TEXT_SIZES.caption,
        color: COLORS.muted,
    },

    ratingCompact: {
        fontSize: TEXT_SIZES.xs,
    },

    ratingLarge: {
        fontSize: TEXT_SIZES.label,
    },
});

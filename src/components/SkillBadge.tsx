// src/components/SkillBadge.tsx
import React from 'react';
import { Text, View, ViewStyle } from 'react-native';
import { AppIcon, type AppIconName } from './AppIcon';
import { getTierFromRating, type SkillTier } from '../services/skillRatingService';
import { COLORS, FONTS } from '../theme';
import styles from './SkillBadge.styles';

interface SkillBadgeProps {
    tier: SkillTier;
    rating?: number;
    size?: 'compact' | 'normal' | 'large';
    showRating?: boolean;
    style?: ViewStyle;
}

const TIER_CONFIG: Record<SkillTier, { icon: AppIconName; color: string }> = {
    Beginner: { icon: 'star-border', color: COLORS.muted },
    Casual: { icon: 'star-half', color: '#8fb3ff' },
    Intermediate: { icon: 'star-half', color: COLORS.success },
    Advanced: { icon: 'star', color: COLORS.accent },
    Pro: { icon: 'stars', color: '#b968c7' },
    Elite: { icon: 'military-tech', color: '#ffd700' },
};

export default function SkillBadge({
    tier,
    rating,
    size = 'normal',
    showRating = true,
    style,
}: SkillBadgeProps) {
    const normalizedRating =
        typeof rating === 'number' ? Math.max(0, Math.min(100, Math.round(rating))) : undefined;
    const displayTier = normalizedRating !== undefined ? getTierFromRating(normalizedRating) : tier;
    const displayConfig = TIER_CONFIG[displayTier] || TIER_CONFIG.Beginner;

    const containerSizeStyle =
        size === 'compact'
            ? styles.containerCompact
            : size === 'large'
                ? styles.containerLarge
                : undefined;

    const textSizeStyle =
        size === 'compact'
            ? styles.textCompact
            : size === 'large'
                ? styles.textLarge
                : undefined;

    const ratingSizeStyle =
        size === 'compact'
            ? styles.ratingCompact
            : size === 'large'
                ? styles.ratingLarge
                : undefined;

    const tierStyle =
        displayTier === 'Beginner'
            ? styles.containerBeginner
            : displayTier === 'Casual'
                ? styles.containerIntermediate
            : displayTier === 'Intermediate'
                ? styles.containerIntermediate
                : displayTier === 'Advanced'
                    ? styles.containerAdvanced
                    : displayTier === 'Pro'
                        ? styles.containerPro
                        : styles.containerElite;

    const textTierStyle =
        displayTier === 'Beginner'
            ? styles.textBeginner
            : displayTier === 'Casual'
                ? styles.textIntermediate
            : displayTier === 'Intermediate'
                ? styles.textIntermediate
                : displayTier === 'Advanced'
                    ? styles.textAdvanced
                    : displayTier === 'Pro'
                        ? styles.textPro
                        : styles.textElite;

    const iconSize = size === 'compact' ? 14 : size === 'large' ? 20 : 16;
    const isCompact = size === 'compact';

    return (
        <View style={[styles.container, tierStyle, containerSizeStyle, style]}>
            <AppIcon
                name={displayConfig.icon}
                size={iconSize}
                color={displayConfig.color}
                style={styles.icon}
            />
            {!isCompact && (
                <Text style={[styles.text, textTierStyle, textSizeStyle]}>
                    {displayTier.toUpperCase()}
                </Text>
            )}
            {showRating && normalizedRating !== undefined && (
                <Text style={[
                    styles.rating,
                    ratingSizeStyle,
                    isCompact && { color: displayConfig.color, fontFamily: FONTS.interSemiBold, marginLeft: 2 }
                ]}>
                    {isCompact ? normalizedRating : `(${normalizedRating})`}
                </Text>
            )}
        </View>
    );
}

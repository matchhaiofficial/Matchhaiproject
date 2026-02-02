// src/components/SkillBadge.tsx
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Text, View, ViewStyle } from 'react-native';
import type { SkillTier } from '../services/skillRatingService';
import { COLORS, FONTS } from '../theme';
import styles from './SkillBadge.styles';

interface SkillBadgeProps {
    tier: SkillTier;
    rating?: number;
    size?: 'compact' | 'normal' | 'large';
    showRating?: boolean;
    style?: ViewStyle;
}

const TIER_CONFIG: Record<SkillTier, { icon: keyof typeof MaterialIcons.glyphMap; color: string }> = {
    Beginner: { icon: 'star-border', color: COLORS.muted },
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
    const config = TIER_CONFIG[tier] || TIER_CONFIG.Beginner;

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
        tier === 'Beginner'
            ? styles.containerBeginner
            : tier === 'Intermediate'
                ? styles.containerIntermediate
                : tier === 'Advanced'
                    ? styles.containerAdvanced
                    : tier === 'Pro'
                        ? styles.containerPro
                        : styles.containerElite;

    const textTierStyle =
        tier === 'Beginner'
            ? styles.textBeginner
            : tier === 'Intermediate'
                ? styles.textIntermediate
                : tier === 'Advanced'
                    ? styles.textAdvanced
                    : tier === 'Pro'
                        ? styles.textPro
                        : styles.textElite;

    const iconSize = size === 'compact' ? 14 : size === 'large' ? 20 : 16;
    const isCompact = size === 'compact';
    const normalizedRating =
        typeof rating === 'number' ? Math.max(0, Math.min(100, Math.round(rating))) : undefined;

    return (
        <View style={[styles.container, tierStyle, containerSizeStyle, style]}>
            <MaterialIcons
                name={config.icon}
                size={iconSize}
                color={config.color}
                style={styles.icon}
            />
            {!isCompact && (
                <Text style={[styles.text, textTierStyle, textSizeStyle]}>
                    {tier.toUpperCase()}
                </Text>
            )}
            {showRating && normalizedRating !== undefined && (
                <Text style={[
                    styles.rating,
                    ratingSizeStyle,
                    isCompact && { color: config.color, fontFamily: FONTS.interSemiBold, marginLeft: 2 }
                ]}>
                    {isCompact ? normalizedRating : `(${normalizedRating})`}
                </Text>
            )}
        </View>
    );
}

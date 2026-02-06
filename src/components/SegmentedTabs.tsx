import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { COLORS, FONTS, RADII, SHADOWS, SPACING, TEXT_SIZES } from '../theme';

export type SegmentedTabItem<T extends string> = {
    key: T;
    label: string;
    badge?: number | string;
    disabled?: boolean;
};

type SegmentedTabsProps<T extends string> = {
    items: SegmentedTabItem<T>[];
    value: T;
    onChange: (value: T) => void;
    style?: StyleProp<ViewStyle>;
    itemTextStyle?: StyleProp<TextStyle>;
    compact?: boolean;
    fullWidth?: boolean;
};

export default function SegmentedTabs<T extends string>({
    items,
    value,
    onChange,
    style,
    itemTextStyle,
    compact = false,
    fullWidth = true,
}: SegmentedTabsProps<T>) {
    return (
        <View style={[styles.container, compact && styles.containerCompact, fullWidth && styles.fullWidth, style]}>
            {items.map((item) => {
                const active = item.key === value;
                const disabled = Boolean(item.disabled);
                return (
                    <Pressable
                        key={item.key}
                        onPress={() => !disabled && onChange(item.key)}
                        style={({ pressed }) => [
                            styles.item,
                            compact && styles.itemCompact,
                            active && styles.itemActive,
                            disabled && styles.itemDisabled,
                            pressed && !active && !disabled && styles.itemPressed,
                        ]}
                    >
                        <Text
                            style={[
                                styles.itemText,
                                itemTextStyle,
                                active && styles.itemTextActive,
                                disabled && styles.itemTextDisabled,
                            ]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                            allowFontScaling={false}
                        >
                            {item.label}
                        </Text>
                        {item.badge !== undefined && item.badge !== '' && (
                            <View style={[styles.badge, active && styles.badgeActive, disabled && styles.badgeDisabled]}>
                                <Text
                                    style={[
                                        styles.badgeText,
                                        active && styles.badgeTextActive,
                                        disabled && styles.badgeTextDisabled,
                                    ]}
                                    numberOfLines={1}
                                    allowFontScaling={false}
                                >
                                    {item.badge}
                                </Text>
                            </View>
                        )}
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: COLORS.background,
        borderRadius: RADII.xl,
        padding: 3,
        borderWidth: 1,
        borderColor: COLORS.divider,
    },
    containerCompact: {
        padding: 3,
    },
    fullWidth: {
        alignSelf: 'stretch',
    },
    item: {
        flex: 1,
        minHeight: 40,
        paddingVertical: 8,
        borderRadius: RADII.lg,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: SPACING.xs,
    },
    itemCompact: {
        minHeight: 36,
        paddingVertical: 6,
    },
    itemActive: {
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.accent,
        ...SHADOWS.cardSoft,
    },
    itemDisabled: {
        opacity: 0.5,
    },
    itemPressed: {
        backgroundColor: COLORS.overlayLight,
    },
    itemText: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.clean,
        fontSize: TEXT_SIZES.label,
        fontWeight: '600',
    },
    itemTextActive: {
        color: COLORS.text,
    },
    itemTextDisabled: {
        color: COLORS.textSecondary,
    },
    badge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: RADII.pill,
        backgroundColor: COLORS.cardDark,
        borderWidth: 1,
        borderColor: COLORS.divider,
    },
    badgeActive: {
        backgroundColor: COLORS.accent + '22',
        borderColor: COLORS.accent + '66',
    },
    badgeDisabled: {
        opacity: 0.7,
    },
    badgeText: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.xs,
        fontWeight: '700',
    },
    badgeTextActive: {
        color: '#FFF',
    },
    badgeTextDisabled: {
        color: COLORS.muted,
    },
});

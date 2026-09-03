import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { AppIcon } from './AppIcon';
import { COLORS, FONTS, SPACING, TEXT_SIZES } from '../theme';

type AppHeaderProps = {
    title: string;
    subtitle?: string;
    onBack?: () => void;
    leftAction?: React.ReactNode;
    rightAction?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    titleStyle?: StyleProp<TextStyle>;
    subtitleStyle?: StyleProp<TextStyle>;
    inlineTitle?: boolean;
};

const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 };

export default function AppHeader({
    title,
    subtitle,
    onBack,
    leftAction,
    rightAction,
    style,
    titleStyle,
    subtitleStyle,
    inlineTitle = false,
}: AppHeaderProps) {
    const showTopRow = Boolean(onBack || leftAction || rightAction);
    const shouldInlineTitle = inlineTitle && showTopRow;
    const hasLeadingAction = Boolean(leftAction || onBack);

    return (
        <View style={[styles.container, style]}>
            {showTopRow && (
                <View style={styles.topRow}>
                    {leftAction ? (
                        <View style={styles.leftAction}>{leftAction}</View>
                    ) : onBack ? (
                        <Pressable
                            onPress={onBack}
                            hitSlop={hitSlop}
                            style={({ pressed }) => [
                                styles.backButton,
                                pressed && styles.backButtonPressed,
                            ]}
                        >
                            <AppIcon name="back" size={22} color={COLORS.text} />
                        </Pressable>
                    ) : (
                        shouldInlineTitle ? null : <View style={styles.backPlaceholder} />
                    )}
                    {shouldInlineTitle && (
                        <Text
                            style={[
                                styles.inlineTitle,
                                !hasLeadingAction && styles.inlineTitleNoLeftInset,
                                titleStyle,
                            ]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                            allowFontScaling={false}
                            adjustsFontSizeToFit
                            minimumFontScale={0.85}
                        >
                            {title}
                        </Text>
                    )}
                    <View style={styles.rightAction}>{rightAction}</View>
                </View>
            )}
            {!shouldInlineTitle && (
                <Text
                    style={[styles.title, titleStyle]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    allowFontScaling={false}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                >
                    {title}
                </Text>
            )}
            {subtitle ? <Text style={[styles.subtitle, subtitleStyle]}>{subtitle}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingTop: SPACING.xs,
        marginBottom: SPACING.sm,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 40,
        marginBottom: SPACING.sm,
    },
    inlineTitle: {
        flex: 1,
        marginHorizontal: SPACING.sm,
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.heading,
        fontWeight: '700',
    },
    inlineTitleNoLeftInset: {
        marginLeft: 0,
    },
    backButton: {
        padding: 4,
        borderRadius: 16,
    },
    backButtonPressed: {
        opacity: 0.8,
    },
    backPlaceholder: {
        width: 30,
        height: 30,
    },
    rightAction: {
        minWidth: 30,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    leftAction: {
        minWidth: 30,
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    title: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.heading,
        fontWeight: '700',
        marginBottom: SPACING.xs,
        maxWidth: '100%',
        flexShrink: 1,
        alignSelf: 'flex-start',
    },
    subtitle: {
        color: COLORS.muted,
        fontFamily: FONTS.subheading,
        fontSize: TEXT_SIZES.subheading,
    },
});

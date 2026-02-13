import React from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    View,
    type ScrollViewProps,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import { useSegments } from 'expo-router';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../theme';
import { useScreenPadding } from '../hooks/useScreenPadding';
import Logger from '../utils/logger';

type ScreenProps = {
    children: React.ReactNode;
    scroll?: boolean;
    keyboardAvoiding?: boolean;
    style?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>;
    scrollProps?: ScrollViewProps;
    edges?: Edge[];
    debugTag?: string;
};

export default function Screen({
    children,
    scroll = false,
    keyboardAvoiding = false,
    style,
    contentStyle,
    scrollProps,
    edges,
    debugTag,
}: ScreenProps) {
    const segments = useSegments() as string[];
    const isTabsScreen = segments.includes('(tabs)');
    const horizontalPadding = useScreenPadding();
    const { contentContainerStyle: scrollContentStyle, ...restScrollProps } = scrollProps || {};
    const scrollKeyboardShouldPersistTaps = restScrollProps.keyboardShouldPersistTaps ?? 'handled';
    const scrollKeyboardDismissMode = restScrollProps.keyboardDismissMode ?? (Platform.OS === 'ios' ? 'interactive' : 'on-drag');
    const resolvedEdges: Edge[] = edges ?? (isTabsScreen ? ['top'] : ['top', 'bottom']);
    const resolvedBottomPadding = isTabsScreen ? 0 : SPACING.xxl;

    const contentContainerStyles = [
        styles.content,
        { paddingHorizontal: horizontalPadding },
        { paddingBottom: resolvedBottomPadding },
        scrollContentStyle,
        contentStyle,
    ];

    const body = scroll ? (
        <ScrollView
            contentContainerStyle={contentContainerStyles}
            keyboardShouldPersistTaps={scrollKeyboardShouldPersistTaps}
            keyboardDismissMode={scrollKeyboardDismissMode}
            {...restScrollProps}
        >
            {children}
        </ScrollView>
    ) : (
        <View
            style={[
                styles.content,
                styles.contentView,
                { paddingHorizontal: horizontalPadding, paddingBottom: resolvedBottomPadding },
                contentStyle,
            ]}
        >
            {children}
        </View>
    );

    const touchDebugEnabled = __DEV__ && (process.env.EXPO_PUBLIC_TOUCH_DEBUG === '1');
    const touchDebugProps = touchDebugEnabled
        ? {
            onTouchEndCapture: (e: any) => {
                const { pageX, pageY } = e.nativeEvent;
                Logger.debug('TouchDebug', 'touch', { tag: debugTag || 'screen', pageX, pageY });
            },
        }
        : {};

    if (keyboardAvoiding) {
        return (
            <SafeAreaView style={[styles.container, style]} edges={resolvedEdges} {...touchDebugProps}>
                <KeyboardAvoidingView
                    style={styles.flex1}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    {body}
                </KeyboardAvoidingView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, style]} edges={resolvedEdges} {...touchDebugProps}>
            {body}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        flexGrow: 1,
        paddingTop: SPACING.lg,
    },
    contentView: {
        flex: 1,
    },
    flex1: {
        flex: 1,
    },
});

import React, { useEffect, useRef } from 'react';
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
import { usePathname, useSegments } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../theme';
import { useScreenPadding } from '../hooks/useScreenPadding';
import { Perf } from '../utils/perfInstrumentation';

type ScreenProps = {
    children: React.ReactNode;
    scroll?: boolean;
    keyboardAvoiding?: boolean;
    variant?: 'auto' | 'tabs' | 'stack' | 'fullscreen';
    style?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>;
    scrollProps?: ScrollViewProps;
    edges?: Edge[];
    debugTag?: string;
    routeKey?: string;
};

export default function Screen({
    children,
    scroll = false,
    keyboardAvoiding = false,
    variant = 'auto',
    style,
    contentStyle,
    scrollProps,
    edges,
    debugTag,
    routeKey,
}: ScreenProps) {
    const segments = useSegments() as string[];
    const pathname = usePathname();
    const isTabsScreen = segments.includes('(tabs)');
    const resolvedVariant =
        variant === 'auto'
            ? (isTabsScreen ? 'tabs' : 'stack')
            : variant;
    const horizontalPadding = useScreenPadding();
    const { contentContainerStyle: scrollContentStyle, ...restScrollProps } = scrollProps || {};
    const scrollKeyboardShouldPersistTaps = restScrollProps.keyboardShouldPersistTaps ?? 'handled';
    const scrollKeyboardDismissMode = restScrollProps.keyboardDismissMode ?? (Platform.OS === 'ios' ? 'interactive' : 'on-drag');
    const presetByVariant: Record<'tabs' | 'stack' | 'fullscreen', { edges: Edge[]; bottomPadding: number }> = {
        tabs: { edges: ['top'], bottomPadding: 0 },
        stack: { edges: ['top', 'bottom'], bottomPadding: SPACING.xxl },
        fullscreen: { edges: ['top', 'bottom'], bottomPadding: 0 },
    };
    const resolvedPreset = presetByVariant[resolvedVariant];
    const resolvedEdges: Edge[] = edges ?? resolvedPreset.edges;
    const resolvedBottomPadding = resolvedPreset.bottomPadding;
    const resolvedTopPadding =
        resolvedVariant === 'tabs' ? 0 : resolvedVariant === 'fullscreen' ? 0 : SPACING.lg;
    const resolvedRouteKey = routeKey ?? debugTag ?? pathname;
    const navMarkConsumedRef = useRef(false);
    const navMarkRef = useRef<ReturnType<typeof Perf.consumeNavMark> | null>(null);

    useEffect(() => {
        Perf.mark("Screen.Mount", {
            routeKey: resolvedRouteKey,
            meta: {
                pathname,
                routeKeyConfidence: routeKey ? "explicit" : debugTag ? "debugTag" : "raw",
            },
        });

        if (!navMarkConsumedRef.current) {
            const navMark = Perf.consumeNavMark(resolvedRouteKey);
            if (navMark) {
                navMarkConsumedRef.current = true;
                navMarkRef.current = navMark;
                Perf.mark("Nav.ToMounted", {
                    cid: navMark.cid,
                    routeKey: resolvedRouteKey,
                    meta: {
                        durationMs: Date.now() - navMark.startedAt,
                        ...(navMark.meta || {}),
                    },
                });
            }
        }
    }, [debugTag, pathname, resolvedRouteKey, routeKey]);

    useFocusEffect(
        React.useCallback(() => {
            Perf.mark("Screen.Focus", {
                routeKey: resolvedRouteKey,
            });

            const navMark = navMarkRef.current;
            if (navMark) {
                Perf.mark("Nav.ToFocused", {
                    cid: navMark.cid,
                    routeKey: resolvedRouteKey,
                    meta: {
                        durationMs: Date.now() - navMark.startedAt,
                        ...(navMark.meta || {}),
                    },
                });
                navMarkRef.current = null;
            }

            return undefined;
        }, [resolvedRouteKey]),
    );

    const contentContainerStyles = resolvedVariant === 'tabs'
        ? [
            styles.content,
            { paddingHorizontal: horizontalPadding },
            { paddingTop: resolvedTopPadding },
            scrollContentStyle,
            contentStyle,
            { paddingBottom: resolvedBottomPadding },
        ]
        : [
            styles.content,
            { paddingHorizontal: horizontalPadding },
            { paddingTop: resolvedTopPadding },
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
                { paddingHorizontal: horizontalPadding },
                { paddingTop: resolvedTopPadding },
                resolvedVariant !== 'tabs' && { paddingBottom: resolvedBottomPadding },
                contentStyle,
                resolvedVariant === 'tabs' && { paddingBottom: resolvedBottomPadding },
            ]}
        >
            {children}
        </View>
    );

    if (keyboardAvoiding) {
        return (
            <SafeAreaView style={[styles.container, style]} edges={resolvedEdges}>
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
        <SafeAreaView style={[styles.container, style]} edges={resolvedEdges}>
            {body}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.backgroundDark,
    },
    content: {
        flexGrow: 1,
    },
    contentView: {
        flex: 1,
    },
    flex1: {
        flex: 1,
    },
});

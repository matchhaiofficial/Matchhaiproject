import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
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
    keyboardFocusKey?: unknown;
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
    keyboardFocusKey,
}: ScreenProps) {
    const segments = useSegments() as string[];
    const pathname = usePathname();
    const isTabsScreen = segments.includes('(tabs)');
    const resolvedVariant =
        variant === 'auto'
            ? (isTabsScreen ? 'tabs' : 'stack')
            : variant;
    const horizontalPadding = useScreenPadding();
    const containerRef = useRef<View | null>(null);
    const scrollRef = useRef<ScrollView | null>(null);
    const scrollOffsetYRef = useRef(0);
    const keyboardTopRef = useRef<number | null>(null);
    const [keyboardInset, setKeyboardInset] = useState(0);
    const { contentContainerStyle: scrollContentStyle, ...restScrollProps } = scrollProps || {};
    const scrollKeyboardShouldPersistTaps = restScrollProps.keyboardShouldPersistTaps ?? 'handled';
    const scrollKeyboardDismissMode = restScrollProps.keyboardDismissMode ?? (Platform.OS === 'ios' ? 'interactive' : 'on-drag');
    const userOnScroll = restScrollProps.onScroll;
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

    const keyboardScrollInset = scroll && keyboardAvoiding ? keyboardInset : 0;
    const bottomPadding = resolvedBottomPadding + keyboardScrollInset;
    const contentContainerStyles = resolvedVariant === 'tabs'
        ? [
            styles.content,
            { paddingHorizontal: horizontalPadding },
            { paddingTop: resolvedTopPadding },
            scrollContentStyle,
            contentStyle,
            { paddingBottom: bottomPadding },
        ]
        : [
            styles.content,
            { paddingHorizontal: horizontalPadding },
            { paddingTop: resolvedTopPadding, paddingBottom: bottomPadding },
            scrollContentStyle,
            contentStyle,
            { paddingBottom: bottomPadding },
        ];

    const ensureFocusedInputVisible = useCallback(() => {
        if (!scroll || !keyboardAvoiding) return;

        requestAnimationFrame(() => {
            setTimeout(() => {
                const focusedInput = TextInput.State?.currentlyFocusedInput?.();
                const scrollView = scrollRef.current;
                const container = containerRef.current;
                if (!focusedInput || !scrollView || !container) return;

                const measurableInput = focusedInput as {
                    measureInWindow?: (
                        callback: (x: number, y: number, width: number, height: number) => void,
                    ) => void;
                };
                if (!measurableInput.measureInWindow) return;

                container.measureInWindow((_containerX, containerY, _containerWidth, containerHeight) => {
                    measurableInput.measureInWindow?.((_inputX, inputY, _inputWidth, inputHeight) => {
                        const keyboardTop = keyboardTopRef.current;
                        const containerBottom = containerY + containerHeight;
                        const visibleBottom = Math.min(containerBottom, keyboardTop ?? containerBottom) - SPACING.lg;
                        const visibleTop = containerY + SPACING.sm;
                        const inputBottom = inputY + inputHeight;
                        let nextOffsetY = scrollOffsetYRef.current;

                        if (inputBottom > visibleBottom) {
                            nextOffsetY += inputBottom - visibleBottom;
                        } else if (inputY < visibleTop) {
                            nextOffsetY -= visibleTop - inputY;
                        }

                        nextOffsetY = Math.max(0, Math.round(nextOffsetY));
                        if (Math.abs(nextOffsetY - scrollOffsetYRef.current) > 1) {
                            scrollView.scrollTo({ y: nextOffsetY, animated: true });
                        }
                    });
                });
            }, 80);
        });
    }, [keyboardAvoiding, scroll]);

    useEffect(() => {
        if (!scroll || !keyboardAvoiding) {
            keyboardTopRef.current = null;
            setKeyboardInset(0);
            return undefined;
        }

        const handleKeyboardFrame = (event: { endCoordinates?: { screenY?: number } }) => {
            const keyboardTop = event.endCoordinates?.screenY;
            keyboardTopRef.current = typeof keyboardTop === 'number' ? keyboardTop : null;

            containerRef.current?.measureInWindow((_x, containerY, _width, containerHeight) => {
                const containerBottom = containerY + containerHeight;
                const nextInset =
                    typeof keyboardTop === 'number' ? Math.max(0, containerBottom - keyboardTop) : 0;
                setKeyboardInset(nextInset);
            });
            ensureFocusedInputVisible();
        };
        const handleKeyboardHide = () => {
            keyboardTopRef.current = null;
            setKeyboardInset(0);
        };

        const showSubscription = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            handleKeyboardFrame,
        );
        const frameSubscription =
            Platform.OS === 'ios'
                ? Keyboard.addListener('keyboardWillChangeFrame', handleKeyboardFrame)
                : null;
        const hideSubscription = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            handleKeyboardHide,
        );

        return () => {
            showSubscription.remove();
            frameSubscription?.remove();
            hideSubscription.remove();
        };
    }, [ensureFocusedInputVisible, keyboardAvoiding, scroll]);

    useEffect(() => {
        if (keyboardFocusKey == null) return;
        ensureFocusedInputVisible();
    }, [ensureFocusedInputVisible, keyboardFocusKey]);

    const body = scroll ? (
        <ScrollView
            ref={scrollRef}
            contentContainerStyle={contentContainerStyles}
            keyboardShouldPersistTaps={scrollKeyboardShouldPersistTaps}
            keyboardDismissMode={scrollKeyboardDismissMode}
            scrollEventThrottle={16}
            {...restScrollProps}
            onScroll={(event) => {
                scrollOffsetYRef.current = event.nativeEvent.contentOffset.y;
                userOnScroll?.(event);
            }}
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
            <SafeAreaView ref={containerRef} style={[styles.container, style]} edges={resolvedEdges}>
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
        <SafeAreaView ref={containerRef} style={[styles.container, style]} edges={resolvedEdges}>
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

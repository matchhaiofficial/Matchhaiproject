import * as Haptics from "expo-haptics";
import React, { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from "react-native-reanimated";

import { AppIcon } from "../../components/AppIcon";
import { COLORS } from "../../theme";

const SWIPE_THRESHOLD = 60;

type SwipeableMessageRowProps = {
    onSwipeReply: () => void;
    children: React.ReactNode;
};

export default function SwipeableMessageRow({
    onSwipeReply,
    children,
}: SwipeableMessageRowProps) {
    const translateX = useSharedValue(0);
    const hasTriggered = useSharedValue(false);

    const triggerHaptic = useCallback(() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, []);

    const triggerReply = useCallback(() => {
        onSwipeReply();
    }, [onSwipeReply]);

    const pan = Gesture.Pan()
        .activeOffsetX(15)
        .failOffsetY([-10, 10])
        .onUpdate((event) => {
            // Only allow right swipe (positive translationX)
            const clamped = Math.min(Math.max(event.translationX, 0), SWIPE_THRESHOLD + 20);
            translateX.value = clamped;

            if (clamped >= SWIPE_THRESHOLD && !hasTriggered.value) {
                hasTriggered.value = true;
                runOnJS(triggerHaptic)();
            } else if (clamped < SWIPE_THRESHOLD) {
                hasTriggered.value = false;
            }
        })
        .onEnd(() => {
            if (translateX.value >= SWIPE_THRESHOLD) {
                runOnJS(triggerReply)();
            }
            translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
            hasTriggered.value = false;
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    const replyIconStyle = useAnimatedStyle(() => ({
        opacity: Math.min(translateX.value / SWIPE_THRESHOLD, 1),
        transform: [
            { scale: Math.min(translateX.value / SWIPE_THRESHOLD, 1) },
        ],
    }));

    return (
        <View style={localStyles.container}>
            <Animated.View style={[localStyles.replyHint, replyIconStyle]}>
                <AppIcon name="reply" size={18} color={COLORS.accent} />
            </Animated.View>
            <GestureDetector gesture={pan}>
                <Animated.View style={animatedStyle}>{children}</Animated.View>
            </GestureDetector>
        </View>
    );
}

const localStyles = StyleSheet.create({
    container: {
        position: "relative",
    },
    replyHint: {
        position: "absolute",
        left: 4,
        top: 0,
        bottom: 0,
        width: 36,
        alignItems: "center",
        justifyContent: "center",
    },
});

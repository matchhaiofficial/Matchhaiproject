import React, { useCallback, useRef } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppIcon } from "../../../src/components/AppIcon";
import { COLORS } from "../../../src/theme";

const SCREEN_WIDTH = Dimensions.get("window").width;

const rowStyles = StyleSheet.create({
  container: {
    marginBottom: 12,
    overflow: "hidden",
  },
  stage: {
    position: "relative",
  },
  background: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: COLORS.error,
    borderRadius: 12,
  },
  deleteSlot: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  deletePressable: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteText: {
    color: "#FFF",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "600",
  },
  content: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
  },
});

type Props = {
  children: React.ReactNode;
  onDelete: () => void;
  canSwipe: boolean;
};

export function InboxSwipeableRow({ children, onDelete, canSwipe }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const rowOpacity = useRef(new Animated.Value(1)).current;
  const isDeleting = useRef(false);
  const gestureActive = useRef(false);
  const deleteThreshold = SCREEN_WIDTH * 0.35;

  const triggerDelete = useCallback(() => {
    if (isDeleting.current) return;
    isDeleting.current = true;

    Animated.parallel([
      Animated.timing(translateX, {
        toValue: -SCREEN_WIDTH,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(100),
        Animated.timing(rowOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      onDelete();
    });
  }, [onDelete, rowOpacity, translateX]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        const isLeftSwipe = gestureState.dx < -10;
        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
        return isLeftSwipe && isHorizontal && !isDeleting.current;
      },
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isLeftSwipe = gestureState.dx < -10;
        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
        return isLeftSwipe && isHorizontal && !isDeleting.current;
      },
      onPanResponderTerminationRequest: () => !gestureActive.current,
      onPanResponderGrant: () => {
        gestureActive.current = true;
        translateX.stopAnimation();
        translateX.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        if (isDeleting.current || !gestureActive.current) return;
        const clampedDx = Math.max(-SCREEN_WIDTH, Math.min(0, gestureState.dx));
        translateX.setValue(clampedDx);
      },
      onPanResponderRelease: (_, gestureState) => {
        gestureActive.current = false;
        if (isDeleting.current) return;

        const shouldDelete =
          gestureState.dx < -deleteThreshold ||
          (gestureState.vx < -0.8 && gestureState.dx < -50);

        if (shouldDelete) {
          triggerDelete();
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
            tension: 60,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        gestureActive.current = false;
        if (!isDeleting.current) {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
            tension: 60,
          }).start();
        }
      },
    }),
  ).current;

  const deleteScale = translateX.interpolate({
    inputRange: [-deleteThreshold, -100, 0],
    outputRange: [1.3, 1, 0.9],
    extrapolate: "clamp",
  });

  const deleteOpacity = translateX.interpolate({
    inputRange: [-80, -30, 0],
    outputRange: [1, 0.7, 0],
    extrapolate: "clamp",
  });

  return (
    <Animated.View
      style={[rowStyles.container, { opacity: rowOpacity }]}
    >
      <View style={rowStyles.stage}>
        <View style={rowStyles.background}>
          <Animated.View
            style={[rowStyles.deleteSlot, { opacity: deleteOpacity }]}
          >
            <Pressable onPress={triggerDelete} style={rowStyles.deletePressable}>
              <Animated.View style={{ transform: [{ scale: deleteScale }] }}>
                <AppIcon name="delete" size={28} color="#FFF" />
              </Animated.View>
              <Text style={rowStyles.deleteText}>Delete</Text>
            </Pressable>
          </Animated.View>
        </View>

        <Animated.View
          style={[rowStyles.content, { transform: [{ translateX }] }]}
          {...(canSwipe ? panResponder.panHandlers : {})}
        >
          {children}
        </Animated.View>
      </View>
    </Animated.View>
  );
}

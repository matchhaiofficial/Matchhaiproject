import { useCallback } from "react";
import {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { MOTION_DURATION, MOTION_PRESS } from "./tokens";

export function usePressScale({
  activeScale = MOTION_PRESS.activeScale,
  activeOpacity = MOTION_PRESS.activeOpacity,
}: {
  activeScale?: number;
  activeOpacity?: number;
} = {}) {
  const pressed = useSharedValue(0);

  const scale = useDerivedValue(() =>
    withTiming(pressed.value ? activeScale : 1, {
      duration: MOTION_DURATION.fast,
      easing: Easing.out(Easing.cubic),
    })
  );
  const opacity = useDerivedValue(() =>
    withTiming(pressed.value ? activeOpacity : 1, {
      duration: MOTION_DURATION.fast,
      easing: Easing.out(Easing.cubic),
    })
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const onPressIn = useCallback(() => {
    pressed.value = 1;
  }, [pressed]);

  const onPressOut = useCallback(() => {
    pressed.value = 0;
  }, [pressed]);

  return {
    animatedStyle,
    onPressIn,
    onPressOut,
  };
}

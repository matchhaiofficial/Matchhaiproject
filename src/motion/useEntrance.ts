import { useEffect } from "react";
import {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { getEntranceOffset } from "./presets";
import { MOTION_DURATION, MOTION_DISTANCE } from "./tokens";

export function useEntrance({
  visible = true,
  axis = "y",
  distance = MOTION_DISTANCE.sm,
  delay = 0,
  initialScale = 1,
}: {
  visible?: boolean;
  axis?: "x" | "y";
  distance?: number;
  delay?: number;
  initialScale?: number;
} = {}) {
  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(visible ? 1 : 0, {
        duration: MOTION_DURATION.normal,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [delay, progress, visible]);

  const opacity = useDerivedValue(() => progress.value);
  const translate = useDerivedValue(() => 1 - progress.value);
  const scale = useDerivedValue(
    () => initialScale + (1 - initialScale) * progress.value
  );

  const { x, y } = getEntranceOffset(axis, distance);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: x * translate.value },
      { translateY: y * translate.value },
      { scale: scale.value },
    ],
  }));

  return {
    animatedStyle,
    progress,
  };
}

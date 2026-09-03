import { Easing, type WithTimingConfig } from "react-native-reanimated";

import { MOTION_DISTANCE, MOTION_DURATION } from "./tokens";

export const MOTION_EASING = {
  standard: Easing.out(Easing.cubic),
  emphasized: Easing.bezier(0.2, 0.8, 0.2, 1),
} as const;

export function timingConfig(duration: number = MOTION_DURATION.normal): WithTimingConfig {
  "worklet";
  return {
    duration,
    easing: Easing.out(Easing.cubic),
  };
}

export function getEntranceOffset(
  axis: "x" | "y" = "y",
  distance: number = MOTION_DISTANCE.sm
) {
  return axis === "x" ? { x: distance, y: 0 } : { x: 0, y: distance };
}

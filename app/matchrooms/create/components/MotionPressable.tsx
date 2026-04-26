import React from "react";
import {
  Pressable,
  type GestureResponderEvent,
  type Insets,
  type PressableAndroidRippleConfig,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated from "react-native-reanimated";

import { usePressScale } from "../../../../src/motion/usePressScale";

type MotionPressableProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
  onPress?: ((event: GestureResponderEvent) => void) | null;
  disabled?: boolean;
  hitSlop?: Insets | number;
  android_ripple?: PressableAndroidRippleConfig;
};

export function MotionPressable({
  children,
  style,
  pressedStyle,
  onPress,
  disabled,
  hitSlop,
  android_ripple,
}: MotionPressableProps) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();

  return (
    <Pressable
      disabled={disabled}
      hitSlop={hitSlop}
      onPress={onPress ?? undefined}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      android_ripple={android_ripple}
      style={({ pressed }) => [style, pressed && pressedStyle]}
    >
      <Animated.View style={animatedStyle}>{children}</Animated.View>
    </Pressable>
  );
}

// src/components/ToastHost.tsx
import React, { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import { useToastStore } from "../src/store/toastStore";
import { COLORS } from "../src/theme";
import { toastStyles as styles } from "./ToastHost.styles";

const typeAccentMap = {
  success: COLORS.success,
  error: COLORS.error,
  info: COLORS.accent,
  // soft amber but still on-brand
  warning: "#FFC107",
} as const;

export default function ToastHost() {
  const { visible, type, title, message } = useToastStore();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 16,
          duration: 140,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, opacity, translateY]);

  if (!visible) return null;

  const accent = typeAccentMap[type] ?? COLORS.accent;

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      <Animated.View
        style={[
          styles.toast,
          {
            borderLeftColor: accent,
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        {title ? (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        <Text style={styles.message} numberOfLines={3}>
          {message}
        </Text>
      </Animated.View>
    </View>
  );
}

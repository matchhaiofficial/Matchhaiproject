import React from "react";
import { Pressable, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { AppIcon, type AppIconName } from "../../../../src/components/AppIcon";
import { usePressScale } from "../../../../src/motion/usePressScale";
import styles from "../../(tabs)/_dashboard.styles";

type DashboardAlertRowProps = {
  icon: AppIconName;
  message: string;
  time: string;
  color: string;
  onPress: () => void;
};

export default function DashboardAlertRow({
  icon,
  message,
  time,
  color,
  onPress,
}: DashboardAlertRowProps) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale({
    activeScale: 0.99,
  });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={({ pressed }) => [
        styles.notificationCard,
        pressed && styles.notificationCardPressed,
      ]}
    >
      <Animated.View style={animatedStyle}>
        <View style={styles.notificationCardInner}>
          <View
            style={[
              styles.notificationIconBox,
              { backgroundColor: `${color}14`, borderColor: `${color}22` },
            ]}
          >
            <AppIcon name={icon} size={18} color={color} />
          </View>
          <View style={styles.notificationContent}>
            <Text style={styles.notificationText} numberOfLines={2}>
              {message}
            </Text>
            <View style={styles.notificationMetaRow}>
              <Text style={styles.notificationTime}>{time}</Text>
              <View style={styles.notificationCta}>
                <Text style={styles.notificationCtaText}>Open</Text>
                <AppIcon name="chevron-right" size={14} color={color} />
              </View>
              </View>
            </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

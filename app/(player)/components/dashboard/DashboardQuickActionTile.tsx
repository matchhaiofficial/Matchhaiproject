import React from "react";
import { Pressable, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { AppIcon, type AppIconName } from "../../../../src/components/AppIcon";
import { AppCard } from "../../../../src/components/AppPrimitives";
import { usePressScale } from "../../../../src/motion/usePressScale";
import styles from "../../(tabs)/_dashboard.styles";

type DashboardQuickActionTileProps = {
  icon: AppIconName;
  label: string;
  color: string;
  onPress: () => void;
};

export default function DashboardQuickActionTile({
  icon,
  label,
  color,
  onPress,
}: DashboardQuickActionTileProps) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();

  return (
    <Pressable
      style={styles.quickActionBtn}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <Animated.View style={animatedStyle}>
        <AppCard variant="soft" style={styles.quickActionCard}>
          <View
            style={[
              styles.quickActionIconContainer,
              { backgroundColor: `${color}18` },
            ]}
          >
            <AppIcon name={icon} size={24} color={color} />
          </View>
          <Text style={styles.quickActionText}>{label}</Text>
        </AppCard>
      </Animated.View>
    </Pressable>
  );
}

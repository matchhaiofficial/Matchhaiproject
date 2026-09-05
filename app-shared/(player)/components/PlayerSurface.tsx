import React from "react";
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { AppButton, AppCard } from "../../../src/components/AppPrimitives";
import styles from "./PlayerSurface.styles";

export function PlayerSectionHeader({
  title,
  actionLabel,
  onPress,
  style,
}: {
  title: string;
  actionLabel?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel && onPress ? (
        <Pressable onPress={onPress}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function PlayerEmptyStateCard({
  title,
  description,
  actionLabel,
  onPress,
  style,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <AppCard variant="empty" style={[styles.emptyCard, style]}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? <Text style={styles.emptyDescription}>{description}</Text> : null}
      {actionLabel && onPress ? (
        <AppButton style={styles.emptyAction} onPress={onPress}>
          {actionLabel}
        </AppButton>
      ) : null}
    </AppCard>
  );
}

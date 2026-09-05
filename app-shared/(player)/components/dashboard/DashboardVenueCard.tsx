import React from "react";
import { Pressable, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { AppIcon } from "../../../../src/components/AppIcon";
import { AppCard, StatusPill } from "../../../../src/components/AppPrimitives";
import { usePressScale } from "../../../../src/motion/usePressScale";
import { COLORS } from "../../../../src/theme";
import styles from "../../(tabs)/_dashboard.styles";

type DashboardVenueCardProps = {
  typeLabel: string;
  statusLabel: string;
  statusTone: "neutral" | "info" | "success" | "warning" | "danger";
  title: string;
  location: string;
  gameLabels: string[];
  capacityLabel: string;
  rateLabel: string;
  onPress: () => void;
};

export default function DashboardVenueCard({
  typeLabel,
  statusLabel,
  statusTone,
  title,
  location,
  gameLabels,
  capacityLabel,
  rateLabel,
  onPress,
}: DashboardVenueCardProps) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale({
    activeScale: 0.99,
  });

  return (
    <Pressable
      style={styles.nearbyCard}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <Animated.View style={animatedStyle}>
        <AppCard variant="soft" style={styles.nearbyCardInner}>
          <View style={styles.nearbyMetaRow}>
            <Text style={styles.nearbyGame}>{typeLabel}</Text>
            <StatusPill
              tone={statusTone}
              label={statusLabel}
              caps={false}
              style={styles.nearbyStatusTag}
              textStyle={styles.nearbyStatusText}
            />
          </View>

          <View style={styles.nearbyTitleRow}>
            <Text style={styles.nearbyTitle} numberOfLines={1}>
              {title}
            </Text>
            <View style={styles.bookSlotBtn}>
              <Text style={styles.bookSlotText}>Check Slots</Text>
            </View>
          </View>

          <View style={styles.nearbyInfoRow}>
            <View style={styles.nearbyDistance}>
              <AppIcon
                name="location-on"
                size={12}
                color={COLORS.textSecondary}
              />
              <Text style={styles.nearbyDistanceText}>{location}</Text>
            </View>
          </View>

          <View style={styles.nearbyGamesRow}>
            {(gameLabels.length > 0 ? gameLabels : ["Games listed on open"]).map(
              (label) => (
                <StatusPill
                  key={`${title}-${label}`}
                  label={label}
                  tone="neutral"
                  caps={false}
                  style={styles.nearbyGameChip}
                  textStyle={styles.nearbyGameChipText}
                />
              ),
            )}
          </View>

          <View style={styles.nearbyBottomRow}>
            <Text style={styles.nearbyCapacityText} numberOfLines={1}>
              {capacityLabel}
            </Text>
            <View style={styles.priceTag}>
              <Text style={styles.priceTagText}>{rateLabel}</Text>
            </View>
          </View>
        </AppCard>
      </Animated.View>
    </Pressable>
  );
}

import React from "react";
import { Pressable, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { AppIcon } from "../../../../src/components/AppIcon";
import { AppCard } from "../../../../src/components/AppPrimitives";
import { usePressScale } from "../../../../src/motion/usePressScale";
import { COLORS } from "../../../../src/theme";
import styles from "../../(tabs)/_dashboard.styles";

type DashboardHighlightTileProps = {
  label: string;
  value: string;
  detail: string;
  icon: "account-balance-wallet" | "inbox";
  actionLabel: string;
  onPress: () => void;
};

function DashboardHighlightTile({
  label,
  value,
  detail,
  icon,
  actionLabel,
  onPress,
}: DashboardHighlightTileProps) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale({
    activeScale: 0.99,
  });

  return (
    <Pressable
      style={styles.glanceHighlightPressable}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <Animated.View style={animatedStyle}>
        <View style={styles.glanceHighlightCard}>
          <View style={styles.glanceHighlightHeader}>
            <View style={styles.glanceHighlightTitleWrap}>
              <Text style={styles.glanceHighlightLabel}>{label}</Text>
              <Text style={styles.glanceHighlightValue}>{value}</Text>
            </View>
            <View style={styles.glanceHighlightMetaWrap}>
              <View style={styles.glanceHighlightIconWrap}>
                <AppIcon name={icon} size={16} color={COLORS.accent} />
              </View>
              <Text style={styles.glanceHighlightAction}>{actionLabel}</Text>
            </View>
          </View>
          <Text style={styles.glanceHighlightDetail}>{detail}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

type DashboardMiniStatProps = {
  label: string;
  value: number;
};

function DashboardMiniStat({ label, value }: DashboardMiniStatProps) {
  return (
    <View style={styles.glanceMiniStat}>
      <Text style={styles.glanceMiniStatValue}>{value}</Text>
      <Text style={styles.glanceMiniStatLabel}>{label}</Text>
    </View>
  );
}

type DashboardAtGlancePanelProps = {
  walletValue: string;
  walletDetail: string;
  walletOnPress: () => void;
  requestsValue: string;
  requestsDetail: string;
  requestsOnPress: () => void;
  upcomingCount: number;
  teamCount: number;
  alertCount: number;
};

export default function DashboardAtGlancePanel({
  walletValue,
  walletDetail,
  walletOnPress,
  requestsValue,
  requestsDetail,
  requestsOnPress,
  upcomingCount,
  teamCount,
  alertCount,
}: DashboardAtGlancePanelProps) {
  return (
    <AppCard variant="soft" style={styles.glancePanel}>
      <View style={styles.glanceHighlightGrid}>
        <DashboardHighlightTile
          label="Wallet"
          value={walletValue}
          detail={walletDetail}
          icon="account-balance-wallet"
          actionLabel="Open wallet"
          onPress={walletOnPress}
        />
        <DashboardHighlightTile
          label="Requests"
          value={requestsValue}
          detail={requestsDetail}
          icon="inbox"
          actionLabel="Open inbox"
          onPress={requestsOnPress}
        />
      </View>
      <View style={styles.glanceMiniStatsRow}>
        <DashboardMiniStat label="Upcoming" value={upcomingCount} />
        <DashboardMiniStat label="Teams" value={teamCount} />
        <DashboardMiniStat label="Alerts" value={alertCount} />
      </View>
    </AppCard>
  );
}

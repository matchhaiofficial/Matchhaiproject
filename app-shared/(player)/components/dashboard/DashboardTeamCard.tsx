import React, { memo, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { AppIcon } from "../../../../src/components/AppIcon";
import { AppCard, StatusPill } from "../../../../src/components/AppPrimitives";
import { usePressScale } from "../../../../src/motion/usePressScale";
import { COLORS } from "../../../../src/theme";
import styles from "../../(tabs)/_dashboard.styles";

type DashboardTeamCardProps = {
  name: string;
  gameLabel: string;
  matchesPlayed: number;
  currentMembers: number;
  maxMembers: number;
  fillPercent: number;
  wins: number;
  losses: number;
  onPress: () => void;
};

function DashboardTeamCard({
  name,
  gameLabel,
  matchesPlayed,
  currentMembers,
  maxMembers,
  fillPercent,
  wins,
  losses,
  onPress,
}: DashboardTeamCardProps) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale({
    activeScale: 0.99,
  });

  const progressFillStyle = useMemo(
    () => [styles.teamProgressFill, { width: `${fillPercent}%` as const }],
    [fillPercent],
  );

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={({ pressed }) => [
        styles.teamCard,
        pressed && styles.teamCardPressed,
      ]}
    >
      <Animated.View style={animatedStyle}>
        <AppCard variant="soft" style={styles.teamCardInner}>
          <View style={styles.teamTopRow}>
            <View style={styles.teamIdentityWrap}>
              <View style={styles.teamAvatarWrap}>
                <AppIcon name="groups" size={18} color={COLORS.accent} />
              </View>
              <View style={styles.teamTextWrap}>
                <Text style={styles.teamName} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={styles.teamSubtext} numberOfLines={1}>
                  {matchesPlayed} matches played
                </Text>
              </View>
            </View>
            <StatusPill
              tone="info"
              label={gameLabel}
              style={styles.teamGamePill}
              textStyle={styles.teamGamePillText}
            />
          </View>

          <View style={styles.teamMembersRow}>
            <Text style={styles.teamMembersText}>Team Capacity</Text>
            <Text style={styles.teamMembersCount}>
              {currentMembers}/{maxMembers}
            </Text>
          </View>
          <View style={styles.teamProgressTrack}>
            <View style={progressFillStyle} />
          </View>

          <View style={styles.teamBottomRow}>
            <Text style={styles.teamStatsText}>
              W {wins} · L {losses}
            </Text>
            <StatusPill
              tone={currentMembers < maxMembers ? "success" : "neutral"}
              label={currentMembers < maxMembers ? "Open slots" : "Full"}
              caps={false}
              style={styles.teamOpenPill}
              textStyle={styles.teamOpenPillText}
            />
          </View>
        </AppCard>
      </Animated.View>
    </Pressable>
  );
}

export default memo(DashboardTeamCard);

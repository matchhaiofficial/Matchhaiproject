import React from "react";
import { Pressable, Text, View } from "react-native";
import { AppIcon } from "../../../src/components/AppIcon";
import SkillBadge from "../../../src/components/SkillBadge";
import { SkillTier } from "../../../src/services/skillRatingService";
import { COLORS } from "../../../src/theme";

type Player = {
  uid: string;
  username: string;
  role?: string;
  skillTier?: string;
};

type SkillBadgeProps = {
  tier: SkillTier;
  rating?: number;
  showRating: boolean;
} | null;

type Props = {
  players: Player[];
  styles: any;
  hostUid?: string | null;
  currentUserId?: string | null;
  identityMatches: (
    candidate: unknown,
    values: Array<string | null | undefined>,
  ) => boolean;
  getDisplayRole: (role?: string | null) => string;
  getSkillBadgeProps: (uid?: string, fallbackTierRaw?: unknown) => SkillBadgeProps;
  onReportPlayer?: (playerUid: string, playerName: string) => void;
};

export function MatchroomFallbackRoster({
  players,
  styles,
  hostUid,
  currentUserId,
  identityMatches,
  getDisplayRole,
  getSkillBadgeProps,
  onReportPlayer,
}: Props) {
  return (
    <View style={styles.playersContainer}>
      {players.map((player) => (
        <View key={player.uid} style={styles.slotRow}>
          <View style={styles.slotAvatar}>
            <Text style={styles.slotAvatarText}>
              {player.username.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.slotInfo}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  flex: 1,
                }}
              >
                <Text style={styles.slotName}>{player.username}</Text>
                {identityMatches(player.uid, [hostUid]) && (
                  <View style={[styles.captainBadge, { marginLeft: 8 }]}>
                    <Text style={styles.captainText}>HOST</Text>
                  </View>
                )}
              </View>
              {onReportPlayer && player.uid !== currentUserId ? (
                <Pressable
                  onPress={() => onReportPlayer(player.uid, player.username)}
                  hitSlop={8}
                  style={{ padding: 4 }}
                >
                  <AppIcon
                    name="flag"
                    size={16}
                    color={COLORS.error}
                    style={{ opacity: 0.85 }}
                  />
                </Pressable>
              ) : player.uid === currentUserId ? (
                <AppIcon
                  name="person"
                  size={16}
                  color={COLORS.accent}
                  style={{ opacity: 0.6 }}
                />
              ) : null}
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 2,
              }}
            >
              {player.role ? (
                <Text style={styles.slotRoleName}>
                  {getDisplayRole(player.role)}
                </Text>
              ) : null}
              {(() => {
                const badge = getSkillBadgeProps(player.uid, player.skillTier);
                if (!badge) return null;
                return (
                  <View style={{ marginLeft: 8 }}>
                    <SkillBadge
                      tier={badge.tier}
                      rating={badge.rating}
                      size="compact"
                      showRating={badge.showRating}
                    />
                  </View>
                );
              })()}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

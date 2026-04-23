import React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  View,
} from "react-native";
import Animated from "react-native-reanimated";

import { AppIcon } from "../../../src/components/AppIcon";
import SkillBadge from "../../../src/components/SkillBadge";
import { usePressScale } from "../../../src/motion/usePressScale";
import { SkillTier } from "../../../src/services/skillRatingService";
import { COLORS } from "../../../src/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type SkillBadgeProps = {
  tier: SkillTier;
  rating?: number;
  showRating: boolean;
};

type MatchroomTeamSectionProps = {
  team: "A" | "B";
  title: string;
  slots: any[];
  styles: any;
  currentUserId?: string;
  captainUid?: string | null;
  canManage: boolean;
  canInvite: boolean;
  canJoin: boolean;
  isJoined: boolean;
  isZoneAdmin: boolean;
  requestedSlots: Map<string, string>;
  footerHitSlop: { top: number; bottom: number; left: number; right: number };
  getSlotUserId: (slot: any) => string | null;
  getDisplayRole: (role?: string | null) => string;
  identityMatches: (
    candidate: unknown,
    values: Array<string | null | undefined>,
  ) => boolean;
  getSkillBadgeProps: (
    uid?: string,
    fallbackTierRaw?: unknown,
  ) => SkillBadgeProps | null;
  joining?: boolean;
  onManagePlayer: (team: "A" | "B", playerUid: string, playerName: string) => void;
  onInvitePress: (team: "A" | "B", slotId: string) => void;
  onRequestJoin: (teamLabel: string, slotId: string) => void;
  onCancelRequest: () => void;
};

function EmptySlotLabel({ slot, styles }: { slot: any; styles: any }) {
  const isBookedPlaceholder =
    slot.status === "reserved" || slot.status === "confirmed";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <AppIcon
        name={isBookedPlaceholder ? "event-seat" : "add-circle-outline"}
        size={14}
        color={COLORS.textSecondary}
        style={{ marginRight: 6, opacity: 0.5 }}
      />
      <Text style={styles.emptySlotName}>
        {isBookedPlaceholder ? "Booked Seat" : "Available Slot"}
      </Text>
    </View>
  );
}

function SlotActionButtons({
  team,
  slotId,
  canInvite,
  canJoin,
  isJoined,
  isZoneAdmin,
  requestedSlots,
  joining,
  footerHitSlop,
  styles,
  onInvitePress,
  onRequestJoin,
  onCancelRequest,
}: {
  team: "A" | "B";
  slotId: string;
  canInvite: boolean;
  canJoin: boolean;
  isJoined: boolean;
  isZoneAdmin: boolean;
  requestedSlots: Map<string, string>;
  joining?: boolean;
  footerHitSlop: { top: number; bottom: number; left: number; right: number };
  styles: any;
  onInvitePress: (team: "A" | "B", slotId: string) => void;
  onRequestJoin: (teamLabel: string, slotId: string) => void;
  onCancelRequest: () => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale({
    activeScale: 0.985,
  });
  const status = requestedSlots.get(slotId);

  if (!canJoin || isJoined || isZoneAdmin) {
    return canInvite ? (
      <AnimatedPressable
        style={styles.inviteSlotButton}
        onPress={() => onInvitePress(team, slotId)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        hitSlop={footerHitSlop}
      >
        <Animated.View style={animatedStyle}>
          <Text style={styles.inviteSlotText}>Invite</Text>
        </Animated.View>
      </AnimatedPressable>
    ) : null;
  }

  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {canInvite && (
        <AnimatedPressable
          style={styles.inviteSlotButton}
          onPress={() => onInvitePress(team, slotId)}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          hitSlop={footerHitSlop}
        >
          <Animated.View style={animatedStyle}>
            <Text style={styles.inviteSlotText}>Invite</Text>
          </Animated.View>
        </AnimatedPressable>
      )}
      {joining ? (
        <View style={[styles.joinSlotButton, { opacity: 0.6 }]}>
          <ActivityIndicator size="small" color="#FFF" />
        </View>
      ) : status ? (
        <AnimatedPressable
          style={[
            styles.joinSlotButton,
            {
              backgroundColor:
                status === "rejected" ? COLORS.error : COLORS.muted,
            },
          ]}
          onPress={() => {
            if (status === "rejected") {
              Alert.alert(
                "Request Rejected",
                "The host has rejected your request for this slot.",
                [{ text: "Dismiss", onPress: onCancelRequest }],
              );
              return;
            }

            Alert.alert(
              "Cancel Request?",
              "Do you want to cancel your request for this slot?",
              [
                { text: "No", style: "cancel" },
                {
                  text: "Yes, Cancel",
                  style: "destructive",
                  onPress: onCancelRequest,
                },
              ],
            );
          }}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          hitSlop={footerHitSlop}
        >
          <Animated.View style={animatedStyle}>
            <Text
              style={[
                styles.joinSlotText,
                { color: "#FFF" },
              ]}
            >
              {status === "approved_pending_payment"
                ? "Pending Pay"
                : status === "rejected"
                  ? "Rejected"
                  : "Requested"}
            </Text>
          </Animated.View>
        </AnimatedPressable>
      ) : (
        <AnimatedPressable
          style={styles.joinSlotButton}
          onPress={() => onRequestJoin(`Team ${team}`, slotId)}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          hitSlop={footerHitSlop}
        >
          <Animated.View style={animatedStyle}>
            <Text style={styles.joinSlotText}>Join</Text>
          </Animated.View>
        </AnimatedPressable>
      )}
    </View>
  );
}

export default function MatchroomTeamSection({
  team,
  title,
  slots,
  styles,
  currentUserId,
  captainUid,
  canManage,
  canInvite,
  canJoin,
  isJoined,
  isZoneAdmin,
  requestedSlots,
  footerHitSlop,
  getSlotUserId,
  getDisplayRole,
  identityMatches,
  getSkillBadgeProps,
  joining,
  onManagePlayer,
  onInvitePress,
  onRequestJoin,
  onCancelRequest,
}: MatchroomTeamSectionProps) {
  const {
    animatedStyle: rowMotionStyle,
    onPressIn: onRowPressIn,
    onPressOut: onRowPressOut,
  } = usePressScale({
    activeScale: 0.992,
  });

  return (
    <View style={styles.teamContainer}>
      <View style={styles.teamTitleContainer}>
        <Text style={styles.teamTitle}>{title}</Text>
      </View>
      {slots.map((slot, idx) => {
        const slotUserId = getSlotUserId(slot);
        const badge = getSkillBadgeProps(
          slotUserId || undefined,
          (slot.user as any)?.skillTier,
        );

        return (
          <View key={slot.slotId || `${team}${idx}`} style={styles.slotRow}>
            <View style={styles.slotAvatar}>
              <Text style={styles.slotAvatarText}>
                {slot.user ? slot.user.username.charAt(0).toUpperCase() : idx + 1}
              </Text>
            </View>
            <AnimatedPressable
              style={styles.slotInfo}
              disabled={!slot.user || slotUserId === currentUserId || !canManage}
              onPress={() =>
                slot.user && slotUserId
                  ? onManagePlayer(team, slotUserId, slot.user.username)
                  : undefined
              }
              onPressIn={onRowPressIn}
              onPressOut={onRowPressOut}
            >
              {slot.user ? (
                <Animated.View style={rowMotionStyle}>
                <View>
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
                      <Text style={styles.slotName} numberOfLines={1}>
                        {slot.user.username}
                      </Text>
                      {identityMatches(slotUserId, [captainUid]) && (
                        <AppIcon
                          name="emoji-events"
                          size={10}
                          color={COLORS.warning}
                          style={{ marginLeft: 4 }}
                        />
                      )}
                    </View>
                    {canManage && slotUserId !== currentUserId && (
                      <AnimatedPressable
                        onPress={() =>
                          slot.user && slotUserId
                            ? onManagePlayer(team, slotUserId, slot.user.username)
                            : undefined
                        }
                        onPressIn={onRowPressIn}
                        onPressOut={onRowPressOut}
                        style={{ padding: 4 }}
                      >
                        <Animated.View style={rowMotionStyle}>
                          <AppIcon
                            name="more-vert"
                            size={16}
                            color={COLORS.muted}
                          />
                        </Animated.View>
                      </AnimatedPressable>
                    )}
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginTop: 2,
                    }}
                  >
                    <Text style={styles.slotRoleName}>
                      {getDisplayRole(slot.role)}
                    </Text>
                    {badge ? (
                      <View style={{ marginLeft: 8 }}>
                        <SkillBadge
                          tier={badge.tier}
                          rating={badge.rating}
                          size="compact"
                          showRating={badge.showRating}
                        />
                      </View>
                    ) : null}
                  </View>
                </View>
                </Animated.View>
              ) : (
                <EmptySlotLabel slot={slot} styles={styles} />
              )}
            </AnimatedPressable>
            {!slot.user && slot.status === "open" ? (
              <SlotActionButtons
                team={team}
                slotId={slot.slotId}
                canInvite={canInvite}
                canJoin={canJoin}
                isJoined={isJoined}
                isZoneAdmin={isZoneAdmin}
                requestedSlots={requestedSlots}
                joining={joining}
                footerHitSlop={footerHitSlop}
                styles={styles}
                onInvitePress={onInvitePress}
                onRequestJoin={onRequestJoin}
                onCancelRequest={onCancelRequest}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

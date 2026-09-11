import React from "react";
import { Pressable, Text, View } from "react-native";

import type { Team } from "../../../../src/services/convex/teamService";
import styles from "../create.styles";

type TeamMode = "solo" | "team";
type TeamPaymentMode = "captain_pays_all" | "captain_pays_self";

type SelectableMember = {
  uid: string;
  username?: string;
};

type Props = {
  canUseCaptainBooking: boolean;
  captainedTeams: Team[];
  isCaptainForGame: boolean;
  memberSportRoleByUid: Record<string, string | null>;
  onModeChange: (mode: TeamMode) => void;
  onReservedSlotsChange: (count: number) => void;
  onSelectTeam: (teamId: string | null) => void;
  onTeamPaymentModeChange: (mode: TeamPaymentMode) => void;
  onToggleSelectedTeamMember: (uid: string) => void;
  reservedSlots: number;
  resolvedTeam: Team | null;
  selectableTeamMembers: SelectableMember[];
  selectedTeamId: string | null;
  selectedTeamMemberUids: string[];
  teamMode: TeamMode;
  teamPaymentMode: TeamPaymentMode;
};

export default function TeamBookingSection({
  canUseCaptainBooking,
  captainedTeams,
  isCaptainForGame,
  memberSportRoleByUid,
  onModeChange,
  onReservedSlotsChange,
  onSelectTeam,
  onTeamPaymentModeChange,
  onToggleSelectedTeamMember,
  reservedSlots,
  resolvedTeam,
  selectableTeamMembers,
  selectedTeamId,
  selectedTeamMemberUids,
  teamMode,
  teamPaymentMode,
}: Props) {
  if (!isCaptainForGame) return null;

  const teammateLimit = Math.max(0, reservedSlots - 1);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>
        Booking Type<Text style={styles.requiredAsterisk}>*</Text>
      </Text>
      <View style={styles.chipRow}>
        {(["solo", "team"] as const).map((mode) => {
          const isActive = teamMode === mode;
          const label = mode === "solo" ? "Solo (1 slot)" : "Captain (2-5 slots)";
          return (
            <Pressable
              key={mode}
              style={({ pressed }) => [
                styles.optionChip,
                isActive && styles.optionChipActive,
                mode === "team" && !canUseCaptainBooking && { opacity: 0.45 },
                pressed && { opacity: 0.9 },
              ]}
              onPress={() => onModeChange(mode)}
            >
              <Text
                style={[
                  styles.optionChipText,
                  isActive && styles.optionChipTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {!canUseCaptainBooking ? (
        <Text style={[styles.helperTextTiny, styles.marginTop8]}>
          Captain booking unlocks after your team has at least one teammate besides you.
        </Text>
      ) : null}

      {teamMode === "team" ? (
        <>
          {captainedTeams.length > 1 ? (
            <View style={[styles.section, { marginBottom: 0, marginTop: 12 }]}>
              <Text style={styles.sectionLabel}>
                Team<Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <View style={styles.chipRow}>
                {captainedTeams.map((team) => {
                  const isActive = selectedTeamId === team.id;
                  return (
                    <Pressable
                      key={team.id}
                      style={({ pressed }) => [
                        styles.optionChip,
                        isActive && styles.optionChipActive,
                        pressed && { opacity: 0.9 },
                      ]}
                      onPress={() => onSelectTeam(team.id || null)}
                    >
                      <Text
                        style={[
                          styles.optionChipText,
                          isActive && styles.optionChipTextActive,
                        ]}
                      >
                        {team.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={[styles.section, { marginBottom: 0, marginTop: 12 }]}>
            <Text style={styles.sectionLabel}>
              Reserved Slots<Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <View style={styles.chipRow}>
              {[2, 3, 4, 5].map((count) => {
                const isActive = reservedSlots === count;
                return (
                  <Pressable
                    key={count}
                    style={({ pressed }) => [
                      styles.optionChip,
                      isActive && styles.optionChipActive,
                      pressed && { opacity: 0.9 },
                    ]}
                    onPress={() => onReservedSlotsChange(count)}
                  >
                    <Text
                      style={[
                        styles.optionChipText,
                        isActive && styles.optionChipTextActive,
                      ]}
                    >
                      {count}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.helperTextTiny, styles.marginTop8]}>
              Captain counts as 1 slot. Select {teammateLimit} teammate
              {teammateLimit === 1 ? "" : "s"} below.
            </Text>
          </View>

          {resolvedTeam ? (
            <View style={[styles.section, { marginBottom: 0, marginTop: 12 }]}>
              <Text style={styles.sectionLabel}>
                Select Players<Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              {selectableTeamMembers.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>No teammates found</Text>
                  <Text style={styles.emptySubtitle}>
                    Invite teammates to your team first.
                  </Text>
                </View>
              ) : (
                <View style={styles.memberGrid}>
                  {selectableTeamMembers.map((member) => {
                    const isActive = selectedTeamMemberUids.includes(member.uid);
                    const disabled =
                      !isActive && selectedTeamMemberUids.length >= teammateLimit;
                    return (
                      <Pressable
                        key={member.uid}
                        style={({ pressed }) => [
                          styles.memberCard,
                          isActive && styles.memberCardSelected,
                          disabled && { opacity: 0.5 },
                          pressed && { opacity: 0.9 },
                        ]}
                        onPress={() => {
                          if (disabled) return;
                          onToggleSelectedTeamMember(member.uid);
                        }}
                      >
                        <View style={styles.memberAvatar}>
                          <Text style={styles.memberAvatarText}>
                            {member.username?.charAt(0).toUpperCase() || "P"}
                          </Text>
                        </View>
                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName} numberOfLines={1}>
                            {member.username}
                          </Text>
                          <View style={styles.memberRoleBadge}>
                            <Text
                              style={styles.memberRoleText}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {memberSportRoleByUid[member.uid] || "Player"}
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              <Text style={[styles.helperTextTiny, styles.marginTop8]}>
                {teamPaymentMode === "captain_pays_all"
                  ? `Captain pays for ${reservedSlots} slots now.`
                  : "Captain pays only own slot now. Teammate slots confirm when they are paid/confirmed."}
              </Text>

              <View style={[styles.chipRow, styles.marginTop8]}>
                {(
                  [
                    {
                      key: "captain_pays_all",
                      label: `Captain pays all (${reservedSlots})`,
                    },
                    {
                      key: "captain_pays_self",
                      label: "Captain pays self only",
                    },
                  ] as const
                ).map((option) => {
                  const isActive = teamPaymentMode === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      style={({ pressed }) => [
                        styles.optionChip,
                        isActive && styles.optionChipActive,
                        pressed && { opacity: 0.9 },
                      ]}
                      onPress={() => onTeamPaymentModeChange(option.key)}
                    >
                      <Text
                        style={[
                          styles.optionChipText,
                          isActive && styles.optionChipTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

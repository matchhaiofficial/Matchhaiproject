import React from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { COLORS } from "../../../../src/theme";
import type { SkillTier } from "../../../../src/services/skillRatingService";
import styles from "../create.styles";
import GameDynamicFields from "./GameDynamicFields";
import type { WalkInSeatPlayerDraft } from "../hooks/useMatchroomCreateWalkInRoster";

type Props = {
  onSeatCountChange: (value: string) => void;
  onSelectCaptain: (team: "A" | "B", seatNumber: number) => void;
  onUpdatePlayerField: (
    seatNumber: number,
    field: keyof WalkInSeatPlayerDraft,
    value: string,
  ) => void;
  selectedGame: string | null;
  walkInBookedSeatCount: number;
  walkInMaxSeatLimit: number;
  walkInSeatCount: string;
  walkInSeatPlayers: WalkInSeatPlayerDraft[];
  walkInTeamACaptainSeatNumber: number | null;
  walkInTeamBCaptainSeatNumber: number | null;
};

const WALKIN_SKILL_TIER_OPTIONS: SkillTier[] = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "Pro",
  "Elite",
];

const isCsStyleGame = (gameKey: string | null | undefined) =>
  gameKey === "cs2" || gameKey === "cs16" || gameKey === "valorant";

function WalkInPlayerCard({
  captainSeatNumber,
  captainTeam,
  compactRank,
  onSelectCaptain,
  onUpdatePlayerField,
  player,
  seatLabel,
  selectedGame,
}: {
  captainSeatNumber: number | null;
  captainTeam: "A" | "B";
  compactRank?: boolean;
  onSelectCaptain: (team: "A" | "B", seatNumber: number) => void;
  onUpdatePlayerField: (
    seatNumber: number,
    field: keyof WalkInSeatPlayerDraft,
    value: string,
  ) => void;
  player: WalkInSeatPlayerDraft;
  seatLabel: string;
  selectedGame: string | null;
}) {
  const isCaptain = captainSeatNumber === player.seatNumber;

  return (
    <View style={[styles.walkInPlayerCard, compactRank && { marginBottom: 12 }]}>
      <View style={styles.walkInPlayerHeader}>
        <Text style={styles.walkInPlayerTitle}>{seatLabel}</Text>
        <Pressable
          style={[
            styles.optionChip,
            styles.walkInCaptainChip,
            isCaptain && styles.optionChipActive,
          ]}
          onPress={() => onSelectCaptain(captainTeam, player.seatNumber)}
        >
          <Text
            style={[
              styles.optionChipText,
              isCaptain && styles.optionChipTextActive,
            ]}
          >
            Captain
          </Text>
        </Pressable>
      </View>

      <Text style={styles.fieldLabel}>
        {compactRank ? "Name (optional)" : "User name (optional)"}
      </Text>
      <View style={styles.inputBox}>
        <TextInput
          style={styles.input}
          placeholder={compactRank ? "Name" : "Zywoo, monesy, s1mple"}
          placeholderTextColor="#757575"
          value={player.name}
          onChangeText={(value) =>
            onUpdatePlayerField(player.seatNumber, "name", value)
          }
        />
      </View>

      <Text style={styles.fieldLabel}>
        {compactRank ? "Rank (optional)" : "Skill tier (optional)"}
      </Text>
      <View style={styles.chipRow}>
        <Pressable
          style={[
            styles.optionChip,
            !player.skillTier && styles.optionChipActive,
            compactRank && { paddingHorizontal: 12 },
          ]}
          onPress={() => onUpdatePlayerField(player.seatNumber, "skillTier", "")}
        >
          <Text
            style={[
              styles.optionChipText,
              !player.skillTier && styles.optionChipTextActive,
              compactRank && { fontSize: 10 },
            ]}
          >
            Not set
          </Text>
        </Pressable>
        {WALKIN_SKILL_TIER_OPTIONS.map((tier) => {
          const isSelected = player.skillTier === tier;
          return (
            <Pressable
              key={`${player.seatNumber}-${tier}`}
              style={[
                styles.optionChip,
                isSelected && styles.optionChipActive,
                compactRank && { paddingHorizontal: 12 },
              ]}
              onPress={() =>
                onUpdatePlayerField(player.seatNumber, "skillTier", tier)
              }
            >
              <Text
                style={[
                  styles.optionChipText,
                  isSelected && styles.optionChipTextActive,
                  compactRank && { fontSize: 10 },
                ]}
              >
                {tier}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {!compactRank && selectedGame ? (
        <GameDynamicFields
          formData={player}
          gameKey={selectedGame}
          scope="player"
          onChange={(field, value) =>
            onUpdatePlayerField(
              player.seatNumber,
              field as keyof WalkInSeatPlayerDraft,
              value,
            )
          }
        />
      ) : null}
    </View>
  );
}

export default function WalkInRosterEditor({
  onSeatCountChange,
  onSelectCaptain,
  onUpdatePlayerField,
  selectedGame,
  walkInBookedSeatCount,
  walkInMaxSeatLimit,
  walkInSeatCount,
  walkInSeatPlayers,
  walkInTeamACaptainSeatNumber,
  walkInTeamBCaptainSeatNumber,
}: Props) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>
        Walk-in Setup<Text style={styles.requiredAsterisk}>*</Text>
      </Text>
      <View style={styles.tabContainer}>
        <View style={styles.flex1}>
          <Text style={styles.fieldLabel}>
            Walk-in players available<Text style={styles.requiredAsterisk}>*</Text>
          </Text>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#757575"
              value={walkInSeatCount}
              onChangeText={onSeatCountChange}
            />
          </View>
          <Text style={styles.helperTextTiny}>
            Max players for this format: {walkInMaxSeatLimit}
          </Text>
        </View>
      </View>

      {walkInBookedSeatCount > 0 ? (
        <View style={styles.walkInRosterWrap}>
          {isCsStyleGame(selectedGame) ? (
            <View style={{ flexDirection: "column", gap: 16 }}>
              <View style={{ width: "100%" }}>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: COLORS.accent, marginBottom: 8 },
                  ]}
                >
                  Team A
                </Text>
                {walkInSeatPlayers
                  .slice(0, Math.ceil(walkInBookedSeatCount / 2))
                  .map((player, idx) => (
                  <WalkInPlayerCard
                    key={`walkin-seat-player-${player.seatNumber}`}
                    captainSeatNumber={walkInTeamACaptainSeatNumber}
                    captainTeam="A"
                    compactRank
                    onSelectCaptain={onSelectCaptain}
                    onUpdatePlayerField={onUpdatePlayerField}
                    player={player}
                    seatLabel={`Player ${idx + 1}`}
                    selectedGame={selectedGame}
                  />
                ))}
              </View>

              <View style={{ width: "100%" }}>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: COLORS.error, marginBottom: 8 },
                  ]}
                >
                  Team B
                </Text>
                {walkInSeatPlayers
                  .slice(Math.ceil(walkInBookedSeatCount / 2), walkInBookedSeatCount)
                  .map((player, idx) => (
                  <WalkInPlayerCard
                    key={`walkin-seat-player-${player.seatNumber}`}
                    captainSeatNumber={walkInTeamBCaptainSeatNumber}
                    captainTeam="B"
                    compactRank
                    onSelectCaptain={onSelectCaptain}
                    onUpdatePlayerField={onUpdatePlayerField}
                    player={player}
                    seatLabel={`Player ${idx + 1}`}
                    selectedGame={selectedGame}
                  />
                ))}
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.fieldLabel}>
                Walk-in Player Details (optional)
              </Text>
              {walkInSeatPlayers.slice(0, walkInBookedSeatCount).map((player) => (
                <WalkInPlayerCard
                  key={`walkin-seat-player-${player.seatNumber}`}
                  captainSeatNumber={walkInTeamACaptainSeatNumber}
                  captainTeam="A"
                  onSelectCaptain={onSelectCaptain}
                  onUpdatePlayerField={onUpdatePlayerField}
                  player={player}
                  seatLabel={`Player ${player.seatNumber}`}
                  selectedGame={selectedGame}
                />
              ))}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

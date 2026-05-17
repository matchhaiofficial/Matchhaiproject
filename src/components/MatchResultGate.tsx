import { useMutation, useQuery } from "convex/react";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../hooks/useToast";
import { COLORS, FONTS, RADII, SPACING, TEXT_SIZES } from "../theme";
import { AppButton } from "./AppPrimitives";
import { AppBottomSheet, AppModalBody, AppModalFooter, AppModalHeader } from "./AppModalPrimitives";
import { AppIcon } from "./AppIcon";

type Winner = "team1" | "team2";

function getTeamNames(room: any) {
  return {
    team1: room?.teamAName || room?.team1Name || "Team 1",
    team2: room?.teamBName || room?.team2Name || "Team 2",
  };
}

export default function MatchResultGate() {
  const { user, loading } = useAuth();
  const { showToast } = useToast();
  const [selectedWinner, setSelectedWinner] = useState<Winner | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const userId = !loading && user?._id ? String(user._id) : null;
  const pending = useQuery(
    api.matchrooms.getPendingResultForUser,
    userId ? { userId } : "skip",
  ) as any;
  const submitCaptainReport = useMutation(api.matchrooms.submitCaptainReport);
  const submitParticipantVote = useMutation(api.matchrooms.submitParticipantVote);

  const room = pending?.room;
  const phase = pending?.phase as "captain" | "participant" | undefined;
  const teamNames = useMemo(() => getTeamNames(room), [room]);
  const visible = Boolean(room && phase);

  const handleSubmit = async () => {
    if (!selectedWinner || !room?._id || !userId || !phase) return;
    setSubmitting(true);
    try {
      if (phase === "captain") {
        const result: any = await submitCaptainReport({
          matchroomId: room._id as Id<"matchrooms">,
          captainUid: userId,
          winner: selectedWinner,
        });
        if (result?.status === "admin_review") {
          showToast({
            type: "error",
            title: "Result needs review",
            message: "This matchroom cannot be verified automatically.",
          });
          return;
        }
      } else {
        const result: any = await submitParticipantVote({
          matchroomId: room._id as Id<"matchrooms">,
          participantUid: userId,
          vote: selectedWinner,
        });
        if (result?.status === "admin_review") {
          showToast({
            type: "error",
            title: "Result needs review",
            message: "This matchroom cannot be verified automatically.",
          });
          return;
        }
      }
      setSelectedWinner(null);
      showToast({
        type: "success",
        title: "Result submitted",
        message: phase === "captain" ? "Waiting for verification." : "Your vote was recorded.",
      });
    } catch (error: any) {
      showToast({
        type: "error",
        title: "Submit failed",
        message: error?.message || "Could not submit the match result.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  const title = phase === "captain" ? "Submit Match Result" : "Resolve Match Result";
  const subtitle =
    phase === "captain"
      ? "Captains must submit before the lobby can finalize."
      : "Captains disagreed. All players must vote to resolve the result.";

  return (
    <AppBottomSheet visible onClose={() => {}} dismissDisabled>
      <AppModalHeader title={title} subtitle={room?.title} />
      <AppModalBody scroll contentContainerStyle={styles.body}>
        <View style={styles.notice}>
          <AppIcon name="verified" size={22} color={COLORS.warning} />
          <Text style={styles.noticeText}>{subtitle}</Text>
        </View>

        <Text style={styles.label}>Who won?</Text>
        {(["team1", "team2"] as Winner[]).map((winner) => {
          const selected = selectedWinner === winner;
          return (
            <AppButton
              key={winner}
              variant={selected ? "primary" : "secondary"}
              size="lg"
              onPress={() => setSelectedWinner(winner)}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <View style={styles.optionContent}>
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {winner === "team1" ? teamNames.team1 : teamNames.team2}
                </Text>
                {selected ? <AppIcon name="check-circle" size={20} color="#FFF" /> : null}
              </View>
            </AppButton>
          );
        })}
      </AppModalBody>
      <AppModalFooter>
        <AppButton
          size="lg"
          onPress={handleSubmit}
          disabled={!selectedWinner || submitting}
          style={styles.submitButton}
        >
          {submitting ? <ActivityIndicator color="#FFF" /> : "Submit Result"}
        </AppButton>
      </AppModalFooter>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: SPACING.md,
  },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.warning + "55",
    backgroundColor: COLORS.warning + "14",
  },
  noticeText: {
    flex: 1,
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.body,
    lineHeight: 22,
  },
  label: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.caption,
    textTransform: "uppercase",
  },
  option: {
    width: "100%",
  },
  optionSelected: {
    borderColor: COLORS.accent,
  },
  optionContent: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionText: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.body,
  },
  optionTextSelected: {
    color: "#FFF",
  },
  submitButton: {
    width: "100%",
  },
});

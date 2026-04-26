import React, { useMemo, useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";

import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import GameActivationPromptModal from "../components/GameActivationPromptModal";
import SkillAssessmentModal from "../components/SkillAssessmentModal";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../hooks/useToast";
import { convex } from "../lib/convex";
import {
  Matchroom,
  requestJoinMatchroom,
  isUserInActiveMatchroom,
  prepareProfileForMatchParticipation,
  getEnablePatchForGame,
} from "../services/convex/matchService";
import { GameKey, GameSkillScore } from "../services/skillRatingService";
import { getUserProfile, getUserSportRoleLabel } from "../services/userService";
import { hasVerifiedEmail, showEmailVerificationRequiredAlert } from "../utils/emailVerificationGate";
import { Perf, PerfScope } from "../utils/perfInstrumentation";

type StartJoinArgs = {
  room: Matchroom;
  team?: string;
  slotId?: string;
  onJoined?: () => Promise<void> | void;
  onRequested?: () => void;
};

type PendingJoinState = StartJoinArgs & {
  gameKey: GameKey;
  profile: any;
  gameLabel: string;
};

export function useMatchroomJoinFlow() {
  const router = useRouter();
  const { user, authUser } = useAuth();
  const { showToast } = useToast();
  const [pendingJoin, setPendingJoin] = useState<PendingJoinState | null>(null);
  const [showActivationPrompt, setShowActivationPrompt] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);
  const [activating, setActivating] = useState(false);

  const performJoin = async (args: StartJoinArgs, profile: any) => {
    if (!user) return;

    const gameplayRole = getUserSportRoleLabel(profile, args.room.game) || "Player";
    const username = profile?.username || user.fullName || "Player";
    const result = await Perf.measureAsync(
      "Matchroom.RequestJoin",
      () =>
        requestJoinMatchroom(
          args.room,
          { uid: user._id, username },
          gameplayRole === "AW Per" ? "AWPer" : gameplayRole === "In-Game Leader (IGL)" ? "IGL" : gameplayRole,
          args.team || "Any",
          args.slotId,
        ),
      {
        actionKey: "matchroom_request_join",
        meta: {
          roomId: args.room.id || args.room._id,
          game: args.room.game,
          team: args.team || "Any",
          slotId: args.slotId || null,
        },
      },
    );

    if (!result.ok) {
      showToast({
        type: "error",
        title: "Join failed",
        message: result.message || "Failed to send request.",
      });
      return;
    }

    const paymentIntentId = String((result.data as any)?.intentId || "");
    if ((result.data as any)?.paymentRequired && paymentIntentId) {
      Perf.markNav({
        routeKey: "/matchrooms/book/pay/[intentId]",
        meta: {
          source: "matchroom_request_join",
          roomId: args.room.id || args.room._id,
        },
      });
      router.push({
        pathname: "/matchrooms/book/pay/[intentId]",
        params: { intentId: paymentIntentId },
      } as any);
      return;
    }

    const joinedImmediately = Boolean((result.data as any)?.joined);
    const alreadyPending = Boolean((result.data as any)?.alreadyPending);
    showToast({
      type: "success",
      title: joinedImmediately ? "Joined" : alreadyPending ? "Request Pending" : "Request Sent",
      message: result.message || "Your request has been recorded.",
    });

    if (joinedImmediately) {
      await args.onJoined?.();
    } else {
      args.onRequested?.();
    }
  };

  const continueWithProfile = async (args: StartJoinArgs, profile: any, gameKey: GameKey | null) => {
    if (!user) return;

    if (!gameKey) {
      await performJoin(args, profile);
      return;
    }

    const preparation = await prepareProfileForMatchParticipation(user._id, profile, gameKey);

    if (preparation.status === "needs_activation") {
      setPendingJoin({
        ...args,
        gameKey: preparation.gameKey,
        profile: preparation.profile,
        gameLabel: preparation.gameLabel,
      });
      setShowActivationPrompt(true);
      return;
    }

    if (preparation.status === "needs_assessment") {
      setPendingJoin({
        ...args,
        gameKey: preparation.gameKey,
        profile: preparation.profile,
        gameLabel: preparation.gameLabel,
      });
      setShowAssessment(true);
      return;
    }

    await performJoin(args, preparation.profile);
  };

  const startJoin = async (args: StartJoinArgs) => {
    const cid = Perf.newCid();
    return PerfScope.run(cid, () =>
      Perf.measureAsync("Action.matchroom_request_join", async () => {
        if (!user) {
          showToast({
            type: "warning",
            title: "Login Required",
            message: "Please login to join matchrooms.",
          });
          return;
        }

        if (!hasVerifiedEmail(authUser)) {
          showEmailVerificationRequiredAlert();
          return;
        }

        const roomId = args.room.id || args.room._id;
        const busyCheck = await Perf.measureAsync("Matchroom.CheckBusy", () =>
          isUserInActiveMatchroom(user._id, args.room as any),
        );
        if (busyCheck.inRoom && busyCheck.roomId !== roomId) {
          showToast({
            type: "warning",
            title: "Already Busy",
            message: busyCheck.message || "You are already active in another matchroom.",
          });
          return;
        }

        const profileResult = await Perf.measureAsync("Matchroom.LoadProfile", () =>
          getUserProfile(user._id as Id<"users">),
        );
        if (!profileResult.ok) {
          showToast({
            type: "error",
            title: "Profile unavailable",
            message: profileResult.message || "Could not load your profile.",
          });
          return;
        }

        const preparation = await Perf.measureAsync("Matchroom.PrepareProfile", () =>
          prepareProfileForMatchParticipation(user._id, profileResult.data, args.room.game),
        );

        await continueWithProfile(args, profileResult.data, preparation.gameKey);
      }, {
        cid,
        actionKey: "matchroom_request_join",
        meta: {
          roomId: args.room.id || args.room._id,
          game: args.room.game,
        },
      }),
    );
  };

  const handleEnableGame = async () => {
    if (!user || !pendingJoin) return;

    setActivating(true);
    try {
      await convex.mutation(api.users.updateGamePreferences, {
        userId: user._id as Id<"users">,
        updates: getEnablePatchForGame(pendingJoin.gameKey),
      });

      const nextProfile = {
        ...pendingJoin.profile,
        ...getEnablePatchForGame(pendingJoin.gameKey),
      };

      setShowActivationPrompt(false);
      await continueWithProfile(pendingJoin, nextProfile, pendingJoin.gameKey);
    } catch (error: any) {
      showToast({
        type: "error",
        title: "Enable failed",
        message: error?.message || "Failed to enable game in your profile.",
      });
    } finally {
      setActivating(false);
    }
  };

  const handleAssessmentSuccess = async (rating: number, tier: string) => {
    if (!pendingJoin || !user) return;

    const newScore: GameSkillScore = {
      rating,
      tier: tier as any,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      initialSource: "questionnaire",
      initialRating: rating,
      lastMatchDate: null,
      lastUpdated: Date.now(),
    };

    setShowAssessment(false);
    const nextProfile = {
      ...pendingJoin.profile,
      skillScores: { ...(pendingJoin.profile.skillScores || {}), [pendingJoin.gameKey]: newScore },
    };
    await continueWithProfile(pendingJoin, nextProfile, pendingJoin.gameKey);
  };

  const setupModal = useMemo(
    () => (
      <>
        <GameActivationPromptModal
          visible={showActivationPrompt}
          gameLabel={pendingJoin?.gameLabel || "Game"}
          loading={activating}
          onClose={() => {
            setShowActivationPrompt(false);
            setPendingJoin(null);
          }}
          onConfirm={handleEnableGame}
        />
        <SkillAssessmentModal
          visible={showAssessment}
          onClose={() => {
            setShowAssessment(false);
            setPendingJoin(null);
          }}
          gameKey={pendingJoin?.gameKey || "cs2"}
          userId={user?._id || ""}
          onSuccess={handleAssessmentSuccess}
        />
      </>
    ),
    [activating, pendingJoin, showActivationPrompt, showAssessment, user?._id],
  );

  return {
    startJoin,
    setupModal,
  };
}

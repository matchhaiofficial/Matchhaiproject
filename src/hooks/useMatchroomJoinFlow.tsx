import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { isUserFullyVerified, showKycVerificationRequiredAlert } from "../utils/verificationGate";
import { Perf, PerfScope } from "../utils/perfInstrumentation";
import { getMatchroomJoinAvailability } from "../utils/matchroomLifecycle";

type StartJoinArgs = {
  room: Matchroom;
  team?: string;
  slotId?: string;
  onJoined?: () => Promise<void> | void;
  onRequested?: () => void;
};

type JoinFlowOutcome =
  | "requested"
  | "joined"
  | "payment"
  | "setup_required"
  | "blocked"
  | "failed";

type PendingJoinState = StartJoinArgs & {
  gameKey: GameKey;
  profile: any;
  gameLabel: string;
};

export function useMatchroomJoinFlow() {
  const router = useRouter();
  const { user, authUser } = useAuth();
  const { showToast } = useToast();

  // ✅ FIX: Use refs so callbacks never get new references due to showToast/router instability
  const showToastRef = useRef(showToast);
  const routerRef = useRef(router);
  showToastRef.current = showToast;
  routerRef.current = router;

  const [pendingJoin, setPendingJoin] = useState<PendingJoinState | null>(null);
  const [showActivationPrompt, setShowActivationPrompt] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);
  const [activating, setActivating] = useState(false);

  // ✅ FIX: Only `user` in deps — showToast/router accessed via stable refs
  const performJoin = useCallback(async (args: StartJoinArgs, profile: any): Promise<JoinFlowOutcome> => {
    if (!user) return "blocked";
    const gameplayRole = getUserSportRoleLabel(profile, args.room.game) || "Player";
    const username = profile?.username || user.fullName || "Player";
    const result = await Perf.measureAsync(
      "Matchroom.RequestJoin",
      () => requestJoinMatchroom(
        args.room,
        { uid: user._id, username },
        gameplayRole === "AW Per" ? "AWPer" : gameplayRole === "In-Game Leader (IGL)" ? "IGL" : gameplayRole,
        args.team || "Any",
        args.slotId,
      ),
      { actionKey: "matchroom_request_join", meta: { roomId: args.room.id || args.room._id, game: args.room.game, team: args.team || "Any", slotId: args.slotId || null } },
    );

    if (!result.ok) {
      showToastRef.current({ type: "error", title: "Join failed", message: result.message || "Failed to send request." });
      return "failed";
    }

    const paymentIntentId = String((result.data as any)?.intentId || "");
    if ((result.data as any)?.paymentRequired && paymentIntentId) {
      Perf.markNav({ routeKey: "/matchrooms/book/pay/[intentId]", meta: { source: "matchroom_request_join", roomId: args.room.id || args.room._id } });
      routerRef.current.push({ pathname: "/matchrooms/book/pay/[intentId]", params: { intentId: paymentIntentId } } as any);
      showToastRef.current({ type: "info", title: "Payment required", message: result.message || "Complete payment to confirm this slot." });
      return "payment";
    }

    const joinedImmediately = Boolean((result.data as any)?.joined);
    const alreadyPending = Boolean((result.data as any)?.alreadyPending);
    showToastRef.current({
      type: "success",
      title: joinedImmediately ? "Joined" : alreadyPending ? "Request Pending" : "Request Sent",
      message: result.message || "Your request has been recorded.",
    });

    if (joinedImmediately) {
      await args.onJoined?.();
      return "joined";
    } else {
      args.onRequested?.();
      return "requested";
    }
  }, [user]); // ✅ Only user — no showToast, no router

  const continueWithProfile = useCallback(async (args: StartJoinArgs, profile: any, gameKey: GameKey | null): Promise<JoinFlowOutcome> => {
    if (!user) return "blocked";

    if (!gameKey) {
      return performJoin(args, profile);
    }

    const preparation = await prepareProfileForMatchParticipation(user._id, profile, gameKey);

    if (preparation.status === "needs_activation") {
      setPendingJoin({ ...args, gameKey: preparation.gameKey, profile: preparation.profile, gameLabel: preparation.gameLabel });
      setShowActivationPrompt(true);
      showToastRef.current({ type: "warning", title: "Game setup required", message: `Enable ${preparation.gameLabel} before joining this matchroom.` });
      return "setup_required";
    }

    if (preparation.status === "needs_assessment") {
      setPendingJoin({ ...args, gameKey: preparation.gameKey, profile: preparation.profile, gameLabel: preparation.gameLabel });
      setShowAssessment(true);
      showToastRef.current({ type: "warning", title: "Skill check required", message: `Complete your ${preparation.gameLabel} skill check before joining.` });
      return "setup_required";
    }

    return performJoin(args, preparation.profile);
  }, [user, performJoin]); // ✅ Stable since performJoin is now stable
  const isStartingRef = useRef(false);

  const startJoin = useCallback(async (args: StartJoinArgs): Promise<JoinFlowOutcome> => {
    if (isStartingRef.current) return "blocked";
    isStartingRef.current = true;
    try {
      const cid = Perf.newCid();
      return PerfScope.run(cid, () =>
        Perf.measureAsync("Action.matchroom_request_join", async () => {
          if (!user) {
            showToastRef.current({ type: "warning", title: "Login Required", message: "Please login to join matchrooms." });
            return "blocked";
          }
          if (!isUserFullyVerified(authUser, user)) {
            showToastRef.current({ type: "warning", title: "Verify your identity", message: "Please complete CNIC & face verification to unlock MatchHai features." });
            showKycVerificationRequiredAlert();
            return "blocked";
          }

          const joinAvailability = getMatchroomJoinAvailability(args.room);
          if (!joinAvailability.available) {
            showToastRef.current({
              type: "warning",
              title:
                joinAvailability.code === "full"
                  ? "Matchroom full"
                  : joinAvailability.code === "locked"
                    ? "Matchroom locked"
                    : "Cannot join matchroom",
              message: joinAvailability.message,
            });
            return "blocked";
          }

          const roomId = args.room.id || args.room._id;
          const busyCheck = await Perf.measureAsync("Matchroom.CheckBusy", () =>
            isUserInActiveMatchroom(user._id, args.room as any),
          );
          if (busyCheck.inRoom && busyCheck.roomId !== roomId) {
            showToastRef.current({ type: "warning", title: "Already Busy", message: busyCheck.message || "You are already active in another matchroom." });
            return "blocked";
          }

          const profileResult = await Perf.measureAsync("Matchroom.LoadProfile", () =>
            getUserProfile(user._id as Id<"users">),
          );
          if (!profileResult.ok) {
            showToastRef.current({ type: "error", title: "Profile unavailable", message: profileResult.message || "Could not load your profile." });
            return "failed";
          }

          const preparation = await Perf.measureAsync("Matchroom.PrepareProfile", () =>
            prepareProfileForMatchParticipation(user._id, profileResult.data, args.room.game),
          );

          return continueWithProfile(args, profileResult.data, preparation.gameKey);
        }, { cid, actionKey: "matchroom_request_join", meta: { roomId: args.room.id || args.room._id, game: args.room.game } }),
      );
    } catch (error: any) {
      showToastRef.current({ type: "error", title: "Join failed", message: error?.message || "Unable to request this slot." });
      return "failed";
    } finally {
      isStartingRef.current = false;
    }
  }, [user, authUser, continueWithProfile]); // ✅ No showToast — accessed via ref

  const handleEnableGame = useCallback(async () => {
    if (!user || !pendingJoin) return;
    setActivating(true);
    try {
      await convex.mutation(api.users.updateGamePreferences, {
        userId: user._id as Id<"users">,
        updates: getEnablePatchForGame(pendingJoin.gameKey),
      });
      const nextProfile = { ...pendingJoin.profile, ...getEnablePatchForGame(pendingJoin.gameKey) };
      setShowActivationPrompt(false);
      await continueWithProfile(pendingJoin, nextProfile, pendingJoin.gameKey);
    } catch (error: any) {
      showToastRef.current({ type: "error", title: "Enable failed", message: error?.message || "Failed to enable game in your profile." });
    } finally {
      setActivating(false);
    }
  }, [user, pendingJoin, continueWithProfile]); // ✅ No showToast

  const handleAssessmentSuccess = useCallback(async (rating: number, tier: string) => {
    if (!pendingJoin || !user) return;
    const newScore: GameSkillScore = {
      rating, tier: tier as any, matchesPlayed: 0, wins: 0, losses: 0,
      initialSource: "questionnaire", initialRating: rating,
      lastMatchDate: null, lastUpdated: Date.now(),
    };
    setShowAssessment(false);
    const nextProfile = {
      ...pendingJoin.profile,
      skillScores: { ...(pendingJoin.profile.skillScores || {}), [pendingJoin.gameKey]: newScore },
    };
    await continueWithProfile(pendingJoin, nextProfile, pendingJoin.gameKey);
  }, [user, pendingJoin, continueWithProfile]);

  const setupModal = useMemo(
    () => (
      <>
        <GameActivationPromptModal
          visible={showActivationPrompt}
          gameLabel={pendingJoin?.gameLabel || "Game"}
          loading={activating}
          onClose={() => { setShowActivationPrompt(false); setPendingJoin(null); }}
          onConfirm={handleEnableGame}
        />
        <SkillAssessmentModal
          visible={showAssessment}
          onClose={() => { setShowAssessment(false); setPendingJoin(null); }}
          gameKey={pendingJoin?.gameKey || "cs2"}
          userId={user?._id || ""}
          onSuccess={handleAssessmentSuccess}
        />
      </>
    ),
    [activating, pendingJoin, showActivationPrompt, showAssessment, user?._id, handleEnableGame, handleAssessmentSuccess],
  );

  return { startJoin, setupModal };
}

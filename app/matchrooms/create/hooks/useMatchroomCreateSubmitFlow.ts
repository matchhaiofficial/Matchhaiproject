import { router } from "expo-router";
import { useAction } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { convex } from "../../../../src/lib/convex";
import { createBookingRequest } from "../../../../src/services/bookingRequestService";
import {
  createMatchroom,
  getEnablePatchForGame,
  prepareProfileForMatchParticipation,
} from "../../../../src/services/convex/matchService";
import { createZoneWalkInMatchroom } from "../../../../src/services/convex/zoneAdminBookingService";
import { GameSkillScore, type SkillTier } from "../../../../src/services/skillRatingService";
import type { Team } from "../../../../src/services/convex/teamService";
import type { UserProfile } from "../../../../src/services/userService";
import { getUserProfile } from "../../../../src/services/userService";
import { FEATURE_READINESS } from "../../../../src/config/featureReadiness";
import { useToast } from "../../../../src/hooks/useToast";
import Logger from "../../../../src/utils/logger";
import {
  formatPakistaniPhone,
  isValidPakistaniPhone,
  normalizePakistaniPhone,
} from "../../../../src/utils/phoneUtils";
import {
  hasVerifiedEmail,
  showEmailVerificationRequiredAlert,
} from "../../../../src/utils/emailVerificationGate";
import {
  buildAssignedTeamMembers,
  buildBookingRequestPayload,
  buildMatchroomPayload,
  buildZoneWalkInPayload,
} from "../utils/matchroomCreatePayloads";

type TeamMode = "solo" | "team";
type TeamPaymentMode = "captain_pays_all" | "captain_pays_self";
type WalkInPaymentMode = "venue_pay" | "guest_pay";
type WalkInSeriesType = "BO1" | "BO3" | "BO5";

type FormDataShape = {
  battingOrder: string;
  battingStyle: string;
  bowlingOrder: string;
  bowlingStyle: string;
  composition: string;
  date: string;
  description: string;
  favouriteClub: string;
  formation: string;
  format: string;
  locationMode: "zone" | "broadcast";
  maxPlayers: number;
  overs: string;
  playstyle: string;
  pricePerPlayer: number;
  rankRequirement: string;
  selectedMaps: string[];
  seriesType: string;
  sidePreference: string;
  skillLevel: string;
  tekkenCharacters: string[];
  time: string;
  title: string;
};

type Branch = { id: string; label: string } | null;
export type MatchroomCreateSubmitFeedback = {
  message: string;
  title: string;
  type: "success" | "error" | "warning" | "info";
};

type Params = {
  adminBranches: Array<{ id: string; label: string }>;
  adminZone: any;
  authUser: any;
  broadcastAreas: string[];
  captainSeatsPaid: number;
  effectivePriceValue: number;
  formData: FormDataShape;
  hostRole: string | null;
  hostSkillAnswers: Record<string, unknown>;
  hostSkillScore: number | null;
  hostSkillTier: SkillTier | null;
  isZoneWalkInAdmin: boolean;
  locationMode: "zone" | "broadcast";
  memberSportRoleByUid: Record<string, string | null>;
  resolvedTeam: Team | null;
  reservedSlots: number;
  duration: number;
  selectedAdminBranch: Branch;
  selectedGame: string | null;
  selectedTeamId: string | null;
  selectedTeamMemberUids: string[];
  selectedZoneId: string | null;
  selectedZoneName: string | null;
  selectableTeamMembers: Array<{ uid: string; username?: string }>;
  seriesType: string;
  setSubmitFeedback: React.Dispatch<React.SetStateAction<MatchroomCreateSubmitFeedback | null>>;
  setFormData: React.Dispatch<React.SetStateAction<FormDataShape>>;
  setHostSkillScore: React.Dispatch<React.SetStateAction<number | null>>;
  setHostSkillTier: React.Dispatch<React.SetStateAction<SkillTier | null>>;
  setSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  teamMode: TeamMode;
  teamPaymentMode: TeamPaymentMode;
  teams: Team[];
  user: any;
  userProfile: UserProfile | null;
  walkInBranchId: string | null;
  walkInPaymentMode: WalkInPaymentMode;
  walkInSeatCount: string;
  walkInSeatPlayers: any[];
  walkInTeamACaptainSeatNumber: number | null;
  walkInTeamBCaptainSeatNumber: number | null;
};

const WALKIN_SERIES_OPTIONS = ["BO1", "BO3", "BO5"] as const;

function generateMatchCode(zoneName?: string | null) {
  const prefix = zoneName
    ? zoneName.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase()
    : "MH";
  const random = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${random}`;
}

export function useMatchroomCreateSubmitFlow(params: Params) {
  const {
    adminBranches,
    adminZone,
    authUser,
    broadcastAreas,
    captainSeatsPaid,
    effectivePriceValue,
    formData,
    hostRole,
    hostSkillAnswers,
    hostSkillScore,
    hostSkillTier,
    isZoneWalkInAdmin,
    locationMode,
    memberSportRoleByUid,
    resolvedTeam,
    reservedSlots,
    duration,
    selectedAdminBranch,
    selectedGame,
    selectedTeamId,
    selectedTeamMemberUids,
    selectedZoneId,
    selectedZoneName,
    selectableTeamMembers,
    seriesType,
    setSubmitFeedback,
    setFormData,
    setHostSkillScore,
    setHostSkillTier,
    setSubmitting,
    setUserProfile,
    teamMode,
    teamPaymentMode,
    teams,
    user,
    userProfile,
    walkInBranchId,
    walkInPaymentMode,
    walkInSeatCount,
    walkInSeatPlayers,
    walkInTeamACaptainSeatNumber,
    walkInTeamBCaptainSeatNumber,
  } = params;

  const [activating, setActivating] = useState(false);
  const [pendingParticipationProfile, setPendingParticipationProfile] =
    useState<UserProfile | null>(null);
  const [showActivationPrompt, setShowActivationPrompt] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);
  const [showEasypaisaPhonePrompt, setShowEasypaisaPhonePrompt] =
    useState(false);
  const [easypaisaCheckoutPhone, setEasypaisaCheckoutPhone] = useState("");
  const [easypaisaPaymentAmount, setEasypaisaPaymentAmount] = useState(0);
  const [startingEasypaisaPayment, setStartingEasypaisaPayment] =
    useState(false);
  const { showToast } = useToast();
  const startCheckout = useAction((api as any).easypaisa.startCheckout);

  const notify = useCallback(
    (feedback: MatchroomCreateSubmitFeedback) => {
      setSubmitFeedback(feedback);
      showToast(feedback);
    },
    [setSubmitFeedback, showToast],
  );

  useEffect(() => {
    if (!showEasypaisaPhonePrompt) {
      setEasypaisaCheckoutPhone(
        user?.phone ? formatPakistaniPhone(String(user.phone)) : "",
      );
    }
  }, [showEasypaisaPhonePrompt, user?.phone]);

  const promptPaymentChoice = useCallback(async (amountDue: number) => {
    return await new Promise<"paid" | "cancel" | "easypaisa">((resolve) => {
      Alert.alert(
        "Wallet Payment Required",
        `To continue, pay from your MatchHai wallet.\n\nAmount: PKR ${amountDue}\n\nPay now with Easypaisa, or use your wallet balance if you already have funds.\n\n${FEATURE_READINESS.payments.card.walletOnlyInfo}`,
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve("cancel") },
          { text: "Pay Now", onPress: () => resolve("easypaisa") },
          { text: "Pay with Wallet", onPress: () => resolve("paid") },
        ],
      );
    });
  }, []);

  const handleEasypaisaPhoneChange = useCallback((value: string) => {
    setEasypaisaCheckoutPhone(formatPakistaniPhone(value));
  }, []);

  const closeEasypaisaPhonePrompt = useCallback(() => {
    if (!startingEasypaisaPayment) {
      setShowEasypaisaPhonePrompt(false);
    }
  }, [startingEasypaisaPayment]);

  const confirmEasypaisaPayment = useCallback(async () => {
    if (!user?._id || startingEasypaisaPayment) return;
    const amount = Math.max(0, Math.ceil(Number(easypaisaPaymentAmount || 0)));
    if (amount <= 0) {
      notify({
        message: "Unable to resolve the payment amount.",
        title: "Payment unavailable",
        type: "error",
      });
      return;
    }
    if (!isValidPakistaniPhone(easypaisaCheckoutPhone)) {
      notify({
        message: "Enter a valid Pakistani mobile number for Easypaisa.",
        title: "Invalid number",
        type: "warning",
      });
      return;
    }

    setStartingEasypaisaPayment(true);
    try {
      const normalizedPhone = normalizePakistaniPhone(easypaisaCheckoutPhone);
      const checkout: any = await startCheckout({
        kind: "wallet_topup",
        amount,
        userId: user._id as Id<"users">,
        phone: normalizedPhone.phoneE164 || easypaisaCheckoutPhone,
        transactionType: "MA",
      });

      setShowEasypaisaPhonePrompt(false);
      const instruction =
        checkout.transactionType === "OTC"
          ? `Use token ${checkout.paymentToken || "generated by Easypaisa"} before it expires. MatchHai will keep checking the status.`
          : "Approve the payment in your Easypaisa app or mobile account flow. MatchHai will keep checking the status.";
      notify({
        message: instruction,
        title: "Payment started",
        type: "info",
      });
    } catch (error: any) {
      Logger.error("CreateMatchroom", "Failed to start Easypaisa payment", error);
      notify({
        message: error?.message || "Could not start the Easypaisa payment.",
        title: "Payment failed",
        type: "error",
      });
    } finally {
      setStartingEasypaisaPayment(false);
    }
  }, [
    easypaisaCheckoutPhone,
    easypaisaPaymentAmount,
    notify,
    startCheckout,
    startingEasypaisaPayment,
    user?._id,
  ]);

  const payWithWallet = useCallback(
    async (amountDue: number) => {
      if (!user?._id) {
        return { ok: false as const, message: "Not authenticated." };
      }

      const amount = Math.max(0, Math.ceil(Number(amountDue || 0)));
      if (amount <= 0) return { ok: true as const };

      try {
        await convex.mutation(api.wallet.deductFunds, {
          amount,
          metadata: {
            flow: "matchroom_create",
          },
          reference: "matchroom_create",
          source: "matchroom_create",
          userId: user._id as Id<"users">,
        });
        return { ok: true as const };
      } catch (error: any) {
        if (error?.message?.includes("Insufficient")) {
          return {
            message: "Insufficient wallet balance. Please add funds from Wallet.",
            ok: false as const,
          };
        }
        return {
          message: "Unable to complete wallet payment.",
          ok: false as const,
        };
      }
    },
    [user?._id],
  );

  const submit = useCallback(async () => {
    if (!user) return;
    if (!hasVerifiedEmail(authUser) && !isZoneWalkInAdmin) {
      showEmailVerificationRequiredAlert();
      return;
    }

    if (isZoneWalkInAdmin) {
      setSubmitting(true);
      try {
        if (!adminZone?.id) {
          showToast({
            message: "Unable to resolve zone context.",
            title: "Zone not found",
            type: "error",
          });
          return;
        }

        const walkInSeries = WALKIN_SERIES_OPTIONS.includes(
          seriesType as WalkInSeriesType,
        )
          ? (seriesType as WalkInSeriesType)
          : "BO1";
        const pricePerPlayer = Math.max(
          0,
          Math.ceil(Number(formData.pricePerPlayer || 0)),
        );
        const branch =
          selectedAdminBranch ||
          (adminBranches.length === 1 ? adminBranches[0] : null);
        const walkInPayload = buildZoneWalkInPayload({
          adminName: user.fullName || adminZone.ownerFullName || "Zone Admin",
          adminUid: user._id,
          branch,
          formData,
          gameKey: selectedGame || "unknown",
          pricePerPlayer,
          seatCountInput: walkInSeatCount,
          seriesType: walkInSeries,
          userId: user._id,
          userName: user.fullName || "Zone Admin",
          walkInPaymentMode,
          walkInSeatPlayers,
          walkInSeed: Date.now(),
          walkInTeamACaptainSeatNumber,
          walkInTeamBCaptainSeatNumber,
          zoneId: adminZone.id,
          zoneOwnerUid: adminZone.ownerUid || user._id,
        });

        const result = await createZoneWalkInMatchroom(walkInPayload as any);
        if (!result.ok) {
          showToast({
            message: result.message || "Failed to create walk-in matchroom.",
            title: "Walk-in failed",
            type: "error",
          });
          return;
        }

        Alert.alert("Walk-in created", "Walk-in matchroom created successfully.", [
          {
            text: "Open",
            onPress: () => router.replace(`/matchrooms/${result.id}` as any),
          },
          {
            text: "Back to Walk-ins",
            onPress: () =>
              router.replace({
                params: { segment: "walkins", t: Date.now().toString() },
                pathname: "/zone/modules/bookings",
              } as any),
          },
        ]);
      } catch (error) {
        Logger.error("CreateMatchroom", "Error creating admin walk-in", error);
        showToast({
          message: "Something went wrong while creating walk-in matchroom.",
          title: "Walk-in failed",
          type: "error",
        });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!userProfile) {
      notify({
        message: "We could not load your profile yet. Please try again in a moment.",
        title: "Profile missing",
        type: "error",
      });
      return;
    }

    setSubmitting(true);
    try {
      const latestProfileResult = await getUserProfile(user._id as Id<"users">);
      if (!latestProfileResult.ok || !latestProfileResult.data) {
        notify({
          message: latestProfileResult.ok
            ? "We could not load your profile yet."
            : latestProfileResult.message || "We could not load your profile yet.",
          title: "Profile missing",
          type: "error",
        });
        setSubmitting(false);
        return;
      }

      const latestProfile = latestProfileResult.data;
      setUserProfile(latestProfile);

      const participation = await prepareProfileForMatchParticipation(
        user._id,
        latestProfile,
        selectedGame,
      );

      if (participation.status === "needs_activation") {
        setPendingParticipationProfile(participation.profile);
        setSubmitFeedback({
          message: `Enable ${participation.gameLabel} in your profile to continue.`,
          title: "Game setup required",
          type: "warning",
        });
        setShowActivationPrompt(true);
        setSubmitting(false);
        return;
      }

      if (participation.status === "needs_assessment") {
        setPendingParticipationProfile(participation.profile);
        setSubmitFeedback({
          message: `Complete your ${participation.gameLabel} skill check before creating this request.`,
          title: "Skill check required",
          type: "warning",
        });
        setShowAssessment(true);
        setSubmitting(false);
        return;
      }

      const activeProfile = participation.profile as UserProfile;
      setUserProfile(activeProfile);
      if (participation.skill) {
        setHostSkillScore(participation.skill.rating);
        setHostSkillTier(participation.skill.tier as SkillTier);
        setFormData((prev) => ({
          ...prev,
          skillLevel: participation.skill?.tier || prev.skillLevel,
        }));
      }

      const amountDue = Math.max(0, Math.ceil(Number(effectivePriceValue || 0)));
      const seatsPaid = captainSeatsPaid;
      if (amountDue > 0) {
        const paymentChoice = await promptPaymentChoice(amountDue);
        if (paymentChoice === "cancel") {
          notify({
            message: "Your booking request was not sent.",
            title: "Payment cancelled",
            type: "warning",
          });
          setSubmitting(false);
          return;
        }

        if (paymentChoice === "easypaisa") {
          setEasypaisaPaymentAmount(amountDue);
          setShowEasypaisaPhonePrompt(true);
          setSubmitting(false);
          return;
        }
      }

      const paymentStatus = "paid";
      const isBroadcastFlow = locationMode === "broadcast";
      const shouldCreateBookingRequest = !isBroadcastFlow;

      if (shouldCreateBookingRequest) {
        const walletPayment = await payWithWallet(amountDue);
        if (!walletPayment.ok) {
          notify({
            message: walletPayment.message || "Wallet payment failed.",
            title: "Payment failed",
            type: "error",
          });
          setSubmitting(false);
          return;
        }

        const requestData = buildBookingRequestPayload({
          amountDue,
          broadcastAreas,
          duration,
          formData,
          gameKey: selectedGame!,
          hostSkillAnswers,
          hostSkillScore,
          hostSkillTier,
          locationMode,
          paymentStatus,
          reservedSlots,
          seatsPaid,
          selectedTeamId,
          selectedZoneId,
          seriesType,
          teamMode,
          userId: user._id,
          userProfile: activeProfile,
        });

        const result = await createBookingRequest(requestData as any, {
          status: "open",
        });

        if (result.ok) {
          notify({
            message: "Your booking request was sent to the venue for admin review.",
            title: "Request sent",
            type: "success",
          });
          router.replace({
            params: { t: Date.now().toString() },
            pathname: "/(player)/(tabs)/index",
          } as any);
        } else {
          notify({
            message: result.message || "Failed to create request.",
            title: "Request failed",
            type: "error",
          });
        }
        setSubmitting(false);
        return;
      }

      const assignedTeamMembers = buildAssignedTeamMembers({
        activeProfile,
        memberSportRoleByUid,
        reservedSlots,
        resolvedTeam,
        selectableTeamMembers,
        selectedTeamMemberUids,
        teamMode,
      });

      const matchroomData = buildMatchroomPayload({
        activeProfile: { ...activeProfile, _id: user._id } as UserProfile,
        amountDue,
        assignedTeamMembers,
        broadcastAreas,
        captainSeatNumber: walkInTeamACaptainSeatNumber,
        duration,
        formData,
        gameKey: selectedGame!,
        hostRole,
        hostSkillAnswers,
        hostSkillScore,
        hostSkillTier,
        locationMode,
        locationName: selectedZoneName,
        matchCode: generateMatchCode(selectedZoneName),
        paymentStatus,
        reservedSlots,
        seatsPaid,
        selectedTeamId,
        selectedTeamName:
          teamMode === "team"
            ? teams.find((team) => team.id === selectedTeamId)?.name || null
            : null,
        selectedZoneId,
        seriesType,
        teamMode,
        teamPaymentMode,
        walkIn: null,
      });

      const result = await createMatchroom(matchroomData as any);
      if (result.ok) {
        if (isBroadcastFlow) {
          try {
            if (amountDue > 0) {
              await convex.mutation(api.wallet.deductFunds, {
                amount: amountDue,
                metadata: {
                  flow: "broadcast_matchroom_create",
                  matchroomId: result.id,
                },
                reference: `matchroom_create:${result.id}`,
                source: "matchroom_create",
                userId: user._id as Id<"users">,
              });
            }
          } catch (error) {
            await convex.mutation(api.matchrooms.remove, {
              matchroomId: result.id as Id<"matchrooms">,
            });
            notify({
              message: "Wallet payment failed. The broadcast matchroom was not created.",
              title: "Payment failed",
              type: "error",
            });
            setSubmitting(false);
            return;
          }
        }

        Alert.alert(
          "Success!",
          isBroadcastFlow
            ? "Your broadcast matchroom is live. Venue requests will fan out automatically once the room becomes full."
            : "Your matchroom has been created",
          [
            {
              text: "View Match",
              onPress: () => router.replace(`/matchrooms/${result.id}`),
            },
          ],
        );
      } else {
        notify({
          message: result.message || "Failed to create matchroom.",
          title: "Create failed",
          type: "error",
        });
      }
    } catch (error) {
      Logger.error("CreateMatchroom", "Error creating matchroom", error);
      notify({
        message: "Something went wrong. Please try again.",
        title: "Create failed",
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    adminBranches,
    adminZone,
    authUser,
    broadcastAreas,
    captainSeatsPaid,
    effectivePriceValue,
    formData,
    hostRole,
    hostSkillAnswers,
    hostSkillScore,
    hostSkillTier,
    isZoneWalkInAdmin,
    locationMode,
    memberSportRoleByUid,
    notify,
    payWithWallet,
    promptPaymentChoice,
    reservedSlots,
    duration,
    resolvedTeam,
    selectableTeamMembers,
    selectedAdminBranch,
    selectedGame,
    selectedTeamId,
    selectedTeamMemberUids,
    selectedZoneId,
    selectedZoneName,
    seriesType,
    setFormData,
    setHostSkillScore,
    setHostSkillTier,
    setSubmitting,
    setSubmitFeedback,
    setUserProfile,
    showToast,
    teamMode,
    teamPaymentMode,
    teams,
    user,
    userProfile,
    walkInBranchId,
    walkInPaymentMode,
    walkInSeatCount,
    walkInSeatPlayers,
    walkInTeamACaptainSeatNumber,
    walkInTeamBCaptainSeatNumber,
  ]);

  const closeActivationPrompt = useCallback(() => {
    setPendingParticipationProfile(null);
    setShowActivationPrompt(false);
  }, []);

  const closeAssessment = useCallback(() => {
    setPendingParticipationProfile(null);
    setShowAssessment(false);
  }, []);

  const confirmActivation = useCallback(async () => {
    if (!user || !selectedGame) return;
    setActivating(true);
    try {
      await convex.mutation(api.users.updateGamePreferences, {
        updates: getEnablePatchForGame(selectedGame as any),
        userId: user._id as Id<"users">,
      });

      const nextProfile = {
        ...(pendingParticipationProfile || userProfile || {}),
        ...getEnablePatchForGame(selectedGame as any),
      } as UserProfile;

      setUserProfile(nextProfile);
      setPendingParticipationProfile(nextProfile);
      setShowActivationPrompt(false);
      await submit();
    } catch (error: any) {
      showToast({
        message: error?.message || "Failed to enable game in your profile.",
        title: "Activation failed",
        type: "error",
      });
    } finally {
      setActivating(false);
    }
  }, [pendingParticipationProfile, selectedGame, setUserProfile, submit, user, userProfile]);

  const completeAssessment = useCallback(
    async (rating: number, tier: string) => {
      const newScore: GameSkillScore = {
        initialRating: rating,
        initialSource: "questionnaire",
        lastMatchDate: null,
        lastUpdated: Date.now(),
        losses: 0,
        matchesPlayed: 0,
        rating,
        tier: tier as any,
        wins: 0,
      };

      const baseProfile = (pendingParticipationProfile || userProfile || {}) as any;
      const nextProfile = {
        ...baseProfile,
        skillScores: {
          ...(baseProfile.skillScores || {}),
          [selectedGame || "cs2"]: newScore,
        },
      } as UserProfile;

      setUserProfile(nextProfile);
      setPendingParticipationProfile(nextProfile);
      setHostSkillScore(rating);
      setHostSkillTier(tier as SkillTier);
      setFormData((prev) => ({ ...prev, skillLevel: tier || prev.skillLevel }));
      setShowAssessment(false);
      await submit();
    },
    [
      pendingParticipationProfile,
      selectedGame,
      setFormData,
      setHostSkillScore,
      setHostSkillTier,
      setUserProfile,
      submit,
      userProfile,
    ],
  );

  return {
    activating,
    closeActivationPrompt,
    closeAssessment,
    completeAssessment,
    closeEasypaisaPhonePrompt,
    confirmEasypaisaPayment,
    confirmActivation,
    easypaisaCheckoutPhone,
    easypaisaPaymentAmount,
    handleEasypaisaPhoneChange,
    handleSubmit: submit,
    pendingParticipationProfile,
    showEasypaisaPhonePrompt,
    showActivationPrompt,
    showAssessment,
    startingEasypaisaPayment,
  };
}

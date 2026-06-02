import { router } from "expo-router";
import { useAction, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState } from "react-native";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { convex } from "../../../../src/lib/convex";
import {
  checkMatchroomCreateAvailability,
  buildMatchroomCreateMutationArgs,
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
import { validateMatchroomScheduleWindow, validateWalkInScheduleWindow } from "../../../../src/constants/timing";
import { useToast } from "../../../../src/hooks/useToast";
import Logger from "../../../../src/utils/logger";
import {
  formatPakistaniPhone,
  isValidPakistaniPhone,
  normalizePakistaniPhone,
} from "../../../../src/utils/phoneUtils";
import {
  isUserFullyVerified,
  showKycVerificationRequiredAlert,
} from "../../../../src/utils/verificationGate";
import {
  buildAssignedTeamMembers,
  buildMatchroomPayload,
  buildZoneWalkInPayload,
} from "../utils/matchroomCreatePayloads";

type TeamMode = "solo" | "team";
type TeamPaymentMode = "captain_pays_all" | "captain_pays_self";
type WalkInPaymentMode = "venue_pay" | "guest_pay";
type WalkInSeriesType = "BO1" | "BO3" | "BO5";
type EasypaisaPaymentPhase =
  | "idle"
  | "payment_sent"
  | "confirmed"
  | "completing"
  | "completion_failed"
  | "finalized"
  | "failed"
  | "expired";
type SubmitOptions = {
  skipPaymentPrompt?: boolean;
};

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
  selectedBranchId: string | null;
  selectedGame: string | null;
  selectedTeamId: string | null;
  selectedTeamMemberUids: string[];
  selectedZoneId: string | null;
  selectedZoneRateKey: string | null;
  selectedZoneRateResourceContext: {
    assetType: string;
    tier?: string;
    surface?: string;
  } | null;
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
const EASYPAY_PENDING_STATUSES = ["created", "redirected", "token_received", "pending"];
// Completing a matchroom after payment can involve waiting for wallet balance propagation
// and a few retries, so allow a bit more time before marking it as pending.
const PAYMENT_RESUME_TIMEOUT_MS = 45000;

async function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = PAYMENT_RESUME_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

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
    selectedBranchId,
    selectedGame,
    selectedTeamId,
    selectedTeamMemberUids,
    selectedZoneId,
    selectedZoneRateKey,
    selectedZoneRateResourceContext,
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
  const [activeEasypaisaOrderRef, setActiveEasypaisaOrderRef] = useState<string | null>(null);
  const [easypaisaPaymentPhase, setEasypaisaPaymentPhase] =
    useState<EasypaisaPaymentPhase>("idle");
  const [finalizedEasypaisaMatchroomId, setFinalizedEasypaisaMatchroomId] =
    useState<string | null>(null);
  const [refreshingEasypaisaStatus, setRefreshingEasypaisaStatus] =
    useState(false);
  const [startingEasypaisaPayment, setStartingEasypaisaPayment] =
    useState(false);
  const { showToast } = useToast();
  const startCheckout = useAction((api as any).easypaisa.startCheckout);
  const syncCheckoutStatus = useAction((api as any).easypaisa.syncTransactionStatus);
  const resumedEasypaisaOrderRef = useRef<string | null>(null);
  const completingEasypaisaOrderRef = useRef<string | null>(null);
  const finalizedEasypaisaOrderRef = useRef<string | null>(null);
  const pendingPaidMatchroomCreateArgsRef = useRef<any | null>(null);
  // P1 FIX 4: stable per-attempt idempotency key for the direct wallet/free create
  // path. Generated lazily for a create attempt and persisted across in-attempt
  // retries (double-tap, network-timeout replay) so the backend returns the same
  // room instead of creating a duplicate. Cleared after a room is created so the
  // next genuinely-new attempt gets a fresh key.
  const createRequestIdRef = useRef<string | null>(null);
  const getOrCreateClientCreateRequestId = useCallback(() => {
    if (!createRequestIdRef.current) {
      createRequestIdRef.current = `mc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    }
    return createRequestIdRef.current;
  }, []);
  const checkoutStatus = useQuery(
    api.easypaisa.getCheckoutStatus,
    user?._id && activeEasypaisaOrderRef
      ? {
          orderRefNum: activeEasypaisaOrderRef,
          userId: user._id as Id<"users">,
        }
      : "skip",
  );

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
        `Amount: PKR ${amountDue}\n\nPay with wallet for instant payment, or tap Pay Now to continue with Easypaisa.`,
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
    if (
      !startingEasypaisaPayment &&
      (easypaisaPaymentPhase === "confirmed" ||
        easypaisaPaymentPhase === "completing" ||
        easypaisaPaymentPhase === "finalized")
    ) {
      setShowEasypaisaPhonePrompt(false);
      return;
    }
    if (
      !startingEasypaisaPayment &&
      easypaisaPaymentPhase !== "payment_sent" &&
      easypaisaPaymentPhase !== "confirmed" &&
      easypaisaPaymentPhase !== "completing" &&
      easypaisaPaymentPhase !== "completion_failed" &&
      easypaisaPaymentPhase !== "finalized"
    ) {
      setShowEasypaisaPhonePrompt(false);
      setActiveEasypaisaOrderRef(null);
      setEasypaisaPaymentPhase("idle");
      setFinalizedEasypaisaMatchroomId(null);
    }
  }, [easypaisaPaymentPhase, startingEasypaisaPayment]);

  const hideEasypaisaPhonePrompt = useCallback(() => {
    setShowEasypaisaPhonePrompt(false);
  }, []);

  const openEasypaisaPhonePrompt = useCallback(() => {
    setShowEasypaisaPhonePrompt(true);
  }, []);

  const resetEasypaisaPaymentPrompt = useCallback(() => {
    if (
      startingEasypaisaPayment ||
      easypaisaPaymentPhase === "completing" ||
      easypaisaPaymentPhase === "finalized"
    ) return;
    setActiveEasypaisaOrderRef(null);
    setEasypaisaPaymentPhase("idle");
    setFinalizedEasypaisaMatchroomId(null);
    resumedEasypaisaOrderRef.current = null;
    setShowEasypaisaPhonePrompt(true);
  }, [easypaisaPaymentPhase, startingEasypaisaPayment]);

  const refreshEasypaisaPaymentStatus = useCallback(
    async (
      reason: "manual" | "poll" | "started" = "manual",
      orderRefOverride?: string | null,
    ) => {
      const orderRefNum = String(orderRefOverride || activeEasypaisaOrderRef || "");
      if (!user?._id || !orderRefNum) return;
      if (reason === "manual") setRefreshingEasypaisaStatus(true);
      try {
        await syncCheckoutStatus({
          orderRefNum,
          userId: user._id as Id<"users">,
        });
      } catch (error) {
        Logger.error("CreateMatchroom", "Failed to sync Easypaisa payment status", error);
        if (reason === "manual") {
          notify({
            message: "Could not refresh the Easypaisa payment status.",
            title: "Refresh failed",
            type: "error",
          });
        }
      } finally {
        if (reason === "manual") setRefreshingEasypaisaStatus(false);
      }
    },
    [activeEasypaisaOrderRef, notify, syncCheckoutStatus, user?._id],
  );

  useEffect(() => {
    if (!activeEasypaisaOrderRef) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refreshEasypaisaPaymentStatus("poll");
      }
    });
    return () => subscription.remove();
  }, [activeEasypaisaOrderRef, refreshEasypaisaPaymentStatus]);

  const confirmEasypaisaPayment = useCallback(async (options?: { forceNew?: boolean }) => {
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
    setEasypaisaPaymentPhase("payment_sent");
    setActiveEasypaisaOrderRef(null);
    setFinalizedEasypaisaMatchroomId(null);
    try {
      const forceNew = options?.forceNew !== false;
      const normalizedPhone = normalizePakistaniPhone(easypaisaCheckoutPhone);
      Logger.info("CreateMatchroomPayment", "Starting Easypaisa wallet top-up", {
        amount,
        phoneMasked: normalizedPhone.phoneE164
          ? `${normalizedPhone.phoneE164.slice(0, 5)}***${normalizedPhone.phoneE164.slice(-2)}`
          : "unavailable",
      });
      const checkout: any = await startCheckout({
        kind: "wallet_topup",
        amount,
        userId: user._id as Id<"users">,
        phone: normalizedPhone.phoneE164 || easypaisaCheckoutPhone,
        transactionType: "MA",
        forceNew,
        matchroomCreateArgs: pendingPaidMatchroomCreateArgsRef.current || undefined,
      });

      const orderRefNum = String(checkout.orderRefNum || "");
      Logger.info("CreateMatchroomPayment", "Easypaisa checkout response", {
        orderRefNum,
        status: checkout.status,
        transactionType: checkout.transactionType,
        actionRequired: checkout.actionRequired,
        startTimedOut: Boolean(checkout.startTimedOut),
        paymentTokenPresent: Boolean(checkout.paymentToken),
      });
      setActiveEasypaisaOrderRef(orderRefNum || null);
      setEasypaisaPaymentPhase(checkout.status === "paid" ? "confirmed" : "payment_sent");
      const instruction =
        checkout.startTimedOut
          ? "The payment request may already be on your phone. Approve it in Easypaisa, then use Refresh Status here if MatchHai does not update automatically."
          : checkout.transactionType === "OTC"
          ? `Use token ${checkout.paymentToken || "generated by Easypaisa"} before it expires. MatchHai will keep checking the status.`
          : "Approve the payment in your Easypaisa app or mobile account flow. MatchHai will keep checking the status.";
      const attemptMessage = String(checkout.attemptMessage || "Starting a new payment attempt.");
      notify({
        message: `${attemptMessage} ${instruction}`,
        title: checkout.startTimedOut ? "Payment pending" : "Payment started",
        type: "info",
      });
      if (orderRefNum) {
        setTimeout(() => {
          refreshEasypaisaPaymentStatus("started", orderRefNum);
        }, 1200);
      }
    } catch (error: any) {
      Logger.error("CreateMatchroom", "Failed to start Easypaisa payment", error);
      setEasypaisaPaymentPhase("idle");
      setActiveEasypaisaOrderRef(null);
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
    refreshEasypaisaPaymentStatus,
    startCheckout,
    startingEasypaisaPayment,
    user?._id,
  ]);

  const resendEasypaisaPayment = useCallback(async () => {
    if (startingEasypaisaPayment || easypaisaPaymentPhase === "completing") return;
    setActiveEasypaisaOrderRef(null);
    setEasypaisaPaymentPhase("idle");
    setFinalizedEasypaisaMatchroomId(null);
    resumedEasypaisaOrderRef.current = null;
    await confirmEasypaisaPayment({ forceNew: true });
  }, [confirmEasypaisaPayment, easypaisaPaymentPhase, startingEasypaisaPayment]);

  const payWithWallet = useCallback(
    async (amountDue: number) => {
      if (!user?._id) {
        return { ok: false as const, message: "Your session has expired. Please log in again." };
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

  const submit = useCallback(async (options?: SubmitOptions): Promise<boolean> => {
    if (!user) return false;
    const skipPaymentPrompt = options?.skipPaymentPrompt === true;
    if (!isUserFullyVerified(authUser, user) && !isZoneWalkInAdmin) {
      showKycVerificationRequiredAlert();
      return false;
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
          return false;
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
        const scheduledStartAt = new Date(`${formData.date}T${formData.time}`).getTime();
        const scheduleValidation = validateWalkInScheduleWindow(scheduledStartAt, Date.now());
        if (!scheduleValidation.ok) {
          showToast({
            message: scheduleValidation.message,
            title: "Invalid schedule",
            type: "warning",
          });
          return false;
        }
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
          return false;
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
        return true;
      } catch (error) {
        Logger.error("CreateMatchroom", "Error creating admin walk-in", error);
        showToast({
          message: "Something went wrong while creating walk-in matchroom.",
          title: "Walk-in failed",
          type: "error",
        });
        return false;
      } finally {
        setSubmitting(false);
      }
    }

    if (!userProfile) {
      notify({
        message: "We could not load your profile yet. Please try again in a moment.",
        title: "Profile missing",
        type: "error",
      });
      return false;
    }

    setSubmitting(true);
    try {
      Logger.info("CreateMatchroomPayment", "Submit started", {
        locationMode,
        selectedGame,
        selectedZoneId,
        skipPaymentPrompt,
      });
      const latestProfileResult =
        skipPaymentPrompt && userProfile
          ? { ok: true as const, data: userProfile }
          : await withTimeout(
              getUserProfile(user._id as Id<"users">),
              "Loading latest profile",
              10000,
            );
      if (!latestProfileResult.ok || !latestProfileResult.data) {
        notify({
          message: latestProfileResult.ok
            ? "We could not load your profile yet."
            : latestProfileResult.message || "We could not load your profile yet.",
          title: "Profile missing",
          type: "error",
        });
        setSubmitting(false);
        return false;
      }

      const latestProfile = latestProfileResult.data;
      setUserProfile(latestProfile);

      Logger.info("CreateMatchroomPayment", "Profile ready for submit", {
        usedCachedProfile: skipPaymentPrompt && Boolean(userProfile),
        selectedGame,
      });
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
        return false;
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
        return false;
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

      if (!skipPaymentPrompt) {
        const availability = await withTimeout(
          checkMatchroomCreateAvailability({
            game: selectedGame!,
            locationMode,
            scheduledDate: formData.date,
            scheduledTime: formData.time,
            zoneId: selectedZoneId,
          }),
          "Checking venue availability",
          10000,
        );
        const availabilityMessage = availability.ok
          ? availability.data?.message
          : availability.message;

        if (!availability.ok || availability.data?.available === false) {
          setSubmitFeedback(null);
          showToast({
            message:
              availabilityMessage ||
              "This time slot is no longer available. Please choose a different time or venue.",
            title: availability.ok ? "Time unavailable" : "Could not verify slot",
            type: "error",
          });
          setSubmitting(false);
          return false;
        }
      }

      const amountDue = Math.max(0, Math.ceil(Number(effectivePriceValue || 0)));
      const seatsPaid = captainSeatsPaid;
      const paymentStatus = "paid";
      const isBroadcastFlow = locationMode === "broadcast";

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
        branchId: selectedBranchId,
        broadcastAreas,
        captainSeatNumber: walkInTeamACaptainSeatNumber,
        clientCreateRequestId: getOrCreateClientCreateRequestId(),
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
        selectedZoneRateKey,
        selectedZoneRateResourceContext,
        seriesType,
        teamMode,
        teamPaymentMode,
        walkIn: null,
      });

      if (amountDue > 0 && !skipPaymentPrompt) {
        Logger.info("CreateMatchroomPayment", "Payment required before booking request", {
          amountDue,
          walletBalance: Number(user.walletBalance || 0),
          selectedGame,
          selectedZoneId,
          locationMode,
        });
        const paymentChoice = await promptPaymentChoice(amountDue);
        Logger.info("CreateMatchroomPayment", "Payment choice selected", {
          paymentChoice,
          amountDue,
        });
        if (paymentChoice === "cancel") {
          notify({
            message: "Your booking request was not sent.",
            title: "Payment cancelled",
            type: "warning",
          });
          setSubmitting(false);
          return false;
        }

        if (paymentChoice === "easypaisa") {
          setEasypaisaPaymentAmount(amountDue);
          pendingPaidMatchroomCreateArgsRef.current =
            buildMatchroomCreateMutationArgs(matchroomData as any);
          setActiveEasypaisaOrderRef(null);
          setEasypaisaPaymentPhase("idle");
          resumedEasypaisaOrderRef.current = null;
          setShowEasypaisaPhonePrompt(true);
          setSubmitting(false);
          return true;
        }
      }

      const result = await createMatchroom(matchroomData as any);
      Logger.info("CreateMatchroomPayment", "Create matchroom result", {
        ok: result.ok,
        matchroomId: result.ok ? result.id : null,
        message: result.ok ? undefined : result.message,
      });
      if (result.ok) {
        // Wallet payment is now deducted atomically inside the create mutation
        // (convex/matchrooms.ts), so a failed charge rolls the matchroom back on
        // the server and surfaces here as result.ok === false. No separate
        // client-side deductFunds call is needed.
        setShowEasypaisaPhonePrompt(false);
        setActiveEasypaisaOrderRef(null);
        setEasypaisaPaymentPhase("idle");
        setFinalizedEasypaisaMatchroomId(null);
        resumedEasypaisaOrderRef.current = null;
        // Room created — retire this attempt's idempotency key so a genuinely new
        // create attempt generates a fresh key (a repeat of THIS attempt would be
        // deduped server-side and return this same room).
        createRequestIdRef.current = null;
        Alert.alert(
          "Success!",
          isBroadcastFlow
            ? "Your broadcast matchroom is live. Venue requests will fan out automatically once the room becomes full."
            : "Your matchroom is live. It will be sent to the venue once every slot is filled and paid.",
          [
            {
              text: "View Match",
              onPress: () => router.replace(`/matchrooms/${result.id}`),
            },
          ],
        );
        return true;
      } else {
        notify({
          message: result.message || "Failed to create matchroom.",
          title: "Create failed",
          type: "error",
        });
        return false;
      }
    } catch (error) {
      Logger.error("CreateMatchroom", "Error creating matchroom", error);
      notify({
        message: "Something went wrong. Please try again.",
        title: "Create failed",
        type: "error",
      });
      return false;
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
    getOrCreateClientCreateRequestId,
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
    selectedBranchId,
    selectedGame,
    selectedTeamId,
    selectedTeamMemberUids,
    selectedZoneId,
    selectedZoneRateKey,
    selectedZoneRateResourceContext,
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

  const completeConfirmedEasypaisaPayment = useCallback(async () => {
    const orderRefNum = activeEasypaisaOrderRef;
    if (!orderRefNum || completingEasypaisaOrderRef.current === orderRefNum) return;

    completingEasypaisaOrderRef.current = orderRefNum;
    setEasypaisaPaymentPhase("completing");

    try {
      await refreshEasypaisaPaymentStatus("poll", orderRefNum);
      setTimeout(() => {
        void refreshEasypaisaPaymentStatus("poll", orderRefNum);
      }, 1500);
    } catch (error) {
      Logger.error("CreateMatchroom", "Failed to resume after Easypaisa payment", error);
      if (activeEasypaisaOrderRef === orderRefNum) {
        setEasypaisaPaymentPhase("completion_failed");
        notify({
          message: "Payment was confirmed, but completing the matchroom timed out. Wait a few seconds and tap Try Again.",
          title: "Completion timed out",
          type: "warning",
        });
      }
    } finally {
      if (completingEasypaisaOrderRef.current === orderRefNum) {
        completingEasypaisaOrderRef.current = null;
      }
    }
  }, [activeEasypaisaOrderRef, notify, refreshEasypaisaPaymentStatus]);

  const continueEasypaisaPayment = useCallback(async () => {
    await refreshEasypaisaPaymentStatus("manual");

    if (
      easypaisaPaymentPhase === "confirmed" ||
      easypaisaPaymentPhase === "completing" ||
      easypaisaPaymentPhase === "completion_failed"
    ) {
      await completeConfirmedEasypaisaPayment();
    }
  }, [
    completeConfirmedEasypaisaPayment,
    easypaisaPaymentPhase,
    refreshEasypaisaPaymentStatus,
  ]);

  useEffect(() => {
    if (!activeEasypaisaOrderRef || !checkoutStatus) return;
    const status = String(checkoutStatus.status || "");
    const finalizedMatchroomId = String((checkoutStatus as any).finalizedMatchroomId || "");

    if (status === "paid" && finalizedMatchroomId) {
      if (finalizedEasypaisaOrderRef.current === activeEasypaisaOrderRef) return;
      finalizedEasypaisaOrderRef.current = activeEasypaisaOrderRef;
      setFinalizedEasypaisaMatchroomId(finalizedMatchroomId);
      setEasypaisaPaymentPhase("finalized");
      setShowEasypaisaPhonePrompt(true);
      resumedEasypaisaOrderRef.current = null;
      pendingPaidMatchroomCreateArgsRef.current = null;
      return;
    }

    if (EASYPAY_PENDING_STATUSES.includes(status)) {
      setEasypaisaPaymentPhase("payment_sent");
      return;
    }

    if (status === "expired") {
      setEasypaisaPaymentPhase("expired");
      return;
    }

    if (status === "failed" || status === "cancelled") {
      setEasypaisaPaymentPhase("failed");
      return;
    }

    if (status !== "paid") return;

    if (resumedEasypaisaOrderRef.current === activeEasypaisaOrderRef) {
      return;
    }

    Logger.info("CreateMatchroomPayment", "Easypaisa payment confirmed, resuming matchroom create", {
      orderRefNum: activeEasypaisaOrderRef,
      providerStatus: checkoutStatus.providerStatus,
      providerDescription: checkoutStatus.providerDescription,
    });
    resumedEasypaisaOrderRef.current = activeEasypaisaOrderRef;
    setEasypaisaPaymentPhase("confirmed");
    setFinalizedEasypaisaMatchroomId(null);
    notify({
      message: "Payment confirmed. Completing your matchroom now.",
      title: "Payment confirmed",
      type: "success",
    });

    const timer = setTimeout(() => {
      void completeConfirmedEasypaisaPayment();
    }, 900);

    return () => clearTimeout(timer);
  }, [
    activeEasypaisaOrderRef,
    checkoutStatus,
    completeConfirmedEasypaisaPayment,
    locationMode,
    notify,
  ]);

  useEffect(() => {
    if (!activeEasypaisaOrderRef || !checkoutStatus) return;
    const status = String(checkoutStatus.status || "");
    if (!EASYPAY_PENDING_STATUSES.includes(status)) return;

    const timer = setInterval(() => {
      refreshEasypaisaPaymentStatus("poll");
    }, 2000);

    return () => clearInterval(timer);
  }, [activeEasypaisaOrderRef, checkoutStatus, refreshEasypaisaPaymentStatus]);

  useEffect(() => {
    if (!activeEasypaisaOrderRef || !checkoutStatus) return;
    if (String(checkoutStatus.status || "") !== "paid") return;
    if ((checkoutStatus as any).finalizedMatchroomId) return;
    if (easypaisaPaymentPhase !== "confirmed" && easypaisaPaymentPhase !== "completing") return;

    const timer = setTimeout(() => {
      if (activeEasypaisaOrderRef) {
        setEasypaisaPaymentPhase("completion_failed");
        notify({
          message: "Payment was confirmed, but MatchHai could not finish the matchroom yet. Please retry finishing with this order number.",
          title: "Completion pending",
          type: "warning",
        });
      }
    }, 12000);

    return () => clearTimeout(timer);
  }, [activeEasypaisaOrderRef, checkoutStatus, easypaisaPaymentPhase, notify]);

  const openFinalizedEasypaisaMatchroom = useCallback(() => {
    if (!finalizedEasypaisaMatchroomId) return;
    const matchroomId = finalizedEasypaisaMatchroomId;
    setShowEasypaisaPhonePrompt(false);
    setActiveEasypaisaOrderRef(null);
    setEasypaisaPaymentPhase("idle");
    setFinalizedEasypaisaMatchroomId(null);
    resumedEasypaisaOrderRef.current = null;
    router.replace(`/matchrooms/${matchroomId}` as any);
  }, [finalizedEasypaisaMatchroomId]);

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
    continueEasypaisaPayment,
    resendEasypaisaPayment,
    confirmActivation,
    hideEasypaisaPhonePrompt,
    activeEasypaisaOrderRef,
    easypaisaCheckoutStatus: checkoutStatus,
    easypaisaCheckoutPhone,
    easypaisaPaymentAmount,
    easypaisaPaymentPhase,
    finalizedEasypaisaMatchroomId,
    openFinalizedEasypaisaMatchroom,
    openEasypaisaPhonePrompt,
    refreshEasypaisaPaymentStatus,
    refreshingEasypaisaStatus,
    resetEasypaisaPaymentPrompt,
    handleEasypaisaPhoneChange,
    handleSubmit: submit,
    pendingParticipationProfile,
    showEasypaisaPhonePrompt,
    showActivationPrompt,
    showAssessment,
    startingEasypaisaPayment,
  };
}

import { Alert, Share } from "react-native";

import { logFlowEvent } from "../../../src/hooks/useRouteLogger";
import { buildLegacyMatchroomsHref } from "../../../src/navigation/routes";
import { cancelBookingIntent } from "../../../src/services/convex/bookingService";
import { createBookingRequest } from "../../../src/services/convex/bookingRequestService";
import {
  adminCancelMatchroom,
  cancelMatchJoinRequest,
  deleteMatchroom,
  leaveMatchroom,
  respondToMatchJoinRequest,
} from "../../../src/services/convex/matchService";
import {
  inviteToMatchroomAction,
  // kickFromMatchroomAction,
  transferMatchroomCaptainAction,
} from "../../../src/services/convex/matchroomActionService";
import { submitMatchroomComplain } from "../../../src/services/convex/reportService";
import {
  rejectZoneBookingRequest,
  sendZoneCounterOffer,
} from "../../../src/services/convex/zoneAdminBookingService";
import { useToast } from "../../../src/hooks/useToast";
import { choose, confirm } from "../../../src/ui/confirm";
import Logger from "../../../src/utils/logger";
import { isLeaveLocked } from "../../../src/utils/matchroomLifecycle";
import { formatMatchroomShare } from "../../../src/utils/shareContent";
import { COUNTER_OFFER_TIME_WINDOW_MS } from "../../../src/constants/timing";
import { getUserProfile } from "../../../src/services/userService";
import { useCallback, useEffect, useRef } from "react";
import { canInviteToMatchroomTeam } from "../utils/matchroomLobbyState";

const isNoPendingRequestResult = (result: { ok: boolean; message?: string }) =>
  !result.ok && /no pending request found/i.test(result.message || "");

type DetailActionDeps = {
  id: string;
  room: any;
  user: any;
  profile: any;
  router: any;
  fetchRoom: () => Promise<void>;
  startJoin: (input: any) => Promise<string | void>;
  activeIntentIds: string[];
  bookingRequestId: string | null;
  setBookingRequestId: (value: string) => void;
  setRequestedSlots: React.Dispatch<React.SetStateAction<Map<string, string>>>;
  setGenericRequestStatus: React.Dispatch<React.SetStateAction<string | null>>;
  setRequestLoading: (value: boolean) => void;
  setProcessingRequestId: (value: string | null) => void;
  setJoining: (value: boolean) => void;
  setLoading: (value: boolean) => void;
  setProfile: (value: any) => void;
  setSubmittingComplain: (value: boolean) => void;
  setShowComplainModal: (value: boolean) => void;
  setComplainReason: (value: string) => void;
  setComplainDescription: (value: string) => void;
  complainReason: string;
  complainDescription: string;
  isZoneAdmin: boolean;
  setShowInviteModal: (value: boolean) => void;
  setInvitingSlot: (value: { team: "A" | "B"; slotId: string } | null) => void;
  invitingSlot: { team: "A" | "B"; slotId: string } | null;
  setAdminProcessing: (value: "accept" | "reject" | "counter" | "cancel" | null) => void;
  counterPrice: string;
  counterMessage: string;
  counterExpiryMinutes: string;
  counterDateValue: Date;
  setShowSuggestModal: (value: boolean) => void;
  setCounterPrice: (value: string) => void;
  setCounterMessage: (value: string) => void;
  adminCancelReason: string;
  adminCancelNote: string;
  setShowAdminCancelModal: (value: boolean) => void;
  setAdminCancelReason: (value: string) => void;
  setAdminCancelNote: (value: string) => void;
  captainUidAResolved?: string | null;
  captainUidBResolved?: string | null;
  identityMatches: (
    candidate: unknown,
    values: Array<string | null | undefined>,
  ) => boolean;
  currentIdentityValues: Array<string | null | undefined>;
};

export function useMatchroomDetailActions({
  id,
  room,
  user,
  profile,
  router,
  fetchRoom,
  startJoin,
  activeIntentIds,
  bookingRequestId,
  setBookingRequestId,
  setRequestedSlots,
  setGenericRequestStatus,
  setRequestLoading,
  setProcessingRequestId,
  setJoining,
  setLoading,
  setProfile,
  setSubmittingComplain,
  setShowComplainModal,
  setComplainReason,
  setComplainDescription,
  complainReason,
  complainDescription,
  isZoneAdmin,
  setShowInviteModal,
  setInvitingSlot,
  invitingSlot,
  setAdminProcessing,
  counterPrice,
  counterMessage,
  counterExpiryMinutes,
  counterDateValue,
  setShowSuggestModal,
  setCounterPrice,
  setCounterMessage,
  adminCancelReason,
  adminCancelNote,
  setShowAdminCancelModal,
  setAdminCancelReason,
  setAdminCancelNote,
  captainUidAResolved,
  captainUidBResolved,
  identityMatches,
  currentIdentityValues,
}: DetailActionDeps) {
  const { showToast } = useToast();
  const roomRef = useRef(room);
  roomRef.current = room;
  const inviteInFlightRef = useRef(false);

  const ensureBookingRequestLink = async () => {
    if (bookingRequestId) return bookingRequestId;
    if (!room?.zoneId) return null;

    const result = await createBookingRequest({
      userId: room.hostUid,
      userName: room.hostName,
      gameKey: room.game,
      title: room.title,
      description: room.description,
      maxPlayers: room.maxPlayers,
      playerCount: room.maxPlayers,
      format: room.format,
      seriesType: room.seriesType || undefined,
      durationHours: room.durationHours || undefined,
      selectedMaps: room.selectedMaps || undefined,
      skillLevel: room.skillLevel,
      hostSkillScore: room.hostSkillScore,
      hostSkillTier: room.hostSkillTier || undefined,
      hostSkillContext: room.hostSkillContext || undefined,
      overs: room.overs ? String(room.overs) : undefined,
      teamMode: room.teamMode || undefined,
      teamId: room.teamId || undefined,
      reservedSlots: room.reservedSlots || undefined,
      preferredDate: room.scheduledDate
        ? new Date(`${room.scheduledDate}T00:00:00`).getTime()
        : undefined,
      preferredTime: room.scheduledTime || undefined,
      locationMode: "zone",
      zoneId: room.zoneId,
      budgetPerPlayer: room.pricing?.perPlayer || 0,
      currency: room.pricing?.currency || "PKR",
      paymentStatus: room.paymentStatus || "unpaid",
      paymentAmount: room.paymentAmount || undefined,
      paymentReservedSlots: room.paymentReservedSlots || undefined,
      matchroomId: room.id,
      lifecycleStatus: "zone_admin_pending",
      notes: room.description || "Linked from an existing zone matchroom.",
    });

    if (!result.ok || !result.id) {
      return null;
    }

    setBookingRequestId(result.id);
    return result.id;
  };

  const openBookingQueue = () => {
    router.push({
      pathname: "/zone/modules/bookings",
      params: {
        segment: "requests",
        requestId: bookingRequestId || undefined,
        matchroomId: room?.id,
      },
    } as any);
  };

  const handleRespondToRequest = async (
    req: any,
    decision: "accept" | "reject",
  ) => {
    if (!user) return;
    const notificationId = req?._id || req?.notificationId || req?.id || null;
    if (!notificationId) {
      Logger.error(
        "MatchroomDetails",
        "Respond aborted: missing notificationId on request",
        { req },
      );
      showToast({
        message: "Could not update this request. Please refresh and try again.",
        title: "Update failed",
        type: "error",
      });
      return;
    }
    const processingKey = `${notificationId}:${decision}`;
    setProcessingRequestId(processingKey);
    try {
      const res = await respondToMatchJoinRequest(
        String(notificationId),
        decision,
        user._id,
      );
      if (res.ok) {
        showToast({
          message: res.message || "Request updated.",
          title: decision === "accept" ? "Updated" : "Rejected",
          type: "success",
        });
        await fetchRoom();
      } else {
        const raw = res.message || "";
        const isValidationError = /ArgumentValidationError|missing the required field|validator/i.test(raw);
        if (isValidationError) {
          Logger.error("MatchroomDetails", "Respond validation error", {
            notificationId,
            decision,
            raw,
          });
        }
        showToast({
          message: isValidationError
            ? "Could not update this request. Please refresh and try again."
            : raw || "Failed to update the request.",
          title: "Update failed",
          type: "error",
        });
      }
    } catch (e) {
      Logger.error("MatchroomDetails", "Respond error", e);
      showToast({
        message: "Could not update this request. Please refresh and try again.",
        title: "Update failed",
        type: "error",
      });
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleZoneAccept = async () => {
    const requestId = await ensureBookingRequestLink();
    if (!room?.zoneId || !user?._id || !requestId) {
      showToast({
        message: "Cannot accept because the booking request or zone info is missing.",
        title: "Missing data",
        type: "warning",
      });
      return;
    }
    setAdminProcessing("accept");
    try {
      logFlowEvent("MatchroomDetails", "Zone accepted booking request", {
        matchroomId: room.id,
        requestId,
        zoneId: room.zoneId,
        adminUid: user._id,
      });
      router.push({
        pathname: "/zone/modules/bookings",
        params: {
          segment: "requests",
          requestId,
          matchroomId: room.id,
        },
      } as any);
      showToast({
        message: "Allocate resources from the booking request before accepting.",
        title: "Allocation required",
        type: "info",
      });
    } catch (e: any) {
      Logger.error("MatchroomDetails", "Zone accept error", e);
      showToast({
        message: "An unexpected error occurred.",
        title: "Accept failed",
        type: "error",
      });
    } finally {
      setAdminProcessing(null);
    }
  };

  const handleZoneReject = async () => {
    if (!room?.zoneId || !user?._id) {
      Alert.alert(
        "Missing data",
        "Cannot reject - booking request or zone info not found.",
      );
      return;
    }
    const confirmed = await confirm({
      title: "Reject Booking",
      message: "Are you sure you want to reject this booking request?",
      cancelText: "Cancel",
      confirmText: "Reject",
      confirmStyle: "destructive",
    });
    if (!confirmed) return;

    const requestId = await ensureBookingRequestLink();
    if (!requestId) {
      showToast({
        message:
          "Cannot reject because the booking request or zone info is missing.",
        title: "Missing data",
        type: "warning",
      });
      return;
    }
    setAdminProcessing("reject");
    try {
      logFlowEvent(
        "MatchroomDetails",
        "Zone rejected booking request",
        {
          matchroomId: room!.id,
          requestId,
          zoneId: room!.zoneId,
          adminUid: user!._id,
        },
      );
      const result = await rejectZoneBookingRequest({
        requestId,
        adminUid: user!._id,
        zoneId: room!.zoneId!,
        requestOwnerUid: room!.hostUid,
        reason: "fully_booked",
        note: "Rejected from matchroom detail",
      });
      if (!result.ok) {
        showToast({
          message: result.message || "Unable to reject the booking request.",
          title: "Reject failed",
          type: "error",
        });
      } else {
        showToast({
          message: "Booking request has been declined.",
          title: "Rejected",
          type: "success",
        });
        await fetchRoom();
      }
    } catch (e: any) {
      Logger.error("MatchroomDetails", "Zone reject error", e);
      showToast({
        message: "An unexpected error occurred.",
        title: "Reject failed",
        type: "error",
      });
    } finally {
      setAdminProcessing(null);
    }
  };

  const handleZoneSuggest = async () => {
    if (!room?.zoneId || !user?._id) return;
    const requestId = await ensureBookingRequestLink();
    if (!requestId) {
      showToast({
        message: "Cannot suggest an alternative without a linked booking request.",
        title: "Missing data",
        type: "warning",
      });
      return;
    }

    const parsedPrice = Number.parseInt(counterPrice, 10);
    const parsedExpiry = Number.parseInt(counterExpiryMinutes, 10);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      showToast({
        message: "Enter a valid counter-offer price.",
        title: "Invalid price",
        type: "warning",
      });
      return;
    }

    // Build stable local date (YYYY-MM-DD) and 24h time (HH:mm). Avoid
    // toISOString()/toLocaleTimeString() which can shift the day to UTC or emit
    // a 12h "hh:mm AM/PM" string the backend cannot parse.
    const pad = (n: number) => String(n).padStart(2, "0");
    const counterDate = `${counterDateValue.getFullYear()}-${pad(counterDateValue.getMonth() + 1)}-${pad(counterDateValue.getDate())}`;
    const counterTime = `${pad(counterDateValue.getHours())}:${pad(counterDateValue.getMinutes())}`;

    // Alternative time must be in the future and within ±2h of the original.
    const proposedStartAtMs = counterDateValue.getTime();
    const originalStartAtMs =
      typeof room.scheduledStartAt === "number" ? room.scheduledStartAt : null;
    if (proposedStartAtMs <= Date.now()) {
      showToast({
        message: "Alternative time cannot be in the past.",
        title: "Invalid time",
        type: "warning",
      });
      return;
    }
    if (
      originalStartAtMs != null &&
      Math.abs(proposedStartAtMs - originalStartAtMs) > COUNTER_OFFER_TIME_WINDOW_MS
    ) {
      showToast({
        message: "Alternative time must be within 2 hours of the original requested time.",
        title: "Out of range",
        type: "warning",
      });
      return;
    }

    setAdminProcessing("counter");
    try {
      logFlowEvent("MatchroomDetails", "Zone sent counter offer", {
        matchroomId: room.id,
        requestId,
        zoneId: room.zoneId,
        adminUid: user._id,
      });
      const result = await sendZoneCounterOffer({
        requestId,
        requestOwnerUid: room.hostUid,
        zoneId: room.zoneId,
        zoneName: room.location || "Zone",
        zoneOwnerUid: user._id,
        adminUid: user._id,
        scheduleOptions: [{ date: counterDate, time: counterTime, startAt: proposedStartAtMs }],
        pricePerPlayer: parsedPrice,
        currency: room.pricing?.currency || "PKR",
        location: room.location || "",
        message: counterMessage.trim(),
        expiresInMinutes: Number.isFinite(parsedExpiry) ? parsedExpiry : 10,
        originalStartAt: originalStartAtMs ?? undefined,
        proposedStartAts: [proposedStartAtMs],
      });

      if (!result.ok) {
        showToast({
          message: result.message || "Unable to send the counter-offer.",
          title: "Counter-offer failed",
          type: "error",
        });
        return;
      }

      showToast({
        message: "Player can accept this from their offers inbox.",
        title: "Alternative sent",
        type: "success",
      });
      setShowSuggestModal(false);
      setCounterPrice("");
      setCounterMessage("");
    } catch (e: any) {
      Logger.error("MatchroomDetails", "Zone suggest error", e);
      showToast({
        message: "An unexpected error occurred.",
        title: "Counter-offer failed",
        type: "error",
      });
    } finally {
      setAdminProcessing(null);
    }
  };

  const handleCancelRequest = async () => {
    if (!user || !id) return;
    logFlowEvent("MatchroomDetails", "Cancelling join request", {
      matchroomId: id,
      userId: user._id,
    });
    setRequestLoading(true);
    try {
      const results = (await Promise.all([
        cancelMatchJoinRequest(id, user._id),
        ...activeIntentIds.map((intentId) => cancelBookingIntent(intentId, user._id)),
      ])) as Array<{ ok: boolean; message?: string }>;
      const blockingFailure = results.find((result) => !result.ok && !isNoPendingRequestResult(result));
      const hasSuccessfulCancellation = results.some((result) => result.ok);
      if (!blockingFailure && (hasSuccessfulCancellation || results.every(isNoPendingRequestResult))) {
        setRequestedSlots(new Map());
        setGenericRequestStatus(null);
        showToast({
          message: "Join request removed.",
          title: "Cancelled",
          type: "success",
        });
      } else {
        showToast({
          message: blockingFailure?.message || "Failed to cancel request.",
          title: "Cancel failed",
          type: "error",
        });
      }
    } catch (e) {
      Logger.error("MatchroomDetails", "Error cancelling request", e);
      showToast({
        message: "Failed to cancel request.",
        title: "Cancel failed",
        type: "error",
      });
    } finally {
      setRequestLoading(false);
    }
  };

  const isRequestingRef = useRef(false);

  const handleRequestJoin = useCallback(async (team?: string, slotId?: string) => {
    if (isRequestingRef.current) return;
    if (!roomRef.current || !id) {
      showToast({
        message: "Matchroom details are still loading. Try again in a moment.",
        title: "Not ready",
        type: "warning",
      });
      return;
    }
    isRequestingRef.current = true;
    setJoining(true);
    try {
      const outcome = await startJoin({
        room: roomRef.current,
        team,
        slotId,
        onJoined: async () => {
          const profileRes = await getUserProfile(user._id);
          if (profileRes.ok) {
            setProfile((prev: any) => {
              if (JSON.stringify(prev) === JSON.stringify(profileRes.data)) return prev;
              return profileRes.data;
            });
          }
          await fetchRoom();
        },
        onRequested: () => {
          if (slotId) {
            setRequestedSlots((prev) => new Map(prev).set(slotId, "pending"));
          } else {
            setGenericRequestStatus("pending");
          }
        },
      });
      if (outcome === "requested" || outcome === "joined") {
        await fetchRoom();
      }
    } catch (e) {
      Logger.error("MatchroomDetails", "Error requesting join", e);
      showToast({
        message: "Could not start the join request. Please try again.",
        title: "Join failed",
        type: "error",
      });
    } finally {
      setJoining(false);
      isRequestingRef.current = false;
    }
  }, [user, id, startJoin, fetchRoom, showToast])
  const handleShare = async () => {
    if (!room) return;
    try {
      const venue =
        String(room?.location || "").trim() ||
        (Array.isArray(room?.broadcastAreas) ? room.broadcastAreas[0] : "") ||
        "";
      const message = formatMatchroomShare({
        id: String(room?.id || id),
        game: room?.game,
        title: room?.title,
        venue,
        scheduledDate: room?.scheduledDate,
        scheduledTime: room?.scheduledTime,
        maxPlayers: room?.maxPlayers,
        currentPlayers: room?.currentPlayers,
        status: room?.status,
      });
      await Share.share({ message });
    } catch {
      // ignore
    }
  };

  const handleResultSubmission = () => {
    router.push(`/matchrooms/result?id=${id}`);
  };

  const handleVote = () => {
    router.push(`/matchrooms/vote?id=${id}`);
  };

  const handleComplain = async () => {
    if (!user || !room) return;
    if (!complainReason) {
      showToast({
        message: "Please select a reason for your complaint.",
        title: "Reason required",
        type: "warning",
      });
      return;
    }

    setSubmittingComplain(true);
    const result = await submitMatchroomComplain({
      matchroomId: room.id!,
      reason: complainReason,
      description: complainDescription,
    });

    setSubmittingComplain(false);
    if (result.ok) {
      showToast({
        message: result.message || "Complaint submitted.",
        title: "Submitted",
        type: "success",
      });
      setShowComplainModal(false);
      setComplainReason("");
      setComplainDescription("");
    } else {
      showToast({
        message: result.message || "Failed to submit complaint.",
        title: "Submission failed",
        type: "error",
      });
    }
  };

  const handleLeave = async () => {
    if (!room || !user || !id) return;

    if (isLeaveLocked(room)) {
      Alert.alert(
        "Locked",
        "This matchroom is locked because it starts within 24 hours or has been confirmed by the zone. Contact support if you need help.",
      );
      return;
    }

    const confirmed = await confirm({
      title: "Leave Matchroom",
      message: "Are you sure you want to leave? If you have paid, there will be NO REFUND.",
      cancelText: "Stay",
      confirmText: "Leave",
      confirmStyle: "destructive",
    });
    if (!confirmed) return;

    setJoining(true);
    try {
      const res = await leaveMatchroom(id, user._id);
      if (res.ok) {
        showToast({
          message: "You have left the matchroom.",
          title: "Left",
          type: "success",
        });
        await fetchRoom();
      } else {
        showToast({
          message: res.message || "Failed to leave.",
          title: "Leave failed",
          type: "error",
        });
      }
    } catch (e) {
      Logger.error("MatchroomDetails", "Leave error", e);
      showToast({
        message: "Failed to leave the matchroom.",
        title: "Leave failed",
        type: "error",
      });
    } finally {
      setJoining(false);
    }
  };

  const handleDelete = async () => {
    if (!room) return;
    if (room.zoneAdminApproved) {
      Alert.alert(
        "Cannot Delete",
        "This lobby has been approved by the Zone Admin and cannot be deleted.",
      );
      return;
    }

    const playerCount = room.players?.length || 0;
    const game = room.game?.toLowerCase();
    let threshold = 2;

    if (game === "cs2") {
      threshold = 3;
    } else if (
      game === "futsal" ||
      game === "cricket" ||
      game === "indoorcricket"
    ) {
      threshold = 6;
    }

    if (playerCount >= threshold) {
      Alert.alert(
        "Deletion Blocked",
        `This lobby cannot be deleted because it has ${playerCount} players joined. Minimum required to lock deletion for ${room.game.toUpperCase()} is ${threshold}.`,
      );
      return;
    }

    const confirmed = await confirm({
      title: "Delete Lobby",
      message: "Are you sure you want to delete this lobby? This cannot be undone.",
      cancelText: "Cancel",
      confirmText: "Delete",
      confirmStyle: "destructive",
    });
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await deleteMatchroom(id);
      if (res.ok) {
        if (isZoneAdmin) {
          router.replace("/zone/modules/bookings");
        } else {
          router.replace(buildLegacyMatchroomsHref() as any);
        }
      } else {
        Alert.alert("Error", res.message || "Failed to delete");
        setLoading(false);
      }
    } catch (e) {
      Logger.error("DeleteMatch", "Error", e);
      setLoading(false);
    }
  };

  const handleAdminForceCancel = async () => {
    if (!user || !id || !room) return;
    if (!adminCancelReason) {
      showToast({
        message: "Please select a reason for cancellation.",
        title: "Reason required",
        type: "warning",
      });
      return;
    }

    setAdminProcessing("cancel");
    try {
      const res = await adminCancelMatchroom(
        id,
        user._id,
        adminCancelReason,
        adminCancelNote.trim(),
      );

      if (res.ok) {
        showToast({
          message: res.message || "Lobby cancelled.",
          title: "Lobby cancelled",
          type: "success",
        });
        setShowAdminCancelModal(false);
        setAdminCancelReason("");
        setAdminCancelNote("");
        await fetchRoom();
      } else {
        showToast({
          message: res.message || "Failed to cancel lobby.",
          title: "Cancellation failed",
          type: "error",
        });
      }
    } catch (e) {
      Logger.error("MatchroomDetails", "Force cancel error", e);
      showToast({
        message: "Failed to cancel lobby.",
        title: "Cancellation failed",
        type: "error",
      });
    } finally {
      setAdminProcessing(null);
    }
  };

  const handleTransferCaptain = async (
    team: "A" | "B",
    newCaptainUid: string,
    teammateName: string,
  ) => {
    if (!user || !id || !room) return;

    const confirmed = await confirm({
      title: "Transfer Captaincy",
      message: `Are you sure you want to make ${teammateName} the captain of Team ${team}? You will lose your captain powers for this team.`,
      cancelText: "Cancel",
      confirmText: "Transfer",
    });
    if (!confirmed) return;

    setJoining(true);
    try {
      const res = await transferMatchroomCaptainAction({
        matchroomId: id,
        team,
        newCaptainUid,
      });
      if (res.ok) {
        showToast({
          message: res.message || "Captaincy transferred.",
          title: "Captain updated",
          type: "success",
        });
        await fetchRoom();
      } else {
        showToast({
          message: res.message || "Transfer failed.",
          title: "Transfer failed",
          type: "error",
        });
      }
    } catch (e) {
      Logger.error("TransferCaptain", "Error", e);
      showToast({
        message: "Failed to transfer captaincy.",
        title: "Transfer failed",
        type: "error",
      });
    } finally {
      setJoining(false);
    }
  };

  const handleInvitePress = (team: "A" | "B", slotId: string) => {
    const canInviteForTeam = canInviteToMatchroomTeam(
      room,
      team,
      currentIdentityValues,
      identityMatches,
    );

    if (!canInviteForTeam) {
      showToast({
        message:
          team === "B" && !captainUidBResolved
            ? "Join this lobby before inviting teammates to Team B."
            : `Only the captain of Team ${team} or the host can invite teammates for that team.`,
        title: "Invite unavailable",
        type: "warning",
      });
      return;
    }

    setInvitingSlot({ team, slotId });
    setShowInviteModal(true);
  };

  const handleSendInvite = async (friend: any) => {
    if (!invitingSlot || !id || !room) return false;

    if (inviteInFlightRef.current) {
      return false;
    }

    const inviteeUid = friend?.uid ?? friend?.friendId ?? friend?._id ?? null;
    if (!inviteeUid) {
      showToast({
        message: "This friend profile is missing an invite id. Refresh and try again.",
        title: "Invite failed",
        type: "error",
      });
      return false;
    }

    setJoining(true);
    inviteInFlightRef.current = true;
    try {
      const res = await inviteToMatchroomAction({
        matchroomId: id,
        toUid: String(inviteeUid),
        team: invitingSlot.team,
        slotId: invitingSlot.slotId,
        role: "Player",
        fromUsername:
          profile?.username || user?.fullName || user?.username || "Captain",
      });

      if (res.ok) {
        showToast({
          message: `Sent invitation to ${friend.username || "teammate"}`,
          title: "Invitation sent",
          type: "success",
        });
        return true;
      } else {
        showToast({
          message: res.message || "Failed to send invitation.",
          title: "Invite failed",
          type: "error",
        });
        return false;
      }
    } catch (e) {
      Logger.error("MatchroomDetails", "Error sending invite", e);
      showToast({
        message: "Failed to send invitation.",
        title: "Invite failed",
        type: "error",
      });
      return false;
    } finally {
      inviteInFlightRef.current = false;
      setJoining(false);
    }
  };

  // const handleKick = async (playerUid: string, playerName: string) => {
  //   if (!id || !user || !room) return;
  //
  //   Alert.alert(
  //     "Kick Player",
  //     `Are you sure you want to remove ${playerName} from the matchroom?`,
  //     [
  //       { text: "Cancel", style: "cancel" },
  //       {
  //         text: "Kick",
  //         style: "destructive",
  //         onPress: async () => {
  //           setJoining(true);
  //           try {
  //             const res = await kickFromMatchroomAction({
  //               matchroomId: id,
  //               playerUid,
  //             });
  //             if (res.ok) {
  //               showToast({
  //                 message: "Player removed.",
  //                 title: "Player removed",
  //                 type: "success",
  //               });
  //               await fetchRoom();
  //             } else {
  //               showToast({
  //                 message: res.message || "Kick failed.",
  //                 title: "Kick failed",
  //                 type: "error",
  //               });
  //             }
  //           } catch (e) {
  //             Logger.error("MatchroomDetails", "Kick error", e);
  //             showToast({
  //               message: "Failed to remove player.",
  //               title: "Kick failed",
  //               type: "error",
  //             });
  //           } finally {
  //             setJoining(false);
  //           }
  //         },
  //       },
  //     ],
  //   );
  // };

  const handleManagePlayer = async (
    team: "A" | "B",
    playerUid: string,
    playerName: string,
  ) => {
    if (!id || !user || !room) return;

    const isCurrentCaptain =
      team === "A"
        ? identityMatches(playerUid, [captainUidAResolved])
        : identityMatches(playerUid, [captainUidBResolved]);

    const action = await choose({
      title: "Manage Player",
      message: `Choose an action for ${playerName}`,
      cancelText: "Cancel",
      choices: !isCurrentCaptain
        ? [{
          key: "make_captain" as const,
          text: "Make Captain",
        }]
        : [],
    });
    if (action === "make_captain") {
      void handleTransferCaptain(team, playerUid, playerName);
    }
    // {
    //   text: "Kick Player",
    //   style: "destructive",
    //   onPress: () => handleKick(playerUid, playerName),
    // },
  };

  return {
    openBookingQueue,
    handleRespondToRequest,
    handleZoneAccept,
    handleZoneReject,
    handleZoneSuggest,
    handleCancelRequest,
    handleRequestJoin,
    handleShare,
    handleResultSubmission,
    handleVote,
    handleComplain,
    handleLeave,
    handleDelete,
    handleAdminForceCancel,
    handleInvitePress,
    handleSendInvite,
    handleManagePlayer,
  };
}

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
  kickFromMatchroomAction,
  transferMatchroomCaptainAction,
} from "../../../src/services/convex/matchroomActionService";
import { submitMatchroomComplain } from "../../../src/services/convex/reportService";
import {
  rejectZoneBookingRequest,
  sendZoneCounterOffer,
} from "../../../src/services/convex/zoneAdminBookingService";
import { useToast } from "../../../src/hooks/useToast";
import Logger from "../../../src/utils/logger";
import { getUserProfile } from "../../../src/services/userService";

type DetailActionDeps = {
  id: string;
  room: any;
  user: any;
  profile: any;
  router: any;
  fetchRoom: () => Promise<void>;
  startJoin: (input: any) => Promise<void>;
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
    setProcessingRequestId(req.id);
    try {
      const res = await respondToMatchJoinRequest(req.id, decision, user._id);
      if (res.ok) {
        showToast({
          message: res.message || "Request updated.",
          title: decision === "accept" ? "Updated" : "Rejected",
          type: "success",
        });
        await fetchRoom();
      } else {
        showToast({
          message: res.message || "Failed to update the request.",
          title: "Update failed",
          type: "error",
        });
      }
    } catch (e) {
      Logger.error("MatchroomDetails", "Respond error", e);
      showToast({
        message: "An unexpected error occurred.",
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

  const handleZoneReject = () => {
    if (!room?.zoneId || !user?._id) {
      Alert.alert(
        "Missing data",
        "Cannot reject - booking request or zone info not found.",
      );
      return;
    }
    Alert.alert(
      "Reject Booking",
      "Are you sure you want to reject this booking request?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
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
          },
        },
      ],
    );
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

    const counterDate = counterDateValue.toISOString().slice(0, 10);
    const counterTime = counterDateValue.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

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
        scheduleOptions: [{ date: counterDate, time: counterTime }],
        pricePerPlayer: parsedPrice,
        currency: room.pricing?.currency || "PKR",
        location: room.location || "",
        message: counterMessage.trim(),
        expiresInMinutes: Number.isFinite(parsedExpiry) ? parsedExpiry : 10,
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
      const hasFailure = results.some((result) => !result.ok);
      if (!hasFailure) {
        setRequestedSlots(new Map());
        setGenericRequestStatus(null);
        showToast({
          message: "Join request removed.",
          title: "Cancelled",
          type: "success",
        });
      } else {
        const failed = results.find((result) => !result.ok);
        showToast({
          message: failed?.message || "Failed to cancel request.",
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

  const handleRequestJoin = async (team?: string, slotId?: string) => {
    if (!room || !user || !id) return;
    setJoining(true);
    try {
      await startJoin({
        room,
        team,
        slotId,
        onJoined: async () => {
          const profileRes = await getUserProfile(user._id);
          if (profileRes.ok) setProfile(profileRes.data);
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
    } catch (e) {
      Logger.error("MatchroomDetails", "Error requesting join", e);
    } finally {
      setJoining(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join my ${room?.game} lobby on MatchHai! ${room?.title}`,
      });
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

  const handleLeave = () => {
    if (!room || !user || !id) return;

    const slotsA = room.slotsA || [];
    const slotsB = room.slotsB || [];
    const confirmedCount = [...slotsA, ...slotsB].filter(
      (slot) => slot?.status === "confirmed",
    ).length;
    if (confirmedCount >= 10) {
      Alert.alert(
        "Locked",
        "The matchroom is full and locked. You cannot leave at this stage.",
      );
      return;
    }

    Alert.alert(
      "Leave Matchroom",
      "Are you sure you want to leave? If you have paid, there will be NO REFUND.",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
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
          },
        },
      ],
    );
  };

  const handleDelete = () => {
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

    Alert.alert(
      "Delete Lobby",
      "Are you sure you want to delete this lobby? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
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
          },
        },
      ],
    );
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

    Alert.alert(
      "Transfer Captaincy",
      `Are you sure you want to make ${teammateName} the captain of Team ${team}? You will lose your captain powers for this team.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Transfer",
          onPress: async () => {
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
          },
        },
      ],
    );
  };

  const handleInvitePress = (team: "A" | "B", slotId: string) => {
    setInvitingSlot({ team, slotId });
    setShowInviteModal(true);
  };

  const handleSendInvite = async (friend: any) => {
    if (!invitingSlot || !id || !room) return;

    setJoining(true);
    try {
      const res = await inviteToMatchroomAction({
        matchroomId: id,
        toUid: friend.uid,
        team: invitingSlot.team,
        slotId: invitingSlot.slotId,
        role: "Player",
        fromUsername:
          profile?.username || user?.fullName || user?.username || "Captain",
      });

      if (res.ok) {
        showToast({
          message: `Sent invitation to ${friend.username}`,
          title: "Invitation sent",
          type: "success",
        });
        setShowInviteModal(false);
      } else {
        showToast({
          message: res.message || "Failed to send invitation.",
          title: "Invite failed",
          type: "error",
        });
      }
    } catch (e) {
      Logger.error("MatchroomDetails", "Error sending invite", e);
      showToast({
        message: "Failed to send invitation.",
        title: "Invite failed",
        type: "error",
      });
    } finally {
      setJoining(false);
    }
  };

  const handleKick = async (playerUid: string, playerName: string) => {
    if (!id || !user || !room) return;

    Alert.alert(
      "Kick Player",
      `Are you sure you want to remove ${playerName} from the matchroom?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Kick",
          style: "destructive",
          onPress: async () => {
            setJoining(true);
            try {
              const res = await kickFromMatchroomAction({
                matchroomId: id,
                playerUid,
              });
              if (res.ok) {
                showToast({
                  message: "Player removed.",
                  title: "Player removed",
                  type: "success",
                });
                await fetchRoom();
              } else {
                showToast({
                  message: res.message || "Kick failed.",
                  title: "Kick failed",
                  type: "error",
                });
              }
            } catch (e) {
              Logger.error("MatchroomDetails", "Kick error", e);
              showToast({
                message: "Failed to remove player.",
                title: "Kick failed",
                type: "error",
              });
            } finally {
              setJoining(false);
            }
          },
        },
      ],
    );
  };

  const handleManagePlayer = (
    team: "A" | "B",
    playerUid: string,
    playerName: string,
  ) => {
    if (!id || !user || !room) return;

    const isCurrentCaptain =
      team === "A"
        ? identityMatches(playerUid, [captainUidAResolved])
        : identityMatches(playerUid, [captainUidBResolved]);

    Alert.alert("Manage Player", `Choose an action for ${playerName}`, [
      { text: "Cancel", style: "cancel" },
      ...(!isCurrentCaptain
        ? [{
            text: "Make Captain",
            onPress: () => handleTransferCaptain(team, playerUid, playerName),
          }]
        : []),
      {
        text: "Kick Player",
        style: "destructive",
        onPress: () => handleKick(playerUid, playerName),
      },
    ]);
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

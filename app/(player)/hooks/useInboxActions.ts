import { useMutation } from "convex/react";
import { useRouter } from "expo-router";

import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Notification } from "../../../src/hooks/useNotifications";
import { logFlowEvent } from "../../../src/hooks/useRouteLogger";
import { useToast } from "../../../src/hooks/useToast";
import {
  cancelBookingIntent,
  getBookingIntent,
} from "../../../src/services/convex/bookingService";
import {
  respondToMatchroomInviteAction,
  respondToMatchroomJoinRequestAction,
} from "../../../src/services/convex/matchroomActionService";
import { respondFriendRequestDecision } from "../../../src/services/convex/socialService";
import {
  respondToJoinRequestAction,
  respondToTeamInviteAction,
} from "../../../src/services/convex/teamActionService";
import { respondToZoneCounterOffer } from "../../../src/services/convex/zoneAdminBookingService";
import { recordCountMetric } from "../../../src/utils/perfInstrumentation";
import Logger from "../../../src/utils/logger";
import {
  confirmClearHistory,
  showCounterOfferAccepted,
} from "../utils/inboxAlerts";

type InboxActionDeps = {
  activeTab: "pending" | "resolved";
  notifications: Notification[];
  processing: string | null;
  setProcessing: React.Dispatch<React.SetStateAction<string | null>>;
  deleting: boolean;
  setDeleting: React.Dispatch<React.SetStateAction<boolean>>;
  userId?: string;
  markAllAsRead: () => Promise<number | void>;
  updateStatus: (
    notificationId: string,
    status: "pending" | "accepted" | "rejected" | "read" | "expired" | "declined",
  ) => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  deleteNotifications: (notificationIds: string[]) => Promise<void>;
  openMatchroom: (matchroomId?: string) => void;
};

export function useInboxActions({
  activeTab,
  notifications,
  processing,
  setProcessing,
  deleting,
  setDeleting,
  userId,
  markAllAsRead,
  updateStatus,
  deleteNotification,
  deleteNotifications,
  openMatchroom,
}: InboxActionDeps) {
  const router = useRouter();
  const { showToast } = useToast();
  const updateBookingIntentMutation = useMutation(api.bookings.updateIntentApproval);

  const handleFriendResponse = async (
    notifId: string,
    decision: "accept" | "decline",
  ) => {
    if (processing) return;
    setProcessing(notifId);
    try {
      const res = await respondFriendRequestDecision({
        notificationId: notifId,
        decision,
      });
      if (!res.ok) {
        showToast({ type: "error", title: "Unable to respond", message: res.message });
      }
    } catch (error) {
      Logger.error("Inbox", "Friend response failed", error);
      showToast({ type: "error", title: "Unable to respond", message: "Failed to update the request." });
    } finally {
      setProcessing(null);
    }
  };

  const handleJoinResponse = async (
    notifId: string,
    decision: "accept" | "reject",
  ) => {
    if (processing) return;
    logFlowEvent("Inbox", "Responding to join request", { notifId, decision });
    setProcessing(notifId);
    try {
      const res = await respondToJoinRequestAction({ notificationId: notifId, decision });
      if (!res.ok) {
        showToast({ type: "error", title: "Unable to respond", message: res.message || "Failed to respond." });
      }
    } catch (error) {
      Logger.error("Inbox", "Team join response failed", error);
      showToast({ type: "error", title: "Unable to respond", message: "Failed to update the request." });
    } finally {
      setProcessing(null);
    }
  };

  const handleMatchJoinResponse = async (
    notifId: string,
    decision: "accept" | "reject",
  ) => {
    if (processing) return;
    setProcessing(notifId);
    try {
      const res = await respondToMatchroomJoinRequestAction({
        notificationId: notifId,
        decision,
      });
      if (!res.ok) {
        showToast({ type: "error", title: "Unable to respond", message: res.message || "Failed to respond." });
      }
    } catch (error) {
      Logger.error("Inbox", "Matchroom join response failed", error);
      showToast({ type: "error", title: "Unable to respond", message: "Failed to update the request." });
    } finally {
      setProcessing(null);
    }
  };

  const handleInviteResponse = async (
    notifId: string,
    decision: "accept" | "decline",
  ) => {
    if (processing) return;
    setProcessing(notifId);
    try {
      const res = await respondToTeamInviteAction({ notificationId: notifId, decision });
      if (!res.ok) {
        showToast({ type: "error", title: "Unable to respond", message: res.message || "Failed to respond." });
      }
    } catch (error) {
      Logger.error("Inbox", "Team invite response failed", error);
      showToast({ type: "error", title: "Unable to respond", message: "Failed to update the invite." });
    } finally {
      setProcessing(null);
    }
  };

  const handleBookingApproval = async (
    notifId: string,
    intentId: string | undefined,
    decision: "approved" | "rejected",
  ) => {
    if (processing) return;
    if (!intentId) {
      showToast({ type: "warning", title: "Missing booking", message: "Booking intent is missing from this request." });
      return;
    }

    setProcessing(notifId);
    try {
      await updateBookingIntentMutation({
        intentId: intentId as Id<"bookingIntents">,
        approvalType: "captain",
        approved: decision === "approved",
      });
      await updateStatus(notifId, decision === "approved" ? "accepted" : "rejected");
    } catch (error) {
      Logger.error("Inbox", "Booking approval failed", error);
      showToast({ type: "error", title: "Unable to respond", message: "Failed to update approval." });
    } finally {
      setProcessing(null);
    }
  };

  const handleSeatInvitation = async (
    notifId: string,
    intentId: string | undefined,
    decision: "accept" | "decline",
  ) => {
    if (processing) return;
    setProcessing(notifId);
    try {
      if (decision === "accept") {
        if (intentId) {
          const intentResult = await getBookingIntent(intentId);
          if (!intentResult.ok || !intentResult.data) {
            showToast({ type: "error", title: "Unable to continue", message: intentResult.message || "Booking request not found." });
            return;
          }

          router.push({
            pathname: "/matchrooms/book/pay/[intentId]",
            params: { intentId },
          } as any);
        } else {
          const res = await respondToMatchroomInviteAction({
            notificationId: notifId,
            decision: "accept",
          });
          if (!res.ok) {
            showToast({ type: "error", title: "Unable to continue", message: res.message || "Failed to join seat." });
            return;
          }

          const nextIntentId = String((res as any).intentId || "");
          if (nextIntentId) {
            router.push({
              pathname: "/matchrooms/book/pay/[intentId]",
              params: { intentId: nextIntentId },
            } as any);
          }
        }
      } else {
        if (!intentId) {
          await respondToMatchroomInviteAction({
            notificationId: notifId,
            decision: "decline",
          });
        } else if (userId) {
          await cancelBookingIntent(intentId, userId);
        }
        await updateStatus(notifId, "rejected");
      }
    } catch (error) {
      Logger.error("Inbox", "Seat invitation response failed", error);
      showToast({ type: "error", title: "Unable to respond", message: "Failed to respond to invitation." });
    } finally {
      setProcessing(null);
    }
  };

  const handleCounterOfferResponse = async (
    item: Notification,
    decision: "accepted" | "rejected",
    selectedOptionIndex?: number,
  ) => {
    if (processing) return;

    const offerId = item.meta?.offerId;
    if (!offerId || !userId) {
      showToast({ type: "warning", title: "Missing details", message: "Negotiation details are missing." });
      return;
    }

    setProcessing(item.id);
    try {
      const result = await respondToZoneCounterOffer({
        offerId,
        responderUid: userId,
        decision,
        selectedOptionIndex,
      });

      if (!result.ok) {
        showToast({ type: "error", title: "Unable to respond", message: result.message || "Failed to respond to the schedule." });
        return;
      }

      await updateStatus(item.id, decision === "accepted" ? "accepted" : "rejected");

      if (decision === "accepted") {
        showCounterOfferAccepted({
          locked: result.locked,
          matchroomId: result.matchroomId,
          openMatchroom,
        });
      }
    } catch (error) {
      Logger.error("Inbox", "Counter-offer response failed", error);
      showToast({ type: "error", title: "Unable to respond", message: "Failed to respond to the proposed schedule." });
    } finally {
      setProcessing(null);
    }
  };

  const handleDeleteNotification = async (notifId: string) => {
    try {
      await deleteNotification(notifId);
    } catch (error) {
      Logger.error("Inbox", "Archive notification failed", error);
      showToast({ type: "error", title: "Error", message: "Failed to archive notification." });
    }
  };

  const handleClearAllHistory = async () => {
    if (deleting) return;

    const resolvedNotifications = notifications.filter((item) => item.status !== "pending");
    if (resolvedNotifications.length === 0) return;

    confirmClearHistory({
      count: resolvedNotifications.length,
      onConfirm: async () => {
        setDeleting(true);
        try {
          await deleteNotifications(resolvedNotifications.map((item) => item.id));
        } catch (error) {
          Logger.error("Inbox", "Clear history failed", error);
          showToast({ type: "error", title: "Error", message: "Failed to clear history." });
        } finally {
          setDeleting(false);
        }
      },
    });
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      const unreadCount = notifications.filter((item) => item.isRead === false).length;
      recordCountMetric("inbox.open_write_count", unreadCount, {
        tab: activeTab,
        source: "mark_all",
      });
    } catch (error) {
      Logger.error("Inbox", "Mark all read failed", error);
      showToast({ type: "error", title: "Error", message: "Failed to mark all as read." });
    }
  };

  return {
    handleFriendResponse,
    handleJoinResponse,
    handleMatchJoinResponse,
    handleInviteResponse,
    handleBookingApproval,
    handleSeatInvitation,
    handleCounterOfferResponse,
    handleDeleteNotification,
    handleClearAllHistory,
    handleMarkAllRead,
  };
}

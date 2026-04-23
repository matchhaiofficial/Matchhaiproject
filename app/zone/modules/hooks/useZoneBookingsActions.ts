import { useToast } from "../../../../src/hooks/useToast";
import { logFlowEvent } from "../../../../src/hooks/useRouteLogger";
import {
  acceptZoneBookingRequest,
  rejectZoneBookingRequest,
  sendZoneCounterOffer,
  type ZoneBookingQueueItem,
} from "../../../../src/services/convex/zoneAdminBookingService";
import Logger from "../../../../src/utils/logger";

type CounterOption = {
  date: string;
  time: string;
};

type ZoneBookingsActionDeps = {
  zone: any;
  user: any;
  primaryBranch: any;
  selectedRequest: ZoneBookingQueueItem | null;
  counterOptions: CounterOption[];
  setProcessingAction: React.Dispatch<
    React.SetStateAction<"accept" | "reject" | "counter" | null>
  >;
  setShowCounterModal: React.Dispatch<React.SetStateAction<boolean>>;
  setCounterOptions: React.Dispatch<React.SetStateAction<CounterOption[]>>;
  rejectReason: string;
  rejectNote: string;
  rejectAlternative: string;
  createDefaultScheduleOption: () => CounterOption;
};

export function useZoneBookingsActions({
  zone,
  user,
  primaryBranch,
  selectedRequest,
  counterOptions,
  setProcessingAction,
  setShowCounterModal,
  setCounterOptions,
  rejectReason,
  rejectNote,
  rejectAlternative,
  createDefaultScheduleOption,
}: ZoneBookingsActionDeps) {
  const { showToast } = useToast();

  const handleAccept = async (input?: {
    targetRequest?: ZoneBookingQueueItem;
    branchId?: string | null;
    branchName?: string | null;
    location?: string | null;
    resourceIds?: string[];
  }) => {
    const request = input?.targetRequest || selectedRequest;
    if (!zone?.id || !user?._id || !request) return;
    if (!input?.branchId || !input.resourceIds?.length) {
      showToast({
        type: "warning",
        title: "Allocation required",
        message: "Select a branch and at least one resource before accepting.",
      });
      return { ok: false as const, message: "Missing required allocation details." };
    }

    logFlowEvent("ZoneBookings", "Accepting booking request", {
      requestId: request.id,
      zoneId: zone.id,
      adminUid: user._id,
      branchId: input.branchId,
      resourceCount: input.resourceIds.length,
    });

    setProcessingAction("accept");
    const result = await acceptZoneBookingRequest({
      requestId: request.id,
      adminUid: user._id,
      zoneId: zone.id,
      requestOwnerUid: request.userId,
      branchId: input.branchId,
      resourceIds: input.resourceIds,
      branchName: input.branchName || primaryBranch?.branchDisplayName || undefined,
      location: input.location || zone.primaryBranch?.areaLabel || zone.venueBrandName || undefined,
      zoneName: zone.venueBrandName || undefined,
      note: "Accepted via admin queue",
    });
    setProcessingAction(null);

    if (!result.ok) {
      showToast({ type: "error", title: "Accept failed", message: result.message });
      return result;
    }

    showToast({
      type: "success",
      title: "Accepted",
      message: "Booking request accepted and moved into the booking workflow.",
    });
    return result;
  };

  const handleReject = async () => {
    if (!zone?.id || !user?._id || !selectedRequest) return;

    logFlowEvent("ZoneBookings", "Rejecting booking request", {
      requestId: selectedRequest.id,
      zoneId: zone.id,
      adminUid: user._id,
      reason: rejectReason,
    });

    setProcessingAction("reject");
    const result = await rejectZoneBookingRequest({
      requestId: selectedRequest.id,
      adminUid: user._id,
      zoneId: zone.id,
      requestOwnerUid: selectedRequest.userId,
      reason: rejectReason,
      note: rejectNote.trim() || undefined,
      alternative: rejectAlternative.trim() || undefined,
    });
    setProcessingAction(null);

    if (!result.ok) {
      showToast({ type: "error", title: "Reject failed", message: result.message });
      return;
    }

    showToast({
      type: "success",
      title: "Rejected",
      message: "Booking request rejected. The rejection note is now part of the request record.",
    });
  };

  const handleCounterOffer = async () => {
    if (!zone?.id || !user?._id || !selectedRequest) return;

    logFlowEvent("ZoneBookings", "Sending counter offer", {
      requestId: selectedRequest.id,
      zoneId: zone.id,
      adminUid: user._id,
    });

    const normalizedOptions = counterOptions
      .map((option) => ({
        date: String(option.date || "").trim(),
        time: String(option.time || "").trim(),
      }))
      .filter((option) => option.date && option.time)
      .slice(0, 3);

    if (!normalizedOptions.length) {
      showToast({ type: "warning", title: "Missing schedule", message: "Add at least one date and time option." });
      return;
    }

    setProcessingAction("counter");
    try {
      const result = await sendZoneCounterOffer({
        requestId: selectedRequest.id,
        requestOwnerUid: selectedRequest.userId,
        zoneId: zone.id,
        zoneName: zone.venueBrandName || "Zone",
        zoneOwnerUid: user._id,
        adminUid: user._id,
        branchId: primaryBranch?.id || undefined,
        branchName: primaryBranch?.branchDisplayName || null,
        scheduleOptions: normalizedOptions,
        pricePerPlayer: selectedRequest.budgetPerPlayer || 0,
        currency: selectedRequest.currency || "PKR",
        location: zone.primaryBranch?.areaLabel || "",
        expiresInMinutes: 240,
      });

      if (!result.ok) {
        showToast({ type: "error", title: "Counter-offer failed", message: result.message });
        return;
      }

      showToast({
        type: "success",
        title: "Time options sent",
        message: "Captains can now respond from their inbox.",
      });
      setShowCounterModal(false);
      setCounterOptions([createDefaultScheduleOption()]);
    } catch (error: any) {
      Logger.error("bookings", "handleCounterOffer crashed", error);
      showToast({
        type: "error",
        title: "Error",
        message: "An unexpected error occurred while sending the offer.",
      });
    } finally {
      setProcessingAction(null);
    }
  };

  return {
    handleAccept,
    handleReject,
    handleCounterOffer,
  };
}

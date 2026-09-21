import { useMutation, useQuery } from "convex/react";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { AppButton, StatusPill } from "../../../src/components/AppPrimitives";
import { AppIcon } from "../../../src/components/AppIcon";
import { DetailSectionCard } from "../../../src/components/DetailSurface";
import { useMinuteTicker } from "../../../src/hooks/useMinuteTicker";
import { useToast } from "../../../src/hooks/useToast";
import { COLORS, FONTS, RADII, SPACING, TEXT_SIZES } from "../../../src/theme";

type BroadcastOffer = {
  _id?: Id<"zoneOffers">;
  id?: string;
  offerId?: string;
  requestId?: string;
  zoneId?: string;
  status?: "pending" | "accepted" | "rejected" | "expired" | string;
  offerType?: "standard_accept" | "counter_offer" | string;
  proposedPrice?: number;
  proposedDate?: number;
  proposedTime?: string;
  scheduleOptions?: Array<{
    date?: string;
    time?: string;
    endTime?: string;
  }>;
  recipientUids?: string[];
  responses?: Array<{
    uid: string;
    decision: "accepted" | "rejected";
    respondedAt: number;
    selectedOptionIndex?: number;
  }>;
  selectedOptionIndex?: number;
  expiresAt?: number;
  responseExpiresAt?: number;
  zoneName?: string;
  branchName?: string;
  message?: string;
  requestStatus?: string;
  requestLifecycleStatus?: string;
  closedReason?: string;
  createdAt?: number;
};

type BroadcastStatusPanelProps = {
  room: any;
  matchroomId: string;
  currentIdentityValues: Array<string | null | undefined>;
  currentUserId?: string | null;
};

type BroadcastDisplayState =
  | "waiting_for_zones"
  | "offers_received"
  | "zone_confirmed"
  | "failed"
  | "expired"
  | "cancelled";

const TERMINAL_ROOM_STATUSES = new Set(["cancelled", "expired", "completed"]);

const statusLabels: Record<BroadcastDisplayState, string> = {
  waiting_for_zones: "Waiting for zones",
  offers_received: "Offers received",
  zone_confirmed: "Venue confirmed",
  failed: "No zones available",
  expired: "Broadcast expired",
  cancelled: "Broadcast cancelled",
};

const normalizeIdentity = (value: unknown) => String(value || "").trim();

const identityMatches = (
  candidate: unknown,
  values: Array<string | null | undefined>,
) => {
  const resolved = normalizeIdentity(candidate);
  if (!resolved) return false;
  return values.some((value) => normalizeIdentity(value) === resolved);
};

const toTimestamp = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
};

const getOfferExpiresAt = (offer: BroadcastOffer) =>
  toTimestamp(offer.responseExpiresAt) || toTimestamp(offer.expiresAt);

const isOfferExpired = (offer: BroadcastOffer, nowMs: number) => {
  const expiresAt = getOfferExpiresAt(offer);
  return offer.status === "expired" || (expiresAt !== null && expiresAt <= nowMs);
};

const isOfferPending = (offer: BroadcastOffer, nowMs: number) =>
  offer.status === "pending" && !isOfferExpired(offer, nowMs);

const formatCountdown = (targetMs: number | null, nowMs: number) => {
  if (!targetMs) return "Not set";
  const remainingMs = targetMs - nowMs;
  if (remainingMs <= 0) return "Expired";

  const totalMinutes = Math.max(0, Math.ceil(remainingMs / 60000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const formatDateTime = (date?: string, time?: string, endTime?: string) => {
  const dateText = String(date || "").trim();
  const timeText = String(time || "").trim();
  const endText = String(endTime || "").trim();
  if (!dateText && !timeText) return "Time option";
  if (timeText && endText) return `${dateText} ${timeText} - ${endText}`.trim();
  return `${dateText} ${timeText}`.trim();
};

const formatMoney = (value: unknown) => {
  const amount = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return amount > 0 ? `Rs.${amount}` : "Price not set";
};

const getOfferId = (offer: BroadcastOffer) => String(offer.offerId || offer.id || offer._id || "");

const getVenueLabel = (offer: BroadcastOffer) =>
  String(offer.branchName || offer.zoneName || "Venue offer").trim();

const getDisplayState = (
  room: any,
  offers: BroadcastOffer[],
  nowMs: number,
): BroadcastDisplayState => {
  const rawStatus = String(room?.broadcastRequestStatus || "").trim();
  const roomStatus = String(room?.status || "").trim();
  const hasConfirmedVenue =
    rawStatus === "zone_confirmed" || Boolean(room?.confirmedZoneId || room?.venueConfirmedAt);
  if (hasConfirmedVenue) return "zone_confirmed";
  if (roomStatus === "cancelled" || rawStatus === "cancelled") return "cancelled";
  if (roomStatus === "expired" || rawStatus === "expired") return "expired";
  if (rawStatus === "failed") return "failed";
  if (rawStatus === "offers_received") return "offers_received";
  if (offers.some((offer) => isOfferPending(offer, nowMs))) return "offers_received";
  return "waiting_for_zones";
};

const isRoomActionable = (room: any) => {
  const requestStatus = String(room?.broadcastRequestStatus || "");
  return (
    !TERMINAL_ROOM_STATUSES.has(String(room?.status || "")) &&
    requestStatus !== "zone_confirmed" &&
    !room?.confirmedZoneId &&
    !room?.venueConfirmedAt
  );
};

const getCounterResponseLabel = (
  offer: BroadcastOffer,
  currentUserId?: string | null,
  nowMs = Date.now(),
) => {
  const responses = Array.isArray(offer.responses) ? offer.responses : [];
  const recipientUids = Array.isArray(offer.recipientUids)
    ? offer.recipientUids.map(String)
    : [];
  const currentResponse = currentUserId
    ? responses.find((response) => String(response.uid) === String(currentUserId))
    : null;
  const acceptedCount = responses.filter((response) => response.decision === "accepted").length;
  const allAccepted = recipientUids.length > 0 && acceptedCount >= recipientUids.length;

  if (offer.status === "accepted" || allAccepted) return "Accepted by all / confirmed";
  if (isOfferExpired(offer, nowMs)) return "Expired";
  if (currentResponse?.decision === "accepted") {
    return allAccepted ? "Accepted by all / confirmed" : "You accepted";
  }
  if (currentResponse?.decision === "rejected") return "You rejected";
  if (currentUserId && recipientUids.includes(String(currentUserId))) {
    return "Waiting for your response";
  }
  if (responses.length > 0) return "Waiting for other captain";
  return "Waiting for other captain";
};

export function BroadcastStatusPanel({
  room,
  matchroomId,
  currentIdentityValues,
  currentUserId,
}: BroadcastStatusPanelProps) {
  const nowMs = useMinuteTicker();
  const { showToast } = useToast();
  const [expandedHistory, setExpandedHistory] = useState(false);
  const [selectingOfferId, setSelectingOfferId] = useState<string | null>(null);
  const [respondingOfferId, setRespondingOfferId] = useState<string | null>(null);
  const selectBroadcastOffer = useMutation(api.matchroomBroadcast.selectBroadcastOffer);
  const respondToCounterOffer = useMutation(api.zoneAdminBooking.respondToCounterOffer);

  const isBroadcastRoom =
    room?.locationMode === "broadcast" || Boolean(room?.broadcastRequestStatus);
  const offers = useQuery(
    api.matchroomBroadcast.listBroadcastOffersForMatchroom,
    isBroadcastRoom && matchroomId
      ? { matchroomId: matchroomId as Id<"matchrooms"> }
      : "skip",
  ) as BroadcastOffer[] | undefined;

  const offerList = useMemo(() => (Array.isArray(offers) ? offers : []), [offers]);
  const displayState = useMemo(
    () => getDisplayState(room, offerList, nowMs),
    [nowMs, offerList, room],
  );
  const actionLocked = selectingOfferId !== null || respondingOfferId !== null;
  const actionableRoom = isRoomActionable(room);
  const canSelectStandardOffer =
    actionableRoom &&
    (identityMatches(room?.hostUid, currentIdentityValues) ||
      identityMatches(room?.captainUidA || room?.hostUid, currentIdentityValues));

  const areas = useMemo<string[]>(
    () =>
      Array.isArray(room?.broadcastAreas)
        ? room.broadcastAreas.map((area: unknown) => String(area).trim()).filter(Boolean)
        : [],
    [room?.broadcastAreas],
  );

  const activeOffers = useMemo(
    () => offerList.filter((offer) => isOfferPending(offer, nowMs)),
    [nowMs, offerList],
  );
  const historyOffers = useMemo(
    () => offerList.filter((offer) => !isOfferPending(offer, nowMs)),
    [nowMs, offerList],
  );
  const standardOffers = activeOffers.filter((offer) => offer.offerType === "standard_accept");
  const counterOffers = activeOffers.filter((offer) => offer.offerType === "counter_offer");
  const visibleHistory = expandedHistory ? historyOffers : [];
  const counts = {
    offers: offerList.length,
    pending: activeOffers.length,
    rejected: offerList.filter((offer) => offer.status === "rejected").length,
    expired: offerList.filter((offer) => isOfferExpired(offer, nowMs)).length,
  };
  const responseExpiresAt = toTimestamp(room?.broadcastRequestExpiresAt);

  if (!isBroadcastRoom) return null;

  const handleSelectOffer = async (offer: BroadcastOffer) => {
    const offerId = getOfferId(offer);
    if (!offerId || actionLocked) return;

    setSelectingOfferId(offerId);
    try {
      await selectBroadcastOffer({
        matchroomId: matchroomId as Id<"matchrooms">,
        offerId: offerId as Id<"zoneOffers">,
      });
      showToast({
        title: "Venue selected",
        message: "Venue selected. Your matchroom is now confirmed.",
        type: "success",
      });
    } catch (error: any) {
      showToast({
        title: "Unable to select venue",
        message: error?.message || "Failed to select this venue offer.",
        type: "error",
      });
    } finally {
      setSelectingOfferId(null);
    }
  };

  const handleCounterResponse = async (
    offer: BroadcastOffer,
    decision: "accepted" | "rejected",
    selectedOptionIndex?: number,
  ) => {
    const offerId = getOfferId(offer);
    if (!offerId || !currentUserId || actionLocked) return;

    setRespondingOfferId(offerId);
    try {
      const result = await respondToCounterOffer({
        offerId: offerId as Id<"zoneOffers">,
        responderUid: currentUserId,
        decision,
        selectedOptionIndex,
      });
      showToast({
        title: decision === "accepted" ? "Counter-offer accepted" : "Counter-offer rejected",
        message:
          decision === "accepted" && result?.locked
            ? "Venue selected. Your matchroom is now confirmed."
            : "Your response was recorded.",
        type: "success",
      });
    } catch (error: any) {
      showToast({
        title: "Unable to respond",
        message: error?.message || "Failed to respond to this counter-offer.",
        type: "error",
      });
    } finally {
      setRespondingOfferId(null);
    }
  };

  const renderOfferCard = (offer: BroadcastOffer, history = false) => {
    const offerId = getOfferId(offer);
    const expiresAt = getOfferExpiresAt(offer);
    const expired = isOfferExpired(offer, nowMs);
    const pending = isOfferPending(offer, nowMs);
    const isStandard = offer.offerType === "standard_accept";
    const isCounter = offer.offerType === "counter_offer";
    const statusText = expired ? "Expired" : String(offer.status || "pending");
    const canSelect =
      isStandard &&
      canSelectStandardOffer &&
      pending &&
      !history &&
      !actionLocked;
    const userResponse = currentUserId
      ? offer.responses?.find((response) => String(response.uid) === String(currentUserId))
      : null;
    const canRespond =
      isCounter &&
      actionableRoom &&
      pending &&
      !history &&
      !userResponse &&
      !!currentUserId &&
      Array.isArray(offer.recipientUids) &&
      offer.recipientUids.map(String).includes(String(currentUserId)) &&
      !actionLocked;

    return (
      <View key={offerId || `${offer.zoneId}-${offer.createdAt}`} style={styles.offerCard}>
        <View style={styles.offerHeader}>
          <View style={styles.offerTitleWrap}>
            <Text style={styles.offerEyebrow}>
              {isStandard ? "Venue offer received" : "Counter-offer"}
            </Text>
            <Text style={styles.offerTitle} numberOfLines={1}>
              {getVenueLabel(offer)}
            </Text>
          </View>
          <StatusPill
            tone={expired ? "danger" : offer.status === "accepted" ? "success" : pending ? "info" : "neutral"}
            label={statusText}
            caps={false}
          />
        </View>

        <View style={styles.offerMetaRow}>
          <Text style={styles.offerMeta}>{formatMoney(offer.proposedPrice)}</Text>
          <Text style={styles.offerMeta}>Expires: {formatCountdown(expiresAt, nowMs)}</Text>
        </View>

        {isCounter ? (
          <View style={styles.counterBlock}>
            <Text style={styles.counterStatus}>
              {getCounterResponseLabel(offer, currentUserId, nowMs)}
            </Text>
            {(offer.scheduleOptions || []).slice(0, 3).map((option, index) => (
              <View key={`${offerId}-option-${index}`} style={styles.optionRow}>
                <Text style={styles.optionText}>
                  {formatDateTime(option.date, option.time, option.endTime)}
                </Text>
                {canRespond ? (
                  <AppButton
                    size="sm"
                    variant="secondary"
                    disabled={respondingOfferId === offerId || actionLocked}
                    loading={respondingOfferId === offerId}
                    onPress={() => handleCounterResponse(offer, "accepted", index)}
                    style={styles.optionButton}
                  >
                    Accept
                  </AppButton>
                ) : null}
              </View>
            ))}
            {canRespond ? (
              <AppButton
                size="sm"
                variant="danger"
                disabled={respondingOfferId === offerId || actionLocked}
                loading={respondingOfferId === offerId}
                onPress={() => handleCounterResponse(offer, "rejected")}
                style={styles.rejectButton}
              >
                Reject
              </AppButton>
            ) : null}
          </View>
        ) : null}

        {canSelect ? (
          <AppButton
            size="sm"
            variant="primary"
            leadingIcon="check"
            disabled={actionLocked}
            loading={selectingOfferId === offerId}
            onPress={() => handleSelectOffer(offer)}
            style={styles.selectButton}
          >
            {selectingOfferId === offerId ? "Selecting" : "Select venue"}
          </AppButton>
        ) : null}

        {history && (offer.closedReason || offer.requestLifecycleStatus) ? (
          <Text style={styles.historyMeta}>
            {[offer.closedReason, offer.requestLifecycleStatus].filter(Boolean).join(" - ")}
          </Text>
        ) : null}
      </View>
    );
  };

  const renderStateMessage = () => {
    if (offers === undefined) {
      return (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={COLORS.accent} size="small" />
          <Text style={styles.stateText}>Loading venue responses...</Text>
        </View>
      );
    }
    if (displayState === "failed") {
      return <Text style={styles.stateText}>No available zones found for your selected areas</Text>;
    }
    if (displayState === "expired") {
      return <Text style={styles.stateText}>No venue was confirmed before the response window expired</Text>;
    }
    if (offerList.length === 0 && displayState !== "zone_confirmed") {
      return <Text style={styles.stateText}>No venue responses yet</Text>;
    }
    return null;
  };

  return (
    <DetailSectionCard
      title="Broadcast venue status"
      subtitle={statusLabels[displayState]}
      style={styles.panel}
      accessory={
        <StatusPill
          tone={
            displayState === "zone_confirmed"
              ? "success"
              : displayState === "failed" || displayState === "expired" || displayState === "cancelled"
                ? "danger"
                : displayState === "offers_received"
                  ? "info"
                  : "warning"
          }
          label={statusLabels[displayState]}
          caps={false}
        />
      }
    >
      <View style={styles.areasRow}>
        {areas.length > 0 ? (
          areas.map((area: string) => (
            <View key={area} style={styles.areaChip}>
              <Text style={styles.areaChipText}>{area}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.mutedText}>No areas selected</Text>
        )}
      </View>

      <View style={styles.timerRow}>
        <AppIcon name="clock" size="sm" tone="muted" />
        <Text style={styles.timerText}>
          Response window: {formatCountdown(responseExpiresAt, nowMs)}
        </Text>
      </View>

      <View style={styles.countRow}>
        <CountBadge label="Offers" value={counts.offers} />
        <CountBadge label="Pending" value={counts.pending} />
        <CountBadge label="Rejected" value={counts.rejected} />
        <CountBadge label="Expired" value={counts.expired} />
      </View>

      {renderStateMessage()}

      {standardOffers.length > 0 ? (
        <View style={styles.offerGroup}>
          <Text style={styles.groupTitle}>Venue offers</Text>
          {standardOffers.map((offer) => renderOfferCard(offer))}
        </View>
      ) : null}

      {counterOffers.length > 0 ? (
        <View style={styles.offerGroup}>
          <Text style={styles.groupTitle}>Counter-offers</Text>
          {counterOffers.map((offer) => renderOfferCard(offer))}
        </View>
      ) : null}

      {historyOffers.length > 0 ? (
        <View style={styles.historyBlock}>
          <Pressable
            onPress={() => setExpandedHistory((value) => !value)}
            style={styles.historyToggle}
          >
            <View style={styles.historyToggleTextWrap}>
              <AppIcon name="history" size="sm" tone="muted" />
              <Text style={styles.historyToggleText}>
                {expandedHistory ? "Hide history" : `Show history (${historyOffers.length})`}
              </Text>
            </View>
            <AppIcon
              name={expandedHistory ? "expand-less" : "expand-more"}
              size="sm"
              tone="muted"
            />
          </Pressable>
          {visibleHistory.map((offer) => renderOfferCard(offer, true))}
        </View>
      ) : null}
    </DetailSectionCard>
  );
}

function CountBadge({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.countBadge}>
      <Text style={styles.countValue}>{value}</Text>
      <Text style={styles.countLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginBottom: SPACING.xl,
  },
  areasRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  areaChip: {
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.overlayLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  areaChipText: {
    color: COLORS.text,
    fontFamily: FONTS.interMedium,
    fontSize: TEXT_SIZES.caption,
  },
  mutedText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  timerText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
  },
  countRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  countBadge: {
    minWidth: 72,
    borderRadius: RADII.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  countValue: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.subheading,
  },
  countLabel: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.xs,
    textTransform: "uppercase",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  stateText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
    lineHeight: 18,
  },
  offerGroup: {
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  groupTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.label,
  },
  offerCard: {
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardBackground,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  offerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  offerTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  offerEyebrow: {
    color: COLORS.accent,
    fontFamily: FONTS.interSemiBold,
    fontSize: TEXT_SIZES.xs,
    textTransform: "uppercase",
  },
  offerTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.body,
    marginTop: 2,
  },
  offerMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
  },
  offerMeta: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
  },
  counterBlock: {
    gap: SPACING.sm,
  },
  counterStatus: {
    color: COLORS.text,
    fontFamily: FONTS.interMedium,
    fontSize: TEXT_SIZES.caption,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  optionText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.caption,
  },
  optionButton: {
    minHeight: 34,
    paddingHorizontal: SPACING.md,
  },
  rejectButton: {
    alignSelf: "flex-start",
    minHeight: 34,
    paddingHorizontal: SPACING.md,
  },
  selectButton: {
    alignSelf: "flex-start",
    minHeight: 36,
    paddingHorizontal: SPACING.md,
  },
  historyBlock: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  historyToggle: {
    minHeight: 36,
    borderRadius: RADII.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.overlayLight,
    paddingHorizontal: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyToggleTextWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  historyToggleText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interMedium,
    fontSize: TEXT_SIZES.caption,
  },
  historyMeta: {
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.xs,
  },
});

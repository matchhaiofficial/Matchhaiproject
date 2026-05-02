import React, { useCallback } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { AppIcon, type AppIconName } from "../../../src/components/AppIcon";
import { Notification } from "../../../src/hooks/useNotifications";
import { COLORS } from "../../../src/theme";
import Logger from "../../../src/utils/logger";
import { getNotificationStatusLabel } from "../../../src/utils/statusLabels";
import styles from "../inbox.styles";

const HIT_SLOP_8 = { top: 8, bottom: 8, left: 8, right: 8 } as const;

const GAME_LABELS: Record<string, string> = {
  cs2: "CS2",
  fc26: "FC26",
  fc25: "FC26",
  tekken8: "Tekken 8",
  // Physical sports are temporarily disabled.
  // futsal: "Futsal",
  // indoor_cricket: "Indoor Cricket",
  // padel: "Padel",
  // pickleball: "Pickleball",
};

const REASON_LABELS: Record<string, string> = {
  full_booked: "Venue is fully booked",
  fully_booked: "Venue is fully booked",
  team_full: "Team is full",
  room_full: "Room is full",
  room_locked: "Room is locked",
  room_expired: "Room has expired",
  slot_unavailable: "Selected slot is unavailable",
  time_conflict: "Schedule conflict",
};

const FRIEND_REQUEST_TYPES = new Set(["social.friend_request", "friend_request"]);
const TEAM_JOIN_REQUEST_TYPES = new Set(["team.join_request", "team_join_request"]);
const MATCH_JOIN_REQUEST_TYPES = new Set(["match.join_request", "match_join_request"]);
const TEAM_INVITE_TYPES = new Set(["team.invite", "team_invite"]);
const TEAM_DECISION_TYPES = new Set(["team.join_request_decision", "team_join_decision"]);
const SEAT_INVITE_TYPES = new Set(["match.seat_invite", "match_seat_invitation", "match.payment_required"]);
const PAYMENT_REQUIRED_TYPES = new Set(["match.payment_required", "match_payment_required"]);
const TEAM_CHALLENGE_TYPES = new Set(["team.challenge_received", "team_match_challenge"]);
const TEAM_CHALLENGE_UPDATE_TYPES = new Set(["team.challenge_updated", "team_match_challenge_update"]);
const BOOKING_ACCEPT_TYPES = new Set(["booking.request_accepted", "booking_request_accepted", "resource.allocation_action"]);
const BOOKING_REJECT_TYPES = new Set(["booking.request_rejected", "booking_request_rejected"]);
const BOOKING_COUNTER_TYPES = new Set(["booking.counter_offer", "booking_counter_offer"]);
const MATCH_CANCELLED_TYPES = new Set(["match.cancelled", "match_cancelled_admin"]);

const getTimeAgo = (timestamp: any): string => {
  if (!timestamp) return "Just now";
  const now = new Date();
  const then =
    typeof timestamp === "number"
      ? new Date(timestamp)
      : timestamp?.toDate
        ? timestamp.toDate()
        : new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
};

const formatGameLabel = (value?: string | null) => {
  const key = String(value || "").trim().toLowerCase();
  if (!key || key === "match") return "match";
  return GAME_LABELS[key] || key.toUpperCase();
};

const getNotificationMatchroomId = (item: Notification) =>
  item.matchroomId || item.meta?.matchroomId;

const getNotificationTeamId = (item: Notification) =>
  item.teamId || item.meta?.teamId || item.data?.teamId;

const getNotificationIntentId = (item: Notification) => item.meta?.intentId;

const getNotificationGameLabel = (item: Notification) =>
  formatGameLabel(item.meta?.gameKey || item.meta?.game);

const getCounterOfferOptions = (item: Notification) =>
  Array.isArray(item.meta?.scheduleOptions)
    ? item.meta.scheduleOptions.filter((option) => option?.date && option?.time)
    : [];

const formatScheduleOptionLabel = (option: { date: string; time: string }) => {
  const parsed = new Date(`${option.date}T00:00:00`);
  const dateLabel = Number.isNaN(parsed.getTime())
    ? option.date
    : parsed.toLocaleDateString([], {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
  return `${dateLabel} • ${option.time}`;
};

const toTitleCase = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");

const normalizeReasonLabel = (reason?: string | null) => {
  const key = String(reason || "").trim().toLowerCase();
  if (!key) return "";
  if (REASON_LABELS[key]) return REASON_LABELS[key];
  return toTitleCase(key.replace(/[_-]+/g, " "));
};

const extractReasonCode = (message?: string | null) => {
  const text = String(message || "").trim();
  if (!text) return "";
  const match = text.match(/reason:\s*([a-z0-9_-]+)/i);
  return (match?.[1] || "").trim().toLowerCase();
};

type Props = {
  item: Notification;
  processing: string | null;
  touchDebugEnabled: boolean;
  openProfile: (uid?: string) => void;
  openTeam: (teamId?: string) => void;
  openMatchroom: (matchroomId?: string) => void;
  openChallenge: (challengeId?: string) => void;
  handleFriendResponse: (notifId: string, decision: "accept" | "decline") => void;
  handleJoinResponse: (notifId: string, decision: "accept" | "reject") => void;
  handleMatchJoinResponse: (
    notifId: string,
    decision: "accept" | "reject",
  ) => void;
  handleInviteResponse: (
    notifId: string,
    decision: "accept" | "decline",
  ) => void;
  handleBookingApproval: (
    notifId: string,
    intentId: string | undefined,
    decision: "approved" | "rejected",
  ) => void;
  handleSeatInvitation: (
    notifId: string,
    intentId: string | undefined,
    decision: "accept" | "decline",
  ) => void;
  handleCounterOfferResponse: (
    item: Notification,
    decision: "accepted" | "rejected",
    selectedOptionIndex?: number,
  ) => void;
};

export function InboxNotificationCard({
  item,
  processing,
  touchDebugEnabled,
  openProfile,
  openTeam,
  openMatchroom,
  openChallenge,
  handleFriendResponse,
  handleJoinResponse,
  handleMatchJoinResponse,
  handleInviteResponse,
  handleBookingApproval,
  handleSeatInvitation,
  handleCounterOfferResponse,
}: Props) {
  const isRequest = FRIEND_REQUEST_TYPES.has(item.type);
  const isJoinRequest = TEAM_JOIN_REQUEST_TYPES.has(item.type);
  const isMatchJoinRequest = MATCH_JOIN_REQUEST_TYPES.has(item.type);
  const isTeamInvite = TEAM_INVITE_TYPES.has(item.type);
  const isDecision = TEAM_DECISION_TYPES.has(item.type);
  const isBookingApproval = item.type === "match_booking_captain_approval";
  const isPaymentRequired = PAYMENT_REQUIRED_TYPES.has(item.type) || item.meta?.paymentRequired === true;
  const isSeatInv = SEAT_INVITE_TYPES.has(item.type) && !isPaymentRequired;
  const isTeamChallenge = TEAM_CHALLENGE_TYPES.has(item.type);
  const isTeamChallengeUpdate = TEAM_CHALLENGE_UPDATE_TYPES.has(item.type);
  const isBookingRequestAccepted = BOOKING_ACCEPT_TYPES.has(item.type);
  const isBookingRequestRejected = BOOKING_REJECT_TYPES.has(item.type);
  const isBookingCounterOffer = BOOKING_COUNTER_TYPES.has(item.type);
  const isMatchCancelledAdmin = MATCH_CANCELLED_TYPES.has(item.type);
  const isBookingNotification =
    isBookingRequestAccepted || isBookingRequestRejected || isBookingCounterOffer;
  const isPending = item.status === "pending";
  const isProcessing = processing === item.id;
  const counterOfferOptions = getCounterOfferOptions(item);
  const challengeGameLabel = formatGameLabel(item.meta?.gameKey || item.meta?.game);
  const reasonCode = String(item.reason || extractReasonCode(item.message))
    .trim()
    .toLowerCase();
  const friendlyReason = normalizeReasonLabel(reasonCode);
  const senderName =
    (item.fromUsername || "").trim() || (isBookingNotification ? "Venue Admin" : "Someone");
  const fallbackMessage = (() => {
    const raw = String(item.message || item.title || "").trim();
    if (raw) {
      if (/^reason:/i.test(raw)) {
        return friendlyReason
          ? ` sent an update. Reason: ${friendlyReason}.`
          : " sent an update.";
      }
      const sentence = /[.!?]$/.test(raw) ? raw : `${raw}.`;
      return ` ${sentence}`;
    }
    if (friendlyReason) return ` sent an update. Reason: ${friendlyReason}.`;
    return " sent an update.";
  })();
  const hasKnownMessage =
    isRequest ||
    isTeamInvite ||
    isJoinRequest ||
    isDecision ||
    isBookingApproval ||
    isMatchJoinRequest ||
    isPaymentRequired ||
    isSeatInv ||
    isTeamChallenge ||
    isTeamChallengeUpdate ||
    isBookingNotification ||
    isMatchCancelledAdmin;
  const typeLabel = isRequest
    ? "Friend Request"
    : isJoinRequest
      ? "Team Join Request"
      : isMatchJoinRequest
        ? "Matchroom Join Request"
        : isTeamInvite
          ? "Team Invitation"
          : isBookingApproval
            ? "Booking Approval"
            : isPaymentRequired
              ? "Request Accepted"
            : isSeatInv
              ? "Seat Invitation"
              : isBookingRequestAccepted
                ? "Booking Accepted"
                : isBookingRequestRejected
                  ? "Booking Declined"
                  : isBookingCounterOffer
                    ? "Counter Offer"
                    : isTeamChallenge
                      ? "Team Match Challenge"
                      : isTeamChallengeUpdate
                        ? "Challenge Update"
                        : isMatchCancelledAdmin
                          ? "Matchroom Closed"
                          : "Team Update";

  const isInfoType =
    isJoinRequest ||
    isMatchJoinRequest ||
    isTeamInvite ||
    isBookingApproval ||
    isPaymentRequired ||
    isSeatInv ||
    isTeamChallenge ||
    isTeamChallengeUpdate;
  const iconColor = isInfoType ? COLORS.accent : COLORS.success;
  const iconContainerStyle = isInfoType ? styles.iconContainerInfo : styles.iconContainerSuccess;
  const headerIconName: AppIconName = isRequest
    ? "person-add"
    : isJoinRequest || isTeamInvite
      ? "group"
    : isBookingApproval
      ? "gavel"
        : isPaymentRequired || isSeatInv
          ? "event-seat"
          : isTeamChallenge || isTeamChallengeUpdate
            ? "sports-esports"
            : "info";
  const matchroomId = getNotificationMatchroomId(item);
  const teamId = getNotificationTeamId(item);
  const intentId = getNotificationIntentId(item);

  const handleAcceptPressIn = useCallback(() => {
    if (!touchDebugEnabled) return;
    Logger.debug("TouchDebug", "pressIn", {
      tag: "inbox_accept",
      id: item.id,
      type: item.type,
    });
  }, [item.id, item.type, touchDebugEnabled]);

  const handleRejectPressIn = useCallback(() => {
    if (!touchDebugEnabled) return;
    Logger.debug("TouchDebug", "pressIn", {
      tag: "inbox_reject",
      id: item.id,
      type: item.type,
    });
  }, [item.id, item.type, touchDebugEnabled]);

  const handleAccept = useCallback(() => {
    if (isRequest) handleFriendResponse(item.id, "accept");
    else if (isJoinRequest) handleJoinResponse(item.id, "accept");
    else if (isMatchJoinRequest) handleMatchJoinResponse(item.id, "accept");
    else if (isTeamInvite) handleInviteResponse(item.id, "accept");
    else if (isBookingApproval) {
      handleBookingApproval(item.id, intentId, "approved");
    } else if (isSeatInv) {
      handleSeatInvitation(item.id, intentId, "accept");
    } else if (isPaymentRequired) {
      handleSeatInvitation(item.id, intentId, "accept");
    }
  }, [
    handleBookingApproval,
    handleFriendResponse,
    handleInviteResponse,
    handleJoinResponse,
    handleMatchJoinResponse,
    handleSeatInvitation,
    intentId,
    isBookingApproval,
    isJoinRequest,
    isMatchJoinRequest,
    isPaymentRequired,
    isRequest,
    isSeatInv,
    isTeamInvite,
    item.id,
  ]);

  const handleReject = useCallback(() => {
    if (isRequest) handleFriendResponse(item.id, "decline");
    else if (isJoinRequest) handleJoinResponse(item.id, "reject");
    else if (isMatchJoinRequest) handleMatchJoinResponse(item.id, "reject");
    else if (isTeamInvite) handleInviteResponse(item.id, "decline");
    else if (isBookingApproval) {
      handleBookingApproval(item.id, intentId, "rejected");
    } else if (isSeatInv) {
      handleSeatInvitation(item.id, intentId, "decline");
    } else if (isPaymentRequired) {
      handleSeatInvitation(item.id, intentId, "decline");
    }
  }, [
    handleBookingApproval,
    handleFriendResponse,
    handleInviteResponse,
    handleJoinResponse,
    handleMatchJoinResponse,
    handleSeatInvitation,
    intentId,
    isBookingApproval,
    isJoinRequest,
    isMatchJoinRequest,
    isPaymentRequired,
    isRequest,
    isSeatInv,
    isTeamInvite,
    item.id,
  ]);

  const handleOpenProfile = useCallback(() => {
    openProfile(item.fromUid);
  }, [item.fromUid, openProfile]);

  const handleOpenTeam = useCallback(() => {
    openTeam(teamId);
  }, [openTeam, teamId]);

  const handleOpenMatchroom = useCallback(() => {
    openMatchroom(matchroomId);
  }, [matchroomId, openMatchroom]);

  const handleOpenChallenge = useCallback(() => {
    openChallenge(item.meta?.challengeId);
  }, [item.meta?.challengeId, openChallenge]);

  return (
    <View style={[styles.notificationCard, styles.notificationCardNoMargin]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, iconContainerStyle]}>
          <AppIcon
            name={headerIconName}
            size={20}
            color={iconColor}
          />
        </View>
        {item.isRead === false && (
          <View style={styles.unreadDot} />
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.typeText}>{typeLabel}</Text>
          <Text style={styles.timeText}>{getTimeAgo(item.createdAt)}</Text>
        </View>
        {!isPending && (
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  item.status === "accepted"
                    ? "rgba(76, 175, 80, 0.1)"
                    : "rgba(244, 67, 54, 0.1)",
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: item.status === "accepted" ? COLORS.success : COLORS.error },
              ]}
            >
              {getNotificationStatusLabel(item.status)}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.cardBody}>
        <View style={styles.messageWrap}>
          <Text style={styles.messageText}>
            {!isPaymentRequired && (
              <Text
                style={styles.highlightText}
                onPress={item.fromUid ? () => openProfile(item.fromUid) : undefined}
              >
                {senderName}
              </Text>
            )}
            {isRequest && " wants to connect with you."}
            {isTeamInvite && (
              <>
                {" invited you to join "}
                <Text style={styles.inlineLinkText} onPress={handleOpenTeam}>
                  {item.meta?.teamName || "team"}
                </Text>
              </>
            )}
            {isJoinRequest && (
              <>
                {" wants to join "}
                <Text style={styles.inlineLinkText} onPress={handleOpenTeam}>
                  {item.meta?.teamName || "team"}
                </Text>
              </>
            )}
            {isDecision && (
              <>
                {item.status === "accepted"
                  ? " accepted your request to join "
                  : " declined your request for "}
                <Text style={styles.inlineLinkText} onPress={handleOpenTeam}>
                  {item.meta?.teamName || "team"}
                </Text>
              </>
            )}
            {isBookingApproval && (
              <>
                {" requested to book multiple seats in your matchroom"}
                {!!item.meta?.matchroomTitle && (
                  <>
                    {" "}
                    <Text
                      style={styles.inlineLinkText}
                      onPress={() => openMatchroom(getNotificationMatchroomId(item))}
                    >
                      {item.meta.matchroomTitle}
                    </Text>
                  </>
                )}
                {"."}
              </>
            )}
            {isMatchJoinRequest && (
              <>
                {" wants to join your matchroom "}
                <Text
                  style={styles.inlineLinkText}
                  onPress={() => openMatchroom(getNotificationMatchroomId(item))}
                >
                  {item.meta?.matchroomTitle || "matchroom"}
                </Text>
                {" as "}
                <Text style={styles.inlineLinkText}>{item.meta?.role || "player"}</Text>
              </>
            )}
            {isSeatInv && (
              <>
                {" invited you to join a squad for a "}
                <Text style={styles.inlineLinkText}>{getNotificationGameLabel(item)}</Text>
                {" match."}
              </>
            )}
            {isPaymentRequired && (
              <>
                {"Your request for "}
                <Text
                  style={styles.inlineLinkText}
                  onPress={() => openMatchroom(getNotificationMatchroomId(item))}
                >
                  {item.meta?.matchroomTitle || "this matchroom"}
                </Text>
                {" has been accepted. Pay now to confirm your slot."}
              </>
            )}
            {isTeamChallenge && (
              <>
                {item.status === "pending" ? (
                  <>
                    {" challenged your team for "}
                    <Text style={styles.challengeGameText}>{challengeGameLabel}</Text>
                    {"."}
                  </>
                ) : (
                  <>
                    {" challenge has been marked as "}
                    <Text style={styles.inlineLinkText}>{getNotificationStatusLabel(item.status)}</Text>
                    {"."}
                  </>
                )}
              </>
            )}
            {isTeamChallengeUpdate &&
              (item.status === "accepted"
                ? getNotificationMatchroomId(item)
                  ? " accepted and confirmed. Matchroom is ready."
                  : " accepted. Open challenge workspace to continue."
                : " updated challenge status. Open the challenge workspace to continue.")}
            {isBookingRequestAccepted && " accepted your booking request."}
            {isBookingRequestRejected && (
              <>
                {" declined your booking request."}
                {friendlyReason ? ` Reason: ${friendlyReason}.` : ""}
              </>
            )}
            {isBookingCounterOffer && " sent a counter-offer for your booking request."}
            {isMatchCancelledAdmin && (
              <>
                {" closed the matchroom "}
                <Text style={styles.inlineLinkText}>
                  {item.meta?.matchroomTitle || "matchroom"}
                </Text>
                {item.meta?.reason
                  ? ` due to ${item.meta.reason.toLowerCase()}.`
                  : " for maintenance."}
                {!!item.meta?.note && ` Note: ${item.meta.note}`}
              </>
            )}
            {!hasKnownMessage && fallbackMessage}
          </Text>
        </View>

        {isJoinRequest && isPending && item.meta?.requesterSnapshot && (
          <View style={styles.requestMetaBox}>
            <Text style={styles.requestMetaText}>
              City: {item.meta.requesterSnapshot.city || "N/A"} | Tier:{" "}
              {item.meta.requesterSnapshot.skillTier?.[item.meta.game || ""] || "No rank"}
            </Text>
          </View>
        )}
        {isBookingCounterOffer && counterOfferOptions.length > 0 && (
          <View style={styles.requestMetaBox}>
            <Text style={styles.requestMetaText}>
              Select one of the proposed time options:
            </Text>
            {counterOfferOptions.map((option, index) => (
              <View
                key={`${item.id}-schedule-${index}`}
                style={styles.counterOfferOptionRow}
              >
                <View style={styles.counterOfferOptionTextWrap}>
                  <Text style={styles.messageText}>{formatScheduleOptionLabel(option)}</Text>
                </View>
                <Pressable
                  disabled={!!processing}
                  onPress={() => handleCounterOfferResponse(item, "accepted", index)}
                  style={styles.acceptButton}
                >
                  {isProcessing ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={styles.buttonText}>Accept This</Text>
                  )}
                </Pressable>
              </View>
            ))}
            {!!item.meta?.expiresAt && (
              <Text style={[styles.requestMetaText, styles.requestMetaMarginTop]}>
                Respond before {new Date(item.meta.expiresAt).toLocaleString()}.
              </Text>
            )}
          </View>
        )}
        <View style={styles.contextChipsRow}>
          {!!item.fromUid && (
            <Pressable style={styles.contextChip} onPress={handleOpenProfile}>
              <AppIcon name="person-outline" size={14} color={COLORS.accent} />
              <Text style={styles.contextChipText}>Profile</Text>
            </Pressable>
          )}
          {!!teamId && (
            <Pressable style={styles.contextChip} onPress={handleOpenTeam}>
              <AppIcon name="groups-2" size={14} color={COLORS.accent} />
              <Text style={styles.contextChipText}>Team</Text>
            </Pressable>
          )}
          {!!matchroomId && (
            <Pressable
              style={styles.contextChip}
              onPress={handleOpenMatchroom}
            >
              <AppIcon name="sports-esports" size={14} color={COLORS.accent} />
              <Text style={styles.contextChipText}>Matchroom</Text>
            </Pressable>
          )}
          {!!item.meta?.challengeId && (
            <Pressable
              style={styles.contextChip}
              onPress={handleOpenChallenge}
            >
              <AppIcon name="bolt" size={14} color={COLORS.accent} />
              <Text style={styles.contextChipText}>Challenge</Text>
            </Pressable>
          )}
        </View>
      </View>

      {isPending &&
        (isRequest ||
          isJoinRequest ||
          isMatchJoinRequest ||
          isTeamInvite ||
          isBookingApproval ||
          isPaymentRequired ||
          isSeatInv) && (
          <View style={styles.actionRow}>
            <Pressable
              disabled={!!processing}
              onPressIn={handleAcceptPressIn}
              onPress={handleAccept}
              style={styles.acceptButton}
              hitSlop={HIT_SLOP_8}
            >
              {isProcessing ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.buttonText}>
                  {isSeatInv
                    ? intentId
                      ? "Pay Now"
                      : "Accept Invite"
                    : isPaymentRequired
                      ? "Pay Now"
                    : "Approve"}
                </Text>
              )}
            </Pressable>

            <Pressable
              disabled={!!processing}
              onPressIn={handleRejectPressIn}
              onPress={handleReject}
              style={styles.declineButton}
              hitSlop={HIT_SLOP_8}
            >
              <Text style={styles.declineButtonText}>Reject</Text>
            </Pressable>
          </View>
        )}
      {isPending && isBookingCounterOffer && (
        <View style={styles.actionRow}>
          <Pressable
            disabled={!!processing}
            onPress={() => handleCounterOfferResponse(item, "rejected")}
            style={styles.declineButton}
          >
            {isProcessing ? (
              <ActivityIndicator color={COLORS.error} size="small" />
            ) : (
              <Text style={styles.declineButtonText}>Reject All</Text>
            )}
          </Pressable>
        </View>
      )}
      {item.meta?.challengeId &&
        (isTeamChallenge || isTeamChallengeUpdate || item.status !== "pending") && (
          <View style={styles.actionRow}>
            <Pressable
              style={styles.openChallengeButton}
              onPress={handleOpenChallenge}
            >
              <Text style={styles.buttonText}>Open Challenge</Text>
            </Pressable>
            {!!matchroomId && (
              <Pressable
                style={styles.acceptButton}
                onPress={handleOpenMatchroom}
              >
                <Text style={styles.buttonText}>View Matchroom</Text>
              </Pressable>
            )}
          </View>
        )}
    </View>
  );
}

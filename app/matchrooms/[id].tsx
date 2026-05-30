import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated from "react-native-reanimated";
import AppHeader from "../../src/components/AppHeader";
import { AppIcon } from "../../src/components/AppIcon";
import BottomActionBar from "../../src/components/BottomActionBar";
import ReportIssueModal from "../../src/components/ReportIssueModal";
import Screen from "../../src/components/Screen";
import { AppButton } from "../../src/components/AppPrimitives";
import { DetailSectionCard, DetailSectionHeader } from "../../src/components/DetailSurface";
import {
  MatchroomAdminCancelSheet,
  BroadcastStatusPanel,
  MatchroomFallbackRoster,
  MatchroomInviteSheet,
  MatchroomJoinTeamSheet,
  MatchroomPendingRequestsPanel,
  MatchroomSuggestSheet,
  MatchroomSummarySection,
  MatchroomTeamSection,
} from "./components";
import { useMatchroomJoinFlow } from "../../src/hooks/useMatchroomJoinFlow";
import { useRouteLogger } from "../../src/hooks/useRouteLogger";
import { useToast } from "../../src/hooks/useToast";
import { useEntrance } from "../../src/motion/useEntrance";
import { usePressScale } from "../../src/motion/usePressScale";
import { submitUserReport } from "../../src/services/convex/reportService";
import { COLORS, SPACING } from "../../src/theme";
import Logger from "../../src/utils/logger";
import { canSubmitComplain } from "../../src/utils/matchroomLifecycle";
import {
  getSlotUserId,
} from "./utils/matchroomLobbyState";
import { deriveLobbyBanner, type LobbyBannerTone } from "./utils/lobbyBanner";
import { useMatchroomDetailState } from "./hooks/useMatchroomDetailState";
import { useMatchroomDetailActions } from "./hooks/useMatchroomDetailActions";
import { useMatchroomDetailUiState } from "./hooks/useMatchroomDetailUiState";
import { useMatchroomDetailViewModel } from "./hooks/useMatchroomDetailViewModel";
import styles from "./detail.styles";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const getDisplayRole = (role?: string | null) => {
  const normalized = String(role || "").trim();
  if (!normalized) return "Player";
  if (normalized === "Flex") return "Player";
  if (normalized.startsWith("Team")) return "Player";
  return normalized === "Captain" ? "Player" : normalized;
};

const identityMatches = (
  candidate: unknown,
  values: Array<string | null | undefined>,
) => {
  if (!candidate) return false;
  const candidateValue = String(candidate);
  return values.some(
    (value) => value != null && String(value) === candidateValue,
  );
};

const isOpenJoinSlot = (slot: any) => {
  const status = String(slot?.status || "open").toLowerCase();
  return (
    Boolean(slot?.slotId) &&
    !getSlotUserId(slot) &&
    !slot?.reservedForUid &&
    status !== "reserved" &&
    status !== "confirmed"
  );
};

function HeaderIconButton({
  icon,
  color,
  onPress,
  onPressIn,
  hitSlop,
}: {
  icon: React.ComponentProps<typeof AppIcon>["name"];
  color: string;
  onPress: () => void;
  onPressIn?: () => void;
  hitSlop?: { top: number; bottom: number; left: number; right: number };
}) {
  const { animatedStyle, onPressIn: motionPressIn, onPressOut } = usePressScale({
    activeScale: 0.98,
  });

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        motionPressIn();
        onPressIn?.();
      }}
      onPressOut={onPressOut}
      style={[styles.headerActionButton, animatedStyle]}
      hitSlop={hitSlop}
    >
      <AppIcon name={icon} size={24} color={color} />
    </AnimatedPressable>
  );
}

export default function MatchroomDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { showToast } = useToast();
  const [showJoinTeamSheet, setShowJoinTeamSheet] = useState(false);
  const [reportedPlayer, setReportedPlayer] = useState<{ uid: string; name: string } | null>(null);
  const footerHitSlop = { top: 12, bottom: 12, left: 12, right: 12 };
  const touchDebugEnabled =
    __DEV__ && process.env.EXPO_PUBLIC_TOUCH_DEBUG === "1";
  const matchroomId = String(id || "");
  const {
    user,
    room,
    loading,
    setLoading,
    joining,
    setJoining,
    requestedSlots,
    setRequestedSlots,
    genericRequestStatus,
    setGenericRequestStatus,
    requestLoading,
    setRequestLoading,
    incomingRequests,
    processingRequestId,
    setProcessingRequestId,
    profile,
    setProfile,
    playerRatings,
    currentIdentityValues,
    isZoneAdmin,
    bookingRequestId,
    setBookingRequestId,
    activeIntentIds,
    convexFriends,
    loadingConvexFriends,
    fetchRoom,
  } = useMatchroomDetailState({
    id: matchroomId,
  });

  useRouteLogger("MatchroomDetailsScreen", {
    matchroomId: id,
    userId: user?._id,
  });
  const { startJoin, setupModal } = useMatchroomJoinFlow();
  const { animatedStyle: contentEntranceStyle } = useEntrance({
    distance: 18,
  });

  const logDebugLayout = useCallback((tag: string, event: any) => {
    if (!touchDebugEnabled) return;
    try {
      const { x, y, width: layoutWidth, height } = event.nativeEvent.layout;
      Logger.debug("TouchDebug", "layout", { tag, x: Math.round(x), y: Math.round(y), width: Math.round(layoutWidth), height: Math.round(height) });
    } catch (error) {
      Logger.error("TouchDebug", "layout logging failed", error);
    }
  }, [touchDebugEnabled]);

  const logDebugTouch = useCallback((tag: string, event: any, phase = "touch") => {
    if (!touchDebugEnabled) return;
    try {
      const { pageX, pageY, locationX, locationY } = event.nativeEvent;
      Logger.debug("TouchDebug", phase, { tag, pageX: Math.round(pageX), pageY: Math.round(pageY), locationX: Math.round(locationX), locationY: Math.round(locationY) });
    } catch (error) {
      Logger.error("TouchDebug", "touch logging failed", error);
    }
  }, [touchDebugEnabled]);

  const {
    showComplainModal,
    setShowComplainModal,
    complainReason,
    setComplainReason,
    complainDescription,
    setComplainDescription,
    submittingComplain,
    setSubmittingComplain,
    COMPLAIN_REASONS,
    showInviteModal,
    setShowInviteModal,
    friends,
    loadingFriends,
    invitingSlot,
    setInvitingSlot,
    showSuggestModal,
    setShowSuggestModal,
    counterPrice,
    setCounterPrice,
    counterMessage,
    setCounterMessage,
    counterExpiryMinutes,
    setCounterExpiryMinutes,
    counterDateValue,
    adminProcessing,
    setAdminProcessing,
    showAdminCancelModal,
    setShowAdminCancelModal,
    adminCancelReason,
    setAdminCancelReason,
    adminCancelNote,
    setAdminCancelNote,
    ADMIN_CANCEL_REASONS,
  } = useMatchroomDetailUiState({
    convexFriends,
    loadingConvexFriends,
  });

  const toDateDisplay = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  const toTimeDisplay = (d: Date) =>
    d.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  const {
    isHost,
    isExpired,
    isLocked,
    isLeaveLocked: isTimeLocked,
    canJoin,
    captainUidAResolved,
    captainUidBResolved,
    canManageTeamA,
    canManageTeamB,
    canInviteTeamA,
    canInviteTeamB,
    getSkillBadgeProps,
    participantUids,
    isJoined,
    displaySlotsA,
    displaySlotsB,
    occupiedSeatCount,
    isFull,
    matchCode,
    qrValue,
  } = useMatchroomDetailViewModel({
    room,
    currentIdentityValues,
    playerRatings,
    identityMatches,
  });

  const {
    handleRespondToRequest: handleRespondToRequestAction,
    handleZoneAccept: handleZoneAcceptAction,
    handleZoneReject: handleZoneRejectAction,
    handleZoneSuggest: handleZoneSuggestAction,
    handleCancelRequest: handleCancelRequestAction,
    handleRequestJoin: handleRequestJoinAction,
    handleShare: handleShareAction,
    handleResultSubmission: handleResultSubmissionAction,
    handleVote: handleVoteAction,
    handleComplain: handleComplainAction,
    handleLeave: handleLeaveAction,
    handleDelete: handleDeleteAction,
    handleAdminForceCancel: handleAdminForceCancelAction,
    handleInvitePress: handleInvitePressAction,
    handleSendInvite: handleSendInviteAction,
    handleManagePlayer: handleManagePlayerAction,
  } = useMatchroomDetailActions({
    id: String(id || ""),
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
  });

  const openSlotsA = useMemo(
    () => (displaySlotsA || []).filter(isOpenJoinSlot),
    [displaySlotsA],
  );
  const openSlotsB = useMemo(
    () => (displaySlotsB || []).filter(isOpenJoinSlot),
    [displaySlotsB],
  );
  const joinTeamOptions = useMemo(
    () => ({
      teamA: { team: "A" as const, availableCount: openSlotsA.length },
      teamB: { team: "B" as const, availableCount: openSlotsB.length },
    }),
    [openSlotsA.length, openSlotsB.length],
  );
  const handleFooterRequestJoinPress = useCallback(() => {
    if (!joining) {
      setShowJoinTeamSheet(true);
    }
  }, [joining]);
  const handleSelectJoinTeam = useCallback((team: "A" | "B") => {
    const slot = (team === "A" ? openSlotsA : openSlotsB)[0];
    if (!slot?.slotId || joining) return;
    setShowJoinTeamSheet(false);
    handleRequestJoinAction(`Team ${team}`, String(slot.slotId));
  }, [handleRequestJoinAction, joining, openSlotsA, openSlotsB]);
  const openMatchroomReport = useCallback(() => {
    setReportedPlayer(null);
    setShowComplainModal(true);
  }, [setShowComplainModal]);
  const openPlayerReport = useCallback((playerUid: string, playerName: string) => {
    setReportedPlayer({ uid: playerUid, name: playerName });
    setComplainReason("");
    setComplainDescription("");
    setShowComplainModal(true);
  }, [setComplainDescription, setComplainReason, setShowComplainModal]);
  const handleReportSubmit = useCallback(async () => {
    if (!reportedPlayer) {
      await handleComplainAction();
      return;
    }
    if (!complainReason) {
      showToast({
        message: "Please select a reason for your report.",
        title: "Reason required",
        type: "warning",
      });
      return;
    }

    setSubmittingComplain(true);
    const result = await submitUserReport({
      reportedUserId: reportedPlayer.uid,
      reason: complainReason,
      description: complainDescription,
    });
    setSubmittingComplain(false);

    if (result.ok) {
      showToast({
        message: result.message || "Player report submitted.",
        title: "Submitted",
        type: "success",
      });
      setReportedPlayer(null);
      setShowComplainModal(false);
      setComplainReason("");
      setComplainDescription("");
      return;
    }

    showToast({
      message: result.message || "Failed to submit report.",
      title: "Submission failed",
      type: "error",
    });
  }, [
    complainDescription,
    complainReason,
    handleComplainAction,
    reportedPlayer,
    setComplainDescription,
    setComplainReason,
    setShowComplainModal,
    setSubmittingComplain,
    showToast,
  ]);
  const hasOpenTeamSlot = openSlotsA.length > 0 || openSlotsB.length > 0;
  const pendingPaymentIntentId = activeIntentIds[0] || null;
  const hasPendingPayment =
    Boolean(pendingPaymentIntentId) &&
    (genericRequestStatus === "approved_pending_payment" ||
      Array.from(requestedSlots.values()).includes("approved_pending_payment"));
  const openPendingPayment = useCallback(() => {
    if (!pendingPaymentIntentId) return;
    router.push({
      pathname: "/matchrooms/book/pay/[intentId]",
      params: { intentId: pendingPaymentIntentId },
    } as any);
  }, [pendingPaymentIntentId, router]);
  const showFloatingRequestJoin =
    !isZoneAdmin &&
    !isExpired &&
    room?.status !== "in-progress" &&
    room?.status !== "completed" &&
    !isJoined &&
    requestedSlots.size === 0 &&
    !genericRequestStatus &&
    !isLocked &&
    !isFull &&
    hasOpenTeamSlot;
  const showStickyLobbyActions = showFloatingRequestJoin || (!isZoneAdmin && (isJoined || hasPendingPayment));
  const resultStatusLabel =
    room?.status === "in-progress"
      ? "In Progress"
      : room?.resultVerification?.status === "resolved"
        ? `Final Result: ${room.resultVerification.finalWinner === "team2" ? "Team 2" : "Team 1"} Won`
        : room?.resultVerification?.status === "participant_vote"
          ? "Result Dispute"
          : room?.resultVerification?.status === "admin_review"
            ? "Admin Review"
            : "Verifying Results";

  if (loading) {
    return (
      <Screen style={styles.screen} scroll={false}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      </Screen>
    );
  }

  if (!room) return null;

  return (
    <Screen
      style={styles.screen}
      scroll={false}
      contentStyle={styles.screenContent}
      debugTag="matchroom_detail_screen"
    >
      <AppHeader
        title="Lobby Details"
        onBack={() => router.back()}
        inlineTitle
        rightAction={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {isJoined && !isHost && (
              <HeaderIconButton
                icon="exit-to-app"
                color={COLORS.error}
                onPress={handleLeaveAction}
                onPressIn={() => {
                  if (touchDebugEnabled) {
                    Logger.debug("TouchDebug", "pressIn", {
                      tag: "lobby_header_leave",
                    });
                  }
                }}
                hitSlop={footerHitSlop}
              />
            )}
            {isHost && (
              <HeaderIconButton
                icon="delete-outline"
                color={COLORS.error}
                onPress={handleDeleteAction}
                onPressIn={() => {
                  if (touchDebugEnabled) {
                    Logger.debug("TouchDebug", "pressIn", {
                      tag: "lobby_header_delete",
                    });
                  }
                }}
                hitSlop={footerHitSlop}
              />
            )}
            {user?._id && (participantUids.has(user._id) || isZoneAdmin) && (
              <HeaderIconButton
                icon="chat"
                color={COLORS.accent}
                onPress={() => router.push(`/matchrooms/chat/${id}`)}
                onPressIn={() => {
                  if (touchDebugEnabled) {
                    Logger.debug("TouchDebug", "pressIn", {
                      tag: "lobby_header_chat",
                    });
                  }
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              />
            )}
            <HeaderIconButton
              icon="share"
              color={COLORS.accent}
              onPress={handleShareAction}
              onPressIn={() => {
                if (touchDebugEnabled) {
                  Logger.debug("TouchDebug", "pressIn", {
                    tag: "lobby_header_share",
                  });
                }
              }}
              hitSlop={footerHitSlop}
            />
            {room && (isZoneAdmin || (isJoined && canSubmitComplain(room))) && (
              <HeaderIconButton
                icon="flag"
                color={COLORS.error}
                onPress={openMatchroomReport}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              />
            )}
          </View>
        }
      />

      <View
        style={styles.body}
        collapsable={false}
        onLayout={(event) => logDebugLayout("lobby_body_wrapper", event)}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.content,
            isZoneAdmin ? styles.adminContent : null,
            showStickyLobbyActions ? styles.contentWithBottomAction : null,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          collapsable={false}
          onLayout={(event) => logDebugLayout("lobby_scroll_view", event)}
        >
          <Animated.View style={contentEntranceStyle}>
            {(() => {
              const lobbyBanner = deriveLobbyBanner(room, {
                isExpired,
                isFull,
                isTimeLocked,
              });
              if (!lobbyBanner) return null;
              const toneStyle: Record<LobbyBannerTone, any> = {
                danger: styles.expiredBanner,
                warning: styles.lockedBanner,
                action: styles.actionBanner,
                success: styles.successBanner,
                info: styles.infoBanner,
                accent: styles.fullBanner,
              };
              return (
                <View style={[styles.banner, toneStyle[lobbyBanner.tone]]}>
                  <AppIcon name={lobbyBanner.icon} size={20} color="#FFF" />
                  <View style={styles.bannerTextWrap}>
                    <Text style={styles.bannerTitle}>{lobbyBanner.title}</Text>
                    {lobbyBanner.body ? (
                      <Text style={styles.bannerSubText}>{lobbyBanner.body}</Text>
                    ) : null}
                  </View>
                </View>
              );
            })()}

            <MatchroomSummarySection
              room={room}
              isLocked={isLocked}
              qrValue={qrValue}
              matchCode={matchCode}
              styles={styles}
            />

            <BroadcastStatusPanel
              room={room}
              matchroomId={matchroomId}
              currentIdentityValues={currentIdentityValues}
              currentUserId={user?._id ? String(user._id) : null}
            />

            {(displaySlotsA?.length || displaySlotsB?.length) ? (
              <View style={styles.teamsWrapper}>
                <View
                  style={{
                    flex: width < 600 ? 0 : 1,
                    width: width < 600 ? "100%" : "auto",
                  }}
                >
                  <MatchroomTeamSection
                    team="A"
                    title="TEAM A"
                    slots={displaySlotsA || []}
                    styles={styles}
                    currentUserId={user?._id}
                    captainUid={captainUidAResolved}
                    canManage={canManageTeamA}
                    canInvite={canInviteTeamA}
                    canJoin={canJoin}
                    isJoined={isJoined}
                    isZoneAdmin={isZoneAdmin}
                    requestedSlots={requestedSlots}
                    joining={joining}
                    footerHitSlop={footerHitSlop}
                    getSlotUserId={getSlotUserId}
                    getDisplayRole={getDisplayRole}
                    identityMatches={identityMatches}
                    getSkillBadgeProps={getSkillBadgeProps}
                    onManagePlayer={handleManagePlayerAction}
                    onInvitePress={handleInvitePressAction}
                    onRequestJoin={handleRequestJoinAction}
                    onCancelRequest={handleCancelRequestAction}
                    onReportPlayer={isZoneAdmin ? openPlayerReport : undefined}
                  />
                </View>
                <View
                  style={{
                    flex: width < 600 ? 0 : 1,
                    width: width < 600 ? "100%" : "auto",
                  }}
                >
                  <MatchroomTeamSection
                    team="B"
                    title="TEAM B"
                    slots={displaySlotsB || []}
                    styles={styles}
                    currentUserId={user?._id}
                    captainUid={captainUidBResolved}
                    canManage={canManageTeamB}
                    canInvite={canInviteTeamB}
                    canJoin={canJoin}
                    isJoined={isJoined}
                    isZoneAdmin={isZoneAdmin}
                    requestedSlots={requestedSlots}
                    joining={joining}
                    footerHitSlop={footerHitSlop}
                    getSlotUserId={getSlotUserId}
                    getDisplayRole={getDisplayRole}
                    identityMatches={identityMatches}
                    getSkillBadgeProps={getSkillBadgeProps}
                    onManagePlayer={handleManagePlayerAction}
                    onInvitePress={handleInvitePressAction}
                    onRequestJoin={handleRequestJoinAction}
                    onCancelRequest={handleCancelRequestAction}
                    onReportPlayer={isZoneAdmin ? openPlayerReport : undefined}
                  />
                </View>
              </View>
            ) : (
              <MatchroomFallbackRoster
                players={room.players || []}
                styles={styles}
                hostUid={room.hostUid}
                currentUserId={user?._id}
                identityMatches={identityMatches}
                getDisplayRole={getDisplayRole}
                getSkillBadgeProps={getSkillBadgeProps}
                onReportPlayer={isZoneAdmin ? openPlayerReport : undefined}
              />
            )}

            {/* ── Pending Join Requests (Host / Admin only) ── */}
            {incomingRequests.length > 0 && (isHost || isZoneAdmin) && (
              <DetailSectionCard
                title={`Pending Join Requests (${incomingRequests.length})`}
                style={styles.pendingRequestsCard}
              >
                <MatchroomPendingRequestsPanel
                  requests={incomingRequests}
                  processingRequestId={processingRequestId}
                  onRespond={handleRespondToRequestAction}
                />
              </DetailSectionCard>
            )}
            {/* Footer Actions */}
            {!showStickyLobbyActions && !isZoneAdmin ? (
              <View
                style={[
                  styles.buttonWrapper,
                  { marginBottom: SPACING.lg },
                ]}
                collapsable={false}
                onLayout={(event) => logDebugLayout("lobby_footer_container", event)}
              >
              <View style={styles.buttonContent}>
                {isZoneAdmin ? (
                  <View style={{ gap: SPACING.sm }}>
                    <Text
                      style={{ textAlign: "center", color: COLORS.textSecondary }}
                    >
                      Booking actions (zone admin)
                    </Text>
                    <View style={styles.footerRow}>
                      <AppButton
                        size="lg"
                        onPress={handleZoneAcceptAction}
                        disabled={adminProcessing !== null}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.footerAction}
                      >
                        {adminProcessing === "accept" ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <Text style={styles.joinButtonText}>Accept</Text>
                        )}
                      </AppButton>
                      <AppButton
                        variant="danger"
                        size="lg"
                        onPress={handleZoneRejectAction}
                        disabled={adminProcessing !== null}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.footerAction}
                      >
                        {adminProcessing === "reject" ? (
                          <ActivityIndicator size="small" color={COLORS.error} />
                        ) : (
                          <Text style={styles.secondaryButtonText}>Reject</Text>
                        )}
                      </AppButton>
                    </View>
                    <AppButton
                      variant="ghost"
                      size="lg"
                      onPress={() => setShowSuggestModal(true)}
                      disabled={adminProcessing !== null}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.warningActionButton}
                    >
                      <View
                        style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                      >
                        <AppIcon name="edit" size={18} color={COLORS.warning} />
                        <Text style={styles.warningActionText}>Suggest Alternative</Text>
                      </View>
                    </AppButton>
                    <AppButton
                      variant="danger"
                      size="lg"
                      onPress={() => setShowAdminCancelModal(true)}
                      disabled={adminProcessing !== null}
                      style={styles.forceCancelButton}
                    >
                      <View
                        style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                      >
                        <AppIcon name="cancel" size={18} color={COLORS.error} />
                        <Text style={styles.secondaryButtonText}>
                          Force Cancel (Admin)
                        </Text>
                      </View>
                    </AppButton>
                  </View>
                ) : isExpired ? (
                  <View style={[styles.fullButton, styles.expiredBanner]}>
                    <Text style={styles.fullText}>Matchroom Expired</Text>
                  </View>
                ) : room.status !== "in-progress" && room.status !== "completed" ? (
                  !isJoined ? (
                    <View style={{ gap: SPACING.md }}>
                      {isFull || room.isLocked ? (
                        <View
                          style={[
                            styles.fullButton,
                            room.isLocked && !isFull ? styles.lockedBanner : null,
                          ]}
                        >
                          <Text style={styles.fullText}>
                            {room.isLocked && !isFull ? "Lobby Locked" : "Lobby Full"}
                          </Text>
                        </View>
                      ) : null}

                      <View
                        style={{ marginTop: SPACING.xs, width: "100%" }}
                        collapsable={false}
                        onLayout={(event) =>
                          logDebugLayout("lobby_footer_action_wrapper", event)
                        }
                      >
                        {requestedSlots.size > 0 || genericRequestStatus ? (
                          <View style={{ gap: SPACING.sm }}>
                            <Text
                              style={{
                                textAlign: "center",
                                color: COLORS.muted,
                              }}
                            >
                              {genericRequestStatus === "approved_pending_payment" ||
                                Array.from(requestedSlots.values()).includes("approved_pending_payment")
                                ? "Payment pending. Complete payment or cancel this slot."
                                : requestedSlots.size > 0
                                  ? `You have requested ${requestedSlots.size} slot${requestedSlots.size > 1 ? "s" : ""}.`
                                  : "Request Sent. Waiting for host approval."}
                            </Text>
                            {hasPendingPayment ? (
                              <AppButton
                                size="lg"
                                onPress={openPendingPayment}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Text style={styles.joinButtonText}>Pay Now</Text>
                                <AppIcon name="payment" size={18} color="#FFF" />
                              </AppButton>
                            ) : null}
                            <AppButton
                              variant="danger"
                              size="lg"
                              onPress={handleCancelRequestAction}
                              disabled={requestLoading}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              style={styles.cancelRequestButton}
                            >
                              {requestLoading ? (
                                <ActivityIndicator color={COLORS.error} />
                              ) : (
                                <Text style={styles.cancelRequestButtonText}>
                                  Cancel Request
                                </Text>
                              )}
                            </AppButton>
                          </View>
                        ) : (
                          !showFloatingRequestJoin &&
                          !isLocked &&
                          !isFull &&
                          hasOpenTeamSlot && (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityState={{ disabled: joining }}
                              testID="matchroom-request-join-button"
                              onPress={handleFooterRequestJoinPress}
                              disabled={joining}
                              hitSlop={footerHitSlop}
                              unstable_pressDelay={0}
                              pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
                              onPressIn={() => {
                                if (touchDebugEnabled) {
                                  Logger.debug("TouchDebug", "pressIn", {
                                    tag: "lobby_request_join",
                                  });
                                }
                              }}
                              style={({ pressed }) => [
                                styles.getRequestButton,
                                pressed && styles.footerButtonPressed,
                                joining && { opacity: 0.6 },
                              ]}
                            >
                              {joining ? (
                                <ActivityIndicator color="#fff" />
                              ) : (
                                <Text style={styles.getRequestButtonText}>
                                  Request to Join
                                </Text>
                              )}
                            </Pressable>
                          )
                        )}
                      </View>
                    </View>
                  ) : (
                    <View style={styles.footerRow}>
                      <View style={[styles.joinedButton, { flex: 1.5 }]}>
                        <Text style={styles.joinedText}>
                          {isHost ? "Waiting for kickoff..." : "You are in!"}
                        </Text>
                      </View>

                      {/* Self-Leave Button if not Host (Host deletes) */}
                      {!isHost && (
                        <AppButton
                          variant="danger"
                          size="lg"
                          onPress={() => {
                            if (touchDebugEnabled) {
                              Logger.debug("TouchDebug", "press", {
                                tag: "lobby_leave",
                              });
                            }
                            handleLeaveAction();
                          }}
                          onPressIn={() => {
                            if (touchDebugEnabled) {
                              Logger.debug("TouchDebug", "pressIn", {
                                tag: "lobby_leave",
                              });
                            }
                          }}
                          disabled={joining}
                          style={styles.footerAction}
                          hitSlop={footerHitSlop}
                        >
                          {joining ? (
                            <ActivityIndicator color={COLORS.error} />
                          ) : (
                            <Text style={styles.secondaryButtonText}>Leave</Text>
                          )}
                        </AppButton>
                      )}
                    </View>
                  )
                ) : (
                  // Match In Progress or Verifying
                  <View style={{ gap: SPACING.sm }}>
                    <View style={styles.statusBanner}>
                      <Text style={styles.statusText}>
                        Status: {resultStatusLabel}
                      </Text>
                    </View>

                    {/* Captain Result Action */}
                    {room.status === "in-progress" &&
                      isJoined && (
                        <AppButton
                          variant="ghost"
                          size="lg"
                          onPressIn={() => {
                            if (touchDebugEnabled) {
                              Logger.debug("TouchDebug", "pressIn", {
                                tag: "lobby_report_result",
                              });
                            }
                          }}
                          onPress={handleResultSubmissionAction}
                          style={styles.warningActionButton}
                          hitSlop={footerHitSlop}
                        >
                          <Text style={styles.warningActionText}>Report Result</Text>
                        </AppButton>
                      )}

                    {/* Participant Vote Action */}
                    {room.resultVerification?.status === "participant_vote" &&
                      isJoined && (
                        <AppButton
                          variant="danger"
                          size="lg"
                          onPressIn={() => {
                            if (touchDebugEnabled) {
                              Logger.debug("TouchDebug", "pressIn", {
                                tag: "lobby_vote_dispute",
                              });
                            }
                          }}
                          onPress={handleVoteAction}
                          style={styles.forceCancelButton}
                          hitSlop={footerHitSlop}
                        >
                          <Text style={styles.secondaryButtonText}>Vote on Dispute</Text>
                        </AppButton>
                      )}
                  </View>
                )}

                {/* Complain Button (Visible for In-Progress or Completed 24h) */}
                {room && (isJoined || isZoneAdmin) && canSubmitComplain(room) && (
                  <AppButton
                    variant="danger"
                    size="lg"
                    onPressIn={() => {
                      if (touchDebugEnabled) {
                        Logger.debug("TouchDebug", "pressIn", {
                          tag: "lobby_complain",
                        });
                      }
                    }}
                    onPress={() => setShowComplainModal(true)}
                    style={styles.complainBtn}
                  >
                    <AppIcon
                      name="report-problem"
                      size={20}
                      color={COLORS.error}
                    />
                    <Text style={styles.complainBtnText}>Report Issue</Text>
                  </AppButton>
                )}
              </View>
              </View>
            ) : null}
          </Animated.View>
        </ScrollView>
        {showStickyLobbyActions ? (
          <BottomActionBar>
            {showFloatingRequestJoin ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: joining }}
                testID="matchroom-request-join-bottom-button"
                onPress={handleFooterRequestJoinPress}
                disabled={joining}
                hitSlop={footerHitSlop}
                unstable_pressDelay={0}
                pressRetentionOffset={{ top: 24, bottom: 24, left: 24, right: 24 }}
                onPressIn={() => {
                  if (touchDebugEnabled) {
                    Logger.debug("TouchDebug", "pressIn", {
                      tag: "lobby_floating_request_join",
                    });
                  }
                }}
                style={({ pressed }) => [
                  styles.getRequestButton,
                  pressed && styles.footerButtonPressed,
                  joining && { opacity: 0.6 },
                ]}
              >
                {joining ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.getRequestButtonText}>Request to Join</Text>
                )}
              </Pressable>
            ) : hasPendingPayment ? (
              <View style={{ gap: SPACING.sm }}>
                <Text style={{ textAlign: "center", color: COLORS.muted }}>
                  Captain approved your request. Complete payment to reserve your seat.
                </Text>
                <AppButton
                  size="lg"
                  onPress={openPendingPayment}
                  hitSlop={footerHitSlop}
                >
                  <Text style={styles.joinButtonText}>Pay Now</Text>
                  <AppIcon name="payment" size={18} color="#FFF" />
                </AppButton>
              </View>
            ) : isExpired ? (
              <View style={[styles.fullButton, styles.expiredBanner]}>
                <Text style={styles.fullText}>Matchroom Expired</Text>
              </View>
            ) : room.status !== "in-progress" && room.status !== "completed" ? (
              <View style={styles.footerRow}>
                <View style={[styles.joinedButton, { flex: 1.5 }]}>
                  <Text style={styles.joinedText}>
                    {isHost ? "Waiting for kickoff..." : "You are in!"}
                  </Text>
                </View>
                {!isHost && (
                  <AppButton
                    variant="danger"
                    size="lg"
                    onPress={() => {
                      if (touchDebugEnabled) {
                        Logger.debug("TouchDebug", "press", {
                          tag: "lobby_leave",
                        });
                      }
                      handleLeaveAction();
                    }}
                    onPressIn={() => {
                      if (touchDebugEnabled) {
                        Logger.debug("TouchDebug", "pressIn", {
                          tag: "lobby_leave",
                        });
                      }
                    }}
                    disabled={joining}
                    style={styles.footerAction}
                    hitSlop={footerHitSlop}
                  >
                    {joining ? (
                      <ActivityIndicator color={COLORS.error} />
                    ) : (
                      <Text style={styles.secondaryButtonText}>Leave</Text>
                    )}
                  </AppButton>
                )}
              </View>
            ) : (
              <View style={{ gap: SPACING.sm }}>
                <View style={styles.statusBanner}>
                  <Text style={styles.statusText}>
                    Status: {resultStatusLabel}
                  </Text>
                </View>
                {room.status === "in-progress" && (
                  <AppButton
                    variant="ghost"
                    size="lg"
                    onPress={handleResultSubmissionAction}
                    style={styles.warningActionButton}
                    hitSlop={footerHitSlop}
                  >
                    <Text style={styles.warningActionText}>Report Result</Text>
                  </AppButton>
                )}
                {room.resultVerification?.status === "participant_vote" && (
                  <AppButton
                    variant="danger"
                    size="lg"
                    onPress={handleVoteAction}
                    style={styles.forceCancelButton}
                    hitSlop={footerHitSlop}
                  >
                    <Text style={styles.secondaryButtonText}>Vote on Dispute</Text>
                  </AppButton>
                )}
              </View>
            )}
          </BottomActionBar>
        ) : null}
      </View>

      <MatchroomJoinTeamSheet
        visible={showJoinTeamSheet}
        onClose={() => setShowJoinTeamSheet(false)}
        joining={joining}
        styles={styles}
        teamA={joinTeamOptions.teamA}
        teamB={joinTeamOptions.teamB}
        onSelectTeam={handleSelectJoinTeam}
      />

      <MatchroomInviteSheet
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        loading={loadingFriends}
        friends={friends}
        joining={joining}
        styles={styles}
        onInvite={handleSendInviteAction}
      />

      {/* Report Issue Modal */}
      <ReportIssueModal
        visible={showComplainModal}
        title={reportedPlayer ? `Report ${reportedPlayer.name}` : "Report Matchroom"}
        subtitle={reportedPlayer ? "Report a player in this matchroom." : "Help us keep MatchHai safe."}
        reasons={COMPLAIN_REASONS}
        reason={complainReason}
        description={complainDescription}
        onChangeReason={setComplainReason}
        onChangeDescription={setComplainDescription}
        onSubmit={handleReportSubmit}
        onClose={() => {
          setReportedPlayer(null);
          setShowComplainModal(false);
        }}
        loading={submittingComplain}
        submitLabel="Submit Report"
      />

      {setupModal}

      <MatchroomSuggestSheet
        visible={showSuggestModal}
        onClose={() => setShowSuggestModal(false)}
        dismissDisabled={adminProcessing !== null}
        styles={styles}
        counterPrice={counterPrice}
        setCounterPrice={setCounterPrice}
        counterDateValue={counterDateValue}
        toDateDisplay={toDateDisplay}
        toTimeDisplay={toTimeDisplay}
        counterExpiryMinutes={counterExpiryMinutes}
        setCounterExpiryMinutes={setCounterExpiryMinutes}
        counterMessage={counterMessage}
        setCounterMessage={setCounterMessage}
        adminProcessing={adminProcessing}
        onSubmit={handleZoneSuggestAction}
      />

      <MatchroomAdminCancelSheet
        visible={showAdminCancelModal}
        onClose={() => setShowAdminCancelModal(false)}
        styles={styles}
        adminProcessing={adminProcessing}
        adminCancelReasons={ADMIN_CANCEL_REASONS}
        adminCancelReason={adminCancelReason}
        setAdminCancelReason={setAdminCancelReason}
        adminCancelNote={adminCancelNote}
        setAdminCancelNote={setAdminCancelNote}
        onSubmit={handleAdminForceCancelAction}
      />
    </Screen>
  );
}


import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StatusBar,
  Text,
  View,
} from "react-native";
import Animated from "react-native-reanimated";

import AppHeader from "../../src/components/AppHeader";
import { AppIcon } from "../../src/components/AppIcon";
import Screen from "../../src/components/Screen";
import SegmentedTabs from "../../src/components/SegmentedTabs";
import { useAuth } from "../../src/context/AuthContext";
import { useNotifications, Notification } from "../../src/hooks/useNotifications";
import { useRouteLogger } from "../../src/hooks/useRouteLogger";
import { useEntrance } from "../../src/motion/useEntrance";
import { usePressScale } from "../../src/motion/usePressScale";
import { COLORS } from "../../src/theme";
import Logger from "../../src/utils/logger";
import { recordCountMetric } from "../../src/utils/perfInstrumentation";
import { InboxEmptyState } from "./components/InboxEmptyState";
import { InboxNotificationCard } from "./components/InboxNotificationCard";
import { InboxSwipeableRow } from "./components/InboxSwipeableRow";
import { useInboxActions } from "./hooks/useInboxActions";
import { useInboxViewModel } from "./hooks/useInboxViewModel";
import styles from "./inbox.styles";

const HIT_SLOP_8 = { top: 8, bottom: 8, left: 8, right: 8 } as const;

const InboxListItem = React.memo(function InboxListItem({
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
  onDeleteNotification,
}: {
  item: Notification;
  processing: string | null;
  touchDebugEnabled: boolean;
  openProfile: (uid?: string) => void;
  openTeam: (teamId?: string) => void;
  openMatchroom: (matchroomId?: string) => void;
  openChallenge: (challengeId?: string) => void;
  handleFriendResponse: (notifId: string, decision: "accept" | "decline") => void;
  handleJoinResponse: (notifId: string, decision: "accept" | "reject") => void;
  handleMatchJoinResponse: (notifId: string, decision: "accept" | "reject") => void;
  handleInviteResponse: (notifId: string, decision: "accept" | "decline") => void;
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
  onDeleteNotification: (notifId: string) => void;
}) {
  const handleDelete = useCallback(() => {
    onDeleteNotification(item.id);
  }, [item.id, onDeleteNotification]);

  const cardContent = (
    <InboxNotificationCard
      item={item}
      processing={processing}
      touchDebugEnabled={touchDebugEnabled}
      openProfile={openProfile}
      openTeam={openTeam}
      openMatchroom={openMatchroom}
      openChallenge={openChallenge}
      handleFriendResponse={handleFriendResponse}
      handleJoinResponse={handleJoinResponse}
      handleMatchJoinResponse={handleMatchJoinResponse}
      handleInviteResponse={handleInviteResponse}
      handleBookingApproval={handleBookingApproval}
      handleSeatInvitation={handleSeatInvitation}
      handleCounterOfferResponse={handleCounterOfferResponse}
    />
  );

  if (item.status !== "pending") {
    return (
      <InboxSwipeableRow onDelete={handleDelete} canSwipe={true}>
        {cardContent}
      </InboxSwipeableRow>
    );
  }

  return <View style={styles.pendingCardSpacer}>{cardContent}</View>;
});

export default function Inbox() {
  useRouteLogger("InboxScreen");
  const router = useRouter();
  const { user } = useAuth();
  const { animatedStyle: entranceStyle } = useEntrance({
    axis: "y",
    distance: 10,
    initialScale: 0.995,
  });
  const { animatedStyle: clearHistoryPressStyle, onPressIn: clearHistoryPressIn, onPressOut: clearHistoryPressOut } =
    usePressScale({ activeScale: 0.99 });

  const [activeTab, setActiveTab] = useState<"pending" | "resolved">("pending");
  const [processing, setProcessing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const touchDebugEnabled = __DEV__ && process.env.EXPO_PUBLIC_TOUCH_DEBUG === "1";

  const {
    notifications,
    loading,
    markAllAsRead: markAllReadHook,
    markManyAsRead,
    updateStatus,
    deleteNotification: deleteNotificationHook,
    deleteNotifications,
  } = useNotifications(activeTab);

  const openProfile = useCallback((uid?: string) => {
    if (!uid) return;
    router.push(`/(player)/profile/${uid}` as any);
  }, [router]);

  const openTeam = useCallback((teamId?: string) => {
    if (!teamId) return;
    router.push(`/teams/${teamId}` as any);
  }, [router]);

  const openMatchroom = useCallback((matchroomId?: string) => {
    if (!matchroomId) return;
    router.push(`/matchrooms/${matchroomId}` as any);
  }, [router]);

  const openChallenge = useCallback((challengeId?: string) => {
    if (!challengeId) return;
    router.push(`/teams/challenge?id=${challengeId}` as any);
  }, [router]);

  const { unreadIds, hasUnread, pendingCount, filteredNotifications, resolvedCount } =
    useInboxViewModel({
      notifications,
      activeTab,
    });

  const {
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
  } = useInboxActions({
    activeTab,
    notifications,
    processing,
    setProcessing,
    deleting,
    setDeleting,
    userId: user?._id,
    markAllAsRead: markAllReadHook,
    updateStatus,
    deleteNotification: deleteNotificationHook,
    deleteNotifications,
    openMatchroom,
  });

  useEffect(() => {
    if (unreadIds.length === 0) return;

    const markUnreadBatch = async () => {
      try {
        await markManyAsRead(unreadIds);
        Logger.info("Inbox", `Marked ${unreadIds.length} notifications as read`);
        recordCountMetric("inbox.open_write_count", unreadIds.length, {
          tab: activeTab,
        });
      } catch (error) {
        Logger.error("Inbox", "Error auto-marking notifications as read", error);
      }
    };

    void markUnreadBatch();
  }, [activeTab, markManyAsRead, unreadIds]);

  const onDeleteNotification = useCallback((notifId: string) => {
    handleDeleteNotification(notifId);
  }, [handleDeleteNotification]);

  const renderItem = useCallback(({ item }: { item: Notification }) => {
    return (
      <InboxListItem
        item={item}
        processing={processing}
        touchDebugEnabled={touchDebugEnabled}
        openProfile={openProfile}
        openTeam={openTeam}
        openMatchroom={openMatchroom}
        openChallenge={openChallenge}
        handleFriendResponse={handleFriendResponse}
        handleJoinResponse={handleJoinResponse}
        handleMatchJoinResponse={handleMatchJoinResponse}
        handleInviteResponse={handleInviteResponse}
        handleBookingApproval={handleBookingApproval}
        handleSeatInvitation={handleSeatInvitation}
        handleCounterOfferResponse={handleCounterOfferResponse}
        onDeleteNotification={onDeleteNotification}
      />
    );
  }, [
    handleBookingApproval,
    handleCounterOfferResponse,
    handleFriendResponse,
    handleInviteResponse,
    handleJoinResponse,
    handleMatchJoinResponse,
    handleSeatInvitation,
    onDeleteNotification,
    openChallenge,
    openMatchroom,
    openProfile,
    openTeam,
    processing,
    touchDebugEnabled,
  ]);

  const keyExtractor = useCallback((item: Notification) => item.id, []);

  const headerRightAction = useMemo(() => {
    if (!hasUnread) return undefined;
    return (
      <Pressable onPress={handleMarkAllRead} style={styles.markAllReadButton}>
        <Text style={styles.markAllReadText}>Mark all read</Text>
      </Pressable>
    );
  }, [handleMarkAllRead, hasUnread]);

  return (
    <Screen style={styles.screen} scroll={false}>
      <StatusBar barStyle="light-content" />
      <AppHeader
        title="Inbox"
        onBack={() => router.back()}
        inlineTitle
        rightAction={headerRightAction}
      />

      <Animated.View style={entranceStyle}>
        <SegmentedTabs
          items={[
            { key: "pending", label: "Pending", badge: pendingCount > 0 ? pendingCount : undefined },
            { key: "resolved", label: "History" },
          ]}
          value={activeTab}
          onChange={setActiveTab}
          style={styles.segmentTabs}
        />

      {activeTab === "resolved" && resolvedCount > 0 && (
        <Pressable
          onPress={handleClearAllHistory}
          onPressIn={() => {
            clearHistoryPressIn();
            if (touchDebugEnabled) {
              Logger.debug("TouchDebug", "pressIn", { tag: "inbox_clear_history" });
            }
          }}
          onPressOut={clearHistoryPressOut}
          disabled={deleting}
          style={styles.clearHistoryButton}
          hitSlop={HIT_SLOP_8}
        >
          {deleting ? (
            <ActivityIndicator size="small" color={COLORS.error} />
          ) : (
            <Animated.View style={clearHistoryPressStyle}>
              <View style={styles.clearHistoryContent}>
                <AppIcon name="delete-sweep" size={20} color={COLORS.error} />
                <Text style={styles.clearHistoryText}>Clear All History</Text>
              </View>
            </Animated.View>
          )}
        </Pressable>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          ListEmptyComponent={<InboxEmptyState activeTab={activeTab} />}
        />
      )}
      </Animated.View>
    </Screen>
  );
}

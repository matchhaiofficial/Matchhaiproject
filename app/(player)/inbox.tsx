import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  StatusBar,
  Text,
  View,
} from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppHeader from "../../src/components/AppHeader";
import { AppIcon } from "../../src/components/AppIcon";
import {
  AppDrawer,
  AppModalBody,
  AppModalFooter,
  AppModalHeader,
} from "../../src/components/AppModalPrimitives";
import { AppButton } from "../../src/components/AppPrimitives";
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
import { useInboxViewModel, type InboxTypeFilter } from "./hooks/useInboxViewModel";
import styles from "./inbox.styles";

const HIT_SLOP_8 = { top: 8, bottom: 8, left: 8, right: 8 } as const;
const DRAWER_WIDTH = Math.min(380, Dimensions.get("window").width * 0.9);

const TYPE_FILTER_OPTIONS: { key: InboxTypeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "matchrooms", label: "Matchrooms" },
  { key: "teams", label: "Teams" },
  { key: "payments", label: "Payments" },
  { key: "support", label: "Support" },
  { key: "reports", label: "Reports" },
  { key: "system", label: "System" },
];

function InboxTypeFilterRow({
  selected,
  onSelect,
}: {
  selected: InboxTypeFilter;
  onSelect: (value: InboxTypeFilter) => void;
}) {
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterSectionLabel}>Type</Text>
      <View style={styles.filterChipWrap}>
        {TYPE_FILTER_OPTIONS.map((option) => {
          const isSelected = selected === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => onSelect(option.key)}
              style={({ pressed }) => [
                styles.filterChip,
                isSelected && styles.filterChipActive,
                pressed && styles.filterChipPressed,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  isSelected && styles.filterChipTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function FilteredInboxEmptyState() {
  return (
    <View style={styles.emptyContent}>
      <View style={styles.emptyIconContainer}>
        <AppIcon name="filters" size={40} tone="muted" />
      </View>
      <Text style={styles.emptyTitle}>No notifications match these filters.</Text>
      <Text style={styles.emptySubtitle}>Reset filters to view all notifications.</Text>
    </View>
  );
}

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
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { animatedStyle: entranceStyle } = useEntrance({
    axis: "y",
    distance: 10,
    initialScale: 0.995,
  });
  const { animatedStyle: clearHistoryPressStyle, onPressIn: clearHistoryPressIn, onPressOut: clearHistoryPressOut } =
    usePressScale({ activeScale: 0.99 });

  const [activeTab, setActiveTab] = useState<"pending" | "resolved">("pending");
  const [typeFilter, setTypeFilter] = useState<InboxTypeFilter>("all");
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const autoMarkedReadForUserRef = useRef<string | null>(null);
  const touchDebugEnabled = __DEV__ && process.env.EXPO_PUBLIC_TOUCH_DEBUG === "1";

  const {
    notifications,
    loading,
    markAllAsRead: markAllReadHook,
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
    router.push({
      pathname: `/teams/${teamId}` as any,
      params: { source: "notification" },
    });
  }, [router]);

  const openMatchroom = useCallback((matchroomId?: string) => {
    if (!matchroomId) return;
    router.push(`/matchrooms/${matchroomId}` as any);
  }, [router]);

  const openChallenge = useCallback((challengeId?: string) => {
    if (!challengeId) return;
    router.push(`/teams/challenge?id=${challengeId}` as any);
  }, [router]);

  const {
    hasUnread,
    pendingCount,
    tabNotifications,
    filteredNotifications,
    resolvedCount,
  } =
    useInboxViewModel({
      notifications,
      activeTab,
      typeFilter,
    });

  const activeFilterCount = typeFilter === "all" ? 0 : 1;
  const hasTabNotifications = tabNotifications.length > 0;

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

  const onDeleteNotification = useCallback((notifId: string) => {
    handleDeleteNotification(notifId);
  }, [handleDeleteNotification]);

  useEffect(() => {
    if (loading || !user?._id || autoMarkedReadForUserRef.current === user._id) return;

    autoMarkedReadForUserRef.current = user._id;

    const markInboxRead = async () => {
      try {
        const updatedCount = await markAllReadHook();
        Logger.info("Inbox", `Marked ${updatedCount || 0} inbox notifications as read`);
        recordCountMetric("inbox.open_write_count", Number(updatedCount || 0), {
          tab: "all",
          source: "screen_open",
        });
      } catch (error) {
        autoMarkedReadForUserRef.current = null;
        Logger.error("Inbox", "Error auto-marking notifications as read", error);
      }
    };

    void markInboxRead();
  }, [loading, markAllReadHook, user?._id]);

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

      <Animated.View style={[styles.contentWrap, entranceStyle]}>
        <View style={styles.tabsFilterRow}>
          <SegmentedTabs
            items={[
              { key: "pending", label: "Pending", badge: pendingCount > 0 ? pendingCount : undefined },
              { key: "resolved", label: "History" },
            ]}
            value={activeTab}
            onChange={setActiveTab}
            style={styles.tabsInRow}
          />
          <Pressable
            onPress={() => setFilterDrawerOpen(true)}
            style={({ pressed }) => [
              styles.filterButton,
              pressed && styles.filterButtonPressed,
            ]}
            hitSlop={HIT_SLOP_8}
          >
            <AppIcon name="filters" size={20} color={COLORS.text} />
            {activeFilterCount > 0 ? (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <View style={styles.filterSummaryRow}>
          <Text style={styles.filterSummary}>
            {filteredNotifications.length} of {tabNotifications.length} notification
            {tabNotifications.length === 1 ? "" : "s"}
          </Text>
        </View>

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
          ListEmptyComponent={
            hasTabNotifications ? (
              <FilteredInboxEmptyState />
            ) : (
              <InboxEmptyState activeTab={activeTab} />
            )
          }
        />
      )}
      </Animated.View>

      <AppDrawer
        visible={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        drawerStyle={[styles.filterDrawer, { width: DRAWER_WIDTH }]}
      >
        <View style={[styles.filterDrawerContent, { paddingTop: Math.max(insets.top, 16) }]}>
          <AppModalHeader
            title="Filters"
            subtitle={`${activeFilterCount} active inbox filters`}
            onClose={() => setFilterDrawerOpen(false)}
            compact
          />
          <AppModalBody scroll contentContainerStyle={styles.filterDrawerBody}>
            <InboxTypeFilterRow selected={typeFilter} onSelect={setTypeFilter} />
          </AppModalBody>
          <AppModalFooter style={styles.filterDrawerFooter}>
            <View style={styles.filterDrawerFooterRow}>
              <AppButton
                variant="ghost"
                disabled={activeFilterCount === 0}
                style={styles.filterDrawerFooterButton}
                onPress={() => setTypeFilter("all")}
              >
                Reset
              </AppButton>
              <AppButton
                style={styles.filterDrawerFooterButton}
                onPress={() => setFilterDrawerOpen(false)}
              >
                Done
              </AppButton>
            </View>
          </AppModalFooter>
        </View>
      </AppDrawer>
    </Screen>
  );
}

import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../../convex/_generated/api";
import AppHeader from "../../src/components/AppHeader";
import { AppIcon } from "../../src/components/AppIcon";
import {
  AppDrawer,
  AppModalBody,
  AppModalFooter,
  AppModalHeader,
} from "../../src/components/AppModalPrimitives";
import { AppButton, AppCard, StatusPill } from "../../src/components/AppPrimitives";
import Screen from "../../src/components/Screen";
import SegmentedTabs from "../../src/components/SegmentedTabs";
import { useAuth } from "../../src/context/AuthContext";
import { DiscoverFilterRow } from "../../src/features/discover/components/DiscoverShared";
import { DISCOVER_GAMES } from "../../src/features/discover/filterConfig";
import { useRouteLogger } from "../../src/hooks/useRouteLogger";
import { convex } from "../../src/lib/convex";
import { Matchroom, getUserMatchrooms } from "../../src/services/convex/matchService";
import { getMyReports } from "../../src/services/convex/reportService";
import { COLORS } from "../../src/theme";
import Logger from "../../src/utils/logger";
import { getReportStatusLabel } from "../../src/utils/statusLabels";
import { getRoomStartDate } from "../../src/utils/timeFilters";
import styles from "./schedule.styles";

type ScheduleTab = "upcoming" | "actions" | "history";
type ScheduleDateFilter = "Any" | "Today" | "Tomorrow" | "This Week";
type ScheduleStatusFilter =
  | "Any"
  | "Confirmed"
  | "Pending Payment"
  | "Pending Approval"
  | "Waiting Lobby"
  | "Waiting Venue"
  | "Completed"
  | "Cancelled";
type ScheduleVenueFilter = "Any" | "Zone" | "Broadcast";
type SchedulePaymentFilter = "Any" | "Paid" | "Unpaid";

type ScheduleFilters = {
  game: string;
  date: ScheduleDateFilter;
  status: ScheduleStatusFilter;
  venue: ScheduleVenueFilter;
  payment: SchedulePaymentFilter;
};

type TimelineActionItem = {
  key: string;
  title: string;
  subtitle: string;
  status: string;
  cta: string;
  onPress: () => void;
};

type BookingIntentRow = {
  _id: string;
  id?: string;
  intentId?: string;
  matchroomId?: string;
  game?: string;
  status?: string;
  paymentStatus?: string;
  side?: string;
  pricing?: { totalCost?: number; currency?: string };
  selectedSlots?: number[];
  createdAt?: number;
  updatedAt?: number;
};

type ScheduleRoomItem = {
  key: string;
  room: Matchroom;
  status: string;
  reason: string;
  tone: "neutral" | "info" | "success" | "warning" | "danger";
  intent?: BookingIntentRow;
};

const DEFAULT_FILTERS: ScheduleFilters = {
  game: "all",
  date: "Any",
  status: "Any",
  venue: "Any",
  payment: "Any",
};

const dedupeRooms = (rooms: Matchroom[]) => {
  const byId = new Map<string, Matchroom>();
  rooms.forEach((room) => {
    const id = getRoomId(room);
    if (id) byId.set(id, room);
  });
  return Array.from(byId.values());
};

const formatGameLabel = (value?: string | null) =>
  String(value || "Match")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatStatusLabel = (value?: string | null) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getTimelineTone = (value?: string | null) => {
  const status = String(value || "").toLowerCase();
  if (status.includes("resolved") || status.includes("completed")) return "success";
  if (status.includes("pending") || status.includes("reviewed")) return "warning";
  if (status.includes("rejected") || status.includes("cancelled") || status.includes("expired")) return "danger";
  return "info";
};

const getRoomId = (room: Matchroom) => String(room.id || room._id || "");

const getRoomSlots = (room: Matchroom) => [
  ...((room.slotsA || []) as any[]),
  ...((room.slotsB || []) as any[]),
];

const isUserConfirmedInRoom = (room: Matchroom, userId?: string | null) => {
  if (!userId) return false;
  if (String(room.hostUid) === String(userId)) return true;
  if ((room.playerUids || []).map(String).includes(String(userId))) return true;
  return getRoomSlots(room).some((slot) => {
    const slotUserId = String(slot?.uid || slot?.user?.uid || "");
    return slotUserId === String(userId) && String(slot?.status || "").toLowerCase() === "confirmed";
  });
};

const isRoomFull = (room: Matchroom) => {
  const slots = getRoomSlots(room);
  if (slots.length > 0) {
    return slots.every((slot) => String(slot?.status || "").toLowerCase() === "confirmed");
  }
  return Number(room.currentPlayers || 0) >= Number(room.maxPlayers || 0);
};

const isZoneRoom = (room: Matchroom) =>
  Boolean(room.zoneId || room.confirmedZoneId) || room.locationMode === "zone";

const isZoneApproved = (room: Matchroom) => !isZoneRoom(room) || room.zoneAdminApproved === true;

const getIntentId = (intent?: BookingIntentRow) =>
  intent ? String(intent.intentId || intent.id || intent._id || "") : "";

const getRoomIntent = (room: Matchroom, intents: BookingIntentRow[]) => {
  const roomId = getRoomId(room);
  return intents
    .filter((intent) => String(intent.matchroomId || "") === roomId)
    .sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0))[0];
};

const getRoomScheduleState = (
  room: Matchroom,
  userId: string | undefined,
  intent?: BookingIntentRow,
): Pick<ScheduleRoomItem, "status" | "reason" | "tone"> => {
  const roomStatus = String(room.status || "").toLowerCase();
  if (roomStatus === "cancelled") {
    return { status: "Cancelled", reason: "Lobby was cancelled.", tone: "danger" };
  }
  if (roomStatus === "completed") {
    return { status: "Completed", reason: "Match completed.", tone: "success" };
  }
  if (intent && intent.paymentStatus !== "paid") {
    if (intent.status === "approved_pending_payment") {
      return { status: "Pending Payment", reason: "Your seat is approved. Payment is required.", tone: "warning" };
    }
    return { status: "Pending Approval", reason: "Waiting for captain approval before payment.", tone: "warning" };
  }
  if (!isUserConfirmedInRoom(room, userId)) {
    return { status: "Pending Approval", reason: "Your slot is not confirmed yet.", tone: "warning" };
  }
  if (!isRoomFull(room)) {
    return { status: "Waiting Lobby", reason: "Lobby is waiting for all players to join and pay.", tone: "warning" };
  }
  if (!isZoneApproved(room)) {
    return { status: "Waiting Venue", reason: "Venue admin approval is still pending.", tone: "warning" };
  }
  return { status: "Confirmed", reason: "Lobby is confirmed and ready.", tone: "success" };
};

const isSameDay = (date: Date, target: Date) =>
  date.getFullYear() === target.getFullYear() &&
  date.getMonth() === target.getMonth() &&
  date.getDate() === target.getDate();

const matchesDateFilter = (room: Matchroom, filter: ScheduleDateFilter) => {
  if (filter === "Any") return true;
  const start = getRoomStartDate(room);
  if (!start) return false;
  const now = new Date();
  if (filter === "Today") return isSameDay(start, now);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (filter === "Tomorrow") return isSameDay(start, tomorrow);
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + 7);
  return start >= now && start <= weekEnd;
};

const getActiveFilterCount = (filters: ScheduleFilters) =>
  Number(filters.game !== DEFAULT_FILTERS.game) +
  Number(filters.date !== DEFAULT_FILTERS.date) +
  Number(filters.status !== DEFAULT_FILTERS.status) +
  Number(filters.venue !== DEFAULT_FILTERS.venue) +
  Number(filters.payment !== DEFAULT_FILTERS.payment);

export default function ScheduleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ScheduleTab>("upcoming");
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Matchroom[]>([]);
  const [intents, setIntents] = useState<BookingIntentRow[]>([]);
  const [actionItems, setActionItems] = useState<TimelineActionItem[]>([]);
  const [historyItems, setHistoryItems] = useState<TimelineActionItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<ScheduleFilters>(DEFAULT_FILTERS);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  useRouteLogger("ScheduleScreen", { activeTab, userId: user?._id });

  const fetchTimeline = useCallback(async () => {
    if (!user?._id) {
      setRooms([]);
      setIntents([]);
      setActionItems([]);
      setHistoryItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [matchroomResult, allIntents, activeIntents, inboxPending, reportsResult] = await Promise.all([
        getUserMatchrooms(user._id),
        convex.query(api.bookings.listIntentsByUser, { userId: user._id }),
        convex.query(api.bookings.listActiveIntentsByUser, { userId: user._id }),
        convex.query(api.notifications.listInboxPage, { userId: user._id, tab: "pending", limit: 40 }),
        getMyReports(),
      ]);
      const reports = reportsResult.ok ? reportsResult.data : [];

      setRooms(
        matchroomResult.ok && matchroomResult.data
          ? dedupeRooms([...(matchroomResult.data.hosted || []), ...(matchroomResult.data.joined || [])])
          : [],
      );
      setIntents((allIntents || []) as BookingIntentRow[]);

      const pendingActions: TimelineActionItem[] = [];
      const history: TimelineActionItem[] = [];

      for (const intent of activeIntents || []) {
        pendingActions.push({
          key: `intent-${intent._id}`,
          title: `${formatGameLabel(intent.game)} booking payment`,
          subtitle: `Seat hold for ${intent.side} side • Rs ${Math.round(intent.pricing?.totalCost || 0)}`,
          status: intent.status === "approved_pending_payment" ? "Pending Payment" : formatStatusLabel(intent.status),
          cta: "Open booking status",
          onPress: () => router.push(`/matchrooms/book/status/${intent._id}` as any),
        });
      }

      for (const notification of inboxPending || []) {
        const title = notification.title || formatStatusLabel(notification.type);
        const body = notification.body || "You have a pending action waiting in Inbox.";
        pendingActions.push({
          key: `notification-${notification._id}`,
          title,
          subtitle: body,
          status: "Pending",
          cta: "Open inbox",
          onPress: () => router.push("/(player)/inbox" as any),
        });
      }

      for (const report of reports || []) {
        const unresolved = report.status !== "resolved";
        const item: TimelineActionItem = {
          key: `report-${report._id}`,
          title: report.reason,
          subtitle: unresolved
            ? "Your report is still in progress. Open it to review the moderation timeline."
            : "This report is resolved and saved in your report history.",
          status: getReportStatusLabel(report.status),
          cta: unresolved ? "Open report" : "View report",
          onPress: () => router.push(`/(player)/report/${report._id}` as any),
        };

        if (unresolved) pendingActions.push(item);
        else history.push(item);
      }

      setActionItems(pendingActions);
      setHistoryItems(history);
    } catch (error) {
      Logger.error("Schedule", "Failed to fetch player timeline", error);
      setRooms([]);
      setIntents([]);
      setActionItems([]);
      setHistoryItems([]);
    } finally {
      setLoading(false);
    }
  }, [router, user?._id]);

  useFocusEffect(useCallback(() => {
    fetchTimeline();
  }, [fetchTimeline]));

  const categorizedRooms = useMemo(() => {
    const now = Date.now();
    const upcoming: ScheduleRoomItem[] = [];
    const pending: ScheduleRoomItem[] = [];
    const previous: ScheduleRoomItem[] = [];

    rooms.forEach((room) => {
      const start = getRoomStartDate(room);
      const intent = getRoomIntent(room, intents);
      const state = getRoomScheduleState(room, user?._id, intent);
      const item: ScheduleRoomItem = { key: getRoomId(room), room, intent, ...state };

      if (room.status === "completed" || room.status === "cancelled") {
        previous.push(item);
        return;
      }
      if (!start) {
        pending.push(item);
        return;
      }
      if (start.getTime() < now - 15 * 60 * 1000) {
        previous.push(item);
        return;
      }
      if (state.status === "Confirmed") upcoming.push(item);
      else pending.push(item);
    });

    upcoming.sort((a, b) => (getRoomStartDate(a.room)?.getTime() || 0) - (getRoomStartDate(b.room)?.getTime() || 0));
    pending.sort((a, b) => (getRoomStartDate(a.room)?.getTime() || 0) - (getRoomStartDate(b.room)?.getTime() || 0));
    previous.sort((a, b) => (getRoomStartDate(b.room)?.getTime() || 0) - (getRoomStartDate(a.room)?.getTime() || 0));

    return { upcoming, pending, previous };
  }, [intents, rooms, user?._id]);

  const activeFilterCount = getActiveFilterCount(filters);
  const filterRoomItems = useCallback(
    (items: ScheduleRoomItem[]) => {
      const query = searchQuery.trim().toLowerCase();
      return items.filter((item) => {
        const room = item.room;
        const haystack = [
          room.title,
          room.game,
          room.location,
          room.scheduledDate,
          room.scheduledTime,
          item.status,
          item.reason,
        ].filter(Boolean).join(" ").toLowerCase();
        if (query && !haystack.includes(query)) return false;
        if (filters.game !== "all" && String(room.game || "").toLowerCase() !== filters.game) return false;
        if (!matchesDateFilter(room, filters.date)) return false;
        if (filters.status !== "Any" && item.status !== filters.status) return false;
        if (filters.venue !== "Any" && (isZoneRoom(room) ? "Zone" : "Broadcast") !== filters.venue) return false;
        if (filters.payment !== "Any") {
          const paymentStatus = item.intent?.paymentStatus || room.paymentStatus || "unpaid";
          if (filters.payment === "Paid" && paymentStatus !== "paid") return false;
          if (filters.payment === "Unpaid" && paymentStatus === "paid") return false;
        }
        return true;
      });
    },
    [filters, searchQuery],
  );

  const visibleRooms =
    activeTab === "upcoming"
      ? filterRoomItems(categorizedRooms.upcoming)
      : activeTab === "actions"
        ? filterRoomItems(categorizedRooms.pending)
        : filterRoomItems(categorizedRooms.previous);
  const visibleActions = activeTab === "actions" ? actionItems : historyItems;
  const filteredActions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return visibleActions;
    return visibleActions.filter((item) =>
      [item.title, item.subtitle, item.status].join(" ").toLowerCase().includes(query),
    );
  }, [searchQuery, visibleActions]);

  return (
    <Screen style={styles.screen} scroll={false}>
      <AppHeader title="Schedule" onBack={() => router.back()} inlineTitle />

      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <AppIcon name="search" size={20} color={COLORS.textSecondary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={`Search ${activeTab === "actions" ? "pending" : activeTab} matches`}
            placeholderTextColor={COLORS.textSecondary}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <Pressable
          onPress={() => setFilterDrawerOpen(true)}
          style={({ pressed }) => [styles.filterButton, pressed && styles.filterButtonPressed]}
        >
          <AppIcon name="filters" size={22} color={COLORS.text} />
          {activeFilterCount > 0 ? (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <SegmentedTabs
        items={[
          { key: "upcoming", label: "Upcoming", badge: categorizedRooms.upcoming.length },
          { key: "actions", label: "Pending", badge: categorizedRooms.pending.length + actionItems.length },
          { key: "history", label: "History", badge: categorizedRooms.previous.length + historyItems.length },
        ]}
        value={activeTab}
        onChange={(value) => setActiveTab(value as ScheduleTab)}
        style={styles.tabs}
      />

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {visibleRooms.length > 0 ? (
            visibleRooms.map((item) => (
              <Pressable key={item.key} onPress={() => router.push(`/matchrooms/${getRoomId(item.room)}` as any)}>
                <AppCard style={styles.timelineCard}>
                  <View style={styles.timelineTopRow}>
                    <Text style={styles.timelineTitle}>{item.room.title}</Text>
                    <StatusPill tone={item.tone} label={item.status} />
                  </View>
                  <Text style={styles.timelineSubtitle}>
                    {formatGameLabel(item.room.game)} • {item.reason}
                  </Text>
                  <Text style={styles.timelineMeta}>
                    {item.room.scheduledDate || "Date TBA"} {item.room.scheduledTime || ""} • {isZoneRoom(item.room) ? "Zone" : "Broadcast"}
                  </Text>
                  <View style={styles.cardActions}>
                    <Text style={styles.timelineCta}>Open lobby</Text>
                    {getIntentId(item.intent) ? (
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation();
                          router.push(`/matchrooms/book/status/${getIntentId(item.intent)}` as any);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.timelineCta}>Booking status</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </AppCard>
              </Pressable>
            ))
          ) : activeTab === "upcoming" ? (
            <AppCard variant="empty" style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No upcoming confirmed matches</Text>
              <Text style={styles.emptyText}>
                Confirmed, full, venue-approved matchrooms appear here.
              </Text>
            </AppCard>
          ) : null}

          {filteredActions.length > 0 ? (
            filteredActions.map((item) => (
              <Pressable key={item.key} onPress={item.onPress}>
                <AppCard style={styles.timelineCard}>
                  <View style={styles.timelineTopRow}>
                    <Text style={styles.timelineTitle}>{item.title}</Text>
                    <StatusPill tone={getTimelineTone(item.status)} label={item.status} />
                  </View>
                  <Text style={styles.timelineSubtitle}>{item.subtitle}</Text>
                  <Text style={styles.timelineCta}>{item.cta}</Text>
                </AppCard>
              </Pressable>
            ))
          ) : activeTab === "actions" && visibleRooms.length === 0 ? (
            <AppCard variant="empty" style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Nothing is pending</Text>
              <Text style={styles.emptyText}>
                Unpaid seats, lobby-fill waits, captain approvals, and venue approvals will surface here.
              </Text>
            </AppCard>
          ) : activeTab === "history" && visibleRooms.length === 0 ? (
            <AppCard variant="empty" style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No history yet</Text>
              <Text style={styles.emptyText}>
                Completed, cancelled, incomplete, and past matchrooms will build your timeline history.
              </Text>
            </AppCard>
          ) : null}
        </ScrollView>
      )}

      <ScheduleFilterDrawer
        visible={filterDrawerOpen}
        filters={filters}
        activeCount={activeFilterCount}
        onClose={() => setFilterDrawerOpen(false)}
        onReset={() => setFilters(DEFAULT_FILTERS)}
        onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
        bottomInset={insets.bottom}
      />
    </Screen>
  );
}

function ScheduleFilterDrawer({
  visible,
  filters,
  activeCount,
  onClose,
  onReset,
  onChange,
  bottomInset,
}: {
  visible: boolean;
  filters: ScheduleFilters;
  activeCount: number;
  onClose: () => void;
  onReset: () => void;
  onChange: (patch: Partial<ScheduleFilters>) => void;
  bottomInset: number;
}) {
  return (
    <AppDrawer visible={visible} onClose={onClose} drawerStyle={styles.drawer}>
      <View style={styles.drawerContent}>
        <AppModalHeader title="Filters" subtitle={`${activeCount} active schedule filters`} onClose={onClose} compact />
        <AppModalBody scroll contentContainerStyle={styles.drawerBody}>
          <DiscoverFilterRow
            label="Game"
            options={DISCOVER_GAMES}
            selected={filters.game}
            onSelect={(value) => onChange({ game: value })}
          />
          <DiscoverFilterRow
            label="Date"
            options={["Any", "Today", "Tomorrow", "This Week"]}
            selected={filters.date}
            onSelect={(value) => onChange({ date: value as ScheduleDateFilter })}
          />
          <DiscoverFilterRow
            label="Status"
            options={["Any", "Confirmed", "Pending Payment", "Pending Approval", "Waiting Lobby", "Waiting Venue", "Completed", "Cancelled"]}
            selected={filters.status}
            onSelect={(value) => onChange({ status: value as ScheduleStatusFilter })}
          />
          <DiscoverFilterRow
            label="Venue"
            options={["Any", "Zone", "Broadcast"]}
            selected={filters.venue}
            onSelect={(value) => onChange({ venue: value as ScheduleVenueFilter })}
          />
          <DiscoverFilterRow
            label="Payment"
            options={["Any", "Paid", "Unpaid"]}
            selected={filters.payment}
            onSelect={(value) => onChange({ payment: value as SchedulePaymentFilter })}
          />
        </AppModalBody>
        <AppModalFooter style={styles.drawerFooter}>
          <View style={[styles.drawerFooterRow, { paddingBottom: bottomInset + 8 }]}>
            <AppButton variant="secondary" style={styles.drawerFooterButton} onPress={onReset} disabled={activeCount === 0}>
              Reset
            </AppButton>
            <AppButton style={styles.drawerFooterButton} onPress={onClose}>
              Done
            </AppButton>
          </View>
        </AppModalFooter>
      </View>
    </AppDrawer>
  );
}

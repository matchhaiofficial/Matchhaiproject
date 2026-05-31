import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
import {
  Matchroom,
  getUserScheduleMatchroomsPage,
  type UserScheduleTab,
} from "../../src/services/convex/matchService";
import { COLORS } from "../../src/theme";
import Logger from "../../src/utils/logger";
import { getRoomStartDate } from "../../src/utils/timeFilters";
import styles from "./schedule.styles";

type ScheduleTab = UserScheduleTab;
type ScheduleDateFilter = "Any" | "Today" | "Tomorrow" | "This Week";
// Coarse, display-only status buckets. The internal per-room statuses produced
// by getRoomScheduleState are unchanged; these only collapse them for filtering.
type ScheduleStatusFilter = "Any" | "Upcoming" | "Needs Action" | "Completed" | "Cancelled";
// Stored values stay "Zone" / "Broadcast" (the filter logic depends on them);
// only the visible label is "Booking Type" / "Zone Booking".
type ScheduleVenueFilter = "Any" | "Zone" | "Broadcast";
type SchedulePaymentFilter = "Any" | "Paid" | "Unpaid";

type ScheduleFilters = {
  game: string;
  date: ScheduleDateFilter;
  status: ScheduleStatusFilter;
  venue: ScheduleVenueFilter;
  payment: SchedulePaymentFilter;
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

// Display-only grouping over the exact statuses getRoomScheduleState produces.
// This does not change how a room's status is computed or which tab it lands in;
// it only maps each status onto a coarse filter bucket. Unknown statuses fall
// through unchanged so they never silently match a group.
const STATUS_FILTER_GROUPS: Record<string, ScheduleStatusFilter> = {
  Confirmed: "Upcoming",
  "Pending Payment": "Needs Action",
  "Pending Approval": "Needs Action",
  "Waiting Lobby": "Needs Action",
  "Waiting Venue": "Needs Action",
  Completed: "Completed",
  Cancelled: "Cancelled",
};

const getStatusFilterGroup = (status: string): string => STATUS_FILTER_GROUPS[status] ?? status;

const getActiveFilterCount = (filters: ScheduleFilters) =>
  Number(filters.game !== DEFAULT_FILTERS.game) +
  Number(filters.date !== DEFAULT_FILTERS.date) +
  Number(filters.status !== DEFAULT_FILTERS.status) +
  Number(filters.venue !== DEFAULT_FILTERS.venue) +
  Number(filters.payment !== DEFAULT_FILTERS.payment);

const PAGE_SIZE = 20;

const mapDateFilterToQuery = (date: ScheduleDateFilter) => {
  if (date === "Today") return "today";
  if (date === "Tomorrow") return "tomorrow";
  if (date === "This Week") return "week";
  return "all";
};

const mapStatusFilterToQuery = (status: ScheduleStatusFilter) => {
  if (status === "Upcoming") return "upcoming";
  if (status === "Needs Action") return "needs_action";
  if (status === "Completed") return "completed";
  if (status === "Cancelled") return "cancelled";
  return "all";
};

const getBackendScheduleState = (room: Matchroom): Pick<ScheduleRoomItem, "status" | "reason" | "tone"> | null => {
  const derivedStatus = (room as any).derivedScheduleState;
  if (!derivedStatus) return null;
  return {
    status: String(derivedStatus),
    reason: String((room as any).scheduleReason || ""),
    tone: ((room as any).scheduleTone || "neutral") as ScheduleRoomItem["tone"],
  };
};

const ScheduleRoomCard = React.memo(function ScheduleRoomCard({
  item,
  onOpenRoom,
  onOpenBookingStatus,
}: {
  item: ScheduleRoomItem;
  onOpenRoom: (roomId: string) => void;
  onOpenBookingStatus: (intentId: string) => void;
}) {
  const intentId = getIntentId(item.intent);
  return (
    <Pressable onPress={() => onOpenRoom(getRoomId(item.room))}>
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
          {intentId ? (
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                onOpenBookingStatus(intentId);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.timelineCta}>Booking status</Text>
            </Pressable>
          ) : null}
        </View>
      </AppCard>
    </Pressable>
  );
});

export default function ScheduleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ScheduleTab>("upcoming");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [rooms, setRooms] = useState<Matchroom[]>([]);
  const [intents, setIntents] = useState<BookingIntentRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(true);
  const [tabCounts, setTabCounts] = useState<Partial<Record<ScheduleTab, number>>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<ScheduleFilters>(DEFAULT_FILTERS);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  useRouteLogger("ScheduleScreen", { activeTab, userId: user?._id });

  const fetchSchedule = useCallback(async (reset = true, nextCursor: string | null = null) => {
    if (!user?._id) {
      setRooms([]);
      setIntents([]);
      setCursor(null);
      setIsDone(true);
      setLoading(false);
      return;
    }

    if (reset) setLoading(true);
    else setLoadingMore(true);
    try {
      const result = await getUserScheduleMatchroomsPage({
        uid: user._id,
        tab: activeTab,
        limit: PAGE_SIZE,
        cursor: reset ? null : nextCursor,
        filters: {
          game: filters.game,
          dateRange: mapDateFilterToQuery(filters.date),
          venue: filters.venue.toLowerCase(),
          paymentStatus: filters.payment.toLowerCase(),
          searchText: searchQuery.trim(),
          statusGroup: mapStatusFilterToQuery(filters.status),
        },
      });
      if (!result.ok || !result.data) throw new Error(result.message);
      setRooms((current) => reset ? result.data!.page : dedupeRooms([...current, ...result.data!.page]));
      setIntents([]);
      setCursor(result.data.continueCursor);
      setIsDone(result.data.isDone);
      setTabCounts((current) => ({ ...current, [activeTab]: result.data?.total || 0 }));
    } catch (error) {
      Logger.error("Schedule", "Failed to fetch player schedule", error);
      setRooms([]);
      setIntents([]);
      setCursor(null);
      setIsDone(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeTab, filters, searchQuery, user?._id]);

  useFocusEffect(useCallback(() => {
    fetchSchedule(true);
  }, [fetchSchedule]));

  const activeFilterCount = getActiveFilterCount(filters);

  const visibleRooms = useMemo<ScheduleRoomItem[]>(() => {
    return rooms.map((room) => {
      const intent = getRoomIntent(room, intents);
      const state = getBackendScheduleState(room) || getRoomScheduleState(room, user?._id, intent);
      return { key: getRoomId(room), room, intent, ...state };
    });
  }, [intents, rooms, user?._id]);

  const rawTabCount = tabCounts[activeTab] ?? visibleRooms.length;

  const handleOpenRoom = useCallback(
    (roomId: string) => {
      router.push(`/matchrooms/${roomId}` as any);
    },
    [router],
  );
  const handleOpenBookingStatus = useCallback(
    (intentId: string) => {
      router.push(`/matchrooms/book/status/${intentId}` as any);
    },
    [router],
  );

  const listData = useMemo(() => visibleRooms, [visibleRooms]);

  const renderListItem = useCallback(
    ({ item }: { item: ScheduleRoomItem }) => (
      <ScheduleRoomCard
        item={item}
        onOpenRoom={handleOpenRoom}
        onOpenBookingStatus={handleOpenBookingStatus}
      />
    ),
    [handleOpenRoom, handleOpenBookingStatus],
  );

  return (
    <Screen style={styles.screen} scroll={false}>
      <AppHeader title="Schedule" onBack={() => router.back()} inlineTitle />

      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <AppIcon name="search" size={20} color={COLORS.textSecondary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={`Search ${activeTab} matches`}
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
          { key: "upcoming", label: "Upcoming", badge: tabCounts.upcoming },
          { key: "waiting", label: "Waiting", badge: tabCounts.waiting },
          { key: "history", label: "History", badge: tabCounts.history },
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
        <FlatList
          data={listData}
          keyExtractor={(item) => item.key}
          renderItem={renderListItem}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          onEndReached={() => {
            if (!loading && !loadingMore && !isDone) fetchSchedule(false, cursor);
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator color={COLORS.accent} />
            </View>
          ) : null}
          ListEmptyComponent={
            rawTabCount === 0 && !searchQuery.trim() && activeFilterCount === 0 ? (
              activeTab === "upcoming" ? (
                <AppCard variant="empty" style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No upcoming confirmed matches</Text>
                  <Text style={styles.emptyText}>
                    Confirmed, full, venue-approved matchrooms appear here.
                  </Text>
                </AppCard>
              ) : activeTab === "waiting" ? (
                <AppCard variant="empty" style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No matchrooms waiting</Text>
                  <Text style={styles.emptyText}>
                    Lobby fill, payment, captain approval, and venue approval matchrooms appear here.
                  </Text>
                </AppCard>
              ) : (
                <AppCard variant="empty" style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No history yet</Text>
                  <Text style={styles.emptyText}>
                    Completed, cancelled, incomplete, and past matchrooms will build your timeline history.
                  </Text>
                </AppCard>
              )
            ) : (
              <AppCard variant="empty" style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No schedule items match these filters.</Text>
                <Text style={styles.emptyText}>Reset filters to view all schedule items.</Text>
              </AppCard>
            )
          }
          removeClippedSubviews
          initialNumToRender={10}
          windowSize={11}
        />
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
            label="Date Range"
            options={["Any", "Today", "Tomorrow", "This Week"]}
            selected={filters.date}
            onSelect={(value) => onChange({ date: value as ScheduleDateFilter })}
          />
          <DiscoverFilterRow
            label="Status"
            options={["Any", "Upcoming", "Needs Action", "Completed", "Cancelled"]}
            selected={filters.status}
            onSelect={(value) => onChange({ status: value as ScheduleStatusFilter })}
          />
          <DiscoverFilterRow
            label="Booking Type"
            options={["Any", { key: "Zone", label: "Zone Booking" }, "Broadcast"]}
            selected={filters.venue}
            onSelect={(value) => onChange({ venue: value as ScheduleVenueFilter })}
          />
          <DiscoverFilterRow
            label="Payment Status"
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

import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from "react-native";

import {
  AdminEmptyStateCard,
  AdminFilterDrawer,
  AdminInfoLine,
  AdminListCard,
  AdminPageHeader,
  AdminSearchFilterBar,
} from "../../src/components/AdminSurface";
import Screen from "../../src/components/Screen";
import { DiscoverFilterRow } from "../../src/features/discover/components/DiscoverShared";
import { useTabBarClearance } from "../../src/hooks/useTabBarClearance";
import { useToast } from "../../src/hooks/useToast";
import { getSuperAdminMatchrooms, SuperAdminMatchroom } from "../../src/services/convex/superAdminService";
import { COLORS, SPACING } from "../../src/theme";

type MatchroomFilter = "Any" | SuperAdminMatchroom["lifecycleStatus"];

const FILTER_OPTIONS: MatchroomFilter[] = [
  "Any",
  "created_open",
  "waiting_lobby_fill",
  "waiting_zone_approval",
  "confirmed",
  "in-progress",
  "completed",
  "cancelled_expired",
];

function lifecycleLabel(value: MatchroomFilter) {
  switch (value) {
    case "created_open": return "Created / Open";
    case "waiting_lobby_fill": return "Waiting lobby fill";
    case "waiting_zone_approval": return "Waiting zone approval";
    case "confirmed": return "Confirmed";
    case "in-progress": return "In-progress";
    case "completed": return "Completed";
    case "cancelled_expired": return "Cancelled / Expired";
    default: return "Any";
  }
}

function lifecycleTone(value: SuperAdminMatchroom["lifecycleStatus"]) {
  if (value === "confirmed" || value === "completed") return "success" as const;
  if (value === "cancelled_expired") return "danger" as const;
  if (value === "in-progress") return "info" as const;
  return "warning" as const;
}

function formatDateTime(room: SuperAdminMatchroom) {
  return [room.scheduledDate, room.scheduledTime].filter(Boolean).join(" ") || "Date/time TBD";
}

const ALL = "All";

type DateRangeKey = "Any" | "Today" | "Last 7 Days" | "Last 30 Days";
const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: "Any", label: "Any" },
  { key: "Today", label: "Today" },
  { key: "Last 7 Days", label: "Last 7 Days" },
  { key: "Last 30 Days", label: "Last 30 Days" },
];

const BOOKING_TYPE_ORDER = ["Direct / Zone", "Broadcast", "Walk-in", "Other"] as const;
type BookingType = (typeof BOOKING_TYPE_ORDER)[number];

function matchesDateRange(timestamp: number | null | undefined, range: DateRangeKey) {
  if (range === "Any") return true;
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return false;
  const now = Date.now();
  if (range === "Today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startOfToday = start.getTime();
    return timestamp >= startOfToday && timestamp < startOfToday + 24 * 60 * 60 * 1000;
  }
  const days = range === "Last 7 Days" ? 7 : 30;
  return timestamp >= now - days * 24 * 60 * 60 * 1000 && timestamp <= now;
}

function getRoomTimestamp(room: SuperAdminMatchroom): number | null {
  if (typeof room.scheduledStartAt === "number" && Number.isFinite(room.scheduledStartAt)) {
    return room.scheduledStartAt;
  }
  if (room.scheduledDate) {
    const parsed = Date.parse(room.scheduledDate);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

// Booking Type is heuristic: SuperAdminMatchroom has no explicit locationMode/bookingSource,
// so we derive conservatively from the fields that ARE present. Anything we can't classify
// falls into "Other" so it is never hidden.
function getBookingType(room: SuperAdminMatchroom): BookingType {
  const loc = (room.location || "").toLowerCase();
  if (room.broadcastRequestStatus) return "Broadcast";
  if (loc.includes("walk-in") || loc.includes("walk in") || loc.includes("walkin")) return "Walk-in";
  if (room.zoneName) return "Direct / Zone";
  return "Other";
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

const MatchroomRow = React.memo(function MatchroomRow({
  room,
  onPress,
}: {
  room: SuperAdminMatchroom;
  onPress: (id: string) => void;
}) {
  return (
    <AdminListCard
      title={room.title || "Untitled matchroom"}
      subtitle={`${String(room.game || "Match").toUpperCase()} | ${formatDateTime(room)}`}
      statusLabel={lifecycleLabel(room.lifecycleStatus)}
      statusTone={lifecycleTone(room.lifecycleStatus)}
      onPress={() => onPress(room.id)}
    >
      <View style={styles.cardBody}>
        <AdminInfoLine label="Location" value={room.location || "N/A"} />
        <AdminInfoLine label="Players" value={`${room.currentPlayers || 0}/${room.maxPlayers || 0}`} />
      </View>
    </AdminListCard>
  );
});

export default function SuperAdminMatchroomsScreen() {
  const bottomContentPadding = useTabBarClearance(SPACING.lg);
  const { showToast } = useToast();
  const [rooms, setRooms] = useState<SuperAdminMatchroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MatchroomFilter>("Any");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [gameFilter, setGameFilter] = useState<string>(ALL);
  const [dateFilter, setDateFilter] = useState<DateRangeKey>("Any");
  const [bookingTypeFilter, setBookingTypeFilter] = useState<string>(ALL);
  const [paymentFilter, setPaymentFilter] = useState<string>(ALL);
  const [zoneFilter, setZoneFilter] = useState<string>(ALL);
  const [resultFilter, setResultFilter] = useState<string>(ALL);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);
    const result = await getSuperAdminMatchrooms();
    if (result.ok) setRooms(result.data);
    else showToast({ type: "error", title: "Matchrooms failed", message: result.message });
    if (mode === "initial") setLoading(false);
    else setRefreshing(false);
  }, [showToast]);

  useFocusEffect(useCallback(() => {
    void load("initial");
  }, [load]));

  const gameOptions = useMemo(() => {
    const present = Array.from(new Set(rooms.map((r) => r.game).filter(Boolean) as string[])).sort();
    return [{ key: ALL, label: "All" }, ...present.map((g) => ({ key: g, label: g.toUpperCase() }))];
  }, [rooms]);

  const paymentOptions = useMemo(() => {
    const present = Array.from(new Set(rooms.map((r) => r.paymentStatus).filter(Boolean) as string[])).sort();
    return [{ key: ALL, label: "All" }, ...present.map((p) => ({ key: p, label: formatLabel(p) }))];
  }, [rooms]);

  const zoneOptions = useMemo(() => {
    const present = Array.from(new Set(rooms.map((r) => r.zoneName).filter(Boolean) as string[])).sort();
    return [{ key: ALL, label: "All" }, ...present.map((z) => ({ key: z, label: z }))];
  }, [rooms]);

  const resultOptions = useMemo(() => {
    const present = Array.from(new Set(rooms.map((r) => r.resultVerificationStatus).filter(Boolean) as string[])).sort();
    return [{ key: ALL, label: "All" }, ...present.map((s) => ({ key: s, label: formatLabel(s) }))];
  }, [rooms]);

  const bookingTypeOptions = useMemo(() => {
    const present = new Set(rooms.map((r) => getBookingType(r)));
    const ordered = BOOKING_TYPE_ORDER.filter((t) => present.has(t));
    return [{ key: ALL, label: "All" }, ...ordered.map((t) => ({ key: t, label: t }))];
  }, [rooms]);

  const visibleRooms = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rooms.filter((room) => {
      if (filter !== "Any" && room.lifecycleStatus !== filter) return false;
      if (gameFilter !== ALL && room.game !== gameFilter) return false;
      if (paymentFilter !== ALL && room.paymentStatus !== paymentFilter) return false;
      if (zoneFilter !== ALL && room.zoneName !== zoneFilter) return false;
      if (resultFilter !== ALL && room.resultVerificationStatus !== resultFilter) return false;
      if (bookingTypeFilter !== ALL && getBookingType(room) !== bookingTypeFilter) return false;
      if (!matchesDateRange(getRoomTimestamp(room), dateFilter)) return false;
      if (!needle) return true;
      return [
        room.title,
        room.game,
        room.location,
        room.status,
        room.paymentStatus,
        room.matchCode,
        lifecycleLabel(room.lifecycleStatus),
      ].filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [filter, query, rooms, gameFilter, paymentFilter, zoneFilter, resultFilter, bookingTypeFilter, dateFilter]);

  const activeCount =
    Number(filter !== "Any") +
    Number(gameFilter !== ALL) +
    Number(dateFilter !== "Any") +
    Number(bookingTypeFilter !== ALL) +
    Number(paymentFilter !== ALL) +
    Number(zoneFilter !== ALL) +
    Number(resultFilter !== ALL);

  const resetFilters = useCallback(() => {
    setFilter("Any");
    setGameFilter(ALL);
    setDateFilter("Any");
    setBookingTypeFilter(ALL);
    setPaymentFilter(ALL);
    setZoneFilter(ALL);
    setResultFilter(ALL);
  }, []);

  const handleOpenRoom = useCallback((id: string) => {
    router.push(`/super-admin/matchroom/${id}` as any);
  }, []);

  const renderRoom = useCallback(
    ({ item }: { item: SuperAdminMatchroom }) => <MatchroomRow room={item} onPress={handleOpenRoom} />,
    [handleOpenRoom],
  );

  const renderEmpty = useCallback(
    () =>
      rooms.length === 0 ? (
        <AdminEmptyStateCard
          title="No matchrooms found"
          description="Matchrooms will appear here once created."
          icon="matchroom"
        />
      ) : (
        <AdminEmptyStateCard
          title="No matchrooms match these filters."
          description="Reset filters to view all matchrooms."
          icon="matchroom"
        />
      ),
    [rooms.length],
  );

  return (
    <Screen style={styles.screen} scroll={false}>
      <AdminPageHeader title="Matchrooms" onBack={() => router.back()} inlineTitle />
      <AdminSearchFilterBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search matchrooms"
        onFilterPress={() => setDrawerOpen(true)}
        activeFilterCount={activeCount}
        style={styles.searchBar}
      />

      {loading ? (
        <View style={styles.loaderWrap}><ActivityIndicator color={COLORS.accent} /></View>
      ) : (
        <FlatList
          data={visibleRooms}
          keyExtractor={(room) => room.id}
          renderItem={renderRoom}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={[styles.content, { paddingBottom: bottomContentPadding }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} tintColor={COLORS.accent} />}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={10}
          windowSize={11}
        />
      )}

      <AdminFilterDrawer
        visible={drawerOpen}
        title="Filters"
        activeFilterCount={activeCount}
        onClose={() => setDrawerOpen(false)}
        onReset={resetFilters}
        onDone={() => setDrawerOpen(false)}
        resetDisabled={!activeCount}
      >
        <DiscoverFilterRow
          label="Status"
          options={FILTER_OPTIONS.map(lifecycleLabel)}
          selected={lifecycleLabel(filter)}
          onSelect={(label) => {
            const next = FILTER_OPTIONS.find((option) => lifecycleLabel(option) === label) || "Any";
            setFilter(next);
          }}
        />
        <DiscoverFilterRow label="Game" options={gameOptions} selected={gameFilter} onSelect={setGameFilter} />
        <DiscoverFilterRow label="Date Range" options={DATE_RANGE_OPTIONS} selected={dateFilter} onSelect={(value) => setDateFilter(value as DateRangeKey)} />
        <DiscoverFilterRow label="Booking Type" options={bookingTypeOptions} selected={bookingTypeFilter} onSelect={setBookingTypeFilter} />
        <DiscoverFilterRow label="Payment Status" options={paymentOptions} selected={paymentFilter} onSelect={setPaymentFilter} />
        <DiscoverFilterRow label="Zone" options={zoneOptions} selected={zoneFilter} onSelect={setZoneFilter} />
        <DiscoverFilterRow label="Result Status" options={resultOptions} selected={resultFilter} onSelect={setResultFilter} />
      </AdminFilterDrawer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.backgroundDark },
  searchBar: {
    marginBottom: SPACING.md,
  },
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { gap: SPACING.md },
  cardBody: { gap: SPACING.sm },
});


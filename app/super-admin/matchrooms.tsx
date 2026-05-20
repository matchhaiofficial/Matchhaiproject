import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

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

export default function SuperAdminMatchroomsScreen() {
  const bottomContentPadding = useTabBarClearance(SPACING.lg);
  const { showToast } = useToast();
  const [rooms, setRooms] = useState<SuperAdminMatchroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MatchroomFilter>("Any");
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  const visibleRooms = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rooms.filter((room) => {
      if (filter !== "Any" && room.lifecycleStatus !== filter) return false;
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
  }, [filter, query, rooms]);

  const activeCount = filter === "Any" ? 0 : 1;

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
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomContentPadding }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} tintColor={COLORS.accent} />}
          showsVerticalScrollIndicator={false}
        >
          {visibleRooms.map((room) => (
            <AdminListCard
              key={room.id}
              title={room.title || "Untitled matchroom"}
              subtitle={`${String(room.game || "Match").toUpperCase()} | ${formatDateTime(room)}`}
              statusLabel={lifecycleLabel(room.lifecycleStatus)}
              statusTone={lifecycleTone(room.lifecycleStatus)}
              onPress={() => router.push(`/super-admin/matchroom/${room.id}` as any)}
            >
              <View style={styles.cardBody}>
                <AdminInfoLine label="Location" value={room.location || "N/A"} />
                <AdminInfoLine label="Players" value={`${room.currentPlayers || 0}/${room.maxPlayers || 0}`} />
              </View>
            </AdminListCard>
          ))}
          {visibleRooms.length === 0 ? (
            <AdminEmptyStateCard
              title="No matchrooms found"
              description="Try a different search or status filter."
              icon="matchroom"
            />
          ) : null}
        </ScrollView>
      )}

      <AdminFilterDrawer
        visible={drawerOpen}
        title="Filters"
        activeFilterCount={activeCount}
        onClose={() => setDrawerOpen(false)}
        onReset={() => setFilter("Any")}
        onDone={() => setDrawerOpen(false)}
        resetDisabled={!activeCount}
      >
        <DiscoverFilterRow
          label="Matchroom status"
          options={FILTER_OPTIONS.map(lifecycleLabel)}
          selected={lifecycleLabel(filter)}
          onSelect={(label) => {
            const next = FILTER_OPTIONS.find((option) => lifecycleLabel(option) === label) || "Any";
            setFilter(next);
          }}
        />
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


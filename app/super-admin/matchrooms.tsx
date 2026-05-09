import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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
import { DiscoverFilterRow } from "../../src/features/discover/components/DiscoverShared";
import { useToast } from "../../src/hooks/useToast";
import { getSuperAdminMatchrooms, SuperAdminMatchroom } from "../../src/services/convex/superAdminService";
import { COLORS, FONTS, RADII, SPACING } from "../../src/theme";

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
  const insets = useSafeAreaInsets();
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
      <AppHeader title="Matchrooms" onBack={() => router.back()} inlineTitle />
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <AppIcon name="search" size={20} color={COLORS.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search matchrooms"
            placeholderTextColor={COLORS.textSecondary}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <Pressable onPress={() => setDrawerOpen(true)} style={styles.filterButton}>
          <AppIcon name="filters" size={22} color={COLORS.text} />
          {activeCount ? (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}><ActivityIndicator color={COLORS.accent} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: SPACING.xxl + insets.bottom }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} tintColor={COLORS.accent} />}
          showsVerticalScrollIndicator={false}
        >
          {visibleRooms.map((room) => (
            <Pressable key={room.id} onPress={() => router.push(`/super-admin/matchroom/${room.id}` as any)}>
              <AppCard style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle}>{room.title || "Untitled matchroom"}</Text>
                  <StatusPill tone={lifecycleTone(room.lifecycleStatus)} label={lifecycleLabel(room.lifecycleStatus)} />
                </View>
                <Text style={styles.cardMeta}>{String(room.game || "Match").toUpperCase()} | {formatDateTime(room)}</Text>
                <Text style={styles.cardMeta}>{room.location}</Text>
                <Text style={styles.cardMeta}>{room.currentPlayers || 0}/{room.maxPlayers || 0} players</Text>
              </AppCard>
            </Pressable>
          ))}
          {visibleRooms.length === 0 ? (
            <AppCard variant="empty">
              <Text style={styles.emptyTitle}>No matchrooms found</Text>
              <Text style={styles.emptyText}>Try a different search or status filter.</Text>
            </AppCard>
          ) : null}
        </ScrollView>
      )}

      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} drawerStyle={styles.drawer}>
        <View style={styles.drawerContent}>
          <AppModalHeader
            title="Filters"
            subtitle="Status filters use existing matchroom fields. Reschedule approval is hidden until a backend field exists."
            onClose={() => setDrawerOpen(false)}
            compact
          />
          <AppModalBody scroll contentContainerStyle={styles.drawerBody}>
            <DiscoverFilterRow
              label="Matchroom status"
              options={FILTER_OPTIONS.map(lifecycleLabel)}
              selected={lifecycleLabel(filter)}
              onSelect={(label) => {
                const next = FILTER_OPTIONS.find((option) => lifecycleLabel(option) === label) || "Any";
                setFilter(next);
              }}
            />
          </AppModalBody>
          <AppModalFooter>
            <View style={[styles.drawerFooterRow, { paddingBottom: insets.bottom + 8 }]}>
              <AppButton variant="secondary" style={styles.drawerFooterButton} onPress={() => setFilter("Any")} disabled={!activeCount}>
                Reset
              </AppButton>
              <AppButton style={styles.drawerFooterButton} onPress={() => setDrawerOpen(false)}>
                Done
              </AppButton>
            </View>
          </AppModalFooter>
        </View>
      </AppDrawer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.backgroundDark },
  searchRow: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.md },
  searchBar: {
    flex: 1,
    minHeight: 48,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardDark,
    paddingHorizontal: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  searchInput: { flex: 1, color: COLORS.text, fontFamily: FONTS.body, fontSize: 14 },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardDark,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadge: {
    position: "absolute",
    top: 7,
    right: 7,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeText: { color: "#fff", fontFamily: FONTS.interSemiBold, fontSize: 10 },
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { gap: SPACING.md },
  card: { gap: SPACING.sm },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.md },
  cardTitle: { flex: 1, color: COLORS.text, fontFamily: FONTS.heading, fontSize: 16 },
  cardMeta: { color: COLORS.textSecondary, fontFamily: FONTS.martelRegular, fontSize: 13 },
  emptyTitle: { color: COLORS.text, fontFamily: FONTS.heading, fontSize: 18, textAlign: "center" },
  emptyText: { color: COLORS.textSecondary, fontFamily: FONTS.martelRegular, fontSize: 13, textAlign: "center", marginTop: SPACING.xs },
  drawer: { backgroundColor: COLORS.backgroundDark },
  drawerContent: { flex: 1 },
  drawerBody: { gap: SPACING.lg },
  drawerFooterRow: { flexDirection: "row", gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  drawerFooterButton: { flex: 1 },
});


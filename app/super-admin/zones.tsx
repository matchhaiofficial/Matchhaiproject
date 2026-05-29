import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";

import { AdminEmptyStateCard, AdminFilterDrawer, AdminListCard, AdminPageHeader, AdminSearchFilterBar } from "../../src/components/AdminSurface";
import Screen from "../../src/components/Screen";
import SegmentedTabs from "../../src/components/SegmentedTabs";
import { DiscoverFilterRow } from "../../src/features/discover/components/DiscoverShared";
import { useTabBarClearance } from "../../src/hooks/useTabBarClearance";
import { useToast } from "../../src/hooks/useToast";
import { getZonesPage } from "../../src/services/convex/superAdminService";
import type { Zone } from "../../src/services/convex/zoneService";
import { COLORS, FONTS, SPACING } from "../../src/theme";
import { getZoneStatusTone } from "../../src/utils/statusLabels";
import { getZoneLifecycleLabel, getZoneMigrationLabel } from "../../src/utils/zoneLifecycle";

type ZoneReviewStatus = "pending-review" | "approved_pending_migration" | "active";

function formatDate(value?: number) {
  if (!value) return "N/A";
  return new Date(value).toLocaleDateString();
}

function statusTitle(status: ZoneReviewStatus) {
  if (status === "active") return "Active";
  return status === "approved_pending_migration" ? "Approved Pending Migration" : "Pending Review";
}

const ALL = "All";
const PAGE_SIZE = 50;

type PilotStatusKey = "all" | "active" | "ended" | "none";
const PILOT_STATUS_OPTIONS: { key: PilotStatusKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active Pilot" },
  { key: "ended", label: "Pilot Ended" },
  { key: "none", label: "No Pilot" },
];

type DateRangeKey = "Any" | "Today" | "Last 7 Days" | "Last 30 Days";
const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: "Any", label: "Any" },
  { key: "Today", label: "Today" },
  { key: "Last 7 Days", label: "Last 7 Days" },
  { key: "Last 30 Days", label: "Last 30 Days" },
];

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

function getZoneTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function getZoneCity(zone: Zone): string | null {
  const legacy = zone as Zone & { city?: string };
  return zone.primaryBranch?.city || legacy.city || null;
}

function getZoneArea(zone: Zone): string | null {
  return zone.primaryBranch?.areaLabel || null;
}

function ZoneReviewCard({ zone }: { zone: Zone }) {
  const legacyZone = zone as Zone & {
    city?: string;
    name?: string;
    ownerUsername?: string;
  };
  const city = zone.primaryBranch?.city || legacyZone.city || "City not set";
  const area = zone.primaryBranch?.areaLabel || "Area not set";

  return (
    <AdminListCard
      title={zone.venueBrandName || legacyZone.name || "Untitled venue"}
      subtitle={zone.ownerFullName || legacyZone.ownerUsername || "Unknown owner"}
      statusLabel={getZoneLifecycleLabel(zone)}
      statusTone={getZoneStatusTone(zone.status)}
      onPress={() => router.push(`/super-admin/request/${zone.id}` as any)}
    >
      <View style={styles.cardBody}>
        <View style={styles.metaRow}>
          <Text style={styles.metaText} numberOfLines={1}>{city}</Text>
          <Text style={styles.metaDot}>|</Text>
          <Text style={styles.metaText} numberOfLines={1}>{area}</Text>
        </View>
        <View style={styles.footerRow}>
          <Text style={styles.metaText}>Submitted: {formatDate(zone.createdAt)}</Text>
          <Text style={styles.linkHint}>{getZoneMigrationLabel(zone)}</Text>
        </View>
      </View>
    </AdminListCard>
  );
}

export default function SuperAdminZonesScreen() {
  const { showToast } = useToast();
  const bottomContentPadding = useTabBarClearance(SPACING.lg);
  const [tab, setTab] = useState<ZoneReviewStatus>("pending-review");
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cityFilter, setCityFilter] = useState<string>(ALL);
  const [areaFilter, setAreaFilter] = useState<string>(ALL);
  const [dateFilter, setDateFilter] = useState<DateRangeKey>("Any");
  const [pilotFilter, setPilotFilter] = useState<PilotStatusKey>("all");

  const mergeZones = useCallback((current: Zone[], next: Zone[]) => {
    const seen = new Set(current.map((zone) => zone.id));
    return [...current, ...next.filter((zone) => !seen.has(zone.id))];
  }, []);

  const load = useCallback(async (mode: "initial" | "refresh" | "more" = "initial") => {
    if (mode === "more" && (loadingMore || isDone)) return;
    if (mode === "initial") setLoading(true);
    else if (mode === "refresh") setRefreshing(true);
    else setLoadingMore(true);

    const result = await getZonesPage({
      status: tab,
      limit: PAGE_SIZE,
      cursor: mode === "more" ? cursor : null,
    });
    if (result.ok) {
      setZones((previous) => mode === "more" ? mergeZones(previous, result.data.page) : result.data.page);
      setCursor(result.data.continueCursor);
      setIsDone(result.data.isDone);
    } else {
      showToast({ type: "error", title: "Zones failed", message: result.message });
    }

    if (mode === "initial") setLoading(false);
    else if (mode === "refresh") setRefreshing(false);
    else setLoadingMore(false);
  }, [cursor, isDone, loadingMore, mergeZones, showToast, tab]);

  useFocusEffect(useCallback(() => {
    void load("initial");
  }, [load]));

  const cityOptions = useMemo(() => {
    const present = Array.from(new Set(zones.map(getZoneCity).filter(Boolean) as string[])).sort();
    return [{ key: ALL, label: "All" }, ...present.map((c) => ({ key: c, label: c }))];
  }, [zones]);

  const areaOptions = useMemo(() => {
    const present = Array.from(new Set(zones.map(getZoneArea).filter(Boolean) as string[])).sort();
    return [{ key: ALL, label: "All" }, ...present.map((a) => ({ key: a, label: a }))];
  }, [zones]);

  const visibleZones = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return zones.filter((zone) => {
      const legacy = zone as Zone & { name?: string; ownerUsername?: string };
      if (cityFilter !== ALL && getZoneCity(zone) !== cityFilter) return false;
      if (areaFilter !== ALL && getZoneArea(zone) !== areaFilter) return false;
      if (tab === "active" && pilotFilter !== "all" && (zone.pilotStatus || "none") !== pilotFilter) return false;
      if (!matchesDateRange(getZoneTimestamp(zone.createdAt), dateFilter)) return false;
      if (!needle) return true;
      return [
        zone.venueBrandName,
        zone.ownerFullName,
        zone.contactEmail,
        getZoneCity(zone),
        getZoneArea(zone),
        legacy.name,
        legacy.ownerUsername,
      ].filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [zones, search, cityFilter, areaFilter, dateFilter, pilotFilter, tab]);

  const activeFilterCount =
    Number(cityFilter !== ALL) +
    Number(areaFilter !== ALL) +
    Number(dateFilter !== "Any") +
    Number(tab === "active" && pilotFilter !== "all");

  const resetFilters = useCallback(() => {
    setCityFilter(ALL);
    setAreaFilter(ALL);
    setDateFilter("Any");
    setPilotFilter("all");
  }, []);

  return (
    <Screen style={styles.screen} contentStyle={styles.screenContent} scroll={false} edges={["top"]}>
      <AdminPageHeader title="Zones" subtitle="Review venue onboarding queues." onBack={() => router.back()} inlineTitle />

      <AdminSearchFilterBar
        value={search}
        onChangeText={setSearch}
        placeholder="Search zone, owner, area, city"
        onFilterPress={() => setDrawerOpen(true)}
        activeFilterCount={activeFilterCount}
        style={styles.searchBar}
      />

      <SegmentedTabs
        items={[
          { key: "pending-review", label: "Pending" },
          { key: "approved_pending_migration", label: "Migration" },
          { key: "active", label: "Active" },
        ]}
        value={tab}
        onChange={(value) => setTab(value as ZoneReviewStatus)}
        style={styles.tabs}
      />

      {loading ? (
        <View style={styles.loaderWrap}><ActivityIndicator color={COLORS.accent} /></View>
      ) : (
        <FlatList
          data={visibleZones}
          keyExtractor={(zone) => zone.id}
          renderItem={({ item }) => <ZoneReviewCard zone={item} />}
          contentContainerStyle={[styles.content, { paddingBottom: bottomContentPadding }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} tintColor={COLORS.accent} />}
          onEndReached={() => load("more")}
          onEndReachedThreshold={0.4}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={10}
          windowSize={11}
          ListHeaderComponent={
            <View style={styles.summaryRow}>
              <Text style={styles.summaryText}>{visibleZones.length} {statusTitle(tab).toLowerCase()}</Text>
            </View>
          }
          ListEmptyComponent={
            zones.length === 0 ? (
              <AdminEmptyStateCard title={`No ${statusTitle(tab).toLowerCase()} zones`} description="Zone registration requests in this state will appear here." icon="business" />
            ) : (
              <AdminEmptyStateCard title="No zones match these filters." description="Reset filters to view all zones." icon="business" />
            )
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}><ActivityIndicator color={COLORS.accent} /></View>
            ) : null
          }
        />
      )}

      <AdminFilterDrawer
        visible={drawerOpen}
        title="Filters"
        activeFilterCount={activeFilterCount}
        onClose={() => setDrawerOpen(false)}
        onReset={resetFilters}
        onDone={() => setDrawerOpen(false)}
        resetDisabled={!activeFilterCount}
      >
        <DiscoverFilterRow label="City" options={cityOptions} selected={cityFilter} onSelect={setCityFilter} />
        <DiscoverFilterRow label="Area" options={areaOptions} selected={areaFilter} onSelect={setAreaFilter} />
        {tab === "active" ? (
          <DiscoverFilterRow label="Pilot Status" options={PILOT_STATUS_OPTIONS} selected={pilotFilter} onSelect={(value) => setPilotFilter(value as PilotStatusKey)} />
        ) : null}
        <DiscoverFilterRow label="Created Date" options={DATE_RANGE_OPTIONS} selected={dateFilter} onSelect={(value) => setDateFilter(value as DateRangeKey)} />
      </AdminFilterDrawer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.backgroundDark },
  screenContent: { paddingTop: 0 },
  searchBar: { marginBottom: SPACING.md },
  tabs: { marginBottom: SPACING.md },
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  footerLoader: { paddingVertical: SPACING.md, alignItems: "center" },
  content: { gap: SPACING.md },
  summaryRow: {
    minHeight: 32,
    justifyContent: "center",
  },
  summaryText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: 13,
  },
  cardBody: { gap: SPACING.sm },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { color: COLORS.textSecondary, fontFamily: FONTS.martelRegular, fontSize: 13 },
  metaDot: { color: COLORS.muted, fontFamily: FONTS.body, fontSize: 13 },
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.sm },
  linkHint: { color: COLORS.accent, fontFamily: FONTS.interSemiBold, fontSize: 12 },
});

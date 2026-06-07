import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { AdminEmptyStateCard, AdminFilterDrawer, AdminListCard, AdminPageHeader, AdminSearchFilterBar } from "../../src/components/AdminSurface";
import Screen from "../../src/components/Screen";
import SegmentedTabs from "../../src/components/SegmentedTabs";
import { DiscoverFilterRow } from "../../src/features/discover/components/DiscoverShared";
import { useTabBarClearance } from "../../src/hooks/useTabBarClearance";
import { useToast } from "../../src/hooks/useToast";
import {
  archiveSuperAdminNotification,
  getSuperAdminNotificationsPage,
  markSuperAdminNotificationRead,
  type SuperAdminNotification,
  type SuperAdminNotificationTab,
} from "../../src/services/convex/superAdminService";
import { setLocalBadgeCount } from "../../src/services/localNotifications";
import { COLORS, FONTS, RADII, SPACING } from "../../src/theme";

function formatDate(value?: number) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}

function labelForType(type?: string) {
  return String(type || "notification").replace(/[._-]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

const ALL = "All";

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

const CATEGORY_ORDER = ["matchrooms", "teams", "payments", "withdrawals", "support", "reports", "kyc", "zones", "broadcasts", "system"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  matchrooms: "Matchrooms",
  teams: "Teams",
  payments: "Payments",
  withdrawals: "Withdrawals",
  support: "Support",
  reports: "Reports",
  kyc: "KYC",
  zones: "Zones",
  broadcasts: "Broadcasts",
  system: "System",
};

// Conservative type bucketing mirroring the Player Inbox (Phase 2C). Unknown -> "system".
function getNotificationCategory(item: SuperAdminNotification): string {
  const type = String(item.type || "").toLowerCase();
  if (type.startsWith("withdrawal.") || type.startsWith("withdrawal_")) return "withdrawals";
  if (type.startsWith("support.") || type.startsWith("support_")) return "support";
  if (type.startsWith("moderation.") || type.includes("report")) return "reports";
  if (type.startsWith("kyc.") || type.startsWith("kyc_")) return "kyc";
  if (type.startsWith("zone.") || type.startsWith("zone_") || type.startsWith("resource.")) return "zones";
  if (type.startsWith("broadcast.") || type.startsWith("broadcast_")) return "broadcasts";
  if (type.startsWith("wallet.") || type.startsWith("wallet_") || type.includes("payment")) return "payments";
  if (type.startsWith("team.") || type.startsWith("team_")) return "teams";
  if (type.startsWith("match.") || type.startsWith("match_") || type.startsWith("booking.") || type.startsWith("booking_")) return "matchrooms";
  return "system";
}

const NotificationCard = React.memo(function NotificationCard({
  item,
  onArchive,
  onMarkRead,
  onOpen,
}: {
  item: SuperAdminNotification;
  onArchive: (item: SuperAdminNotification) => void;
  onMarkRead: (item: SuperAdminNotification) => void;
  onOpen: (item: SuperAdminNotification) => void;
}) {
  const route = item.route || String(item.data?.href || item.data?.route || "");
  return (
    <AdminListCard
      title={item.title || labelForType(item.type)}
      subtitle={formatDate(item.createdAt)}
      statusLabel={item.isRead ? "Read" : "Unread"}
      statusTone={item.isRead ? "neutral" : "warning"}
    >
      {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
      <View style={styles.metaRow}>
        <Text style={styles.typeText}>{labelForType(item.type)}</Text>
        {route ? <Text style={styles.routeText} numberOfLines={1}>{route}</Text> : null}
      </View>
      <View style={styles.actions}>
        {route ? (
          <Pressable style={styles.actionButton} onPress={() => onOpen(item)}>
            <Text style={styles.actionText}>Open</Text>
          </Pressable>
        ) : null}
        {!item.isRead ? (
          <Pressable style={styles.actionButton} onPress={() => onMarkRead(item)}>
            <Text style={styles.actionText}>Mark read</Text>
          </Pressable>
        ) : null}
        <Pressable style={[styles.actionButton, styles.archiveButton]} onPress={() => onArchive(item)}>
          <Text style={[styles.actionText, styles.archiveText]}>Archive</Text>
        </Pressable>
      </View>
    </AdminListCard>
  );
});

export default function SuperAdminNotificationsScreen() {
  const { showToast } = useToast();
  const bottomContentPadding = useTabBarClearance(SPACING.lg);
  const [tab, setTab] = useState<SuperAdminNotificationTab>("unread");
  const [items, setItems] = useState<SuperAdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [dateFilter, setDateFilter] = useState<DateRangeKey>("Any");

  const mergeItems = useCallback((current: SuperAdminNotification[], next: SuperAdminNotification[]) => {
    const seen = new Set(current.map((row) => row.id));
    return [...current, ...next.filter((row) => !seen.has(row.id))];
  }, []);

  const load = useCallback(async (mode: "initial" | "refresh" | "more" = "initial") => {
    if (mode === "more" && (loadingMore || isDone)) return;
    if (mode === "initial") setLoading(true);
    else if (mode === "refresh") setRefreshing(true);
    else setLoadingMore(true);
    const result = await getSuperAdminNotificationsPage({
      tab,
      limit: 50,
      cursor: mode === "more" ? cursor : null,
    });
    if (result.ok) {
      setItems((previous) => mode === "more" ? mergeItems(previous, result.data.page) : result.data.page);
      setCursor(result.data.continueCursor);
      setIsDone(result.data.isDone);
      if (tab === "unread") {
        void setLocalBadgeCount(Number(result.data.total || 0));
      }
    } else {
      showToast({ type: "error", title: "Notifications failed", message: result.message });
    }
    if (mode === "initial") setLoading(false);
    else if (mode === "refresh") setRefreshing(false);
    else setLoadingMore(false);
  }, [cursor, isDone, loadingMore, mergeItems, showToast, tab]);

  useFocusEffect(useCallback(() => {
    void load("initial");
  }, [load]));

  const unreadCount = useMemo(() => items.filter((item) => !item.isRead).length, [items]);

  const typeOptions = useMemo(() => {
    const present = new Set(items.map(getNotificationCategory));
    const ordered = CATEGORY_ORDER.filter((c) => present.has(c));
    return [{ key: ALL, label: "All" }, ...ordered.map((c) => ({ key: c, label: CATEGORY_LABELS[c] }))];
  }, [items]);

  const visibleItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((item) => {
      if (typeFilter !== ALL && getNotificationCategory(item) !== typeFilter) return false;
      if (!matchesDateRange(item.createdAt, dateFilter)) return false;
      if (!needle) return true;
      return [item.title, item.body, labelForType(item.type), item.route]
        .filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [items, search, typeFilter, dateFilter]);

  const activeFilterCount = Number(typeFilter !== ALL) + Number(dateFilter !== "Any");

  const resetFilters = useCallback(() => {
    setTypeFilter(ALL);
    setDateFilter("Any");
  }, []);

  const markRead = useCallback(async (item: SuperAdminNotification) => {
    if (item.isRead || busyId) return;
    setBusyId(item.id);
    const result = await markSuperAdminNotificationRead(item.id);
    setBusyId(null);
    if (!result.ok) {
      showToast({ type: "error", title: "Update failed", message: result.message });
      return;
    }
    setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, isRead: true } : candidate));
  }, [busyId, showToast]);

  const archive = useCallback(async (item: SuperAdminNotification) => {
    if (busyId) return;
    setBusyId(item.id);
    const result = await archiveSuperAdminNotification(item.id);
    setBusyId(null);
    if (!result.ok) {
      showToast({ type: "error", title: "Archive failed", message: result.message });
      return;
    }
    setItems((current) => current.filter((candidate) => candidate.id !== item.id));
  }, [busyId, showToast]);

  const openNotification = useCallback(async (item: SuperAdminNotification) => {
    const route = item.route || String(item.data?.href || item.data?.route || "");
    if (!route) return;
    if (!item.isRead) await markRead(item);
    router.push(route as any);
  }, [markRead]);

  const renderNotification = useCallback(
    ({ item }: { item: SuperAdminNotification }) => (
      <NotificationCard
        item={item}
        onArchive={archive}
        onMarkRead={markRead}
        onOpen={openNotification}
      />
    ),
    [archive, markRead, openNotification],
  );

  const renderEmpty = useCallback(
    () =>
      items.length === 0 ? (
        <AdminEmptyStateCard
          title={tab === "unread" ? "No unread notifications" : "No read notifications"}
          description="Super Admin operational alerts will appear here."
          icon="notifications"
        />
      ) : (
        <AdminEmptyStateCard
          title="No notifications match these filters."
          description="Reset filters to view all notifications."
          icon="notifications"
        />
      ),
    [items.length, tab],
  );

  return (
    <Screen style={styles.screen} scroll={false} edges={["top"]}>
      <AdminPageHeader title="Notifications" subtitle="Super Admin inbox" onBack={() => router.back()} inlineTitle />
      <AdminSearchFilterBar
        value={search}
        onChangeText={setSearch}
        placeholder="Search notifications"
        onFilterPress={() => setDrawerOpen(true)}
        activeFilterCount={activeFilterCount}
        style={styles.searchBar}
      />
      <SegmentedTabs
        items={[
          { key: "unread", label: "Unread", badge: tab === "unread" && unreadCount ? unreadCount : undefined },
          { key: "read", label: "Read" },
        ]}
        value={tab}
        onChange={(value) => setTab(value as SuperAdminNotificationTab)}
        style={styles.tabs}
      />
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      ) : (
        <FlatList
          data={visibleItems}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={[styles.content, { paddingBottom: bottomContentPadding }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} tintColor={COLORS.accent} />}
          onEndReached={() => load("more")}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <View style={styles.footerLoader}><ActivityIndicator color={COLORS.accent} /></View> : null}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={10}
          windowSize={11}
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
        <DiscoverFilterRow label="Type" options={typeOptions} selected={typeFilter} onSelect={setTypeFilter} />
        <DiscoverFilterRow label="Date Range" options={DATE_RANGE_OPTIONS} selected={dateFilter} onSelect={(value) => setDateFilter(value as DateRangeKey)} />
      </AdminFilterDrawer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: COLORS.backgroundDark,
  },
  searchBar: {
    marginBottom: SPACING.md,
  },
  tabs: {
    marginBottom: SPACING.md,
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  footerLoader: {
    paddingVertical: SPACING.md,
    alignItems: "center",
  },
  content: {
    gap: SPACING.md,
  },
  body: {
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
  },
  metaRow: {
    gap: 4,
  },
  typeText: {
    color: COLORS.accent,
    fontFamily: FONTS.medium,
    fontSize: 12,
  },
  routeText: {
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: 12,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  actionButton: {
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
  },
  actionText: {
    color: COLORS.text,
    fontFamily: FONTS.medium,
    fontSize: 13,
  },
  archiveButton: {
    borderColor: `${COLORS.error}55`,
  },
  archiveText: {
    color: COLORS.error,
  },
});

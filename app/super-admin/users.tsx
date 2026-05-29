import { useFocusEffect, useRouter } from "expo-router";
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
import { AppButton } from "../../src/components/AppPrimitives";
import Screen from "../../src/components/Screen";
import SegmentedTabs from "../../src/components/SegmentedTabs";
import { DiscoverFilterRow } from "../../src/features/discover/components/DiscoverShared";
import { useTabBarClearance } from "../../src/hooks/useTabBarClearance";
import { useToast } from "../../src/hooks/useToast";
import {
  getUsersPage,
  setUserSuspension,
  type SuperAdminUser,
} from "../../src/services/convex/superAdminService";
import { COLORS, SPACING } from "../../src/theme";

type UserTab = "all" | "player" | "zone";

function formatDate(value?: number | null) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}

function statusTone(status?: string | null) {
  return status === "suspended" ? "danger" as const : "success" as const;
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

const ALL = "All";
const PAGE_SIZE = 50;

// Canonical KYC lifecycle order (matches users.kycVerificationStatus enum).
// Missing kycVerificationStatus is treated as "not_started".
const KYC_STATUS_ORDER = [
  "not_started",
  "pending",
  "in_progress",
  "in_review",
  "verified",
  "rejected",
  "expired",
] as const;

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

const UserRow = React.memo(function UserRow({
  user,
  busy,
  onSuspend,
  onReactivate,
}: {
  user: SuperAdminUser;
  busy: boolean;
  onSuspend: (user: SuperAdminUser) => void;
  onReactivate: (user: SuperAdminUser) => void;
}) {
  const suspended = user.accountStatus === "suspended";
  return (
    <AdminListCard
      title={user.fullName || user.username || "Unknown user"}
      subtitle={user.email}
      statusLabel={suspended ? "Suspended" : "Active"}
      statusTone={statusTone(user.accountStatus)}
      actions={
        suspended ? (
          <AppButton size="sm" variant="success" loading={busy} onPress={() => onReactivate(user)}>
            Reactivate
          </AppButton>
        ) : (
          <AppButton size="sm" variant="danger" loading={busy} onPress={() => onSuspend(user)}>
            Suspend
          </AppButton>
        )
      }
    >
      <View style={styles.infoStack}>
        <AdminInfoLine label="Username" value={user.username || "N/A"} />
        <AdminInfoLine label="Type" value={user.accountType === "zone" ? "Zone Admin" : "Player"} />
        <AdminInfoLine label="Role" value={user.role || "Standard"} />
        <AdminInfoLine label="Created" value={formatDate(user.createdAt)} />
        {suspended ? <AdminInfoLine label="Reason" value={user.suspensionReason || "No reason recorded"} /> : null}
      </View>
    </AdminListCard>
  );
});

export default function SuperAdminUsersScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const bottomContentPadding = useTabBarClearance(SPACING.lg);
  const [tab, setTab] = useState<UserTab>("all");
  const [users, setUsers] = useState<SuperAdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [roleFilter, setRoleFilter] = useState<string>(ALL);
  const [kycFilter, setKycFilter] = useState<string>(ALL);
  const [dateFilter, setDateFilter] = useState<DateRangeKey>("Any");

  const mergeUsers = useCallback((current: SuperAdminUser[], next: SuperAdminUser[]) => {
    const seen = new Set(current.map((user) => user.id));
    return [...current, ...next.filter((user) => !seen.has(user.id))];
  }, []);

  const load = useCallback(async (mode: "initial" | "refresh" | "more" = "initial") => {
    if (mode === "more" && (loadingMore || isDone)) return;
    if (mode === "initial") setLoading(true);
    else if (mode === "refresh") setRefreshing(true);
    else setLoadingMore(true);
    const result = await getUsersPage({
      accountType: tab === "all" ? undefined : tab,
      limit: PAGE_SIZE,
      cursor: mode === "more" ? cursor : null,
    });
    if (result.ok) {
      setUsers((previous) => mode === "more" ? mergeUsers(previous, result.data.page) : result.data.page);
      setCursor(result.data.continueCursor);
      setIsDone(result.data.isDone);
    } else {
      showToast({ type: "error", title: "Users failed", message: result.message });
    }
    if (mode === "initial") setLoading(false);
    else if (mode === "refresh") setRefreshing(false);
    else setLoadingMore(false);
  }, [cursor, isDone, loadingMore, mergeUsers, showToast, tab]);

  useFocusEffect(useCallback(() => {
    void load("initial");
  }, [load]));

  const statusOptions = useMemo(() => {
    const present = Array.from(new Set(users.map((u) => u.accountStatus || "active"))).sort();
    return [{ key: ALL, label: "All" }, ...present.map((s) => ({ key: s, label: formatLabel(s) }))];
  }, [users]);

  const roleOptions = useMemo(() => {
    const present = Array.from(new Set(users.map((u) => u.role).filter(Boolean) as string[])).sort();
    return [{ key: ALL, label: "All" }, ...present.map((r) => ({ key: r, label: formatLabel(r) }))];
  }, [users]);

  const kycOptions = useMemo(() => {
    const present = new Set(users.map((u) => u.kycVerificationStatus || "not_started"));
    const ordered = KYC_STATUS_ORDER.filter((s) => present.has(s));
    return [{ key: ALL, label: "All" }, ...ordered.map((s) => ({ key: s, label: formatLabel(s) }))];
  }, [users]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return users.filter((user) => {
      if (statusFilter !== ALL && (user.accountStatus || "active") !== statusFilter) return false;
      if (roleFilter !== ALL && user.role !== roleFilter) return false;
      if (kycFilter !== ALL && (user.kycVerificationStatus || "not_started") !== kycFilter) return false;
      if (!matchesDateRange(user.createdAt, dateFilter)) return false;
      if (!needle) return true;
      return [
        user.fullName,
        user.username,
        user.email,
        user.accountType,
        user.role,
        user.accountStatus || "active",
      ].filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [search, users, statusFilter, roleFilter, kycFilter, dateFilter]);

  const activeFilterCount =
    Number(statusFilter !== ALL) +
    Number(roleFilter !== ALL) +
    Number(kycFilter !== ALL) +
    Number(dateFilter !== "Any");

  const resetFilters = useCallback(() => {
    setStatusFilter(ALL);
    setRoleFilter(ALL);
    setKycFilter(ALL);
    setDateFilter("Any");
  }, []);

  const handleSuspension = useCallback(async (user: SuperAdminUser, status: "active" | "suspended") => {
    setBusyUserId(user.id);
    const result = await setUserSuspension(user.id, {
      status,
      reason: status === "suspended" ? "Suspended from Super Admin users screen." : undefined,
      suspendedUntil: null,
    });
    setBusyUserId(null);
    if (result.ok) {
      showToast({
        type: "success",
        title: status === "suspended" ? "User suspended" : "User reactivated",
        message: `${user.fullName || user.username} was updated.`,
      });
      await load("refresh");
    } else {
      showToast({ type: "error", title: "Update failed", message: result.message });
    }
  }, [load, showToast]);

  const handleSuspend = useCallback((user: SuperAdminUser) => handleSuspension(user, "suspended"), [handleSuspension]);
  const handleReactivate = useCallback((user: SuperAdminUser) => handleSuspension(user, "active"), [handleSuspension]);

  const renderUser = useCallback(
    ({ item }: { item: SuperAdminUser }) => (
      <UserRow
        user={item}
        busy={busyUserId === item.id}
        onSuspend={handleSuspend}
        onReactivate={handleReactivate}
      />
    ),
    [busyUserId, handleSuspend, handleReactivate],
  );

  const renderEmpty = useCallback(
    () =>
      users.length === 0 ? (
        <AdminEmptyStateCard title="No users found" description="Try another tab or search term." icon="players" />
      ) : (
        <AdminEmptyStateCard title="No users match these filters." description="Reset filters to view all users." icon="players" />
      ),
    [users.length],
  );

  return (
    <Screen style={styles.screen} contentStyle={styles.screenContent} scroll={false} edges={["top"]}>
      <AdminPageHeader title="Users" subtitle="Review accounts and manage suspensions." onBack={() => router.back()} inlineTitle />
      <AdminSearchFilterBar
        value={search}
        onChangeText={setSearch}
        placeholder="Search users"
        onFilterPress={() => setDrawerOpen(true)}
        activeFilterCount={activeFilterCount}
        style={styles.searchBar}
      />
      <SegmentedTabs
        items={[
          { key: "all", label: "All" },
          { key: "player", label: "Players" },
          { key: "zone", label: "Zone Admins" },
        ]}
        value={tab}
        onChange={(value) => setTab(value as UserTab)}
        style={styles.tabs}
      />

      {loading ? (
        <View style={styles.loaderWrap}><ActivityIndicator color={COLORS.accent} /></View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(user) => user.id}
          renderItem={renderUser}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={[styles.content, { paddingBottom: bottomContentPadding }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} tintColor={COLORS.accent} />}
          onEndReached={() => load("more")}
          onEndReachedThreshold={0.4}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={10}
          windowSize={11}
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
        <DiscoverFilterRow label="Account Status" options={statusOptions} selected={statusFilter} onSelect={setStatusFilter} />
        <DiscoverFilterRow label="Role" options={roleOptions} selected={roleFilter} onSelect={setRoleFilter} />
        <DiscoverFilterRow label="KYC Status" options={kycOptions} selected={kycFilter} onSelect={setKycFilter} />
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
  infoStack: { gap: SPACING.sm },
});

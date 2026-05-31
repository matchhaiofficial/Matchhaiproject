import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";

import {
  AdminEmptyStateCard,
  AdminFilterDrawer,
  AdminListCard,
  AdminPageHeader,
  AdminSearchFilterBar,
} from "../../src/components/AdminSurface";
import Screen from "../../src/components/Screen";
import { DiscoverFilterRow } from "../../src/features/discover/components/DiscoverShared";
import { useTabBarClearance } from "../../src/hooks/useTabBarClearance";
import { useToast } from "../../src/hooks/useToast";
import {
  getSuperAdminAllowlistConfig,
  getSuperAdminAuditLogsPage,
  type SuperAdminAllowlistEntry,
  type SuperAdminAuditLog,
} from "../../src/services/convex/superAdminService";
import { COLORS, FONTS, RADII, SPACING } from "../../src/theme";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "success", label: "Success" },
  { key: "failed", label: "Failed" },
  { key: "denied", label: "Denied" },
] as const;

const COMMON_ACTION_FILTERS = [
  { key: "all", label: "All" },
  { key: "super_admin_route_access", label: "Route Access" },
  { key: "view_identity_verifications", label: "View KYC" },
  { key: "manual_kyc_verify", label: "Manual KYC" },
  { key: "view_support_tickets", label: "Support" },
  { key: "view_user", label: "Users" },
  { key: "view_matchrooms", label: "Matchrooms" },
  { key: "view_payment_transaction", label: "Payments" },
];

const MODULE_FILTERS = [
  { key: "all", label: "All" },
  { key: "super_admin", label: "Super Admin" },
  { key: "identity", label: "Identity" },
  { key: "support", label: "Support" },
  { key: "users", label: "Users" },
  { key: "matchrooms", label: "Matchrooms" },
  { key: "payments", label: "Payments" },
  { key: "reports", label: "Reports" },
];

function formatDate(value?: number) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}

function formatLabel(value?: string | null) {
  return String(value || "N/A").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusTone(status: SuperAdminAuditLog["status"]) {
  if (status === "success") return "success" as const;
  if (status === "denied") return "warning" as const;
  return "danger" as const;
}

type DateRangeKey = "Any" | "Today" | "Last 7 Days" | "Last 30 Days";
const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: "Any", label: "Any" },
  { key: "Today", label: "Today" },
  { key: "Last 7 Days", label: "Last 7 Days" },
  { key: "Last 30 Days", label: "Last 30 Days" },
];

// Audit Date Range maps to the EXISTING backend `from` arg (no new arg, no new index).
// Audit logs are never future-dated, so only a lower bound is required.
function dateRangeToFrom(range: DateRangeKey): number | undefined {
  if (range === "Any") return undefined;
  if (range === "Today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start.getTime();
  }
  const days = range === "Last 7 Days" ? 7 : 30;
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

const AuditLogCard = React.memo(function AuditLogCard({ item }: { item: SuperAdminAuditLog }) {
  const metadataEntries = item.metadataSafe && typeof item.metadataSafe === "object"
    ? Object.entries(item.metadataSafe).slice(0, 6)
    : [];

  return (
    <AdminListCard
      title={formatLabel(item.action)}
      subtitle={formatDate(item.createdAt)}
      statusLabel={formatLabel(item.status)}
      statusTone={statusTone(item.status)}
    >
      <View style={styles.adminBox}>
        <Text style={styles.adminName}>{item.superAdminName || "Unknown Super Admin"}</Text>
        <Text style={styles.adminEmail}>{item.superAdminEmail || "unknown"}</Text>
      </View>

      <View style={styles.metaGrid}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Module</Text>
          <Text style={styles.metaValue}>{formatLabel(item.module)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Target</Text>
          <Text style={styles.metaValue} numberOfLines={1}>
            {[item.targetType, item.targetId].filter(Boolean).join(" / ") || "N/A"}
          </Text>
        </View>
      </View>

      {item.reason ? <Text style={styles.reason}>Reason: {formatLabel(item.reason)}</Text> : null}

      {metadataEntries.length > 0 ? (
        <View style={styles.metadataBox}>
          {metadataEntries.map(([key, value]) => (
            <Text key={key} style={styles.metadataText} numberOfLines={1}>
              {formatLabel(key)}: {typeof value === "object" ? JSON.stringify(value) : String(value)}
            </Text>
          ))}
        </View>
      ) : null}
    </AdminListCard>
  );
});

export default function SuperAdminAuditLogsScreen() {
  const bottomContentPadding = useTabBarClearance(SPACING.lg);
  const { showToast } = useToast();
  const [rows, setRows] = useState<SuperAdminAuditLog[]>([]);
  const [admins, setAdmins] = useState<SuperAdminAllowlistEntry[]>([]);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]["key"]>("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [adminFilter, setAdminFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateRangeKey>("Any");
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  const mergeRows = useCallback((current: SuperAdminAuditLog[], next: SuperAdminAuditLog[]) => {
    const seen = new Set(current.map((row) => row.id));
    return [...current, ...next.filter((row) => !seen.has(row.id))];
  }, []);

  const load = useCallback(async (mode: "initial" | "refresh" | "more" = "initial") => {
    if (mode === "more" && (loadingMore || isDone)) return;
    if (mode === "initial") setLoading(true);
    else if (mode === "refresh") setRefreshing(true);
    else setLoadingMore(true);

    const result = await getSuperAdminAuditLogsPage({
      status: statusFilter === "all" ? undefined : statusFilter,
      module: moduleFilter === "all" ? undefined : moduleFilter,
      action: actionFilter === "all" ? undefined : actionFilter,
      superAdminEmail: adminFilter === "all" ? undefined : adminFilter,
      targetId: search.trim() || undefined,
      from: dateRangeToFrom(dateFilter),
      limit: 50,
      cursor: mode === "more" ? cursor : null,
    });

    if (result.ok) {
      setRows((previous) => mode === "more" ? mergeRows(previous, result.data.page) : result.data.page);
      setCursor(result.data.continueCursor);
      setIsDone(result.data.isDone);
    } else {
      showToast({ type: "error", title: "Audit logs failed", message: result.message });
    }

    if (mode === "initial") setLoading(false);
    else if (mode === "refresh") setRefreshing(false);
    else setLoadingMore(false);
  }, [actionFilter, adminFilter, cursor, dateFilter, isDone, loadingMore, mergeRows, moduleFilter, search, showToast, statusFilter]);

  useFocusEffect(useCallback(() => {
    void load("initial");
    void getSuperAdminAllowlistConfig().then((result) => {
      if (result.ok) setAdmins(result.data.filter((entry) => entry.isActive && entry.email));
    });
  }, [load]));

  const activeFilterCount = Number(statusFilter !== "all")
    + Number(moduleFilter !== "all")
    + Number(actionFilter !== "all")
    + Number(adminFilter !== "all")
    + Number(dateFilter !== "Any");

  const adminOptions = useMemo(
    () => [
      { key: "all", label: "All" },
      ...admins.map((admin) => ({ key: admin.email, label: admin.displayName || admin.email })),
    ],
    [admins],
  );

  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [
        row.targetId,
        row.targetType,
        row.action,
        row.module,
        row.superAdminName,
        row.superAdminEmail,
        row.reason,
      ].filter(Boolean).join(" ").toLowerCase().includes(needle),
    );
  }, [rows, search]);

  const renderAuditLog = useCallback(
    ({ item }: { item: SuperAdminAuditLog }) => <AuditLogCard item={item} />,
    [],
  );

  const renderEmpty = useCallback(
    () => (
      <AdminEmptyStateCard
        title="No audit logs found"
        description="Super Admin access and actions will appear here."
        icon="reports"
      />
    ),
    [],
  );

  return (
    <Screen style={styles.screen} contentStyle={styles.screenContent} scroll={false} edges={["top"]}>
      <AdminPageHeader
        title="Audit Logs"
        subtitle="Super Admin access and action history."
        onBack={() => router.back()}
        inlineTitle
      />

      <AdminSearchFilterBar
        value={search}
        onChangeText={setSearch}
        placeholder="Search target ID / action / admin"
        onFilterPress={() => setDrawerOpen(true)}
        activeFilterCount={activeFilterCount}
        style={styles.searchBar}
      />

      {loading ? (
        <View style={styles.loaderWrap}><ActivityIndicator color={COLORS.accent} /></View>
      ) : (
        <FlatList
          data={visibleRows}
          keyExtractor={(item) => item.id}
          renderItem={renderAuditLog}
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
        title="Audit filters"
        activeFilterCount={activeFilterCount}
        onClose={() => setDrawerOpen(false)}
        onReset={() => {
          setAdminFilter("all");
          setStatusFilter("all");
          setActionFilter("all");
          setModuleFilter("all");
          setDateFilter("Any");
        }}
        onDone={() => setDrawerOpen(false)}
        resetDisabled={!activeFilterCount}
      >
        <DiscoverFilterRow
          label="Super Admin"
          options={adminOptions}
          selected={adminFilter}
          onSelect={setAdminFilter}
        />
        <DiscoverFilterRow
          label="Date Range"
          options={DATE_RANGE_OPTIONS}
          selected={dateFilter}
          onSelect={(value) => setDateFilter(value as DateRangeKey)}
        />
        <DiscoverFilterRow
          label="Status"
          options={STATUS_FILTERS.map((item) => ({ key: item.key, label: item.label }))}
          selected={statusFilter}
          onSelect={(value) => setStatusFilter(value as typeof statusFilter)}
        />
        <DiscoverFilterRow
          label="Action"
          options={COMMON_ACTION_FILTERS}
          selected={actionFilter}
          onSelect={setActionFilter}
        />
        <DiscoverFilterRow
          label="Module"
          options={MODULE_FILTERS}
          selected={moduleFilter}
          onSelect={setModuleFilter}
        />
      </AdminFilterDrawer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.backgroundDark },
  screenContent: { flex: 1 },
  searchBar: {
    marginBottom: SPACING.md,
  },
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  footerLoader: { paddingVertical: SPACING.md, alignItems: "center" },
  content: { gap: SPACING.md },
  adminBox: {
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.overlayLight,
    padding: SPACING.md,
  },
  adminName: { color: COLORS.text, fontFamily: FONTS.interSemiBold, fontSize: 14 },
  adminEmail: { color: COLORS.textSecondary, fontFamily: FONTS.interRegular, fontSize: 12, marginTop: 2 },
  metaGrid: { flexDirection: "row", gap: SPACING.sm },
  metaItem: { flex: 1, minWidth: 0 },
  metaLabel: { color: COLORS.textSecondary, fontFamily: FONTS.interMedium, fontSize: 11, textTransform: "uppercase" },
  metaValue: { color: COLORS.text, fontFamily: FONTS.interRegular, fontSize: 13, marginTop: 2 },
  reason: { color: COLORS.warning, fontFamily: FONTS.interRegular, fontSize: 13 },
  metadataBox: { borderTopWidth: 1, borderTopColor: COLORS.cardBorder, paddingTop: SPACING.sm, gap: 2 },
  metadataText: { color: COLORS.textSecondary, fontFamily: FONTS.interRegular, fontSize: 12 },
});

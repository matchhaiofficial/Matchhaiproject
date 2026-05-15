import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppHeader from "../../src/components/AppHeader";
import { AdminEmptyStateCard } from "../../src/components/AdminSurface";
import { AppIcon } from "../../src/components/AppIcon";
import { AppDrawer, AppModalBody, AppModalFooter, AppModalHeader } from "../../src/components/AppModalPrimitives";
import { AppButton } from "../../src/components/AppPrimitives";
import { AppCard, StatusPill } from "../../src/components/AppPrimitives";
import Screen from "../../src/components/Screen";
import { DiscoverFilterRow } from "../../src/features/discover/components/DiscoverShared";
import { useToast } from "../../src/hooks/useToast";
import {
  getSuperAdminAllowlistConfig,
  getSuperAdminAuditLogs,
  type SuperAdminAllowlistEntry,
  type SuperAdminAuditLog,
} from "../../src/services/convex/superAdminService";
import { COLORS, FONTS, RADII, SPACING } from "../../src/theme";

const DRAWER_WIDTH = Math.min(420, Math.round(Dimensions.get("window").width * 0.94));

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

function AuditLogCard({ item }: { item: SuperAdminAuditLog }) {
  const metadataEntries = item.metadataSafe && typeof item.metadataSafe === "object"
    ? Object.entries(item.metadataSafe).slice(0, 6)
    : [];

  return (
    <AppCard style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.titleWrap}>
          <Text style={styles.action}>{formatLabel(item.action)}</Text>
          <Text style={styles.timestamp}>{formatDate(item.createdAt)}</Text>
        </View>
        <StatusPill tone={statusTone(item.status)} label={formatLabel(item.status)} />
      </View>

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
    </AppCard>
  );
}

export default function SuperAdminAuditLogsScreen() {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const [rows, setRows] = useState<SuperAdminAuditLog[]>([]);
  const [admins, setAdmins] = useState<SuperAdminAllowlistEntry[]>([]);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]["key"]>("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [adminFilter, setAdminFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);

    const result = await getSuperAdminAuditLogs({
      status: statusFilter === "all" ? undefined : statusFilter,
      module: moduleFilter === "all" ? undefined : moduleFilter,
      action: actionFilter === "all" ? undefined : actionFilter,
      superAdminEmail: adminFilter === "all" ? undefined : adminFilter,
      targetId: search.trim() || undefined,
    });

    if (result.ok) setRows(result.data);
    else showToast({ type: "error", title: "Audit logs failed", message: result.message });

    if (mode === "initial") setLoading(false);
    else setRefreshing(false);
  }, [actionFilter, adminFilter, moduleFilter, search, showToast, statusFilter]);

  useFocusEffect(useCallback(() => {
    void load("initial");
    void getSuperAdminAllowlistConfig().then((result) => {
      if (result.ok) setAdmins(result.data.filter((entry) => entry.isActive && entry.email));
    });
  }, [load]));

  const activeFilterCount = Number(statusFilter !== "all")
    + Number(moduleFilter !== "all")
    + Number(actionFilter !== "all")
    + Number(adminFilter !== "all");

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

  return (
    <Screen style={styles.screen} contentStyle={styles.screenContent} scroll={false} edges={["top"]}>
      <AppHeader
        title="Audit Logs"
        subtitle="Super Admin access and action history."
        onBack={() => router.back()}
        inlineTitle
      />

      <View style={styles.filters}>
        <View style={styles.searchBar}>
          <AppIcon name="search" size={20} color={COLORS.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search target/action/reference"
            placeholderTextColor={COLORS.textSecondary}
            style={styles.searchInput}
            autoCapitalize="none"
          />
        </View>
        <Pressable onPress={() => setDrawerOpen(true)} style={styles.filterButton}>
          <AppIcon name="filters" size={20} color={COLORS.text} />
          <Text style={styles.filterButtonText}>Filters</Text>
          {activeFilterCount ? (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}><ActivityIndicator color={COLORS.accent} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} tintColor={COLORS.accent} />}
          showsVerticalScrollIndicator={false}
        >
          {visibleRows.map((item) => <AuditLogCard key={item.id} item={item} />)}
          {visibleRows.length === 0 ? (
            <AdminEmptyStateCard
              title="No audit logs found"
              description="Super Admin access and actions will appear here."
              icon="reports"
            />
          ) : null}
        </ScrollView>
      )}

      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} drawerStyle={styles.drawer}>
        <View style={styles.drawerContent}>
          <AppModalHeader
            title="Audit filters"
            subtitle={`${activeFilterCount} active filters`}
            onClose={() => setDrawerOpen(false)}
            compact
          />
          <AppModalBody scroll contentContainerStyle={styles.drawerBody}>
            <DiscoverFilterRow
              label="Super Admin"
              options={adminOptions}
              selected={adminFilter}
              onSelect={setAdminFilter}
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
          </AppModalBody>
          <AppModalFooter>
            <View style={[styles.drawerFooterRow, { paddingBottom: insets.bottom + 8 }]}>
              <AppButton
                variant="secondary"
                style={styles.drawerFooterButton}
                onPress={() => {
                  setAdminFilter("all");
                  setStatusFilter("all");
                  setActionFilter("all");
                  setModuleFilter("all");
                }}
                disabled={!activeFilterCount}
              >
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
  screenContent: { flex: 1 },
  filters: {
    paddingTop: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  searchBar: {
    minHeight: 48,
    flex: 1,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardDark,
    paddingHorizontal: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  searchInput: { flex: 1, color: COLORS.text, fontFamily: FONTS.montserratRegular },
  filterButton: {
    width: 48,
    minHeight: 46,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardDark,
    paddingHorizontal: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  filterButtonText: {
    display: "none",
    color: COLORS.text,
    fontFamily: FONTS.interSemiBold,
    fontSize: 13,
  },
  filterBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeText: { color: "#fff", fontFamily: FONTS.interSemiBold, fontSize: 11 },
  drawer: { width: DRAWER_WIDTH, flex: 1, backgroundColor: COLORS.backgroundDark },
  drawerContent: { flex: 1 },
  drawerBody: { gap: SPACING.lg },
  drawerFooterRow: { flexDirection: "row", gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  drawerFooterButton: { flex: 1 },
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingBottom: SPACING.xxl, gap: SPACING.md },
  card: { gap: SPACING.md },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: SPACING.md },
  titleWrap: { flex: 1, minWidth: 0 },
  action: { color: COLORS.text, fontFamily: FONTS.heading, fontSize: 16 },
  timestamp: { color: COLORS.textSecondary, fontFamily: FONTS.interRegular, fontSize: 12, marginTop: 2 },
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

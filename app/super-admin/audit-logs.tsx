import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import AppHeader from "../../src/components/AppHeader";
import { AppIcon } from "../../src/components/AppIcon";
import { AppCard, StatusPill } from "../../src/components/AppPrimitives";
import Screen from "../../src/components/Screen";
import SegmentedTabs from "../../src/components/SegmentedTabs";
import { useToast } from "../../src/hooks/useToast";
import {
  getSuperAdminAuditLogs,
  type SuperAdminAuditLog,
} from "../../src/services/convex/superAdminService";
import { COLORS, FONTS, RADII, SPACING } from "../../src/theme";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "success", label: "Success" },
  { key: "failed", label: "Failed" },
  { key: "denied", label: "Denied" },
] as const;

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
  const { showToast } = useToast();
  const [rows, setRows] = useState<SuperAdminAuditLog[]>([]);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]["key"]>("all");
  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [adminFilter, setAdminFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);

    const result = await getSuperAdminAuditLogs({
      status: statusFilter === "all" ? undefined : statusFilter,
      module: moduleFilter.trim() || undefined,
      action: actionFilter.trim() || undefined,
      superAdminEmail: adminFilter.trim().toLowerCase() || undefined,
      targetId: search.trim() || undefined,
    });

    if (result.ok) setRows(result.data);
    else showToast({ type: "error", title: "Audit logs failed", message: result.message });

    if (mode === "initial") setLoading(false);
    else setRefreshing(false);
  }, [actionFilter, adminFilter, moduleFilter, search, showToast, statusFilter]);

  useFocusEffect(useCallback(() => {
    void load("initial");
  }, [load]));

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
        <View style={styles.filterRow}>
          <TextInput
            value={adminFilter}
            onChangeText={setAdminFilter}
            placeholder="Filter admin email"
            placeholderTextColor={COLORS.textSecondary}
            style={styles.filterInput}
            autoCapitalize="none"
          />
          <TextInput
            value={actionFilter}
            onChangeText={setActionFilter}
            placeholder="Action"
            placeholderTextColor={COLORS.textSecondary}
            style={styles.filterInput}
            autoCapitalize="none"
          />
        </View>
        <View style={styles.filterRow}>
          <TextInput
            value={moduleFilter}
            onChangeText={setModuleFilter}
            placeholder="Module"
            placeholderTextColor={COLORS.textSecondary}
            style={styles.filterInput}
            autoCapitalize="none"
          />
        </View>
      </View>

      <SegmentedTabs
        items={STATUS_FILTERS.map((item) => ({ key: item.key, label: item.label }))}
        value={statusFilter}
        onChange={(value) => setStatusFilter(value as typeof statusFilter)}
        style={styles.tabs}
      />

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
            <AppCard variant="empty">
              <Text style={styles.emptyTitle}>No audit logs found</Text>
              <Text style={styles.emptyText}>Super Admin access and actions will appear here.</Text>
            </AppCard>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.backgroundDark },
  screenContent: { flex: 1 },
  filters: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, gap: SPACING.sm },
  searchBar: {
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
  searchInput: { flex: 1, color: COLORS.text, fontFamily: FONTS.montserratRegular },
  filterRow: { flexDirection: "row", gap: SPACING.sm },
  filterInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardDark,
    color: COLORS.text,
    fontFamily: FONTS.montserratRegular,
    paddingHorizontal: SPACING.md,
  },
  tabs: { marginHorizontal: SPACING.lg, marginTop: SPACING.md },
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },
  card: { gap: SPACING.sm },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: SPACING.md },
  titleWrap: { flex: 1, minWidth: 0 },
  action: { color: COLORS.text, fontFamily: FONTS.heading, fontSize: 16 },
  timestamp: { color: COLORS.textSecondary, fontFamily: FONTS.martelRegular, fontSize: 12, marginTop: 2 },
  adminBox: {
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.overlayLight,
    padding: SPACING.md,
  },
  adminName: { color: COLORS.text, fontFamily: FONTS.interSemiBold, fontSize: 14 },
  adminEmail: { color: COLORS.textSecondary, fontFamily: FONTS.martelRegular, fontSize: 12, marginTop: 2 },
  metaGrid: { flexDirection: "row", gap: SPACING.sm },
  metaItem: { flex: 1, minWidth: 0 },
  metaLabel: { color: COLORS.textSecondary, fontFamily: FONTS.interMedium, fontSize: 11, textTransform: "uppercase" },
  metaValue: { color: COLORS.text, fontFamily: FONTS.martelRegular, fontSize: 13, marginTop: 2 },
  reason: { color: COLORS.warning, fontFamily: FONTS.martelRegular, fontSize: 13 },
  metadataBox: { borderTopWidth: 1, borderTopColor: COLORS.cardBorder, paddingTop: SPACING.sm, gap: 2 },
  metadataText: { color: COLORS.textSecondary, fontFamily: FONTS.martelRegular, fontSize: 12 },
  emptyTitle: { color: COLORS.text, fontFamily: FONTS.heading, fontSize: 18, textAlign: "center" },
  emptyText: { color: COLORS.textSecondary, fontFamily: FONTS.martelRegular, fontSize: 13, textAlign: "center", marginTop: SPACING.xs },
});

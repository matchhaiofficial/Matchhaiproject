import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";

import {
  AdminEmptyStateCard,
  AdminFilterDrawer,
  AdminPageHeader,
  AdminSearchFilterBar,
  AdminStatusBadge,
} from "../../src/components/AdminSurface";
import { AppButton, AppCard } from "../../src/components/AppPrimitives";
import Screen from "../../src/components/Screen";
import { DiscoverFilterRow } from "../../src/features/discover/components/DiscoverShared";
import { useTabBarClearance } from "../../src/hooks/useTabBarClearance";
import { useToast } from "../../src/hooks/useToast";
import {
  getIdentityVerifications,
  manuallyVerifyIdentityVerification,
  type SuperAdminIdentityVerification,
} from "../../src/services/convex/superAdminService";
import { COLORS, FONTS, RADII, SPACING } from "../../src/theme";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "Progress" },
  { key: "in_review", label: "Review" },
  { key: "verified", label: "Verified" },
  { key: "rejected", label: "Rejected" },
] as const;

const ROLE_FILTERS = [
  { key: "all", label: "All" },
  { key: "player", label: "Players" },
  { key: "zone_owner", label: "Zone Owners" },
  { key: "venue_admin", label: "Venue Admins" },
] as const;

function formatDate(value?: number | null) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}

function formatLabel(value?: string | null) {
  return String(value || "Not available").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

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

function getVerificationTimestamp(row: SuperAdminIdentityVerification): number | null {
  return row.submittedAt ?? row.verifiedAt ?? row.rejectedAt ?? null;
}

function statusTone(status: string) {
  if (status === "verified") return "success" as const;
  if (status === "rejected" || status === "expired") return "danger" as const;
  if (status === "in_review" || status === "in_progress") return "info" as const;
  return "warning" as const;
}

function CheckStatusRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.checkRow}>
      <Text style={styles.checkLabel}>{label}</Text>
      <Text style={styles.checkValue}>{formatLabel(value)}</Text>
    </View>
  );
}

const VerificationCard = React.memo(function VerificationCard({
  item,
  reason,
  onReasonChange,
  onManualVerify,
  verifying,
}: {
  item: SuperAdminIdentityVerification;
  reason: string;
  onReasonChange: (value: string) => void;
  onManualVerify: () => void;
  verifying: boolean;
}) {
  const canManualVerify = ["pending", "in_review"].includes(item.status);
  return (
    <AppCard style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.titleWrap}>
          <Text style={styles.userName} numberOfLines={1}>{item.userName}</Text>
          {item.userEmail ? <Text style={styles.userEmail} numberOfLines={1}>{item.userEmail}</Text> : null}
        </View>
        <AdminStatusBadge tone={statusTone(item.status)} label={formatLabel(item.status)} />
      </View>

      <View style={styles.metaGrid}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Role</Text>
          <Text style={styles.metaValue}>{formatLabel(item.role)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Provider</Text>
          <Text style={styles.metaValue}>Didit</Text>
        </View>
      </View>

      <Text style={styles.workflowText} numberOfLines={1}>Workflow: {item.workflowId}</Text>
      <Text style={styles.dateText}>Submitted: {formatDate(item.submittedAt)}</Text>
      {item.verifiedAt ? <Text style={styles.dateText}>Verified: {formatDate(item.verifiedAt)}</Text> : null}
      {item.rejectedAt ? <Text style={styles.dateText}>Rejected: {formatDate(item.rejectedAt)}</Text> : null}
      {item.rejectionReason ? <Text style={styles.reasonText}>Reason: {item.rejectionReason}</Text> : null}

      <View style={styles.checksBox}>
        <CheckStatusRow label="Email" value={item.emailVerificationStatus} />
        <CheckStatusRow label="ID" value={item.idVerificationStatus} />
        <CheckStatusRow label="Liveness" value={item.livenessStatus} />
        <CheckStatusRow label="Face match" value={item.faceMatchStatus} />
        <CheckStatusRow label="AML" value={item.amlStatus} />
        <CheckStatusRow label="IP analysis" value={item.ipAnalysisStatus} />
      </View>

      {canManualVerify ? (
        <View style={styles.manualBox}>
          <Text style={styles.manualTitle}>Manual review</Text>
          <Text style={styles.manualText}>
            Use only when Didit is pending due to a safe review mismatch and the profile has been checked.
          </Text>
          <TextInput
            value={reason}
            onChangeText={onReasonChange}
            placeholder="Reason, e.g. name transliteration reviewed"
            placeholderTextColor={COLORS.textSecondary}
            style={styles.reasonInput}
            multiline
          />
          <AppButton
            style={styles.manualButton}
            onPress={onManualVerify}
            loading={verifying}
            disabled={verifying || reason.trim().length < 8}
          >
            Manually Verify
          </AppButton>
        </View>
      ) : null}
    </AppCard>
  );
});

export default function SuperAdminIdentityVerificationsScreen() {
  const bottomContentPadding = useTabBarClearance(SPACING.lg);
  const { showToast } = useToast();
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]["key"]>("all");
  const [roleFilter, setRoleFilter] = useState<(typeof ROLE_FILTERS)[number]["key"]>("all");
  const [rows, setRows] = useState<SuperAdminIdentityVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateRangeKey>("Any");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [manualReasons, setManualReasons] = useState<Record<string, string>>({});
  const [manualVerifyingId, setManualVerifyingId] = useState<string | null>(null);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);

    const result = await getIdentityVerifications({
      status: statusFilter === "all" ? undefined : statusFilter,
      role: roleFilter === "all" ? undefined : roleFilter,
    });
    if (result.ok) setRows(result.data);
    else showToast({ type: "error", title: "Verifications failed", message: result.message });

    if (mode === "initial") setLoading(false);
    else setRefreshing(false);
  }, [roleFilter, showToast, statusFilter]);

  useFocusEffect(useCallback(() => {
    void load("initial");
  }, [load]));

  const handleManualVerify = useCallback(async (item: SuperAdminIdentityVerification) => {
    const reason = String(manualReasons[item.id] || "").trim();
    if (reason.length < 8) {
      showToast({ type: "warning", title: "Reason required", message: "Add a clear manual verification reason first." });
      return;
    }

    setManualVerifyingId(item.id);
    const result = await manuallyVerifyIdentityVerification(item.id, reason);
    setManualVerifyingId(null);

    if (!result.ok) {
      showToast({ type: "error", title: "Manual verification failed", message: result.message });
      return;
    }

    setManualReasons((current) => ({ ...current, [item.id]: "" }));
    showToast({ type: "success", title: "Profile verified", message: "Manual KYC override was saved and audited." });
    await load("refresh");
  }, [load, manualReasons, showToast]);

  const activeFilterCount = Number(statusFilter !== "all") + Number(roleFilter !== "all") + Number(dateFilter !== "Any");

  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const statusFilteredRows = statusFilter === "pending"
      ? rows.filter((row) => ["not_started", "pending", "in_progress", "in_review"].includes(row.status))
      : rows;
    return statusFilteredRows.filter((row) => {
      if (!matchesDateRange(getVerificationTimestamp(row), dateFilter)) return false;
      if (!needle) return true;
      return [
        row.userName,
        row.userEmail,
        row.role,
        row.status,
        row.workflowId,
        row.rejectionReason,
      ].filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [rows, search, statusFilter, dateFilter]);

  const handleReasonChange = useCallback((id: string, value: string) => {
    setManualReasons((current) => ({ ...current, [id]: value }));
  }, []);

  const renderVerification = useCallback(
    ({ item }: { item: SuperAdminIdentityVerification }) => (
      <VerificationCard
        item={item}
        reason={manualReasons[item.id] || ""}
        onReasonChange={(value) => handleReasonChange(item.id, value)}
        onManualVerify={() => handleManualVerify(item)}
        verifying={manualVerifyingId === item.id}
      />
    ),
    [manualReasons, manualVerifyingId, handleReasonChange, handleManualVerify],
  );

  const renderEmpty = useCallback(
    () =>
      rows.length === 0 ? (
        <AdminEmptyStateCard
          title="No verifications found"
          description="Didit KYC sessions will appear here after users start verification."
          icon="verified-user"
        />
      ) : (
        <AdminEmptyStateCard
          title="No verifications match these filters."
          description="Reset filters to view all verifications."
          icon="verified-user"
        />
      ),
    [rows.length],
  );

  return (
    <Screen style={styles.screen} contentStyle={styles.screenContent} scroll={false} edges={["top"]} keyboardAvoiding>
      <AdminPageHeader
        title="Identity Verifications"
        subtitle="Safe Didit KYC status overview."
        onBack={() => router.back()}
        inlineTitle
      />

      <AdminSearchFilterBar
        value={search}
        onChangeText={setSearch}
        placeholder="Search user, role, workflow, status"
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
          renderItem={renderVerification}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={[styles.content, { paddingBottom: bottomContentPadding }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} tintColor={COLORS.accent} />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews
          initialNumToRender={10}
          windowSize={11}
        />
      )}

      <AdminFilterDrawer
        visible={drawerOpen}
        title="Verification filters"
        activeFilterCount={activeFilterCount}
        onClose={() => setDrawerOpen(false)}
        onReset={() => {
          setStatusFilter("all");
          setRoleFilter("all");
          setDateFilter("Any");
        }}
        onDone={() => setDrawerOpen(false)}
        resetDisabled={!activeFilterCount}
      >
        <DiscoverFilterRow
          label="Status"
          options={STATUS_FILTERS.map((item) => ({ key: item.key, label: item.label }))}
          selected={statusFilter}
          onSelect={(value) => setStatusFilter(value as typeof statusFilter)}
        />
        <DiscoverFilterRow
          label="Role"
          options={ROLE_FILTERS.map((item) => ({ key: item.key, label: item.label }))}
          selected={roleFilter}
          onSelect={(value) => setRoleFilter(value as typeof roleFilter)}
        />
        <DiscoverFilterRow
          label="Date Range"
          options={DATE_RANGE_OPTIONS}
          selected={dateFilter}
          onSelect={(value) => setDateFilter(value as DateRangeKey)}
        />
      </AdminFilterDrawer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.backgroundDark,
  },
  screenContent: {
    flex: 1,
  },
  searchBar: {
    marginBottom: SPACING.md,
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    gap: SPACING.md,
  },
  card: {
    gap: SPACING.md,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  titleWrap: {
    flex: 1,
  },
  userName: {
    color: COLORS.text,
    fontFamily: FONTS.montserratBold,
    fontSize: 16,
  },
  userEmail: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.montserratRegular,
    fontSize: 12,
    marginTop: 2,
  },
  metaGrid: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  metaItem: {
    flex: 1,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.sm,
  },
  metaLabel: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.montserratRegular,
    fontSize: 11,
  },
  metaValue: {
    color: COLORS.text,
    fontFamily: FONTS.montserratSemiBold,
    fontSize: 13,
    marginTop: 2,
  },
  workflowText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interRegular,
    fontSize: 12,
  },
  dateText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interRegular,
    fontSize: 12,
  },
  reasonText: {
    color: COLORS.warning,
    fontFamily: FONTS.interMedium,
    fontSize: 12,
  },
  checksBox: {
    marginTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
    paddingTop: SPACING.sm,
    gap: 6,
  },
  manualBox: {
    marginTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
    paddingTop: SPACING.sm,
    gap: SPACING.sm,
  },
  manualTitle: {
    color: COLORS.text,
    fontFamily: FONTS.montserratBold,
    fontSize: 13,
  },
  manualText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.montserratRegular,
    fontSize: 12,
    lineHeight: 18,
  },
  reasonInput: {
    minHeight: 72,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.backgroundDark,
    color: COLORS.text,
    fontFamily: FONTS.montserratRegular,
    fontSize: 13,
    padding: SPACING.sm,
    textAlignVertical: "top",
  },
  manualButton: {
    alignSelf: "stretch",
  },
  checkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  checkLabel: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.montserratRegular,
    fontSize: 12,
  },
  checkValue: {
    color: COLORS.text,
    fontFamily: FONTS.montserratMedium,
    fontSize: 12,
    textAlign: "right",
    flex: 1,
  },
});

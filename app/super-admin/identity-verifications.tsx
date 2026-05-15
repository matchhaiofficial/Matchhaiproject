import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppHeader from "../../src/components/AppHeader";
import { AppIcon } from "../../src/components/AppIcon";
import { AdminEmptyStateCard } from "../../src/components/AdminSurface";
import { AppDrawer, AppModalBody, AppModalFooter, AppModalHeader } from "../../src/components/AppModalPrimitives";
import { AppButton, AppCard, StatusPill } from "../../src/components/AppPrimitives";
import Screen from "../../src/components/Screen";
import { DiscoverFilterRow } from "../../src/features/discover/components/DiscoverShared";
import { useToast } from "../../src/hooks/useToast";
import {
  getIdentityVerifications,
  manuallyVerifyIdentityVerification,
  type SuperAdminIdentityVerification,
} from "../../src/services/convex/superAdminService";
import { COLORS, FONTS, RADII, SPACING } from "../../src/theme";

const DRAWER_WIDTH = Math.min(420, Math.round(Dimensions.get("window").width * 0.94));

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

function VerificationCard({
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
        <StatusPill tone={statusTone(item.status)} label={formatLabel(item.status)} />
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
}

export default function SuperAdminIdentityVerificationsScreen() {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]["key"]>("all");
  const [roleFilter, setRoleFilter] = useState<(typeof ROLE_FILTERS)[number]["key"]>("all");
  const [rows, setRows] = useState<SuperAdminIdentityVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
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

  const activeFilterCount = Number(statusFilter !== "all") + Number(roleFilter !== "all");

  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const statusFilteredRows = statusFilter === "pending"
      ? rows.filter((row) => ["not_started", "pending", "in_progress", "in_review"].includes(row.status))
      : rows;
    if (!needle) return statusFilteredRows;
    return statusFilteredRows.filter((row) =>
      [
        row.userName,
        row.userEmail,
        row.role,
        row.status,
        row.workflowId,
        row.rejectionReason,
      ].filter(Boolean).join(" ").toLowerCase().includes(needle),
    );
  }, [rows, search, statusFilter]);

  return (
    <Screen style={styles.screen} contentStyle={styles.screenContent} scroll={false} edges={["top"]}>
      <AppHeader
        title="Identity Verifications"
        subtitle="Safe Didit KYC status overview."
        onBack={() => router.back()}
        inlineTitle
      />

      <View style={styles.topControls}>
        <View style={styles.searchBar}>
          <AppIcon name="search" size={20} color={COLORS.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search user, role, workflow, status"
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
          {visibleRows.map((item) => (
            <VerificationCard
              key={item.id}
              item={item}
              reason={manualReasons[item.id] || ""}
              onReasonChange={(value) => setManualReasons((current) => ({ ...current, [item.id]: value }))}
              onManualVerify={() => handleManualVerify(item)}
              verifying={manualVerifyingId === item.id}
            />
          ))}
          {visibleRows.length === 0 ? (
            <AdminEmptyStateCard
              title="No verifications found"
              description="Didit KYC sessions will appear here after users start verification."
              icon="verified-user"
            />
          ) : null}
        </ScrollView>
      )}

      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} drawerStyle={styles.drawer}>
        <View style={styles.drawerContent}>
          <AppModalHeader
            title="Verification filters"
            subtitle={`${activeFilterCount} active filters`}
            onClose={() => setDrawerOpen(false)}
            compact
          />
          <AppModalBody scroll contentContainerStyle={styles.drawerBody}>
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
          </AppModalBody>
          <AppModalFooter>
            <View style={[styles.drawerFooterRow, { paddingBottom: insets.bottom + 8 }]}>
              <AppButton
                variant="secondary"
                style={styles.drawerFooterButton}
                onPress={() => {
                  setStatusFilter("all");
                  setRoleFilter("all");
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
  screen: {
    flex: 1,
    backgroundColor: COLORS.backgroundDark,
  },
  screenContent: {
    flex: 1,
  },
  topControls: {
    marginTop: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  searchBar: {
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardDark,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    minHeight: 48,
    flex: 1,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontFamily: FONTS.montserratRegular,
    marginLeft: SPACING.sm,
  },
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
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingBottom: SPACING.xxl,
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

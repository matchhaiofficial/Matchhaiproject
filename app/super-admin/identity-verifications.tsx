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
  getIdentityVerifications,
  type SuperAdminIdentityVerification,
} from "../../src/services/convex/superAdminService";
import { COLORS, FONTS, RADII, SPACING } from "../../src/theme";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "in_review", label: "Review" },
  { key: "verified", label: "Verified" },
  { key: "rejected", label: "Rejected" },
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
  if (status === "in_review") return "info" as const;
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

function VerificationCard({ item }: { item: SuperAdminIdentityVerification }) {
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
    </AppCard>
  );
}

export default function SuperAdminIdentityVerificationsScreen() {
  const { showToast } = useToast();
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]["key"]>("all");
  const [rows, setRows] = useState<SuperAdminIdentityVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);

    const result = await getIdentityVerifications({
      status: statusFilter === "all" ? undefined : statusFilter,
    });
    if (result.ok) setRows(result.data);
    else showToast({ type: "error", title: "Verifications failed", message: result.message });

    if (mode === "initial") setLoading(false);
    else setRefreshing(false);
  }, [showToast, statusFilter]);

  useFocusEffect(useCallback(() => {
    void load("initial");
  }, [load]));

  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [
        row.userName,
        row.userEmail,
        row.role,
        row.status,
        row.workflowId,
        row.rejectionReason,
      ].filter(Boolean).join(" ").toLowerCase().includes(needle),
    );
  }, [rows, search]);

  return (
    <Screen style={styles.screen} contentStyle={styles.screenContent} scroll={false} edges={["top"]}>
      <AppHeader
        title="Identity Verifications"
        subtitle="Safe Didit KYC status overview."
        onBack={() => router.back()}
        inlineTitle
      />

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
          {visibleRows.map((item) => <VerificationCard key={item.id} item={item} />)}
          {visibleRows.length === 0 ? (
            <AppCard variant="empty">
              <Text style={styles.emptyTitle}>No verifications found</Text>
              <Text style={styles.emptyText}>Didit KYC sessions will appear here after users start verification.</Text>
            </AppCard>
          ) : null}
        </ScrollView>
      )}
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
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardDark,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontFamily: FONTS.montserratRegular,
    marginLeft: SPACING.sm,
  },
  tabs: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
    gap: SPACING.md,
  },
  card: {
    gap: SPACING.sm,
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
    fontFamily: FONTS.montserratRegular,
    fontSize: 12,
  },
  dateText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.montserratRegular,
    fontSize: 12,
  },
  reasonText: {
    color: COLORS.warning,
    fontFamily: FONTS.montserratMedium,
    fontSize: 12,
  },
  checksBox: {
    marginTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
    paddingTop: SPACING.sm,
    gap: 6,
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
  emptyTitle: {
    color: COLORS.text,
    fontFamily: FONTS.montserratBold,
    fontSize: 16,
    textAlign: "center",
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.montserratRegular,
    fontSize: 13,
    textAlign: "center",
    marginTop: SPACING.xs,
  },
});

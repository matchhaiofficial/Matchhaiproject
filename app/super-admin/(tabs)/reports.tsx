import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppHeader from "../../../src/components/AppHeader";
import { AppIcon } from "../../../src/components/AppIcon";
import { AdminInfoLine } from "../../../src/components/AdminSurface";
import { AppDrawer, AppModalBody, AppModalFooter, AppModalHeader } from "../../../src/components/AppModalPrimitives";
import { AppButton, AppCard, StatusPill } from "../../../src/components/AppPrimitives";
import Screen from "../../../src/components/Screen";
import SegmentedTabs from "../../../src/components/SegmentedTabs";
import { DiscoverFilterRow } from "../../../src/features/discover/components/DiscoverShared";
import { useTabBarClearance } from "../../../src/hooks/useTabBarClearance";
import { useToast } from "../../../src/hooks/useToast";
import { getReports, SuperAdminReport } from "../../../src/services/convex/superAdminService";
import { COLORS, FONTS, RADII, SPACING } from "../../../src/theme";
import { getReportStatusLabel, getReportStatusTone } from "../../../src/utils/statusLabels";

type ReportTab = "pending" | "reviewed" | "resolved";
type ReportTypeFilter = "Any" | SuperAdminReport["type"];

function formatDate(value?: number) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}

function formatType(value?: string | null) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function SuperAdminReportsTab() {
  const insets = useSafeAreaInsets();
  const bottomContentPadding = useTabBarClearance(SPACING.lg);
  const { showToast } = useToast();
  const [tab, setTab] = useState<ReportTab>("pending");
  const [reports, setReports] = useState<SuperAdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ReportTypeFilter>("Any");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);
    const result = await getReports(tab);
    if (result.ok) setReports(result.data);
    else showToast({ type: "error", title: "Reports failed", message: result.message });
    if (mode === "initial") setLoading(false);
    else setRefreshing(false);
  }, [showToast, tab]);

  useFocusEffect(useCallback(() => {
    void load("initial");
  }, [load]));

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return reports.filter((report) => {
      if (typeFilter !== "Any" && report.type !== typeFilter) return false;
      if (!needle) return true;
      return [
        report.reason,
        report.description,
        report.reporterName,
        report.reportedUserName,
        report.zoneName,
        report.branchLabel,
        report.matchroomTitle,
        report.game,
        report.type,
      ].filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [reports, search, typeFilter]);

  const activeCount = Number(typeFilter !== "Any");

  return (
    <Screen style={styles.screen} contentStyle={styles.screenContent} scroll={false} edges={["top"]}>
      <AppHeader title="Reports" subtitle="Review and resolve moderation reports." inlineTitle />
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <AppIcon name="search" size={20} color={COLORS.textSecondary} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search reports" placeholderTextColor={COLORS.textSecondary} style={styles.searchInput} autoCapitalize="none" />
        </View>
        <Pressable onPress={() => setDrawerOpen(true)} style={styles.filterButton}>
          <AppIcon name="filters" size={22} color={COLORS.text} />
          {activeCount ? <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{activeCount}</Text></View> : null}
        </Pressable>
      </View>
      <SegmentedTabs
        items={[
          { key: "pending", label: "Pending" },
          { key: "reviewed", label: "Reviewed" },
          { key: "resolved", label: "Resolved" },
        ]}
        value={tab}
        onChange={(value) => setTab(value as ReportTab)}
        style={styles.tabs}
      />
      <Pressable onPress={() => router.push("/super-admin/support-tickets" as any)} style={({ pressed }) => pressed && { opacity: 0.9 }}>
        <AppCard style={styles.supportTicketLinkCard}>
          <View style={styles.supportTicketLinkIcon}>
            <AppIcon name="support" size={20} color={COLORS.success} />
          </View>
          <View style={styles.supportTicketLinkText}>
            <Text style={styles.supportTicketLinkTitle}>View Support Tickets</Text>
            <Text style={styles.supportTicketLinkSubtitle}>Operational support requests from Help & Support chat.</Text>
          </View>
          <AppIcon name="chevron-right" size={20} color={COLORS.textSecondary} />
        </AppCard>
      </Pressable>

      {loading ? (
        <View style={styles.loaderWrap}><ActivityIndicator color={COLORS.accent} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomContentPadding }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} tintColor={COLORS.accent} />}
          showsVerticalScrollIndicator={false}
        >
          {visible.map((report) => (
            <Pressable key={report.id} onPress={() => router.push(`/super-admin/report/${report.id}` as any)}>
              <AppCard style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle}>{report.reason}</Text>
                  <StatusPill tone={getReportStatusTone(report.status)} label={getReportStatusLabel(report.status)} />
                </View>
                <Text style={styles.cardMeta}>{formatType(report.type)} | {formatDate(report.createdAt)}</Text>
                <View style={styles.infoStack}>
                  <AdminInfoLine label="Reporter" value={report.reporterName} />
                  {report.reportedUserName ? <AdminInfoLine label="Player" value={report.reportedUserName} /> : null}
                  {report.zoneName ? <AdminInfoLine label="Zone" value={report.zoneName} /> : null}
                  {report.matchroomTitle ? <AdminInfoLine label="Matchroom" value={report.matchroomTitle} /> : null}
                </View>
                <Text style={styles.linkHint}>Open report details</Text>
              </AppCard>
            </Pressable>
          ))}
          {visible.length === 0 ? (
            <AppCard variant="empty">
              <Text style={styles.emptyTitle}>No reports here</Text>
              <Text style={styles.emptyText}>Try another tab, search, or filter.</Text>
            </AppCard>
          ) : null}
        </ScrollView>
      )}

      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} drawerStyle={styles.drawer}>
        <View style={styles.drawerContent}>
          <AppModalHeader title="Filters" subtitle={`${activeCount} active report filters`} onClose={() => setDrawerOpen(false)} compact />
          <AppModalBody scroll contentContainerStyle={styles.drawerBody}>
            <DiscoverFilterRow
              label="Report type"
              options={["Any", "Player report", "Matchroom report", "Zone / venue report"]}
              selected={typeFilter === "user_report" ? "Player report" : typeFilter === "matchroom_complaint" ? "Matchroom report" : typeFilter === "zone_complaint" ? "Zone / venue report" : "Any"}
              onSelect={(value) => setTypeFilter(value === "Player report" ? "user_report" : value === "Matchroom report" ? "matchroom_complaint" : value === "Zone / venue report" ? "zone_complaint" : "Any")}
            />
          </AppModalBody>
          <AppModalFooter>
            <View style={[styles.drawerFooterRow, { paddingBottom: insets.bottom + 8 }]}>
              <AppButton variant="secondary" style={styles.drawerFooterButton} onPress={() => setTypeFilter("Any")} disabled={!activeCount}>Reset</AppButton>
              <AppButton style={styles.drawerFooterButton} onPress={() => setDrawerOpen(false)}>Done</AppButton>
            </View>
          </AppModalFooter>
        </View>
      </AppDrawer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.backgroundDark },
  screenContent: { paddingTop: 0 },
  searchRow: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.md },
  searchBar: { flex: 1, minHeight: 48, borderRadius: RADII.lg, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.cardDark, paddingHorizontal: SPACING.md, flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  searchInput: { flex: 1, color: COLORS.text, fontFamily: FONTS.body, fontSize: 14 },
  filterButton: { width: 48, height: 48, borderRadius: RADII.lg, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.cardDark, alignItems: "center", justifyContent: "center" },
  filterBadge: { position: "absolute", top: 7, right: 7, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.accent, alignItems: "center", justifyContent: "center" },
  filterBadgeText: { color: "#fff", fontFamily: FONTS.interSemiBold, fontSize: 10 },
  tabs: { marginBottom: SPACING.md },
  supportTicketLinkCard: { flexDirection: "row", alignItems: "center", gap: SPACING.md, marginBottom: SPACING.md },
  supportTicketLinkIcon: { width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${COLORS.success}18`, borderWidth: 1, borderColor: `${COLORS.success}44` },
  supportTicketLinkText: { flex: 1, minWidth: 0 },
  supportTicketLinkTitle: { color: COLORS.text, fontFamily: FONTS.interSemiBold, fontSize: 14 },
  supportTicketLinkSubtitle: { color: COLORS.textSecondary, fontFamily: FONTS.martelRegular, fontSize: 12, lineHeight: 18, marginTop: 2 },
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { gap: SPACING.md },
  card: { gap: SPACING.sm },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.md },
  cardTitle: { flex: 1, color: COLORS.text, fontFamily: FONTS.heading, fontSize: 16 },
  cardMeta: { color: COLORS.textSecondary, fontFamily: FONTS.martelRegular, fontSize: 13 },
  infoStack: { gap: SPACING.sm },
  linkHint: { color: COLORS.accent, fontFamily: FONTS.interSemiBold, fontSize: 12 },
  emptyTitle: { color: COLORS.text, fontFamily: FONTS.heading, fontSize: 18, textAlign: "center" },
  emptyText: { color: COLORS.textSecondary, fontFamily: FONTS.martelRegular, fontSize: 13, textAlign: "center", marginTop: SPACING.xs },
  drawer: { backgroundColor: COLORS.backgroundDark },
  drawerContent: { flex: 1 },
  drawerBody: { gap: SPACING.lg },
  drawerFooterRow: { flexDirection: "row", gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  drawerFooterButton: { flex: 1 },
});

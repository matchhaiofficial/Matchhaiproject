import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "../../../src/components/AppIcon";
import {
  AdminEmptyStateCard,
  AdminFilterDrawer,
  AdminInfoLine,
  AdminListCard,
  AdminPageHeader,
  AdminSearchFilterBar,
} from "../../../src/components/AdminSurface";
import { AppCard } from "../../../src/components/AppPrimitives";
import Screen from "../../../src/components/Screen";
import SegmentedTabs from "../../../src/components/SegmentedTabs";
import { DiscoverFilterRow } from "../../../src/features/discover/components/DiscoverShared";
import { useTabBarClearance } from "../../../src/hooks/useTabBarClearance";
import { useToast } from "../../../src/hooks/useToast";
import { getReports, SuperAdminReport } from "../../../src/services/convex/superAdminService";
import { COLORS, FONTS, SPACING } from "../../../src/theme";
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
      <AdminPageHeader title="Reports" subtitle="Review and resolve moderation reports." inlineTitle />
      <AdminSearchFilterBar
        value={search}
        onChangeText={setSearch}
        placeholder="Search reports"
        onFilterPress={() => setDrawerOpen(true)}
        activeFilterCount={activeCount}
        style={styles.searchBar}
      />
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
            <AdminListCard
              key={report.id}
              title={report.reason}
              subtitle={`${formatType(report.type)} | ${formatDate(report.createdAt)}`}
              statusLabel={getReportStatusLabel(report.status)}
              statusTone={getReportStatusTone(report.status)}
              onPress={() => router.push(`/super-admin/report/${report.id}` as any)}
            >
              <View style={styles.cardBody}>
                <View style={styles.infoStack}>
                  <AdminInfoLine label="Reporter" value={report.reporterName} />
                  {report.reportedUserName ? <AdminInfoLine label="Player" value={report.reportedUserName} /> : null}
                  {report.zoneName ? <AdminInfoLine label="Zone" value={report.zoneName} /> : null}
                  {report.matchroomTitle ? <AdminInfoLine label="Matchroom" value={report.matchroomTitle} /> : null}
                </View>
                <Text style={styles.linkHint}>Open report details</Text>
              </View>
            </AdminListCard>
          ))}
          {visible.length === 0 ? (
            <AdminEmptyStateCard
              title="No reports here"
              description="Try another tab, search, or filter."
              icon="reports"
            />
          ) : null}
        </ScrollView>
      )}

      <AdminFilterDrawer
        visible={drawerOpen}
        title="Filters"
        activeFilterCount={activeCount}
        onClose={() => setDrawerOpen(false)}
        onReset={() => setTypeFilter("Any")}
        onDone={() => setDrawerOpen(false)}
        resetDisabled={!activeCount}
      >
        <DiscoverFilterRow
          label="Report type"
          options={["Any", "Player report", "Matchroom report", "Zone / venue report"]}
          selected={typeFilter === "user_report" ? "Player report" : typeFilter === "matchroom_complaint" ? "Matchroom report" : typeFilter === "zone_complaint" ? "Zone / venue report" : "Any"}
          onSelect={(value) => setTypeFilter(value === "Player report" ? "user_report" : value === "Matchroom report" ? "matchroom_complaint" : value === "Zone / venue report" ? "zone_complaint" : "Any")}
        />
      </AdminFilterDrawer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.backgroundDark },
  screenContent: { paddingTop: 0 },
  searchBar: { marginBottom: SPACING.md },
  tabs: { marginBottom: SPACING.md },
  supportTicketLinkCard: { flexDirection: "row", alignItems: "center", gap: SPACING.md, marginBottom: SPACING.md },
  supportTicketLinkIcon: { width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${COLORS.success}18`, borderWidth: 1, borderColor: `${COLORS.success}44` },
  supportTicketLinkText: { flex: 1, minWidth: 0 },
  supportTicketLinkTitle: { color: COLORS.text, fontFamily: FONTS.interSemiBold, fontSize: 14 },
  supportTicketLinkSubtitle: { color: COLORS.textSecondary, fontFamily: FONTS.interRegular, fontSize: 12, lineHeight: 18, marginTop: 2 },
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { gap: SPACING.md },
  cardBody: { gap: SPACING.md },
  infoStack: { gap: SPACING.sm },
  linkHint: { color: COLORS.accent, fontFamily: FONTS.interSemiBold, fontSize: 12 },
});

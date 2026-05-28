import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

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
type ReportTypeFilter = "Any" | "player" | "zone" | "matchroom" | "chat" | "support";

function formatDate(value?: number) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}

function formatType(value?: string | null) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function reportTypeGroup(report: SuperAdminReport): Exclude<ReportTypeFilter, "Any"> {
  if (report.source === "support_chatbot_moderation_report") return "support";
  if (report.type.includes("chat_message_report")) return "chat";
  if (report.type === "zone_complaint") return "zone";
  if (report.type === "matchroom_complaint") return "matchroom";
  return "player";
}

function reportContextLabel(report: SuperAdminReport) {
  if (report.chatContextLabel) return report.chatContextLabel;
  if (report.source === "support_chatbot_moderation_report") return "Support chatbot moderation report";
  return formatType(report.type);
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

const ReportRow = React.memo(function ReportRow({
  report,
  onPress,
}: {
  report: SuperAdminReport;
  onPress: (id: string) => void;
}) {
  return (
    <AdminListCard
      title={report.reason}
      subtitle={`${formatType(report.type)} | ${formatDate(report.createdAt)}`}
      statusLabel={getReportStatusLabel(report.status)}
      statusTone={getReportStatusTone(report.status)}
      onPress={() => onPress(report.id)}
    >
      <View style={styles.cardBody}>
        <View style={styles.infoStack}>
          <AdminInfoLine label="Reporter" value={report.reporterName} />
          {report.reportedUserName ? <AdminInfoLine label="Player" value={report.reportedUserName} /> : null}
          {report.zoneName ? <AdminInfoLine label="Zone" value={report.zoneName} /> : null}
          {report.matchroomTitle ? <AdminInfoLine label="Matchroom" value={report.matchroomTitle} /> : null}
          {report.chatContextLabel || report.source ? <AdminInfoLine label="Source" value={reportContextLabel(report)} /> : null}
          {report.messagePreview ? <AdminInfoLine label="Preview" value={report.messagePreview} /> : null}
          {report.targetMissing ? <AdminInfoLine label="Target" value="Record no longer available" /> : null}
        </View>
        <Text style={styles.linkHint}>Open report details</Text>
      </View>
    </AdminListCard>
  );
});

export default function SuperAdminReportsTab() {
  const bottomContentPadding = useTabBarClearance(SPACING.lg);
  const { showToast } = useToast();
  const [tab, setTab] = useState<ReportTab>("pending");
  const [reports, setReports] = useState<SuperAdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ReportTypeFilter>("Any");
  const [gameFilter, setGameFilter] = useState<string>(ALL);
  const [dateFilter, setDateFilter] = useState<DateRangeKey>("Any");
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

  const gameOptions = useMemo(() => {
    const present = Array.from(new Set(reports.map((r) => r.game).filter(Boolean) as string[])).sort();
    return [{ key: ALL, label: "All" }, ...present.map((g) => ({ key: g, label: g.toUpperCase() }))];
  }, [reports]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return reports.filter((report) => {
      if (typeFilter !== "Any" && reportTypeGroup(report) !== typeFilter) return false;
      if (gameFilter !== ALL && report.game !== gameFilter) return false;
      if (!matchesDateRange(report.createdAt, dateFilter)) return false;
      if (!needle) return true;
      return [
        report.reason,
        report.description,
        report.reporterName,
        report.reportedUserName,
        report.zoneName,
        report.branchLabel,
        report.matchroomTitle,
        report.chatContextLabel,
        report.source,
        report.targetType,
        report.targetReference,
        report.messagePreview,
        report.chatMessageId,
        report.teamChallengeChatId,
        report.supportTicketId,
        report.game,
        report.type,
      ].filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [reports, search, typeFilter, gameFilter, dateFilter]);

  const activeCount =
    Number(typeFilter !== "Any") +
    Number(gameFilter !== ALL) +
    Number(dateFilter !== "Any");

  const resetFilters = useCallback(() => {
    setTypeFilter("Any");
    setGameFilter(ALL);
    setDateFilter("Any");
  }, []);

  const handleOpenReport = useCallback((id: string) => {
    router.push(`/super-admin/report/${id}` as any);
  }, []);

  const renderReport = useCallback(
    ({ item }: { item: SuperAdminReport }) => <ReportRow report={item} onPress={handleOpenReport} />,
    [handleOpenReport],
  );

  const renderEmpty = useCallback(
    () =>
      reports.length === 0 ? (
        <AdminEmptyStateCard
          title="No reports here"
          description="Reports in this state will appear here."
          icon="reports"
        />
      ) : (
        <AdminEmptyStateCard
          title="No reports match these filters."
          description="Reset filters to view all reports."
          icon="reports"
        />
      ),
    [reports.length],
  );

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
        <FlatList
          data={visible}
          keyExtractor={(report) => report.id}
          renderItem={renderReport}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={[styles.content, { paddingBottom: bottomContentPadding }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} tintColor={COLORS.accent} />}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={10}
          windowSize={11}
        />
      )}

      <AdminFilterDrawer
        visible={drawerOpen}
        title="Filters"
        activeFilterCount={activeCount}
        onClose={() => setDrawerOpen(false)}
        onReset={resetFilters}
        onDone={() => setDrawerOpen(false)}
        resetDisabled={!activeCount}
      >
        <DiscoverFilterRow
          label="Target Type"
          options={["Any", "Player / team report", "Matchroom report", "Zone / venue report", "Chat message report", "Support moderation report"]}
          selected={
            typeFilter === "player" ? "Player / team report"
              : typeFilter === "matchroom" ? "Matchroom report"
                : typeFilter === "zone" ? "Zone / venue report"
                  : typeFilter === "chat" ? "Chat message report"
                    : typeFilter === "support" ? "Support moderation report"
                      : "Any"
          }
          onSelect={(value) => setTypeFilter(
            value === "Player / team report" ? "player"
              : value === "Matchroom report" ? "matchroom"
                : value === "Zone / venue report" ? "zone"
                  : value === "Chat message report" ? "chat"
                    : value === "Support moderation report" ? "support"
                      : "Any"
          )}
        />
        <DiscoverFilterRow label="Game" options={gameOptions} selected={gameFilter} onSelect={setGameFilter} />
        <DiscoverFilterRow label="Date Range" options={DATE_RANGE_OPTIONS} selected={dateFilter} onSelect={(value) => setDateFilter(value as DateRangeKey)} />
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

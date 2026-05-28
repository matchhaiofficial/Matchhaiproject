
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";

import { AdminEmptyStateCard, AdminFilterDrawer, AdminListCard, AdminPageHeader, AdminSearchFilterBar, AdminStatusBadge } from "../../src/components/AdminSurface";
import Screen from "../../src/components/Screen";
import SegmentedTabs from "../../src/components/SegmentedTabs";
import { DiscoverFilterRow } from "../../src/features/discover/components/DiscoverShared";
import { useTabBarClearance } from "../../src/hooks/useTabBarClearance";
import { useToast } from "../../src/hooks/useToast";
import {
  getSupportTickets,
  type SuperAdminSupportTicket,
  type SuperAdminSupportTicketStatus,
} from "../../src/services/convex/superAdminService";
import { COLORS, FONTS, SPACING } from "../../src/theme";

function formatDate(value?: number) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}

function formatValue(value?: string | null) {
  return String(value || "Uncategorized").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

const ALL = "All";
const UNASSIGNED = "__unassigned__";
const PRIORITY_ORDER = ["urgent", "high", "medium", "low"];

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

function statusLabel(status: SuperAdminSupportTicketStatus) {
  switch (status) {
    case "in_review":
      return "In Review";
    case "resolved":
      return "Resolved";
    case "open":
    default:
      return "Open";
  }
}

function statusTone(status: SuperAdminSupportTicketStatus) {
  if (status === "resolved") return "success" as const;
  if (status === "in_review") return "info" as const;
  return "warning" as const;
}

function priorityTone(priority?: SuperAdminSupportTicket["priority"]) {
  if (priority === "urgent" || priority === "high") return "warning" as const;
  if (priority === "low") return "info" as const;
  return "neutral" as const;
}

function emptyLabel(status: SuperAdminSupportTicketStatus) {
  if (status === "in_review") return "No in-review support tickets";
  if (status === "resolved") return "No resolved support tickets";
  return "No open support tickets";
}

function TicketCard({ ticket }: { ticket: SuperAdminSupportTicket }) {
  return (
    <AdminListCard
      title={ticket.issueSummary}
      subtitle={ticket.reference}
      statusLabel={statusLabel(ticket.status)}
      statusTone={statusTone(ticket.status)}
      onPress={() => router.push(`/super-admin/support-ticket/${ticket.id}` as any)}
    >
      <View style={styles.cardBody}>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{formatValue(ticket.category)}</Text>
          <Text style={styles.metaDot}>|</Text>
          <Text style={styles.metaText}>{formatValue(ticket.userRole)}</Text>
          {ticket.priority ? (
            <>
              <Text style={styles.metaDot}>|</Text>
              <AdminStatusBadge tone={priorityTone(ticket.priority)} label={formatValue(ticket.priority)} />
            </>
          ) : null}
        </View>
        <Text style={styles.metaText}>Created: {formatDate(ticket.createdAt)}</Text>
        {ticket.userDisplayName ? <Text style={styles.metaText}>User: {ticket.userDisplayName}</Text> : null}
        {ticket.excerptPreview ? <Text style={styles.excerpt} numberOfLines={3}>{ticket.excerptPreview}</Text> : null}
        <Text style={styles.linkHint}>Open ticket details</Text>
      </View>
    </AdminListCard>
  );
}

export default function SuperAdminSupportTicketsScreen() {
  const { showToast } = useToast();
  const bottomContentPadding = useTabBarClearance(SPACING.lg);
  const [tab, setTab] = useState<SuperAdminSupportTicketStatus>("open");
  const [tickets, setTickets] = useState<SuperAdminSupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<string>(ALL);
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL);
  const [roleFilter, setRoleFilter] = useState<string>(ALL);
  const [assignedFilter, setAssignedFilter] = useState<string>(ALL);
  const [dateFilter, setDateFilter] = useState<DateRangeKey>("Any");

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);

    const result = await getSupportTickets(tab, { forceRefresh: true });
    if (result.ok) setTickets(result.data);
    else showToast({ type: "error", title: "Support tickets failed", message: result.message });

    if (mode === "initial") setLoading(false);
    else setRefreshing(false);
  }, [showToast, tab]);

  useFocusEffect(useCallback(() => {
    void load("initial");
  }, [load]));

  const priorityOptions = useMemo(() => {
    const present = new Set(tickets.map((t) => t.priority).filter(Boolean) as string[]);
    const ordered = PRIORITY_ORDER.filter((p) => present.has(p));
    return [{ key: ALL, label: "All" }, ...ordered.map((p) => ({ key: p, label: formatValue(p) }))];
  }, [tickets]);

  const categoryOptions = useMemo(() => {
    const present = Array.from(new Set(tickets.map((t) => t.category).filter(Boolean) as string[])).sort();
    return [{ key: ALL, label: "All" }, ...present.map((c) => ({ key: c, label: formatValue(c) }))];
  }, [tickets]);

  const roleOptions = useMemo(() => {
    const present = Array.from(new Set(tickets.map((t) => t.userRole).filter(Boolean) as string[])).sort();
    return [{ key: ALL, label: "All" }, ...present.map((r) => ({ key: r, label: formatValue(r) }))];
  }, [tickets]);

  const assignedOptions = useMemo(() => {
    const present = Array.from(new Set(tickets.map((t) => t.assignedAdminName).filter(Boolean) as string[])).sort();
    const hasUnassigned = tickets.some((t) => !t.assignedAdminName);
    return [
      { key: ALL, label: "All" },
      ...(hasUnassigned ? [{ key: UNASSIGNED, label: "Unassigned" }] : []),
      ...present.map((a) => ({ key: a, label: a })),
    ];
  }, [tickets]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (priorityFilter !== ALL && ticket.priority !== priorityFilter) return false;
      if (categoryFilter !== ALL && ticket.category !== categoryFilter) return false;
      if (roleFilter !== ALL && ticket.userRole !== roleFilter) return false;
      if (assignedFilter !== ALL) {
        if (assignedFilter === UNASSIGNED) {
          if (ticket.assignedAdminName) return false;
        } else if (ticket.assignedAdminName !== assignedFilter) {
          return false;
        }
      }
      if (!matchesDateRange(ticket.createdAt, dateFilter)) return false;
      if (!needle) return true;
      return [
        ticket.reference,
        ticket.issueSummary,
        ticket.category,
        ticket.userRole,
        ticket.userDisplayName,
        ticket.userEmail,
        ticket.excerptPreview,
      ].filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [search, tickets, priorityFilter, categoryFilter, roleFilter, assignedFilter, dateFilter]);

  const activeFilterCount =
    Number(priorityFilter !== ALL) +
    Number(categoryFilter !== ALL) +
    Number(roleFilter !== ALL) +
    Number(assignedFilter !== ALL) +
    Number(dateFilter !== "Any");

  const resetFilters = useCallback(() => {
    setPriorityFilter(ALL);
    setCategoryFilter(ALL);
    setRoleFilter(ALL);
    setAssignedFilter(ALL);
    setDateFilter("Any");
  }, []);

  return (
    <Screen style={styles.screen} contentStyle={styles.screenContent} scroll={false} edges={["top"]}>
      <AdminPageHeader title="Support Tickets" subtitle="Review operational support requests." onBack={() => router.back()} inlineTitle />

      <AdminSearchFilterBar
        value={search}
        onChangeText={setSearch}
        placeholder="Search support tickets"
        onFilterPress={() => setDrawerOpen(true)}
        activeFilterCount={activeFilterCount}
        style={styles.searchBar}
      />

      <SegmentedTabs
        items={[
          { key: "open", label: "Open" },
          { key: "in_review", label: "In Review" },
          { key: "resolved", label: "Resolved" },
        ]}
        value={tab}
        onChange={(value) => setTab(value as SuperAdminSupportTicketStatus)}
        style={styles.tabs}
      />

      {loading ? (
        <View style={styles.loaderWrap}><ActivityIndicator color={COLORS.accent} /></View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(ticket) => ticket.id}
          renderItem={({ item }) => <TicketCard ticket={item} />}
          contentContainerStyle={[styles.content, { paddingBottom: bottomContentPadding }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} tintColor={COLORS.accent} />}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={10}
          windowSize={11}
          ListEmptyComponent={
            tickets.length === 0 ? (
              <AdminEmptyStateCard
                title={emptyLabel(tab)}
                description="Support requests from the Help & Support chat will appear here."
                icon="support"
              />
            ) : (
              <AdminEmptyStateCard
                title="No support tickets match these filters."
                description="Reset filters to view all tickets."
                icon="support"
              />
            )
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
        <DiscoverFilterRow label="Priority" options={priorityOptions} selected={priorityFilter} onSelect={setPriorityFilter} />
        <DiscoverFilterRow label="Category" options={categoryOptions} selected={categoryFilter} onSelect={setCategoryFilter} />
        <DiscoverFilterRow label="User Role" options={roleOptions} selected={roleFilter} onSelect={setRoleFilter} />
        <DiscoverFilterRow label="Assigned Admin" options={assignedOptions} selected={assignedFilter} onSelect={setAssignedFilter} />
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
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { gap: SPACING.md },
  cardBody: { gap: SPACING.sm },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metaText: { color: COLORS.textSecondary, fontFamily: FONTS.martelRegular, fontSize: 13 },
  metaDot: { color: COLORS.muted, fontFamily: FONTS.body, fontSize: 13 },
  excerpt: { color: COLORS.text, fontFamily: FONTS.martelRegular, fontSize: 14, lineHeight: 21, marginTop: SPACING.xs },
  linkHint: { color: COLORS.accent, fontFamily: FONTS.interSemiBold, fontSize: 12 },
});

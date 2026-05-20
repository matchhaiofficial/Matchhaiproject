
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { AdminEmptyStateCard, AdminListCard, AdminPageHeader, AdminSearchFilterBar, AdminStatusBadge } from "../../src/components/AdminSurface";
import Screen from "../../src/components/Screen";
import SegmentedTabs from "../../src/components/SegmentedTabs";
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

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return tickets;
    return tickets.filter((ticket) =>
      [
        ticket.reference,
        ticket.issueSummary,
        ticket.category,
        ticket.userRole,
        ticket.userDisplayName,
        ticket.userEmail,
        ticket.excerptPreview,
      ].filter(Boolean).join(" ").toLowerCase().includes(needle)
    );
  }, [search, tickets]);

  return (
    <Screen style={styles.screen} contentStyle={styles.screenContent} scroll={false} edges={["top"]}>
      <AdminPageHeader title="Support Tickets" subtitle="Review operational support requests." onBack={() => router.back()} inlineTitle />

      <AdminSearchFilterBar
        value={search}
        onChangeText={setSearch}
        placeholder="Search support tickets"
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
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomContentPadding }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} tintColor={COLORS.accent} />}
          showsVerticalScrollIndicator={false}
        >
          {visible.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)}
          {visible.length === 0 ? (
            <AdminEmptyStateCard
              title={emptyLabel(tab)}
              description="Support requests from the Help & Support chat will appear here."
              icon="support"
            />
          ) : null}
        </ScrollView>
      )}
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

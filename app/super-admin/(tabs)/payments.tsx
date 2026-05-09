import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppHeader from "../../../src/components/AppHeader";
import { AppIcon } from "../../../src/components/AppIcon";
import { AdminInfoLine } from "../../../src/components/AdminSurface";
import { AppDrawer, AppModalBody, AppModalFooter, AppModalHeader } from "../../../src/components/AppModalPrimitives";
import { AppButton, AppCard, StatusPill } from "../../../src/components/AppPrimitives";
import { DiscoverFilterRow } from "../../../src/features/discover/components/DiscoverShared";
import Screen from "../../../src/components/Screen";
import { useTabBarClearance } from "../../../src/hooks/useTabBarClearance";
import { useToast } from "../../../src/hooks/useToast";
import { EasypaisaAdminTransaction, getEasypaisaTransactions } from "../../../src/services/convex/superAdminService";
import { COLORS, FONTS, RADII, SPACING } from "../../../src/theme";

type KindFilter = "Any" | "wallet_topup" | "booking_intent";
type StatusFilter = "Any" | "created" | "redirected" | "token_received" | "pending" | "paid" | "failed" | "expired" | "cancelled";

function formatDateTime(value?: number | null) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}

function statusTone(status?: string | null) {
  if (status === "paid") return "success" as const;
  if (status === "failed" || status === "expired" || status === "cancelled") return "danger" as const;
  if (status === "pending" || status === "created" || status === "redirected" || status === "token_received") return "warning" as const;
  return "neutral" as const;
}

function kindLabel(kind?: string | null) {
  return kind === "wallet_topup" ? "Wallet payment" : "Matchroom payment";
}

export default function SuperAdminPaymentsTab() {
  const insets = useSafeAreaInsets();
  const bottomContentPadding = useTabBarClearance(SPACING.lg);
  const { showToast } = useToast();
  const [transactions, setTransactions] = useState<EasypaisaAdminTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<KindFilter>("Any");
  const [status, setStatus] = useState<StatusFilter>("Any");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);
    const result = await getEasypaisaTransactions();
    if (result.ok) setTransactions(result.data);
    else showToast({ type: "error", title: "Payments failed", message: result.message });
    if (mode === "initial") setLoading(false);
    else setRefreshing(false);
  }, [showToast]);

  useFocusEffect(useCallback(() => {
    void load("initial");
    const timer = setInterval(() => void load("refresh"), 45_000);
    return () => clearInterval(timer);
  }, [load]));

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return transactions.filter((item) => {
      if (kind !== "Any" && item.kind !== kind) return false;
      if (status !== "Any" && item.status !== status) return false;
      if (!needle) return true;
      return [
        item.accountOwnerName,
        item.orderRefNum,
        item.providerReference,
        item.status,
        item.kind,
        String(item.amount),
      ].filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [kind, search, status, transactions]);

  const activeCount = Number(kind !== "Any") + Number(status !== "Any");

  return (
    <Screen style={styles.screen} contentStyle={styles.screenContent} scroll={false} edges={["top"]}>
      <AppHeader title="Payments" subtitle="Auto-refreshes while focused. Pull down to refresh immediately." inlineTitle />
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <AppIcon name="search" size={20} color={COLORS.textSecondary} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search payments" placeholderTextColor={COLORS.textSecondary} style={styles.searchInput} autoCapitalize="none" />
        </View>
        <Pressable onPress={() => setDrawerOpen(true)} style={styles.filterButton}>
          <AppIcon name="filters" size={22} color={COLORS.text} />
          {activeCount ? <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{activeCount}</Text></View> : null}
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}><ActivityIndicator color={COLORS.accent} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomContentPadding }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} tintColor={COLORS.accent} />}
          showsVerticalScrollIndicator={false}
        >
          {visible.map((item) => {
            const expanded = expandedId === item.id;
            return (
              <Pressable key={item.id} onPress={() => setExpandedId(expanded ? null : item.id)}>
                <AppCard style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.cardTitleWrap}>
                      <Text style={styles.cardTitle}>{kindLabel(item.kind)}</Text>
                      <Text style={styles.cardMeta}>{item.accountOwnerName || "Unknown user"}</Text>
                    </View>
                    <StatusPill tone={statusTone(item.status)} label={item.status} />
                  </View>
                  <Text style={styles.cardMeta}>{formatDateTime(item.createdAt)} | {item.currency} {Math.round(item.amount).toLocaleString("en-US")}</Text>
                  <Text style={styles.cardMeta}>Reference: {item.orderRefNum}</Text>
                  {expanded ? (
                    <View style={styles.details}>
                      <AdminInfoLine label="Provider status" value={item.providerStatus || "N/A"} />
                      <AdminInfoLine label="Provider description" value={item.providerDescription || "N/A"} />
                      <AdminInfoLine label="Provider reference" value={item.providerReference || "N/A"} />
                      <AdminInfoLine label="Processed" value={formatDateTime(item.processedAt)} />
                      <AdminInfoLine label="Updated" value={formatDateTime(item.updatedAt)} />
                      <AdminInfoLine label="Callbacks" value={String(item.callbackCount || 0)} />
                      <AdminInfoLine label="Last sync" value={formatDateTime(item.providerPayload?.lastSyncAt)} />
                      <AdminInfoLine label="Flow" value={item.providerPayload?.flow || "N/A"} />
                      <AdminInfoLine label="Last error" value={item.lastError || "None"} />
                    </View>
                  ) : null}
                </AppCard>
              </Pressable>
            );
          })}
          {visible.length === 0 ? (
            <AppCard variant="empty">
              <Text style={styles.emptyTitle}>No payments found</Text>
              <Text style={styles.emptyText}>Try a different search or filter.</Text>
            </AppCard>
          ) : null}
        </ScrollView>
      )}

      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} drawerStyle={styles.drawer}>
        <View style={styles.drawerContent}>
          <AppModalHeader title="Filters" subtitle={`${activeCount} active payment filters`} onClose={() => setDrawerOpen(false)} compact />
          <AppModalBody scroll contentContainerStyle={styles.drawerBody}>
            <DiscoverFilterRow label="Type" options={["Any", "Wallet payment", "Matchroom payment"]} selected={kind === "wallet_topup" ? "Wallet payment" : kind === "booking_intent" ? "Matchroom payment" : "Any"} onSelect={(value) => setKind(value === "Wallet payment" ? "wallet_topup" : value === "Matchroom payment" ? "booking_intent" : "Any")} />
            <DiscoverFilterRow label="Status" options={["Any", "created", "redirected", "token_received", "pending", "paid", "failed", "expired", "cancelled"]} selected={status} onSelect={(value) => setStatus(value as StatusFilter)} />
          </AppModalBody>
          <AppModalFooter>
            <View style={[styles.drawerFooterRow, { paddingBottom: insets.bottom + 8 }]}>
              <AppButton variant="secondary" style={styles.drawerFooterButton} onPress={() => { setKind("Any"); setStatus("Any"); }} disabled={!activeCount}>Reset</AppButton>
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
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { gap: SPACING.md },
  card: { gap: SPACING.sm },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.md },
  cardTitleWrap: { flex: 1, minWidth: 0 },
  cardTitle: { color: COLORS.text, fontFamily: FONTS.heading, fontSize: 16 },
  cardMeta: { color: COLORS.textSecondary, fontFamily: FONTS.martelRegular, fontSize: 13 },
  details: { marginTop: SPACING.sm, gap: SPACING.sm },
  emptyTitle: { color: COLORS.text, fontFamily: FONTS.heading, fontSize: 18, textAlign: "center" },
  emptyText: { color: COLORS.textSecondary, fontFamily: FONTS.martelRegular, fontSize: 13, textAlign: "center", marginTop: SPACING.xs },
  drawer: { backgroundColor: COLORS.backgroundDark },
  drawerContent: { flex: 1 },
  drawerBody: { gap: SPACING.lg },
  drawerFooterRow: { flexDirection: "row", gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  drawerFooterButton: { flex: 1 },
});

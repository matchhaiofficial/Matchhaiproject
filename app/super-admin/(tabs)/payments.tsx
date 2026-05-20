import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import {
  AdminEmptyStateCard,
  AdminFilterDrawer,
  AdminInfoLine,
  AdminListCard,
  AdminPageHeader,
  AdminSearchFilterBar,
} from "../../../src/components/AdminSurface";
import { DiscoverFilterRow } from "../../../src/features/discover/components/DiscoverShared";
import Screen from "../../../src/components/Screen";
import { useTabBarClearance } from "../../../src/hooks/useTabBarClearance";
import { useToast } from "../../../src/hooks/useToast";
import { EasypaisaAdminTransaction, getEasypaisaTransactions } from "../../../src/services/convex/superAdminService";
import { COLORS, SPACING } from "../../../src/theme";

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
      <AdminPageHeader title="Payments" subtitle="Auto-refreshes while focused. Pull down to refresh immediately." inlineTitle />
      <AdminSearchFilterBar
        value={search}
        onChangeText={setSearch}
        placeholder="Search payments"
        onFilterPress={() => setDrawerOpen(true)}
        activeFilterCount={activeCount}
        style={styles.searchBar}
      />

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
              <AdminListCard
                key={item.id}
                title={kindLabel(item.kind)}
                subtitle={item.accountOwnerName || "Unknown user"}
                statusLabel={item.status}
                statusTone={statusTone(item.status)}
                onPress={() => setExpandedId(expanded ? null : item.id)}
              >
                <View style={styles.cardBody}>
                  <AdminInfoLine label="Created" value={`${formatDateTime(item.createdAt)} | ${item.currency} ${Math.round(item.amount).toLocaleString("en-US")}`} />
                  <AdminInfoLine label="Reference" value={item.orderRefNum} />
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
                </View>
              </AdminListCard>
            );
          })}
          {visible.length === 0 ? (
            <AdminEmptyStateCard
              title="No payments found"
              description="Try a different search or filter."
              icon="paymentWallet"
            />
          ) : null}
        </ScrollView>
      )}

      <AdminFilterDrawer
        visible={drawerOpen}
        title="Filters"
        activeFilterCount={activeCount}
        onClose={() => setDrawerOpen(false)}
        onReset={() => { setKind("Any"); setStatus("Any"); }}
        onDone={() => setDrawerOpen(false)}
        resetDisabled={!activeCount}
      >
        <DiscoverFilterRow label="Type" options={["Any", "Wallet payment", "Matchroom payment"]} selected={kind === "wallet_topup" ? "Wallet payment" : kind === "booking_intent" ? "Matchroom payment" : "Any"} onSelect={(value) => setKind(value === "Wallet payment" ? "wallet_topup" : value === "Matchroom payment" ? "booking_intent" : "Any")} />
        <DiscoverFilterRow label="Status" options={["Any", "created", "redirected", "token_received", "pending", "paid", "failed", "expired", "cancelled"]} selected={status} onSelect={(value) => setStatus(value as StatusFilter)} />
      </AdminFilterDrawer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.backgroundDark },
  screenContent: { paddingTop: 0 },
  searchBar: { marginBottom: SPACING.md },
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { gap: SPACING.md },
  cardBody: { gap: SPACING.sm },
  details: { marginTop: SPACING.sm, gap: SPACING.sm },
});

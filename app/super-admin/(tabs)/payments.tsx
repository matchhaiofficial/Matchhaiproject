import { router, useFocusEffect } from "expo-router";
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
import { AppButton, StatusPill } from "../../../src/components/AppPrimitives";
import { DiscoverFilterRow } from "../../../src/features/discover/components/DiscoverShared";
import Screen from "../../../src/components/Screen";
import { useTabBarClearance } from "../../../src/hooks/useTabBarClearance";
import { useToast } from "../../../src/hooks/useToast";
import {
  AdminPaymentListItem,
  AdminPaymentReconciliation,
  AdminPaymentStatus,
  getAdminPayments,
} from "../../../src/services/convex/superAdminService";
import { COLORS, SPACING } from "../../../src/theme";

const ALL = "All";

type KindFilter = "Any" | "wallet_topup" | "booking_intent";
const KIND_OPTIONS: { key: KindFilter; label: string }[] = [
  { key: "Any", label: "All" },
  { key: "wallet_topup", label: "Wallet Top-up" },
  { key: "booking_intent", label: "Booking Payment" },
];

type StatusFilter = "Any" | AdminPaymentStatus;
const STATUS_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: "Any", label: "All" },
  { key: "created", label: "Created" },
  { key: "redirected", label: "Redirected" },
  { key: "token_received", label: "Token Received" },
  { key: "pending", label: "Pending" },
  { key: "paid", label: "Paid" },
  { key: "failed", label: "Failed" },
  { key: "expired", label: "Expired" },
  { key: "cancelled", label: "Cancelled" },
];

type DateRangeKey = "Any" | "Today" | "Last 7 Days" | "Last 30 Days";
const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: "Any", label: "Any" },
  { key: "Today", label: "Today" },
  { key: "Last 7 Days", label: "Last 7 Days" },
  { key: "Last 30 Days", label: "Last 30 Days" },
];

function dateRangeToFrom(range: DateRangeKey): number | undefined {
  if (range === "Any") return undefined;
  if (range === "Today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start.getTime();
  }
  const days = range === "Last 7 Days" ? 7 : 30;
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

type AmountRangeKey = "Any" | "Under 500" | "500-2000" | "2000-5000" | "Above 5000";
const AMOUNT_RANGE_OPTIONS: { key: AmountRangeKey; label: string }[] = [
  { key: "Any", label: "Any" },
  { key: "Under 500", label: "Under Rs 500" },
  { key: "500-2000", label: "Rs 500 - Rs 2,000" },
  { key: "2000-5000", label: "Rs 2,000 - Rs 5,000" },
  { key: "Above 5000", label: "Above Rs 5,000" },
];

// Whole-rupee inclusive bounds (payment amounts are whole PKR). Matches the withdrawals buckets.
function amountRangeToBounds(range: AmountRangeKey): { amountMin?: number; amountMax?: number } {
  if (range === "Under 500") return { amountMax: 499 };
  if (range === "500-2000") return { amountMin: 500, amountMax: 2000 };
  if (range === "2000-5000") return { amountMin: 2001, amountMax: 5000 };
  if (range === "Above 5000") return { amountMin: 5001 };
  return {};
}

type ReconKey =
  | "all"
  | "paidNoWalletTx"
  | "walletTxWithoutPaid"
  | "bookingIntentUnpaidButPaymentPaid"
  | "pendingPastExpiry"
  | "failedButWalletTxExists";
const RECON_OPTIONS: { key: ReconKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "paidNoWalletTx", label: "Paid but no wallet transaction" },
  { key: "walletTxWithoutPaid", label: "Wallet transaction without paid payment" },
  { key: "bookingIntentUnpaidButPaymentPaid", label: "Booking unpaid but payment paid" },
  { key: "pendingPastExpiry", label: "Pending past expiry" },
  { key: "failedButWalletTxExists", label: "Failed but wallet transaction exists" },
];

function reconciliationMatches(recon: AdminPaymentReconciliation | null | undefined, key: ReconKey): boolean {
  if (key === "all") return true;
  if (!recon) return false;
  return Boolean(recon[key]);
}

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
  return kind === "wallet_topup" ? "Wallet Top-up" : "Booking Payment";
}

export default function SuperAdminPaymentsTab() {
  const bottomContentPadding = useTabBarClearance(SPACING.lg);
  const { showToast } = useToast();
  const [transactions, setTransactions] = useState<AdminPaymentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<KindFilter>("Any");
  const [status, setStatus] = useState<StatusFilter>("Any");
  const [dateFilter, setDateFilter] = useState<DateRangeKey>("Any");
  const [amountFilter, setAmountFilter] = useState<AmountRangeKey>("Any");
  const [providerStatusFilter, setProviderStatusFilter] = useState<string>(ALL);
  const [reconFilter, setReconFilter] = useState<ReconKey>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Server-driven filters. reconFilter only toggles the opt-in (page-scoped) reconciliation compute.
  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);
    const bounds = amountRangeToBounds(amountFilter);
    const result = await getAdminPayments({
      kind: kind === "Any" ? undefined : kind,
      status: status === "Any" ? undefined : status,
      dateFrom: dateRangeToFrom(dateFilter),
      amountMin: bounds.amountMin,
      amountMax: bounds.amountMax,
      includeReconciliation: reconFilter !== "all",
      limit: 50,
    });
    if (result.ok) setTransactions(result.data);
    else showToast({ type: "error", title: "Payments failed", message: result.message });
    if (mode === "initial") setLoading(false);
    else setRefreshing(false);
  }, [showToast, kind, status, dateFilter, amountFilter, reconFilter]);

  useFocusEffect(useCallback(() => {
    void load("initial");
    const timer = setInterval(() => void load("refresh"), 45_000);
    return () => clearInterval(timer);
  }, [load]));

  // Provider Status options are derived from the loaded page (dynamic, only present values).
  const providerStatusOptions = useMemo(() => {
    const present = Array.from(
      new Set(transactions.map((t) => t.providerStatus).filter(Boolean) as string[]),
    ).sort();
    return [{ key: ALL, label: "All" }, ...present.map((p) => ({ key: p, label: p }))];
  }, [transactions]);

  // Client-side filters over the loaded page: provider status, reconciliation flag, search.
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return transactions.filter((item) => {
      if (providerStatusFilter !== ALL && item.providerStatus !== providerStatusFilter) return false;
      if (!reconciliationMatches(item.reconciliation, reconFilter)) return false;
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
  }, [transactions, search, providerStatusFilter, reconFilter]);

  const activeCount =
    Number(kind !== "Any") +
    Number(status !== "Any") +
    Number(dateFilter !== "Any") +
    Number(amountFilter !== "Any") +
    Number(providerStatusFilter !== ALL) +
    Number(reconFilter !== "all");

  const resetFilters = useCallback(() => {
    setKind("Any");
    setStatus("Any");
    setDateFilter("Any");
    setAmountFilter("Any");
    setProviderStatusFilter(ALL);
    setReconFilter("all");
  }, []);

  const anyFilterActive = activeCount > 0 || search.trim().length > 0;

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
            const flags = item.reconciliation
              ? RECON_OPTIONS.filter((opt) => opt.key !== "all" && item.reconciliation?.[opt.key as keyof AdminPaymentReconciliation])
              : [];
            return (
              <AdminListCard
                key={item.id}
                title={kindLabel(item.kind)}
                subtitle={item.accountOwnerName || "Unknown user"}
                statusLabel={item.status}
                statusTone={statusTone(item.status)}
                onPress={() => setExpandedId(expanded ? null : item.id)}
                actions={
                  <AppButton
                    size="sm"
                    variant="secondary"
                    leadingIcon="visibility"
                    onPress={(event) => {
                      event.stopPropagation();
                      router.push(`/super-admin/payment/${encodeURIComponent(item.orderRefNum)}` as any);
                    }}
                  >
                    View detail
                  </AppButton>
                }
              >
                <View style={styles.cardBody}>
                  <AdminInfoLine label="Created" value={`${formatDateTime(item.createdAt)} | ${item.currency} ${Math.round(item.amount).toLocaleString("en-US")}`} />
                  <AdminInfoLine label="Reference" value={item.orderRefNum} />
                  {flags.length > 0 ? (
                    <View style={styles.flagRow}>
                      {flags.map((f) => (
                        <StatusPill key={f.key} tone="danger" label={f.label} />
                      ))}
                    </View>
                  ) : null}
                  {expanded ? (
                    <View style={styles.details}>
                      <AdminInfoLine label="Provider status" value={item.providerStatus || "N/A"} />
                      <AdminInfoLine label="Provider description" value={item.providerDescription || "N/A"} />
                      <AdminInfoLine label="Provider reference" value={item.providerReference || "N/A"} />
                      <AdminInfoLine label="Processed" value={formatDateTime(item.processedAt)} />
                      <AdminInfoLine label="Expires" value={formatDateTime(item.expiresAt)} />
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
            anyFilterActive ? (
              <AdminEmptyStateCard
                title="No payments match these filters."
                description="Reset filters to view all payments."
                icon="paymentWallet"
              />
            ) : (
              <AdminEmptyStateCard
                title="No payments found"
                description="Payments will appear here as they are created."
                icon="paymentWallet"
              />
            )
          ) : null}
        </ScrollView>
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
        <DiscoverFilterRow label="Payment Type" options={KIND_OPTIONS} selected={kind} onSelect={(value) => setKind(value as KindFilter)} />
        <DiscoverFilterRow label="Payment Status" options={STATUS_OPTIONS} selected={status} onSelect={(value) => setStatus(value as StatusFilter)} />
        <DiscoverFilterRow label="Date Range" options={DATE_RANGE_OPTIONS} selected={dateFilter} onSelect={(value) => setDateFilter(value as DateRangeKey)} />
        <DiscoverFilterRow label="Amount Range" options={AMOUNT_RANGE_OPTIONS} selected={amountFilter} onSelect={(value) => setAmountFilter(value as AmountRangeKey)} />
        <DiscoverFilterRow label="Provider Status" options={providerStatusOptions} selected={providerStatusFilter} onSelect={setProviderStatusFilter} />
        <DiscoverFilterRow label="Reconciliation Issue" options={RECON_OPTIONS} selected={reconFilter} onSelect={(value) => setReconFilter(value as ReconKey)} />
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
  flagRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  details: { marginTop: SPACING.sm, gap: SPACING.sm },
});

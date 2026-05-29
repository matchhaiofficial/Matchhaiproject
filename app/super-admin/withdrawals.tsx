import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppIcon } from "../../src/components/AppIcon";
import { AdminEmptyStateCard, AdminFilterDrawer, AdminInfoLine, AdminListCard, AdminPageHeader, AdminSearchFilterBar } from "../../src/components/AdminSurface";
import { AppDialog, AppDrawer, AppModalBody, AppModalFooter, AppModalHeader } from "../../src/components/AppModalPrimitives";
import { AppButton, StatusPill } from "../../src/components/AppPrimitives";
import Screen from "../../src/components/Screen";
import SegmentedTabs from "../../src/components/SegmentedTabs";
import { DiscoverFilterRow } from "../../src/features/discover/components/DiscoverShared";
import { useTabBarClearance } from "../../src/hooks/useTabBarClearance";
import { useToast } from "../../src/hooks/useToast";
import {
  approveZoneWithdrawal,
  getZoneFinanceSummaries,
  getZoneWithdrawalRequestsPage,
  rejectZoneWithdrawal,
  SuperAdminZoneFinanceSummary,
  SuperAdminWithdrawalRequest,
} from "../../src/services/convex/superAdminService";
import { COLORS, FONTS, RADII, SPACING } from "../../src/theme";

const DRAWER_WIDTH = Math.min(440, Math.round(Dimensions.get("window").width * 0.94));

function formatDateTime(value?: number | null) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}

function formatAmount(amount: number) {
  return `PKR ${Math.round(Number(amount || 0)).toLocaleString("en-US")}`;
}

function statusTone(status?: string | null) {
  if (status === "completed") return "success" as const;
  if (status === "failed") return "danger" as const;
  if (status === "pending") return "warning" as const;
  return "neutral" as const;
}

const ALL = "All";

// Status view. Backend only knows pending/completed/failed; "rejected" is derived
// (failed + adminDecision === "rejected") and "failed" is the system-failure remainder
// (failed + adminDecision !== "rejected"). "all" fetches every status via the "any" arg.
type StatusTabKey = "all" | "pending" | "completed" | "rejected" | "failed";
const STATUS_TABS: { key: StatusTabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "completed", label: "Completed" },
  { key: "rejected", label: "Rejected" },
  { key: "failed", label: "Failed" },
];

// Map the UI status tab to the existing backend `status` arg (no new backend args).
function tabToBackendStatus(tab: StatusTabKey): "any" | "pending" | "completed" | "failed" {
  if (tab === "all") return "any";
  if (tab === "rejected" || tab === "failed") return "failed";
  return tab;
}

// Tab-scoped post-filter that splits the backend "failed" set into Rejected vs Failed.
function matchesStatusTab(item: SuperAdminWithdrawalRequest, tab: StatusTabKey): boolean {
  if (tab === "rejected") return item.status === "failed" && item.adminDecision === "rejected";
  if (tab === "failed") return item.status === "failed" && item.adminDecision !== "rejected";
  return true;
}

function statusTabTitle(tab: StatusTabKey): string {
  return STATUS_TABS.find((t) => t.key === tab)?.label.toLowerCase() ?? "";
}

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

type AmountRangeKey = "Any" | "Under 500" | "500-2000" | "2000-5000" | "Above 5000";
const AMOUNT_RANGE_OPTIONS: { key: AmountRangeKey; label: string }[] = [
  { key: "Any", label: "Any" },
  { key: "Under 500", label: "Under Rs 500" },
  { key: "500-2000", label: "Rs 500 - Rs 2,000" },
  { key: "2000-5000", label: "Rs 2,000 - Rs 5,000" },
  { key: "Above 5000", label: "Above Rs 5,000" },
];

function matchesAmountRange(amount: number, range: AmountRangeKey) {
  if (range === "Any") return true;
  const value = Number(amount || 0);
  if (range === "Under 500") return value < 500;
  if (range === "500-2000") return value >= 500 && value <= 2000;
  if (range === "2000-5000") return value > 2000 && value <= 5000;
  return value > 5000;
}

const WithdrawalRow = React.memo(function WithdrawalRow({
  item,
  onSelect,
}: {
  item: SuperAdminWithdrawalRequest;
  onSelect: (item: SuperAdminWithdrawalRequest) => void;
}) {
  return (
    <AdminListCard
      title={formatAmount(item.amount)}
      subtitle={`${item.venueName || item.branchName || "Zone withdrawal"} - ${formatDateTime(item.createdAt)}`}
      statusLabel={item.adminDecision === "rejected" ? "rejected" : item.status}
      statusTone={statusTone(item.status)}
      onPress={() => onSelect(item)}
    >
      <View style={styles.cardBody}>
        <AdminInfoLine label="Branch" value={item.branchName || "N/A"} />
        <AdminInfoLine label="Bank" value={item.bankName || "N/A"} />
        <AdminInfoLine label="Masked account" value={item.accountNumberMasked || "N/A"} />
        <Text style={styles.referenceText}>Reference: {item.reference || item.id}</Text>
        <View style={styles.cardActionHint}>
          <Text style={styles.cardActionHintText}>View details</Text>
          <AppIcon name="chevron-right" size={18} color={COLORS.accent} />
        </View>
      </View>
    </AdminListCard>
  );
});

function ZoneFinanceRow({ item }: { item: SuperAdminZoneFinanceSummary }) {
  return (
    <View style={styles.financeRow}>
      <View style={styles.financeTitleCol}>
        <Text style={styles.financeZone} numberOfLines={1}>{item.zoneName || "Unknown zone"}</Text>
        <Text style={styles.financeAdmin} numberOfLines={1}>{item.zoneAdminName || item.zoneAdminEmail || "Unknown admin"}</Text>
      </View>
      <View style={styles.financeMetric}>
        <Text style={styles.financeLabel}>Earned</Text>
        <Text style={styles.financeValue}>{formatAmount(item.earnedToday)} / {formatAmount(item.earnedThisWeek)} / {formatAmount(item.earnedThisMonth)}</Text>
      </View>
      <View style={styles.financeMetric}>
        <Text style={styles.financeLabel}>Withdrawn</Text>
        <Text style={styles.financeValue}>{formatAmount(item.withdrawnToday)} / {formatAmount(item.withdrawnThisWeek)} / {formatAmount(item.withdrawnThisMonth)}</Text>
      </View>
      <View style={styles.financeMetricSmall}>
        <Text style={styles.financeLabel}>Pending</Text>
        <Text style={styles.financeValue}>{formatAmount(item.pendingWithdrawalAmount)}</Text>
      </View>
    </View>
  );
}

export default function SuperAdminWithdrawalsScreen() {
  const bottomContentPadding = useTabBarClearance(SPACING.lg);
  const { showToast } = useToast();
  const [withdrawals, setWithdrawals] = useState<SuperAdminWithdrawalRequest[]>([]);
  const [zoneFinance, setZoneFinance] = useState<SuperAdminZoneFinanceSummary[]>([]);
  const [zoneFinanceCapped, setZoneFinanceCapped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | null>(null);
  const [statusTab, setStatusTab] = useState<StatusTabKey>("pending");
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateRangeKey>("Any");
  const [amountFilter, setAmountFilter] = useState<AmountRangeKey>("Any");
  const [branchFilter, setBranchFilter] = useState<string>(ALL);

  const selected = useMemo(
    () => withdrawals.find((item) => item.id === selectedId) || null,
    [selectedId, withdrawals],
  );

  const mergeWithdrawals = useCallback((current: SuperAdminWithdrawalRequest[], next: SuperAdminWithdrawalRequest[]) => {
    const byId = new Map<string, SuperAdminWithdrawalRequest>();
    [...current, ...next].forEach((item) => byId.set(String(item.id), item));
    return Array.from(byId.values());
  }, []);

  const load = useCallback(async (mode: "initial" | "refresh" | "more" = "initial") => {
    if (mode === "more" && (loadingMore || isDone)) return;
    if (mode === "initial") setLoading(true);
    else if (mode === "more") setLoadingMore(true);
    else setRefreshing(true);
    const [result, financeResult] = await Promise.all([
      getZoneWithdrawalRequestsPage({
        status: tabToBackendStatus(statusTab),
        limit: 50,
        cursor: mode === "more" ? cursor : null,
        search: search.trim() || undefined,
      }),
      getZoneFinanceSummaries({ limit: 80 }),
    ]);
    if (result.ok) {
      setWithdrawals((current) => mode === "more" ? mergeWithdrawals(current, result.data.page) : result.data.page);
      setCursor(result.data.continueCursor);
      setIsDone(result.data.isDone);
    }
    else showToast({ type: "error", title: "Withdrawals failed", message: result.message });
    if (financeResult.ok) {
      setZoneFinance(financeResult.data.rows || []);
      setZoneFinanceCapped(Boolean(financeResult.data.capped));
    } else {
      showToast({ type: "error", title: "Zone finance failed", message: financeResult.message });
    }
    if (mode === "initial") setLoading(false);
    else if (mode === "more") setLoadingMore(false);
    else setRefreshing(false);
  }, [cursor, isDone, loadingMore, mergeWithdrawals, search, showToast, statusTab]);

  useFocusEffect(useCallback(() => {
    void load("initial");
  }, [load]));

  // Tab-scoped set (splits backend "failed" into Rejected vs Failed) before drawer/search filters.
  const tabFiltered = useMemo(
    () => withdrawals.filter((item) => matchesStatusTab(item, statusTab)),
    [withdrawals, statusTab],
  );

  const branchOptions = useMemo(() => {
    const present = Array.from(
      new Set(tabFiltered.map((w) => w.branchName || w.venueName).filter(Boolean) as string[]),
    ).sort();
    return [{ key: ALL, label: "All" }, ...present.map((b) => ({ key: b, label: b }))];
  }, [tabFiltered]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return tabFiltered.filter((item) => {
      if (branchFilter !== ALL && (item.branchName || item.venueName) !== branchFilter) return false;
      if (!matchesDateRange(item.createdAt, dateFilter)) return false;
      if (!matchesAmountRange(item.amount, amountFilter)) return false;
      if (!needle) return true;
      return [
        item.ownerName,
        item.venueName,
        item.branchName,
        item.bankName,
        item.reference,
        item.accountNumberMasked,
        String(item.amount),
      ].filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [tabFiltered, search, branchFilter, dateFilter, amountFilter]);

  const visibleZoneFinance = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return zoneFinance.filter((item) => {
      if (!needle) return true;
      return [
        item.zoneName,
        item.zoneAdminName,
        item.zoneAdminEmail,
        item.zoneId,
        item.zoneAdminId,
      ].filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [search, zoneFinance]);

  const activeFilterCount =
    Number(branchFilter !== ALL) +
    Number(dateFilter !== "Any") +
    Number(amountFilter !== "Any");

  const resetFilters = useCallback(() => {
    setBranchFilter(ALL);
    setDateFilter("Any");
    setAmountFilter("Any");
  }, []);

  const closeDrawer = useCallback(() => {
    setSelectedId(null);
    setRejectReason("");
  }, []);

  const handleApprove = useCallback(() => {
    if (!selected || submitting) return;
    setConfirmAction("approve");
  }, [selected, submitting]);

  const confirmApprove = useCallback(async () => {
    if (!selected || submitting) return;
    setConfirmAction(null);
    setSubmitting("approve");
    const result = await approveZoneWithdrawal(selected.id);
    setSubmitting(null);
    if (!result.ok) {
      showToast({ type: "error", title: "Approval failed", message: result.message });
      return;
    }
    showToast({
      type: result.changed ? "success" : "info",
      title: result.changed ? "Withdrawal approved" : "Already processed",
      message: result.changed ? "The wallet balance was deducted." : "This withdrawal was already processed.",
    });
    setSelectedId(null);
    setRejectReason("");
    await load("refresh");
  }, [load, selected, showToast, submitting]);

  const handleReject = useCallback(() => {
    if (!selected || submitting) return;
    const reason = rejectReason.trim();
    if (!reason) {
      showToast({ type: "error", title: "Reason required", message: "Add a rejection reason before continuing." });
      return;
    }
    setConfirmAction("reject");
  }, [rejectReason, selected, showToast, submitting]);

  const confirmReject = useCallback(async () => {
    if (!selected || submitting) return;
    const reason = rejectReason.trim();
    if (!reason) {
      showToast({ type: "error", title: "Reason required", message: "Add a rejection reason before continuing." });
      setConfirmAction(null);
      return;
    }
    setConfirmAction(null);
    setSubmitting("reject");
    const result = await rejectZoneWithdrawal(selected.id, reason);
    setSubmitting(null);
    if (!result.ok) {
      showToast({ type: "error", title: "Rejection failed", message: result.message });
      return;
    }
    showToast({
      type: result.changed ? "success" : "info",
      title: result.changed ? "Withdrawal rejected" : "Already processed",
      message: result.changed ? "The request was marked failed." : "This withdrawal was already processed.",
    });
    setSelectedId(null);
    setRejectReason("");
    await load("refresh");
  }, [load, rejectReason, selected, showToast, submitting]);

  const handleSelect = useCallback((item: SuperAdminWithdrawalRequest) => {
    setSelectedId(item.id);
    setRejectReason("");
  }, []);

  const renderWithdrawal = useCallback(
    ({ item }: { item: SuperAdminWithdrawalRequest }) => (
      <WithdrawalRow item={item} onSelect={handleSelect} />
    ),
    [handleSelect],
  );

  const renderEmpty = useCallback(
    () =>
      tabFiltered.length === 0 ? (
        <AdminEmptyStateCard
          title={statusTab === "all" ? "No withdrawals" : `No ${statusTabTitle(statusTab)} withdrawals`}
          description="Withdrawal requests in this status will appear here."
          icon="wallet"
        />
      ) : (
        <AdminEmptyStateCard
          title="No withdrawals match these filters."
          description="Reset filters to view all withdrawals."
          icon="wallet"
        />
      ),
    [tabFiltered.length, statusTab],
  );

  const listHeader = useMemo(() => (
    <View style={styles.financeSection}>
      <View style={styles.financeHeaderRow}>
        <View>
          <Text style={styles.financeSectionTitle}>Zone Finance</Text>
          <Text style={styles.financeSectionSubtitle}>Today / week / month, Asia/Karachi time. Read-only payout and withdrawal analytics.</Text>
        </View>
        {zoneFinanceCapped ? <StatusPill tone="warning" label="capped" /> : null}
      </View>
      {visibleZoneFinance.length > 0 ? (
        <View style={styles.financeTable}>
          {visibleZoneFinance.slice(0, 12).map((item) => <ZoneFinanceRow key={item.id} item={item} />)}
        </View>
      ) : (
        <AdminEmptyStateCard
          title="No zone finance rows"
          description="Completed venue payouts and zone withdrawal requests will appear here."
          icon="wallet"
        />
      )}
      <Text style={styles.financeFootnote}>Earned uses completed venue payout wallet deposits. Withdrawn uses completed zone withdrawal requests; pending is shown separately.</Text>
    </View>
  ), [visibleZoneFinance, zoneFinanceCapped]);

  return (
    <Screen style={styles.screen} contentStyle={styles.screenContent} scroll={false} edges={["top"]}>
      <AdminPageHeader title="Withdrawals" subtitle="Zone withdrawal requests across all statuses" onBack={() => router.back()} inlineTitle />

      <AdminSearchFilterBar
        value={search}
        onChangeText={setSearch}
        placeholder="Search owner, branch, bank, reference"
        onFilterPress={() => setDrawerOpen(true)}
        activeFilterCount={activeFilterCount}
        style={styles.searchBar}
      />

      <SegmentedTabs
        items={STATUS_TABS}
        value={statusTab}
        onChange={(value) => setStatusTab(value)}
        style={styles.tabs}
        itemTextStyle={styles.tabText}
      />

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          renderItem={renderWithdrawal}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={[styles.content, { paddingBottom: bottomContentPadding }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} tintColor={COLORS.accent} />}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={COLORS.accent} /> : null}
          onEndReached={() => load("more")}
          onEndReachedThreshold={0.4}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={10}
          windowSize={11}
        />
      )}

      <AppDrawer visible={Boolean(selected)} onClose={closeDrawer} drawerStyle={styles.drawer} keyboardAware>
        <View style={styles.drawerContent}>
          <AppModalHeader
            title="Withdrawal detail"
            subtitle={selected ? `${formatAmount(selected.amount)} - ${selected.status}` : undefined}
            onClose={closeDrawer}
            compact
          />
          <AppModalBody scroll contentContainerStyle={styles.drawerBody}>
            {selected ? (
              <>
                <View style={styles.detailTopRow}>
                  <View style={styles.detailIcon}>
                    <AppIcon name="wallet" size={22} color={COLORS.accent} />
                  </View>
                  <View style={styles.detailTitleWrap}>
                    <Text style={styles.detailTitle}>{selected.venueName || selected.branchName || "Zone withdrawal"}</Text>
                    <Text style={styles.detailSubtitle}>{formatDateTime(selected.createdAt)}</Text>
                  </View>
                  <StatusPill tone={statusTone(selected.status)} label={selected.status} />
                </View>
                <View style={styles.detailSection}>
                  <AdminInfoLine label="Amount" value={formatAmount(selected.amount)} />
                  <AdminInfoLine label="Owner" value={selected.ownerName || "N/A"} />
                  <AdminInfoLine label="Branch" value={selected.branchName || "N/A"} />
                  <AdminInfoLine label="Bank" value={selected.bankName || "N/A"} />
                  <AdminInfoLine label="Masked account" value={selected.accountNumberMasked || "N/A"} />
                  <AdminInfoLine label="Reference" value={selected.reference || selected.id} />
                  {selected.status !== "pending" ? (
                    <>
                      <AdminInfoLine label="Decision" value={selected.adminDecision || "N/A"} />
                      <AdminInfoLine label="Decided" value={formatDateTime(selected.decidedAt)} />
                    </>
                  ) : null}
                </View>
                {selected.status === "pending" ? (
                  <View style={styles.reasonBlock}>
                    <Text style={styles.reasonLabel}>Reject reason</Text>
                    <TextInput
                      value={rejectReason}
                      onChangeText={setRejectReason}
                      placeholder="Required for rejection"
                      placeholderTextColor={COLORS.textSecondary}
                      style={styles.reasonInput}
                      multiline
                      maxLength={300}
                      editable={!submitting}
                    />
                    <Text style={styles.reasonCounter}>{rejectReason.trim().length}/300</Text>
                  </View>
                ) : null}
              </>
            ) : null}
          </AppModalBody>
          {selected && selected.status === "pending" ? (
            <AppModalFooter>
              <View style={styles.footerRow}>
                <AppButton
                  variant="danger"
                  style={styles.footerButton}
                  onPress={handleReject}
                  disabled={!selected || Boolean(submitting)}
                  loading={submitting === "reject"}
                >
                  Reject
                </AppButton>
                <AppButton
                  variant="success"
                  style={styles.footerButton}
                  onPress={handleApprove}
                  disabled={!selected || Boolean(submitting)}
                  loading={submitting === "approve"}
                >
                  Approve
                </AppButton>
              </View>
            </AppModalFooter>
          ) : null}
        </View>
      </AppDrawer>

      <AppDialog visible={confirmAction === "approve"} onClose={() => setConfirmAction(null)}>
        <AppModalHeader title="Approve withdrawal" onClose={() => setConfirmAction(null)} />
        <AppModalBody contentContainerStyle={styles.confirmBody}>
          <Text style={styles.confirmText}>
            {selected
              ? `Approve ${formatAmount(selected.amount)} for payout? This will deduct the zone admin wallet balance once.`
              : "Approve this withdrawal for payout? This will deduct the zone admin wallet balance once."}
          </Text>
        </AppModalBody>
        <AppModalFooter>
          <View style={styles.footerRow}>
            <AppButton variant="secondary" style={styles.footerButton} onPress={() => setConfirmAction(null)}>
              Cancel
            </AppButton>
            <AppButton
              variant="success"
              style={styles.footerButton}
              onPress={confirmApprove}
              disabled={!selected || Boolean(submitting)}
              loading={submitting === "approve"}
            >
              Approve
            </AppButton>
          </View>
        </AppModalFooter>
      </AppDialog>

      <AppDialog visible={confirmAction === "reject"} onClose={() => setConfirmAction(null)}>
        <AppModalHeader title="Reject withdrawal" onClose={() => setConfirmAction(null)} />
        <AppModalBody contentContainerStyle={styles.confirmBody}>
          <Text style={styles.confirmText}>
            Reject this withdrawal request? The reason is stored for admin context and is not sent in the notification.
          </Text>
        </AppModalBody>
        <AppModalFooter>
          <View style={styles.footerRow}>
            <AppButton variant="secondary" style={styles.footerButton} onPress={() => setConfirmAction(null)}>
              Cancel
            </AppButton>
            <AppButton
              variant="danger"
              style={styles.footerButton}
              onPress={confirmReject}
              disabled={!selected || Boolean(submitting)}
              loading={submitting === "reject"}
            >
              Reject
            </AppButton>
          </View>
        </AppModalFooter>
      </AppDialog>

      <AdminFilterDrawer
        visible={drawerOpen}
        title="Filters"
        activeFilterCount={activeFilterCount}
        onClose={() => setDrawerOpen(false)}
        onReset={resetFilters}
        onDone={() => setDrawerOpen(false)}
        resetDisabled={!activeFilterCount}
      >
        <DiscoverFilterRow label="Branch / Venue" options={branchOptions} selected={branchFilter} onSelect={setBranchFilter} />
        <DiscoverFilterRow label="Amount Range" options={AMOUNT_RANGE_OPTIONS} selected={amountFilter} onSelect={(value) => setAmountFilter(value as AmountRangeKey)} />
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
  tabText: { fontSize: 11 },
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { gap: SPACING.md },
  cardBody: { gap: SPACING.sm, marginTop: SPACING.sm },
  referenceText: { color: COLORS.textSecondary, fontFamily: FONTS.interRegular, fontSize: 12 },
  cardActionHint: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 2 },
  cardActionHintText: { color: COLORS.accent, fontFamily: FONTS.interSemiBold, fontSize: 12 },
  financeSection: { gap: SPACING.md, marginBottom: SPACING.sm },
  financeHeaderRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: SPACING.md },
  financeSectionTitle: { color: COLORS.text, fontFamily: FONTS.heading, fontSize: 17 },
  financeSectionSubtitle: { color: COLORS.textSecondary, fontFamily: FONTS.interRegular, fontSize: 12, marginTop: 3, lineHeight: 18 },
  financeTable: { borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: RADII.lg, overflow: "hidden", backgroundColor: COLORS.cardDark },
  financeRow: { gap: SPACING.sm, padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  financeTitleCol: { gap: 2 },
  financeZone: { color: COLORS.text, fontFamily: FONTS.interSemiBold, fontSize: 14 },
  financeAdmin: { color: COLORS.textSecondary, fontFamily: FONTS.interRegular, fontSize: 12 },
  financeMetric: { gap: 2 },
  financeMetricSmall: { gap: 2 },
  financeLabel: { color: COLORS.textSecondary, fontFamily: FONTS.interSemiBold, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 },
  financeValue: { color: COLORS.text, fontFamily: FONTS.interRegular, fontSize: 12, lineHeight: 18 },
  financeFootnote: { color: COLORS.textSecondary, fontFamily: FONTS.interRegular, fontSize: 11, lineHeight: 16 },
  drawer: { width: DRAWER_WIDTH, flex: 1, backgroundColor: COLORS.backgroundDark },
  drawerContent: { flex: 1 },
  drawerBody: { gap: SPACING.lg },
  detailTopRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  detailIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(66,165,245,0.12)", alignItems: "center", justifyContent: "center" },
  detailTitleWrap: { flex: 1, minWidth: 0 },
  detailTitle: { color: COLORS.text, fontFamily: FONTS.heading, fontSize: 16 },
  detailSubtitle: { color: COLORS.textSecondary, fontFamily: FONTS.interRegular, fontSize: 12, marginTop: 2 },
  detailSection: { gap: SPACING.sm },
  reasonBlock: { gap: SPACING.sm },
  reasonLabel: { color: COLORS.text, fontFamily: FONTS.interSemiBold, fontSize: 13 },
  reasonInput: { minHeight: 96, borderRadius: RADII.md, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.cardDark, color: COLORS.text, fontFamily: FONTS.body, fontSize: 14, padding: SPACING.md, textAlignVertical: "top" },
  reasonCounter: { color: COLORS.textSecondary, fontFamily: FONTS.interRegular, fontSize: 12, textAlign: "right" },
  confirmBody: { gap: SPACING.md },
  confirmText: { color: COLORS.textSecondary, fontFamily: FONTS.body, fontSize: 14, lineHeight: 20 },
  footerRow: { flexDirection: "row", gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  footerButton: { flex: 1 },
});

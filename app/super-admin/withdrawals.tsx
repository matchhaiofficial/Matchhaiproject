import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "../../src/components/AppIcon";
import { AdminEmptyStateCard, AdminInfoLine, AdminListCard, AdminPageHeader } from "../../src/components/AdminSurface";
import { AppDrawer, AppModalBody, AppModalFooter, AppModalHeader } from "../../src/components/AppModalPrimitives";
import { AppButton, StatusPill } from "../../src/components/AppPrimitives";
import Screen from "../../src/components/Screen";
import { useTabBarClearance } from "../../src/hooks/useTabBarClearance";
import { useToast } from "../../src/hooks/useToast";
import {
  approveZoneWithdrawal,
  getZoneWithdrawalRequests,
  rejectZoneWithdrawal,
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

export default function SuperAdminWithdrawalsScreen() {
  const insets = useSafeAreaInsets();
  const bottomContentPadding = useTabBarClearance(SPACING.lg);
  const { showToast } = useToast();
  const [withdrawals, setWithdrawals] = useState<SuperAdminWithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);

  const selected = useMemo(
    () => withdrawals.find((item) => item.id === selectedId) || null,
    [selectedId, withdrawals],
  );

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);
    const result = await getZoneWithdrawalRequests({ status: "pending", limit: 50 });
    if (result.ok) setWithdrawals(result.data);
    else showToast({ type: "error", title: "Withdrawals failed", message: result.message });
    if (mode === "initial") setLoading(false);
    else setRefreshing(false);
  }, [showToast]);

  useFocusEffect(useCallback(() => {
    void load("initial");
  }, [load]));

  const closeDrawer = useCallback(() => {
    if (submitting) return;
    setSelectedId(null);
    setRejectReason("");
  }, [submitting]);

  const handleApprove = useCallback(() => {
    if (!selected || submitting) return;
    Alert.alert(
      "Approve withdrawal",
      `Approve ${formatAmount(selected.amount)} for payout? This will deduct the zone admin wallet balance once.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: async () => {
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
          },
        },
      ],
    );
  }, [load, selected, showToast, submitting]);

  const handleReject = useCallback(() => {
    if (!selected || submitting) return;
    const reason = rejectReason.trim();
    if (!reason) {
      showToast({ type: "error", title: "Reason required", message: "Add a rejection reason before continuing." });
      return;
    }
    Alert.alert(
      "Reject withdrawal",
      "Reject this withdrawal request? The reason is stored for admin context and is not sent in the notification.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
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
          },
        },
      ],
    );
  }, [load, rejectReason, selected, showToast, submitting]);

  return (
    <Screen style={styles.screen} contentStyle={styles.screenContent} scroll={false} edges={["top"]}>
      <AdminPageHeader title="Withdrawals" subtitle="Pending zone withdrawal requests" onBack={() => router.back()} inlineTitle />
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomContentPadding }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} tintColor={COLORS.accent} />}
          showsVerticalScrollIndicator={false}
        >
          {withdrawals.map((item) => (
            <AdminListCard
              key={item.id}
              title={formatAmount(item.amount)}
              subtitle={`${item.venueName || item.branchName || "Zone withdrawal"} - ${formatDateTime(item.createdAt)}`}
              statusLabel={item.status}
              statusTone={statusTone(item.status)}
              onPress={() => {
                setSelectedId(item.id);
                setRejectReason("");
              }}
            >
              <View style={styles.cardBody}>
                <AdminInfoLine label="Branch" value={item.branchName || "N/A"} />
                <AdminInfoLine label="Bank" value={item.bankName || "N/A"} />
                <AdminInfoLine label="Masked account" value={item.accountNumberMasked || "N/A"} />
                <Text style={styles.referenceText}>Reference: {item.reference || item.id}</Text>
              </View>
            </AdminListCard>
          ))}
          {withdrawals.length === 0 ? (
            <AdminEmptyStateCard
              title="No pending withdrawals"
              description="Approved or rejected requests are hidden from this review queue."
              icon="wallet"
            />
          ) : null}
        </ScrollView>
      )}

      <AppDrawer visible={Boolean(selected)} onClose={closeDrawer} drawerStyle={styles.drawer}>
        <View style={styles.drawerContent}>
          <AppModalHeader
            title="Withdrawal detail"
            subtitle={selected ? `${formatAmount(selected.amount)} - ${selected.status}` : undefined}
            onClose={closeDrawer}
            closeDisabled={Boolean(submitting)}
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
                </View>
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
              </>
            ) : null}
          </AppModalBody>
          <AppModalFooter>
            <View style={[styles.footerRow, { paddingBottom: insets.bottom + 8 }]}>
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
        </View>
      </AppDrawer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.backgroundDark },
  screenContent: { paddingTop: 0 },
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { gap: SPACING.md },
  cardBody: { gap: SPACING.sm, marginTop: SPACING.sm },
  referenceText: { color: COLORS.textSecondary, fontFamily: FONTS.interRegular, fontSize: 12 },
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
  footerRow: { flexDirection: "row", gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  footerButton: { flex: 1 },
});

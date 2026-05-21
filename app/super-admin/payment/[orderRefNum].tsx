import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  AdminEmptyStateCard,
  AdminInfoLine,
  AdminPageHeader,
  AdminSectionHeader,
  AdminStatusBadge,
} from "../../../src/components/AdminSurface";
import { AppButton, AppCard } from "../../../src/components/AppPrimitives";
import Screen from "../../../src/components/Screen";
import { useToast } from "../../../src/hooks/useToast";
import {
  getPaymentDetailByOrderRefNum,
  type SuperAdminPaymentDetail,
} from "../../../src/services/convex/superAdminService";
import { COLORS, FONTS, SPACING } from "../../../src/theme";

function formatDate(value?: number | null) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}

function formatValue(value?: string | number | boolean | null) {
  if (value === undefined || value === null || value === "") return "N/A";
  return String(value).replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatMoney(amount?: number | null, currency?: string | null) {
  if (typeof amount !== "number" || Number.isNaN(amount)) return "N/A";
  return `${currency || "PKR"} ${Math.round(amount).toLocaleString("en-US")}`;
}

function statusTone(status?: string | null) {
  const normalized = String(status || "").toLowerCase();
  if (["paid", "completed", "confirmed"].includes(normalized)) return "success" as const;
  if (["failed", "expired", "cancelled", "rejected"].includes(normalized)) return "danger" as const;
  if (["created", "redirected", "token_received", "pending", "unpaid"].includes(normalized)) return "warning" as const;
  return "neutral" as const;
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <AppCard variant="elevated" style={styles.card}>
      <AdminSectionHeader title={title} subtitle={subtitle} compact />
      <View style={styles.infoStack}>{children}</View>
    </AppCard>
  );
}

function CopyableId({ label, value }: { label: string; value?: string | null }) {
  const { showToast } = useToast();
  if (!value) return <AdminInfoLine label={label} value="N/A" />;
  return (
    <AdminInfoLine
      label={label}
      value={
        <View style={styles.copyRow}>
          <Text style={styles.copyValue} selectable>{value}</Text>
          <AppButton
            size="sm"
            variant="secondary"
            leadingIcon="content-copy"
            onPress={async () => {
              await Clipboard.setStringAsync(value);
              showToast({ type: "success", title: "Copied", message: `${label} copied.` });
            }}
          >
            Copy
          </AppButton>
        </View>
      }
    />
  );
}

export default function SuperAdminPaymentDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderRefNum?: string }>();
  const orderRefNum = String(params.orderRefNum || "");
  const { showToast } = useToast();
  const [detail, setDetail] = useState<SuperAdminPaymentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!orderRefNum) {
        setError("Payment reference not found.");
        setLoading(false);
        return;
      }

      setLoading(true);
      const result = await getPaymentDetailByOrderRefNum(orderRefNum);
      if (cancelled) return;
      if (result.ok) {
        setDetail(result.data);
        setError(result.data ? null : "Payment not found.");
      } else {
        setError(result.message);
        showToast({ type: "error", title: "Payment detail failed", message: result.message });
      }
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [orderRefNum, showToast]);

  const reconciliationRows = useMemo(() => {
    if (!detail) return [];
    return [
      ["Paid payment missing wallet transaction", detail.reconciliation.paymentPaidNoWalletTx],
      ["Wallet transaction exists while payment is not paid", detail.reconciliation.walletTxWithoutPaid],
      ["Booking intent unpaid while payment is paid", detail.reconciliation.bookingIntentUnpaidButPaymentPaid],
      ["Failed payment has wallet transaction", detail.reconciliation.paymentFailedButWalletTxExists],
      ["Pending payment past expiry", detail.reconciliation.paymentPendingPastExpiry],
      ["Booking intent missing", detail.reconciliation.bookingIntentMissing],
      ["Matchroom missing", detail.reconciliation.matchroomMissing],
    ] as const;
  }, [detail]);

  const payment = detail?.paymentTransaction;

  return (
    <Screen style={styles.screen} scroll={false}>
      <AdminPageHeader title="Payment Detail" subtitle={orderRefNum || "Read-only payment review"} onBack={() => router.back()} inlineTitle />
      {loading ? (
        <View style={styles.loaderWrap}><ActivityIndicator color={COLORS.accent} /></View>
      ) : error || !detail || !payment ? (
        <View style={styles.emptyWrap}>
          <AdminEmptyStateCard title={error || "Payment not found"} description="Check the order reference and try again from the Payments tab." icon="paymentWallet" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <AppCard variant="elevated" style={styles.headerCard}>
            <View style={styles.headerTop}>
              <View style={styles.headerTextWrap}>
                <Text style={styles.eyebrow}>Order reference</Text>
                <Text style={styles.orderRef} selectable>{payment.orderRefNum}</Text>
              </View>
              <AdminStatusBadge tone={statusTone(payment.status)} label={formatValue(payment.status)} />
            </View>
            <Text style={styles.headerMeta}>
              {formatValue(payment.kind)} | {formatMoney(payment.amount, payment.currency)}
            </Text>
          </AppCard>

          <SectionCard title="Payment Transaction" subtitle="Provider and internal payment status">
            <AdminInfoLine label="Amount" value={formatMoney(payment.amount, payment.currency)} />
            <AdminInfoLine label="Kind" value={formatValue(payment.kind)} />
            <AdminInfoLine label="Status" value={formatValue(payment.status)} />
            <AdminInfoLine label="Provider" value={formatValue(payment.provider)} />
            <AdminInfoLine label="Payment method" value={payment.paymentMethod || "N/A"} />
            <AdminInfoLine label="Provider status" value={payment.providerStatus || "N/A"} />
            <AdminInfoLine label="Provider reference" value={payment.providerReference || "N/A"} />
            <AdminInfoLine label="Created" value={formatDate(payment.createdAt)} />
            <AdminInfoLine label="Expires" value={formatDate(payment.expiresAt)} />
            <AdminInfoLine label="Processed" value={formatDate(payment.processedAt)} />
            <AdminInfoLine label="Updated" value={formatDate(payment.updatedAt)} />
            <AdminInfoLine label="Callbacks" value={String(payment.callbackCount || 0)} />
            <AdminInfoLine label="Last callback" value={formatDate(payment.lastCallbackAt)} />
            <AdminInfoLine label="Last error" value={payment.lastError || "None"} />
            <AdminInfoLine label="Provider description" value={payment.providerDescription || "N/A"} />
          </SectionCard>

          <SectionCard title="Provider Context" subtitle="Derived timestamps and status only">
            <AdminInfoLine label="Flow" value={detail.providerContext.flow || "N/A"} />
            <AdminInfoLine label="Last sync" value={formatDate(detail.providerContext.lastSyncAt)} />
            <AdminInfoLine label="Last provider status" value={detail.providerContext.lastProviderStatus || "N/A"} />
          </SectionCard>

          <SectionCard title="Wallet Link" subtitle="Matched by walletTransactions.reference">
            {detail.linkedWalletTransaction ? (
              <>
                <AdminInfoLine label="Type" value={formatValue(detail.linkedWalletTransaction.type)} />
                <AdminInfoLine label="Status" value={formatValue(detail.linkedWalletTransaction.status)} />
                <AdminInfoLine label="Amount" value={formatMoney(detail.linkedWalletTransaction.amount, payment.currency)} />
                <AdminInfoLine label="Created" value={formatDate(detail.linkedWalletTransaction.createdAt)} />
                <AdminInfoLine label="Reference" value={detail.linkedWalletTransaction.reference || "N/A"} />
                <AdminInfoLine label="Metadata source" value={detail.linkedWalletTransaction.metadataSource || "N/A"} />
              </>
            ) : (
              <Text style={styles.emptyText}>No linked wallet transaction found.</Text>
            )}
          </SectionCard>

          <SectionCard title="Booking / Match Context" subtitle="Shown only when linked">
            {detail.linkedBookingIntent ? (
              <>
                <AdminInfoLine label="Booking payment" value={formatValue(detail.linkedBookingIntent.paymentStatus)} />
                <AdminInfoLine label="Booking total" value={formatMoney(detail.linkedBookingIntent.pricingTotalCost, payment.currency)} />
                <AdminInfoLine label="Booking created" value={formatDate(detail.linkedBookingIntent.createdAt)} />
              </>
            ) : (
              <Text style={styles.emptyText}>No linked booking intent found.</Text>
            )}
            {detail.linkedMatchroom ? (
              <>
                <View style={styles.divider} />
                <AdminInfoLine label="Matchroom" value={detail.linkedMatchroom.title || "N/A"} />
                <AdminInfoLine label="Matchroom status" value={formatValue(detail.linkedMatchroom.status)} />
                <AdminInfoLine label="Schedule" value={[detail.linkedMatchroom.scheduledDate, detail.linkedMatchroom.scheduledTime].filter(Boolean).join(" ") || "N/A"} />
                <AdminInfoLine label="Scheduled start" value={formatDate(detail.linkedMatchroom.scheduledStartAt)} />
              </>
            ) : (
              <Text style={styles.emptyText}>No linked matchroom found.</Text>
            )}
          </SectionCard>

          <SectionCard title="Linked User" subtitle="Minimal safe user context">
            {detail.linkedUser ? (
              <>
                <AdminInfoLine label="Name" value={detail.linkedUser.displayName || "Unknown user"} />
                <AdminInfoLine label="Username" value={detail.linkedUser.username || "N/A"} />
                <AdminInfoLine label="Email" value={detail.linkedUser.emailMasked || "N/A"} />
              </>
            ) : (
              <Text style={styles.emptyText}>No linked user found.</Text>
            )}
          </SectionCard>

          <SectionCard title="Reconciliation Summary" subtitle="Derived read-only checks">
            {reconciliationRows.map(([label, active]) => (
              <AdminInfoLine
                key={label}
                label={label}
                value={<AdminStatusBadge tone={active ? "warning" : "success"} label={active ? "Flagged" : "Clear"} />}
              />
            ))}
            {detail.reconciliation.messages.length ? (
              <View style={styles.messageStack}>
                {detail.reconciliation.messages.map((message) => (
                  <Text key={message} style={styles.warningText}>{message}</Text>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>No reconciliation flags raised.</Text>
            )}
          </SectionCard>

          <SectionCard title="Notes For Support" subtitle="Copyable internal identifiers">
            <CopyableId label="Order ref" value={detail.support.orderRefNum} />
            <CopyableId label="Payment transaction ID" value={detail.support.paymentTransactionId} />
            <CopyableId label="Wallet transaction ID" value={detail.support.walletTransactionId} />
            <CopyableId label="Booking intent ID" value={detail.support.bookingIntentId} />
            <CopyableId label="Matchroom ID" value={detail.support.matchroomId} />
            <CopyableId label="User ID" value={detail.support.userId} />
          </SectionCard>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.backgroundDark },
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyWrap: { flex: 1, justifyContent: "center", padding: SPACING.lg },
  content: { gap: SPACING.md, paddingBottom: SPACING.xl },
  headerCard: { gap: SPACING.sm },
  headerTop: { flexDirection: "row", justifyContent: "space-between", gap: SPACING.md, alignItems: "flex-start" },
  headerTextWrap: { flex: 1, minWidth: 0 },
  eyebrow: { color: COLORS.textSecondary, fontFamily: FONTS.medium, fontSize: 12, textTransform: "uppercase" },
  orderRef: { color: COLORS.text, fontFamily: FONTS.bold, fontSize: 22 },
  headerMeta: { color: COLORS.textSecondary, fontFamily: FONTS.medium, fontSize: 14 },
  card: { gap: SPACING.sm },
  infoStack: { gap: SPACING.sm },
  emptyText: { color: COLORS.textSecondary, fontFamily: FONTS.body, fontSize: 14 },
  divider: { height: 1, backgroundColor: COLORS.cardBorder, marginVertical: SPACING.xs },
  messageStack: { gap: SPACING.xs, marginTop: SPACING.xs },
  warningText: { color: COLORS.warning, fontFamily: FONTS.medium, fontSize: 13 },
  copyRow: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: SPACING.sm },
  copyValue: { flex: 1, color: COLORS.text, fontFamily: FONTS.interMedium, fontSize: 12, textAlign: "right" },
});

import { useAction, useQuery } from "convex/react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    ActivityIndicator,
    ScrollView,
    Text,
    TextInput,
    View
} from "react-native";

import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import AppHeader from "../../src/components/AppHeader";
import {
    AppDialog,
    AppModalBody,
    AppModalFooter,
    AppModalHeader,
} from "../../src/components/AppModalPrimitives";
import {
    AppButton,
    AppCard,
    StatusPill,
} from "../../src/components/AppPrimitives";
import Screen from "../../src/components/Screen";
import SegmentedTabs from "../../src/components/SegmentedTabs";
import { useAuth } from "../../src/context/AuthContext";
import { usePerfLoadingDeps } from "../../src/hooks/usePerfLoadingDeps";
import { useRouteLogger } from "../../src/hooks/useRouteLogger";
import { useToast } from "../../src/hooks/useToast";
import {
    getOffersForUser,
    getUserRequests,
} from "../../src/services/convex/bookingRequestService";
import { COLORS } from "../../src/theme";
import Logger from "../../src/utils/logger";
import { Perf } from "../../src/utils/perfInstrumentation";
import {
    formatPakistaniPhone,
    isValidPakistaniPhone,
    normalizePakistaniPhone,
} from "../../src/utils/phoneUtils";
import {
    getCheckoutStatusLabel,
    getPaymentStatusLabel
} from "../../src/utils/statusLabels";
import styles from "./wallet.styles";

type WalletTab = "overview" | "transactions";

const getMillis = (value: any) => {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return 0;
};

const formatCurrency = (value: number) => `Rs ${Math.round(value)}`;

const getPhoneSourceLabel = (source?: string | null) => {
  if (source === "checkout_override") return "entered here";
  if (source === "profile") return "profile";
  return null;
};

const getWalletTopupErrorMessage = (error: unknown) => {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  if (
    lower.includes("taking too long to respond") ||
    lower.includes("aborted due to timeout") ||
    lower.includes("timeout")
  ) {
    return "Easypaisa is taking too long to respond. Please try again in a moment.";
  }

  if (lower.includes("server error")) {
    const cleaned = raw
      .split("Called by client")[0]
      .split("Server Error")[0]
      .trim();
    return cleaned || "Could not start the Easypaisa top-up. Please try again.";
  }

  return raw || "Could not start the Easypaisa top-up. Please try again.";
};

export default function WalletScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    gateway?: string;
    paymentStatus?: string;
    orderRefNum?: string;
  }>();
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<WalletTab>("overview");
  const [requestsCount, setRequestsCount] = useState(0);
  const [offersCount, setOffersCount] = useState(0);
  const [addAmount, setAddAmount] = useState("");
  const [addingFunds, setAddingFunds] = useState(false);
  const [phoneModalVisible, setPhoneModalVisible] = useState(false);
  const [checkoutPhone, setCheckoutPhone] = useState("");
  const [serviceLoading, setServiceLoading] = useState(true);
  const [activeOrderRef, setActiveOrderRef] = useState<string | null>(null);
  useRouteLogger("WalletScreen", { activeTab, userId: user?._id });
  const { showToast } = useToast();

  const userId = user?._id as Id<"users"> | undefined;
  const startCheckout = useAction((api as any).easypaisa.startCheckout);

  const walletBalance =
    useQuery(api.wallet.getBalance, userId ? { userId } : "skip") ?? 0;
  const walletHistory = useQuery(
    api.wallet.listHistory,
    userId ? { userId } : "skip",
  );

  const bookingIntents = useQuery(
    api.bookings.listIntentsByUser,
    userId ? { userId } : "skip",
  );

  const checkoutStatus = useQuery(
    api.easypaisa.getCheckoutStatus,
    userId && (activeOrderRef || params.orderRefNum)
      ? { userId, orderRefNum: String(activeOrderRef || params.orderRefNum) }
      : "skip",
  );
  const syncCheckoutStatus = useAction(
    (api as any).easypaisa.syncTransactionStatus,
  );
  const lastAutoSyncKeyRef = useRef<string | null>(null);

  const autoSyncCheckoutStatus = useCallback(
    async (orderRefNum: string, reason: string) => {
      if (!userId || !orderRefNum) return;
      try {
        await Perf.measureAsync(
          "Wallet.SyncCheckoutStatus.Auto",
          () => syncCheckoutStatus({ orderRefNum, userId } as any),
          { meta: { reason, orderRefNum } },
        );
      } catch (error) {
        Logger.error("Wallet", "Auto sync Easypaisa status failed", error);
      }
    },
    [syncCheckoutStatus, userId],
  );

  const fetchServiceData = useCallback(async () => {
    if (!user?._id) {
      setRequestsCount(0);
      setOffersCount(0);
      setServiceLoading(false);
      return;
    }
    setServiceLoading(true);
    try {
      const [requestsResult, offersResult] = await Perf.measureAsync(
        "Wallet.FetchServiceData",
        () =>
          Promise.all([getUserRequests(user._id), getOffersForUser(user._id)]),
      );

      setRequestsCount(
        requestsResult.ok && requestsResult.data
          ? requestsResult.data.length
          : 0,
      );
      setOffersCount(
        offersResult.ok && offersResult.data ? offersResult.data.length : 0,
      );
      Perf.metric("Wallet.FetchServiceData.Result", {
        requestsCount:
          requestsResult.ok && requestsResult.data
            ? requestsResult.data.length
            : 0,
        offersCount:
          offersResult.ok && offersResult.data ? offersResult.data.length : 0,
      });
    } catch (error) {
      Logger.error("Wallet", "Failed to fetch service data", error);
      setRequestsCount(0);
      setOffersCount(0);
    } finally {
      setServiceLoading(false);
    }
  }, [user?._id]);

  useFocusEffect(
    useCallback(() => {
      fetchServiceData();
      const orderRefNum = String(activeOrderRef || params.orderRefNum || "");
      const gateway = String(params.gateway || "");
      const paymentStatus = String(params.paymentStatus || "");
      let retryTimer: ReturnType<typeof setTimeout> | null = null;
      if (
        gateway === "easypaisa" &&
        orderRefNum &&
        (paymentStatus === "success" || paymentStatus === "pending")
      ) {
        const key = `${orderRefNum}:${paymentStatus}:focus`;
        if (lastAutoSyncKeyRef.current !== key) {
          lastAutoSyncKeyRef.current = key;
          autoSyncCheckoutStatus(orderRefNum, "wallet_focus");
          // One retry to reduce "stale balance" after returning from gateway.
          retryTimer = setTimeout(
            () => autoSyncCheckoutStatus(orderRefNum, "wallet_focus_retry"),
            4000,
          );
        }
      }
      return () => {
        if (retryTimer) clearTimeout(retryTimer);
      };
    }, [
      activeOrderRef,
      autoSyncCheckoutStatus,
      fetchServiceData,
      params.gateway,
      params.orderRefNum,
      params.paymentStatus,
    ]),
  );

  const intents = useMemo(() => {
    if (!bookingIntents) return [];
    return [...bookingIntents].sort(
      (a, b) => getMillis(b.createdAt) - getMillis(a.createdAt),
    );
  }, [bookingIntents]);

  const totals = useMemo(() => {
    const totalSpent = intents
      .filter((item) => item.paymentStatus === "paid")
      .reduce((acc, item) => acc + (item.pricing?.totalCost || 0), 0);
    const pendingAmount = intents
      .filter((item) => item.paymentStatus !== "paid")
      .reduce((acc, item) => acc + (item.pricing?.totalCost || 0), 0);
    return {
      totalSpent,
      pendingAmount,
      paidCount: intents.filter((item) => item.paymentStatus === "paid").length,
      pendingCount: intents.filter((item) => item.paymentStatus !== "paid")
        .length,
    };
  }, [intents]);

  const loading =
    authLoading ||
    serviceLoading ||
    (Boolean(userId) && bookingIntents === undefined);
  const quickAmounts = [500, 1000, 2000, 5000];
  const loadingDeps = useMemo(
    () => ({
      authLoading,
      serviceLoading,
      bookingIntentsPending: Boolean(userId) && bookingIntents === undefined,
      checkoutStatusPending:
        Boolean(userId && (activeOrderRef || params.orderRefNum)) &&
        checkoutStatus === undefined,
    }),
    [
      activeOrderRef,
      authLoading,
      bookingIntents,
      checkoutStatus,
      params.orderRefNum,
      serviceLoading,
      userId,
    ],
  );

  usePerfLoadingDeps("Load.Wallet", loadingDeps, {
    routeKey: "/(player)/wallet",
    meta: {
      activeTab,
      hasUserId: Boolean(userId),
      orderRefNum: activeOrderRef || params.orderRefNum || null,
    },
  });

  useEffect(() => {
    if (params.orderRefNum) {
      setActiveOrderRef(String(params.orderRefNum));
    }
  }, [params.orderRefNum]);

  useEffect(() => {
    if (!phoneModalVisible) {
      const formatted = user?.phone
        ? formatPakistaniPhone(String(user.phone))
        : "";
      setCheckoutPhone(formatted);
    }
  }, [phoneModalVisible, user?.phone]);

  useEffect(() => {
    const orderRefNum = String(activeOrderRef || params.orderRefNum || "");
    if (!userId || !orderRefNum || !checkoutStatus) {
      return;
    }
    if (
      !["created", "redirected", "token_received", "pending"].includes(
        String(checkoutStatus.status || ""),
      )
    ) {
      return;
    }

    const timer = setInterval(() => {
      syncCheckoutStatus({ orderRefNum, userId }).catch((error) => {
        Logger.error("Wallet", "Failed to sync Easypaisa status", error);
      });
    }, 5000);

    return () => clearInterval(timer);
  }, [
    activeOrderRef,
    checkoutStatus,
    params.orderRefNum,
    syncCheckoutStatus,
    userId,
  ]);

  useEffect(() => {
    const gateway = String(params.gateway || "");
    const paymentStatus = String(params.paymentStatus || "");
    const orderRefNum = String(params.orderRefNum || "");
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    if (
      gateway === "easypaisa" &&
      orderRefNum &&
      (paymentStatus === "success" || paymentStatus === "pending")
    ) {
      const key = `${orderRefNum}:${paymentStatus}:return`;
      if (lastAutoSyncKeyRef.current !== key) {
        lastAutoSyncKeyRef.current = key;
        autoSyncCheckoutStatus(orderRefNum, "wallet_return");
        retryTimer = setTimeout(
          () => autoSyncCheckoutStatus(orderRefNum, "wallet_return_retry"),
          4000,
        );
      }
    }

    if (gateway === "easypaisa" && paymentStatus === "success") {
      showToast({
        type: "success",
        title: "Top-up received",
        message:
          "Your Easypaisa payment was received. Wallet balance will refresh shortly.",
      });
    }
    if (gateway === "easypaisa" && paymentStatus === "pending") {
      showToast({
        type: "warning",
        title: "Top-up pending",
        message:
          "Approve the payment in Easypaisa. MatchHai will keep checking the status automatically.",
      });
    }
    if (gateway === "easypaisa" && paymentStatus === "expired") {
      showToast({
        type: "warning",
        title: "Top-up expired",
        message: "This Easypaisa payment session expired before completion.",
      });
    }
    if (gateway === "easypaisa" && paymentStatus === "failed") {
      showToast({
        type: "error",
        title: "Top-up failed",
        message: "Easypaisa did not complete the top-up.",
      });
    }

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [
    autoSyncCheckoutStatus,
    params.gateway,
    params.orderRefNum,
    params.paymentStatus,
    showToast,
  ]);

  const handleAddFunds = async () => {
    if (!userId || addingFunds) return;
    const amount = Number(addAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast({
        type: "warning",
        title: "Invalid amount",
        message: "Enter a valid amount to add funds.",
      });
      return;
    }

    setPhoneModalVisible(true);
  };

  const handleConfirmTopup = async () => {
    if (!userId || addingFunds) return;
    const amount = Number(addAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast({
        type: "warning",
        title: "Invalid amount",
        message: "Enter a valid amount to add funds.",
      });
      return;
    }
    if (!isValidPakistaniPhone(checkoutPhone)) {
      showToast({
        type: "warning",
        title: "Invalid number",
        message: "Enter a valid Pakistani mobile number for Easypaisa.",
      });
      return;
    }

    setAddingFunds(true);
    try {
      const normalizedPhone = normalizePakistaniPhone(checkoutPhone);
      const checkout: any = await Perf.measureAsync(
        "Wallet.StartCheckout",
        () =>
          startCheckout({
            kind: "wallet_topup",
            amount,
            userId,
            phone: normalizedPhone.phoneE164 || checkoutPhone,
            transactionType: "MA",
          }),
      );
      setActiveOrderRef(String(checkout.orderRefNum));
      setAddAmount("");
      setPhoneModalVisible(false);
      const instruction =
        checkout.transactionType === "OTC"
          ? `Use token ${checkout.paymentToken || "generated by Easypaisa"} before it expires. MatchHai will keep checking the status.`
          : "Approve the payment in your Easypaisa app or mobile account flow. MatchHai will keep checking the status.";
      showToast({
        type: "info",
        title: "Payment started",
        message: instruction,
      });
    } catch (error) {
      Logger.error("Wallet", "Failed to add funds", error);
      const message = getWalletTopupErrorMessage(error);
      showToast({ type: "error", title: "Failed", message });
    } finally {
      setAddingFunds(false);
    }
  };

  return (
    <Screen style={styles.screen} scroll={false} routeKey="/(player)/wallet">
      <AppHeader title="Wallet" onBack={() => router.back()} inlineTitle />

      <SegmentedTabs
        items={[
          { key: "overview", label: "Overview" },
          {
            key: "transactions",
            label: `Transactions (${walletHistory?.length || 0})`,
          },
        ]}
        value={activeTab}
        onChange={(value) => setActiveTab(value as WalletTab)}
        style={styles.tabs}
      />

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === "overview" ? (
            <>
              <AppCard style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>Wallet Balance</Text>
                <Text style={styles.balanceValue}>
                  {formatCurrency(walletBalance)}
                </Text>
              </AppCard>

              <AppCard style={styles.addFundsCard}>
                <Text style={styles.addFundsTitle}>Add Funds</Text>
                <Text style={styles.addFundsSubtext}>
                  Choose a quick amount and start an Easypaisa payment without
                  leaving MatchHai.
                </Text>
                <View style={styles.quickAmountRow}>
                  {quickAmounts.map((amount) => (
                    <AppButton
                      key={amount}
                      onPress={() => setAddAmount(String(amount))}
                      variant={
                        Number(addAmount) === amount ? "primary" : "secondary"
                      }
                      size="sm"
                      style={[styles.quickAmountBtn]}
                    >
                      <Text style={styles.quickAmountText}>
                        {formatCurrency(amount)}
                      </Text>
                    </AppButton>
                  ))}
                </View>
                <View style={styles.addFundsRow}>
                  <TextInput
                    style={styles.amountInput}
                    keyboardType="numeric"
                    value={addAmount}
                    onChangeText={(text) =>
                      setAddAmount(text.replace(/[^0-9]/g, ""))
                    }
                    placeholder="Enter amount"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                  <AppButton
                    style={styles.addFundsBtn}
                    onPress={handleAddFunds}
                    disabled={!userId || addingFunds}
                    loading={addingFunds}
                    perf={{
                      actionKey: "wallet_topup_start",
                      meta: {
                        source: "wallet",
                      },
                    }}
                  >
                    {!userId ? "Profile unavailable" : "Top up via Easypaisa"}
                  </AppButton>
                </View>
              </AppCard>

              {checkoutStatus ? (
                <AppCard>
                  <Text style={styles.summaryTitle}>
                    Latest Easypaisa Checkout
                  </Text>
                  <Text style={styles.summaryValue}>
                    {getCheckoutStatusLabel(checkoutStatus.status)}
                  </Text>
                  <Text style={styles.summarySubText}>
                    Order {checkoutStatus.orderRefNum} |{" "}
                    {formatCurrency(Number(checkoutStatus.amount || 0))}
                  </Text>
                  {checkoutStatus.providerDescription ? (
                    <Text style={[styles.summarySubText, { marginTop: 8 }]}>
                      Gateway: {checkoutStatus.providerDescription}
                    </Text>
                  ) : null}
                  {checkoutStatus.actionRequired ? (
                    <Text style={[styles.summarySubText, { marginTop: 8 }]}>
                      Next step:{" "}
                      {checkoutStatus.actionRequired === "pay_with_token"
                        ? `Pay with OTC token ${checkoutStatus.paymentToken || ""}`.trim()
                        : "Approve in Easypaisa"}
                    </Text>
                  ) : null}
                  {checkoutStatus.lastError ? (
                    <Text
                      style={[
                        styles.summarySubText,
                        { marginTop: 8, color: COLORS.warning },
                      ]}
                    >
                      Last sync note: {checkoutStatus.lastError}
                    </Text>
                  ) : null}
                  {checkoutStatus.status === "created" ||
                  checkoutStatus.status === "redirected" ||
                  checkoutStatus.status === "token_received" ||
                  checkoutStatus.status === "pending" ? (
                    <AppButton
                      onPress={async () => {
                        try {
                          if (!userId) {
                            throw new Error("Profile unavailable.");
                          }
                          await Perf.measureAsync(
                            "Wallet.SyncCheckoutStatus",
                            () =>
                              syncCheckoutStatus({
                                orderRefNum: String(checkoutStatus.orderRefNum),
                                userId,
                              } as any),
                          );
                          showToast({
                            type: "info",
                            title: "Refreshing",
                            message:
                              "Asked MatchHai to sync the latest Easypaisa status.",
                          });
                        } catch (error) {
                          Logger.error(
                            "Wallet",
                            "Failed to refresh checkout",
                            error,
                          );
                          showToast({
                            type: "error",
                            title: "Refresh failed",
                            message: "Could not sync the Easypaisa status.",
                          });
                        }
                      }}
                      style={[styles.addFundsBtn, { marginTop: 16 }]}
                      perf={{
                        actionKey: "wallet_checkout_refresh",
                        meta: {
                          orderRefNum: checkoutStatus.orderRefNum,
                        },
                      }}
                    >
                      Refresh Easypaisa Status
                    </AppButton>
                  ) : null}
                </AppCard>
              ) : null}

              <AppCard>
                <Text style={styles.summaryTitle}>Total Spent</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(totals.totalSpent)}
                </Text>
                <Text style={styles.summarySubText}>
                  Across all paid bookings
                </Text>
              </AppCard>

              <View style={styles.statsRow}>
                <AppCard style={styles.statCard}>
                  <Text style={styles.statLabel}>Pending Amount</Text>
                  <Text style={styles.statValue}>
                    {formatCurrency(totals.pendingAmount)}
                  </Text>
                </AppCard>
                <AppCard style={[styles.statCard, styles.statCardLast]}>
                  <Text style={styles.statLabel}>Paid Bookings</Text>
                  <Text style={styles.statValue}>{totals.paidCount}</Text>
                </AppCard>
              </View>

              <View style={styles.statsRow}>
                <AppCard style={styles.statCard}>
                  <Text style={styles.statLabel}>My Requests</Text>
                  <Text style={styles.statValue}>{requestsCount}</Text>
                </AppCard>
                <AppCard style={[styles.statCard, styles.statCardLast]}>
                  <Text style={styles.statLabel}>Offers Received</Text>
                  <Text style={styles.statValue}>{offersCount}</Text>
                </AppCard>
              </View>
            </>
          ) : (
            <>
              {walletHistory && walletHistory.length > 0 ? (
                walletHistory.map((item: any) => {
                  const tone =
                    item.status === "paid" || item.status === "completed"
                      ? "success"
                      : item.status === "pending" ||
                          item.status === "created" ||
                          item.status === "redirected" ||
                          item.status === "token_received"
                        ? "warning"
                        : item.status === "failed" ||
                            item.status === "expired" ||
                            item.status === "cancelled"
                          ? "danger"
                          : "neutral";
                  return (
                    <AppCard key={item.id} style={styles.transactionCard}>
                      <View style={styles.transactionTopRow}>
                        <Text style={styles.transactionTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.transactionAmount}>
                          {formatCurrency(Number(item.amount || 0))}
                        </Text>
                      </View>
                      {item.subtitle ? (
                        <Text style={styles.transactionMeta}>
                          {item.subtitle}
                        </Text>
                      ) : null}
                      <Text style={styles.transactionMeta}>
                        Reference: {item.reference || "N/A"}
                      </Text>
                      <Text style={styles.transactionMeta}>
                        Created:{" "}
                        {getMillis(item.createdAt)
                          ? new Date(getMillis(item.createdAt)).toLocaleString()
                          : "Unknown"}
                      </Text>
                      {item.support?.orderRefNum ? (
                        <Text style={styles.transactionMeta}>
                          Order: {item.support.orderRefNum}
                        </Text>
                      ) : null}
                      {item.support?.checkoutPhoneMasked ? (
                        <Text style={styles.transactionMeta}>
                          Phone: {item.support.checkoutPhoneMasked}
                          {getPhoneSourceLabel(item.support.phoneSource)
                            ? ` (${getPhoneSourceLabel(item.support.phoneSource)})`
                            : ""}
                        </Text>
                      ) : null}
                      <StatusPill
                        tone={tone}
                        label={
                          item.source === "payment"
                            ? getCheckoutStatusLabel(item.status)
                            : item.kind === "booking_payment" ||
                                item.kind === "withdrawal"
                              ? getPaymentStatusLabel(item.status)
                              : getCheckoutStatusLabel(item.status)
                        }
                      />
                    </AppCard>
                  );
                })
              ) : (
                <AppCard variant="empty" style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No transactions yet</Text>
                  <Text style={styles.emptyText}>
                    Your payment and booking transaction history will appear
                    here.
                  </Text>
                </AppCard>
              )}
            </>
          )}
        </ScrollView>
      )}

      <AppDialog
        visible={phoneModalVisible}
        onClose={() => !addingFunds && setPhoneModalVisible(false)}
        dismissDisabled={addingFunds}
        cardStyle={styles.phoneDialogCard}
      >
        <AppModalHeader
          title="Confirm Easypaisa Number"
          subtitle="Use the number you want to pay with for this top-up."
          onClose={() => !addingFunds && setPhoneModalVisible(false)}
          closeDisabled={addingFunds}
        />
        <AppModalBody
          scroll
          style={styles.phoneDialogContent}
          contentContainerStyle={styles.phoneModalContent}
        >
          <Text style={styles.phoneAmountLabel}>
            Top-up amount: {formatCurrency(Number(addAmount || 0))}
          </Text>
          <Text style={styles.phoneSectionLabel}>Mobile Account Number</Text>
          <TextInput
            style={[styles.amountInput, styles.phoneInput]}
            keyboardType="phone-pad"
            value={checkoutPhone}
            onChangeText={(value) =>
              setCheckoutPhone(formatPakistaniPhone(value))
            }
            placeholder="03XX XXX XXXX"
            placeholderTextColor={COLORS.textSecondary}
            editable={!addingFunds}
          />
        </AppModalBody>
        <AppModalFooter style={styles.phoneFooter}>
          <View style={styles.phoneActionsRow}>
            <AppButton
              variant="secondary"
              style={styles.phoneActionBtn}
              onPress={() => setPhoneModalVisible(false)}
              disabled={addingFunds}
            >
              Cancel
            </AppButton>
            <AppButton
              style={styles.phoneActionBtn}
              onPress={handleConfirmTopup}
              loading={addingFunds}
              disabled={addingFunds}
              perf={{
                actionKey: "wallet_topup_confirm_phone",
                meta: {
                  source: "wallet",
                },
              }}
            >
              Continue to Pay
            </AppButton>
          </View>
        </AppModalFooter>
      </AppDialog>
    </Screen>
  );
}

import { useAction, useMutation, useQuery } from "convex/react";
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
    Dimensions,
    FlatList,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import AppHeader from "../../src/components/AppHeader";
import { AppIcon } from "../../src/components/AppIcon";
import {
    AppDrawer,
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
import {
    PAYMENT_VERIFICATION_SAFE_MESSAGE,
    RESERVED_WALLET_HELPER_TEXT,
    UNPAID_BOOKINGS_HELPER_TEXT,
    WALLET_BALANCE_HELPER_TEXT,
} from "../../src/utils/paymentUiCopy";
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
import {
    cleanConvexErrorMessage,
    getUserFacingErrorMessage,
} from "../../src/utils/userFacingErrors";
import styles from "./wallet.styles";

type WalletTab = "overview" | "transactions";
type WalletFilterType =
  | "all"
  | "topup"
  | "booking_payment"
  | "hold"
  | "refund"
  | "release_capture"
  | "withdrawal"
  | "other";
type WalletFilterStatus =
  | "all"
  | "successful"
  | "pending"
  | "failed"
  | "expired"
  | "cancelled"
  | "refunded";
type WalletDateRange = "all" | "today" | "last_7_days" | "last_30_days";
type WalletAmountRange = "all" | "under_500" | "500_2000" | "2000_5000" | "above_5000";
type WalletFilters = {
  type: WalletFilterType;
  status: WalletFilterStatus;
  dateRange: WalletDateRange;
  amountRange: WalletAmountRange;
};

const DRAWER_WIDTH = Math.min(420, Math.round(Dimensions.get("window").width * 0.94));
const DEFAULT_WALLET_FILTERS: WalletFilters = {
  type: "all",
  status: "all",
  dateRange: "all",
  amountRange: "all",
};
const TYPE_FILTERS: { key: WalletFilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "topup", label: "Wallet Top-up" },
  { key: "booking_payment", label: "Booking Payment" },
  { key: "hold", label: "Reserved / Hold" },
  { key: "refund", label: "Refund" },
  { key: "release_capture", label: "Release / Capture" },
  { key: "withdrawal", label: "Withdrawal" },
  { key: "other", label: "Other" },
];
const STATUS_FILTERS: { key: WalletFilterStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "successful", label: "Successful" },
  { key: "pending", label: "Pending" },
  { key: "failed", label: "Failed" },
  { key: "expired", label: "Expired" },
  { key: "cancelled", label: "Cancelled" },
  { key: "refunded", label: "Refunded" },
];
const DATE_FILTERS: { key: WalletDateRange; label: string }[] = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "last_7_days", label: "Last 7 Days" },
  { key: "last_30_days", label: "Last 30 Days" },
];
const AMOUNT_FILTERS: { key: WalletAmountRange; label: string }[] = [
  { key: "all", label: "All" },
  { key: "under_500", label: "Under Rs 500" },
  { key: "500_2000", label: "Rs 500 - Rs 2,000" },
  { key: "2000_5000", label: "Rs 2,000 - Rs 5,000" },
  { key: "above_5000", label: "Above Rs 5,000" },
];

const getMillis = (value: any) => {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return 0;
};

const formatCurrency = (value: number) => `Rs ${Math.round(value)}`;

const ACTIVE_CHECKOUT_STATUSES = new Set([
  "created",
  "redirected",
  "token_received",
  "pending",
]);

const formatReferenceLabel = (value?: string | null) => {
  if (!value) return "N/A";
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const getPhoneSourceLabel = (source?: string | null) => {
  if (source === "checkout_override") return "entered here";
  if (source === "profile") return "profile";
  return null;
};

const normalizeValue = (value: unknown) =>
  String(value || "").trim().toLowerCase();

const getWalletTransactionType = (item: any): WalletFilterType => {
  const source = normalizeValue(item.source);
  const kind = normalizeValue(item.kind || item.type);
  const reference = normalizeValue(item.reference);
  const title = normalizeValue(item.title);

  if (kind === "booking_payment") return "booking_payment";
  if (kind === "hold") return "hold";
  if (kind === "refund" || reference.includes("refund") || title.includes("refund")) return "refund";
  if (kind === "hold_release" || kind === "hold_capture") return "release_capture";
  if (kind === "withdrawal") return "withdrawal";
  if (source === "payment" || kind.includes("topup") || kind.includes("top_up") || title.includes("top up")) {
    return "topup";
  }
  return "other";
};

const getWalletTransactionStatus = (item: any): WalletFilterStatus => {
  const status = normalizeValue(item.status);
  const kind = normalizeValue(item.kind || item.type);

  if (status.includes("refund") || kind === "refund") return "refunded";
  if (status === "paid" || status === "completed" || status === "success" || status === "succeeded" || status === "captured") {
    return "successful";
  }
  if (status === "pending" || status === "created" || status === "redirected" || status === "token_received" || status === "approved_pending_payment") {
    return "pending";
  }
  if (status === "failed" || status === "rejected" || status === "error") return "failed";
  if (status === "expired") return "expired";
  if (status === "cancelled" || status === "canceled") return "cancelled";
  return "all";
};

const isInDateRange = (item: any, filter: WalletDateRange) => {
  if (filter === "all") return true;
  const createdAt = getMillis(item.createdAt);
  if (!createdAt) return false;
  const now = new Date();
  const created = new Date(createdAt);

  if (filter === "today") {
    return (
      created.getFullYear() === now.getFullYear() &&
      created.getMonth() === now.getMonth() &&
      created.getDate() === now.getDate()
    );
  }

  const windowMs = filter === "last_7_days" ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
  return createdAt >= now.getTime() - windowMs && createdAt <= now.getTime();
};

const isInAmountRange = (item: any, filter: WalletAmountRange) => {
  if (filter === "all") return true;
  const amount = Math.abs(Number(item.amount || 0));
  if (filter === "under_500") return amount < 500;
  if (filter === "500_2000") return amount >= 500 && amount <= 2000;
  if (filter === "2000_5000") return amount > 2000 && amount <= 5000;
  return amount > 5000;
};

const getWalletTopupErrorMessage = (error: unknown) => {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();
  const fallback = "Could not start the Easypaisa top-up. Please try again.";
  const cleaned = cleanConvexErrorMessage(error, fallback);

  if (
    lower.includes("taking too long to respond") ||
    lower.includes("aborted due to timeout") ||
    lower.includes("timeout")
  ) {
    return "Easypaisa is taking too long to respond. Please try again in a moment.";
  }

  if (
    lower.includes("system error") ||
    cleaned.toLowerCase() === "system error"
  ) {
    return "Easypaisa did not complete the top-up. Please try again.";
  }

  if (lower.includes("unauthenticated") || lower.includes("please sign in")) {
    return "Please sign in to continue.";
  }

  return getUserFacingErrorMessage(error, fallback);
};

const WalletTransactionRow = React.memo(function WalletTransactionRow({
  item,
}: {
  item: any;
}) {
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
    <AppCard style={styles.transactionCard}>
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
        Reference: {formatReferenceLabel(item.reference)}
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
      {item.kind === "hold" ? (
        <Text style={styles.transactionMeta}>
          Funds are reserved for your seat and captured when the match starts or is confirmed.
        </Text>
      ) : item.kind === "hold_release" ? (
        <Text style={styles.transactionMeta}>
          The match was cancelled before capture, so funds returned to your MatchHai Wallet.
        </Text>
      ) : item.kind === "hold_capture" ? (
        <Text style={styles.transactionMeta}>
          Funds were captured for the match. Approved refunds return to your MatchHai Wallet.
        </Text>
      ) : item.kind === "refund" ? (
        <Text style={styles.transactionMeta}>
          Refund added back to your MatchHai Wallet.
        </Text>
      ) : null}
      <StatusPill
        tone={tone}
        label={
          item.source === "payment"
            ? getCheckoutStatusLabel(item.status)
            : item.kind === "booking_payment" ||
                item.kind === "withdrawal" ||
                item.kind === "hold" ||
                item.kind === "hold_release" ||
                item.kind === "hold_capture"
              ? getPaymentStatusLabel(item.status)
              : getCheckoutStatusLabel(item.status)
        }
      />
    </AppCard>
  );
});

function WalletFilterRow<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: { key: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterSectionLabel}>{label}</Text>
      <View style={styles.filterChipWrap}>
        {options.map((option) => (
          <Pressable
            key={option.key}
            onPress={() => onSelect(option.key)}
            style={[
              styles.filterChip,
              selected === option.key && styles.filterChipActive,
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                selected === option.key && styles.filterChipTextActive,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function WalletScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [transactionFilters, setTransactionFilters] = useState<WalletFilters>(DEFAULT_WALLET_FILTERS);
  const [checkoutPhone, setCheckoutPhone] = useState("");
  const [serviceLoading, setServiceLoading] = useState(true);
  const [activeOrderRef, setActiveOrderRef] = useState<string | null>(null);
  useRouteLogger("WalletScreen", { activeTab, userId: user?._id });
  const { showToast } = useToast();

  const userId = user?._id as Id<"users"> | undefined;
  const startCheckout = useAction((api as any).easypaisa.startCheckout);
  const repairRejectedRefunds = useMutation(api.teamChallenges.repairRejectedRefundsForCaptain);

  const walletSummary = useQuery(
    api.wallet.getSummary,
    userId ? { userId } : "skip",
  );
  const walletBalance = walletSummary?.balance ?? 0;
  const walletHeldBalance = walletSummary?.heldBalance ?? 0;
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
      if (userId) {
        repairRejectedRefunds({ actorUid: userId })
          .then((result: any) => {
            const creditedAmount = Number(result?.creditedAmount || 0);
            if (creditedAmount > 0) {
              showToast({
                type: "success",
                title: "Refund restored",
                message: `PKR ${creditedAmount} was returned to your wallet.`,
              });
            }
          })
          .catch((error) => {
            Logger.warn("Wallet", "Failed to repair rejected challenge refunds", error);
          });
      }
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
      repairRejectedRefunds,
      showToast,
      userId,
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
    const unpaidIntentMap = new Map<string, any>();
    for (const item of intents) {
      if (item.paymentStatus === "paid") continue;
      const slotIds = Array.isArray(item.selectedSlotIds) && item.selectedSlotIds.length > 0
        ? [...item.selectedSlotIds].map(String).sort().join(",")
        : Array.isArray(item.selectedSlots)
          ? [...item.selectedSlots].map(String).sort().join(",")
          : "unknown";
      const key = `${String(item.matchroomId || "unknown")}:${slotIds}`;
      const existing = unpaidIntentMap.get(key);
      if (!existing || getMillis(item.createdAt) > getMillis(existing.createdAt)) {
        unpaidIntentMap.set(key, item);
      }
    }
    const unpaidIntents = [...unpaidIntentMap.values()];
    const pendingAmount = unpaidIntents
      .reduce((acc, item) => acc + (item.pricing?.totalCost || 0), 0);
    return {
      totalSpent,
      pendingAmount,
      pendingCount: unpaidIntents.length,
    };
  }, [intents]);

  const loading =
    authLoading ||
    serviceLoading ||
    (Boolean(userId) && walletSummary === undefined) ||
    (Boolean(userId) && bookingIntents === undefined);
  const quickAmounts = [500, 1000, 2000, 5000];
  const activeTransactionFilterCount =
    Number(transactionFilters.type !== DEFAULT_WALLET_FILTERS.type) +
    Number(transactionFilters.status !== DEFAULT_WALLET_FILTERS.status) +
    Number(transactionFilters.dateRange !== DEFAULT_WALLET_FILTERS.dateRange) +
    Number(transactionFilters.amountRange !== DEFAULT_WALLET_FILTERS.amountRange);
  const walletTransactions = walletHistory || [];
  const filteredWalletHistory = useMemo(
    () =>
      walletTransactions.filter((item: any) => {
        if (transactionFilters.type !== "all" && getWalletTransactionType(item) !== transactionFilters.type) return false;
        if (transactionFilters.status !== "all" && getWalletTransactionStatus(item) !== transactionFilters.status) return false;
        if (!isInDateRange(item, transactionFilters.dateRange)) return false;
        if (!isInAmountRange(item, transactionFilters.amountRange)) return false;
        return true;
      }),
    [transactionFilters, walletTransactions],
  );
  const hasActiveCheckout = ACTIVE_CHECKOUT_STATUSES.has(
    String(checkoutStatus?.status || ""),
  );
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
      const attemptMessage = String(checkout.attemptMessage || "Starting a new payment attempt.");
      showToast({
        type: "info",
        title: "Payment started",
        message: `${attemptMessage} ${instruction}`,
      });
    } catch (error) {
      // Avoid triggering LogBox red-screen for expected gateway failures (e.g. user cancels in Easypaisa).
      Logger.warn("Wallet", "Failed to add funds", error);
      const message = getWalletTopupErrorMessage(error);
      showToast({ type: "error", title: "Failed to add funds", message });
    } finally {
      setAddingFunds(false);
    }
  };

  return (
    <Screen style={styles.screen} scroll={false} keyboardAvoiding routeKey="/(player)/wallet">
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
      ) : activeTab === "transactions" ? (
        <FlatList
          data={walletTransactions.length > 0 ? filteredWalletHistory : []}
          keyExtractor={(item: any) => String(item.id)}
          renderItem={({ item }) => <WalletTransactionRow item={item} />}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            walletTransactions.length > 0 ? (
              <View style={styles.transactionFilterBar}>
                <Text style={styles.transactionFilterSummary}>
                  {filteredWalletHistory.length} of {walletTransactions.length} transaction
                  {walletTransactions.length === 1 ? "" : "s"}
                </Text>
                <Pressable
                  onPress={() => setFilterDrawerOpen(true)}
                  style={({ pressed }) => [
                    styles.transactionFilterButton,
                    pressed && styles.transactionFilterButtonPressed,
                  ]}
                >
                  <AppIcon name="filters" size={20} color={COLORS.text} />
                  {activeTransactionFilterCount > 0 ? (
                    <View style={styles.filterBadge}>
                      <Text style={styles.filterBadgeText}>
                        {activeTransactionFilterCount}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              </View>
            ) : null
          }
          ListEmptyComponent={
            walletTransactions.length > 0 ? (
              <AppCard variant="empty" style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No transactions match these filters.</Text>
                <Text style={styles.emptyText}>
                  Reset filters to view your full transaction history.
                </Text>
              </AppCard>
            ) : (
              <AppCard variant="empty" style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No transactions yet</Text>
                <Text style={styles.emptyText}>
                  Your payment and booking transaction history will appear
                  here.
                </Text>
              </AppCard>
            )
          }
          removeClippedSubviews
          initialNumToRender={10}
          windowSize={11}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {activeTab === "overview" ? (
            <>
              <AppCard style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>Wallet Balance</Text>
                <Text style={styles.balanceValue}>
                  {formatCurrency(walletBalance)}
                </Text>
                <Text style={styles.balanceHelperText}>
                  {WALLET_BALANCE_HELPER_TEXT}
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
                    {!userId ? "Profile unavailable" : "Top up"}
                  </AppButton>
                </View>
              </AppCard>

              {checkoutStatus && hasActiveCheckout ? (
                <AppCard>
                  <Text style={styles.summaryTitle}>
                    Pending Easypaisa Payment
                  </Text>
                  <Text style={styles.summarySubText}>
                    Status: {getCheckoutStatusLabel(checkoutStatus.status)}
                  </Text>
                  <Text style={styles.summarySubText}>
                    Order: {checkoutStatus.orderRefNum}
                  </Text>
                  <Text style={styles.summarySubText}>
                    Amount: {formatCurrency(Number(checkoutStatus.amount || 0))}
                  </Text>
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
                      Last sync note: {PAYMENT_VERIFICATION_SAFE_MESSAGE}
                    </Text>
                  ) : null}
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
                </AppCard>
              ) : null}

              <AppCard>
                <Text style={styles.summaryTitle}>Total Spent</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(totals.totalSpent)}
                </Text>
                <Text style={styles.summarySubText}>
                  Captured booking payments. Reserved funds appear in transactions.
                </Text>
              </AppCard>

              <View style={styles.statsGrid}>
                <AppCard style={styles.statCard}>
                  <Text style={styles.statLabel}>Unpaid Bookings</Text>
                  <Text style={styles.statValue}>
                    {formatCurrency(totals.pendingAmount)}
                  </Text>
                  <Text style={styles.statHelperText}>
                    {UNPAID_BOOKINGS_HELPER_TEXT}
                  </Text>
                </AppCard>
                <AppCard style={styles.statCard}>
                  <Text style={styles.statLabel}>Reserved</Text>
                  <Text style={styles.statValue}>
                    {formatCurrency(walletHeldBalance)}
                  </Text>
                  <Text style={styles.statHelperText}>
                    {RESERVED_WALLET_HELPER_TEXT}
                  </Text>
                </AppCard>
                <AppCard style={styles.statCard}>
                  <Text style={styles.statLabel}>My Requests</Text>
                  <Text style={styles.statValue}>{requestsCount}</Text>
                </AppCard>
                <AppCard style={styles.statCard}>
                  <Text style={styles.statLabel}>Offers Received</Text>
                  <Text style={styles.statValue}>{offersCount}</Text>
                </AppCard>
              </View>
            </>
          ) : null}
        </ScrollView>
      )}

      <AppDrawer
        visible={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        drawerStyle={[styles.filterDrawer, { width: DRAWER_WIDTH }]}
      >
        <View style={[styles.filterDrawerContent, { paddingTop: Math.max(insets.top, 16) }]}>
          <AppModalHeader
            title="Filters"
            subtitle={`${activeTransactionFilterCount} active transaction filters`}
            onClose={() => setFilterDrawerOpen(false)}
            compact
          />
          <AppModalBody scroll contentContainerStyle={styles.filterDrawerBody}>
            <WalletFilterRow
              label="Type"
              options={TYPE_FILTERS}
              selected={transactionFilters.type}
              onSelect={(type) => setTransactionFilters((current) => ({ ...current, type }))}
            />
            <WalletFilterRow
              label="Status"
              options={STATUS_FILTERS}
              selected={transactionFilters.status}
              onSelect={(status) => setTransactionFilters((current) => ({ ...current, status }))}
            />
            <WalletFilterRow
              label="Date Range"
              options={DATE_FILTERS}
              selected={transactionFilters.dateRange}
              onSelect={(dateRange) => setTransactionFilters((current) => ({ ...current, dateRange }))}
            />
            <WalletFilterRow
              label="Amount Range"
              options={AMOUNT_FILTERS}
              selected={transactionFilters.amountRange}
              onSelect={(amountRange) => setTransactionFilters((current) => ({ ...current, amountRange }))}
            />
          </AppModalBody>
          <AppModalFooter style={styles.filterDrawerFooter}>
            <View style={styles.filterDrawerFooterRow}>
              <AppButton
                variant="ghost"
                disabled={activeTransactionFilterCount === 0}
                style={styles.filterDrawerFooterButton}
                onPress={() => setTransactionFilters(DEFAULT_WALLET_FILTERS)}
              >
                Reset
              </AppButton>
              <AppButton
                style={styles.filterDrawerFooterButton}
                onPress={() => setFilterDrawerOpen(false)}
              >
                Done
              </AppButton>
            </View>
          </AppModalFooter>
        </View>
      </AppDrawer>

      <AppDialog
        visible={phoneModalVisible}
        onClose={() => !addingFunds && setPhoneModalVisible(false)}
        dismissDisabled={addingFunds}
        cardStyle={styles.phoneDialogCard}
        keyboardAware={true}
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

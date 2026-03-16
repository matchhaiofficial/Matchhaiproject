import { useFocusEffect, useRouter } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import React, { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import AppHeader from "../../src/components/AppHeader";
import Screen from "../../src/components/Screen";
import SegmentedTabs from "../../src/components/SegmentedTabs";
import { useAuth } from "../../src/context/AuthContext";
import { getOffersForUser, getUserRequests } from "../../src/services/convex/bookingRequestService";
import { BookingIntent } from "../../src/services/convex/bookingService";
import { COLORS } from "../../src/theme";
import Logger from "../../src/utils/logger";
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

const getStatusStyles = (status?: string) => {
    if (status === "confirmed") {
        return { borderColor: COLORS.successBright + "55", color: COLORS.successBright };
    }
    if (status === "approved_pending_payment" || status === "pending_approvals") {
        return { borderColor: COLORS.warning + "55", color: COLORS.warning };
    }
    if (status === "rejected" || status === "cancelled" || status === "expired") {
        return { borderColor: COLORS.error + "55", color: COLORS.error };
    }
    return { borderColor: COLORS.cardBorder, color: COLORS.textSecondary };
};

export default function WalletScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<WalletTab>("overview");
    const [requestsCount, setRequestsCount] = useState(0);
    const [offersCount, setOffersCount] = useState(0);
    const [addAmount, setAddAmount] = useState("");
    const [addingFunds, setAddingFunds] = useState(false);
    const [serviceLoading, setServiceLoading] = useState(true);

    const userId = user?._id as Id<"users"> | undefined;

    // Convex reactive queries
    const walletBalance = useQuery(
        api.wallet.getBalance,
        userId ? { userId } : "skip"
    ) ?? 0;

    const bookingIntents = useQuery(
        api.bookings.listIntentsByUser,
        userId ? { userId } : "skip"
    );

    const addFundsMutation = useMutation(api.wallet.addFunds);

    // Fetch requests/offers counts via service layer
    const fetchServiceData = useCallback(async () => {
        if (!user?._id) {
            setRequestsCount(0);
            setOffersCount(0);
            setServiceLoading(false);
            return;
        }
        setServiceLoading(true);
        try {
            const [requestsResult, offersResult] = await Promise.all([
                getUserRequests(user._id),
                getOffersForUser(user._id),
            ]);

            setRequestsCount(requestsResult.ok && requestsResult.data ? requestsResult.data.length : 0);
            setOffersCount(offersResult.ok && offersResult.data ? offersResult.data.length : 0);
        } catch (error) {
            Logger.error("Wallet", "Failed to fetch service data", error);
            setRequestsCount(0);
            setOffersCount(0);
        } finally {
            setServiceLoading(false);
        }
    }, [user?._id]);

    useFocusEffect(useCallback(() => {
        fetchServiceData();
    }, [fetchServiceData]));

    const intents = useMemo(() => {
        if (!bookingIntents) return [];
        return [...bookingIntents].sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
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
            pendingCount: intents.filter((item) => item.paymentStatus !== "paid").length,
        };
    }, [intents]);

    const loading = bookingIntents === undefined || serviceLoading;

    const quickAmounts = [500, 1000, 2000, 5000];

    const handleAddFunds = async () => {
        if (!userId || addingFunds) return;
        const amount = Number(addAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            Alert.alert("Invalid amount", "Enter a valid amount to add funds.");
            return;
        }

        setAddingFunds(true);
        try {
            await addFundsMutation({
                userId,
                amount,
            });

            setAddAmount("");
            Alert.alert("Funds added", `Rs ${Math.round(amount)} added to your wallet.`);
        } catch (error) {
            Logger.error("Wallet", "Failed to add funds", error);
            Alert.alert("Failed", "Could not add funds. Please try again.");
        } finally {
            setAddingFunds(false);
        }
    };

    return (
        <Screen style={styles.screen} scroll={false}>
            <AppHeader title="Wallet" onBack={() => router.back()} inlineTitle />

            <SegmentedTabs
                items={[
                    { key: "overview", label: "Overview" },
                    { key: "transactions", label: `Transactions (${intents.length})` },
                ]}
                value={activeTab}
                onChange={(value) => setActiveTab(value as WalletTab)}
                style={styles.tabs}
            />

            {loading ? (
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                    <ActivityIndicator color={COLORS.accent} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {activeTab === "overview" ? (
                        <>
                            <View style={styles.balanceCard}>
                                <Text style={styles.balanceLabel}>Wallet Balance</Text>
                                <Text style={styles.balanceValue}>Rs {Math.round(walletBalance)}</Text>
                            </View>

                            <View style={styles.addFundsCard}>
                                <Text style={styles.addFundsTitle}>Add Funds</Text>
                                <Text style={styles.addFundsSubtext}>
                                    Choose a quick amount or enter a custom amount.
                                </Text>
                                <View style={styles.quickAmountRow}>
                                    {quickAmounts.map((amount) => (
                                        <Pressable
                                            key={amount}
                                            onPress={() => setAddAmount(String(amount))}
                                            style={({ pressed }) => [
                                                styles.quickAmountBtn,
                                                Number(addAmount) === amount && styles.quickAmountBtnActive,
                                                pressed && styles.quickAmountBtnPressed,
                                            ]}
                                        >
                                            <Text style={styles.quickAmountText}>Rs {amount}</Text>
                                        </Pressable>
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
                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.addFundsBtn,
                                            addingFunds && styles.addFundsBtnDisabled,
                                            pressed && !addingFunds && styles.addFundsBtnPressed,
                                        ]}
                                        onPress={handleAddFunds}
                                        disabled={addingFunds}
                                    >
                                        <Text style={styles.addFundsBtnText}>
                                            {addingFunds ? "Adding..." : "Add Funds"}
                                        </Text>
                                    </Pressable>
                                </View>
                            </View>

                            <View style={styles.summaryCard}>
                                <Text style={styles.summaryTitle}>Total Spent</Text>
                                <Text style={styles.summaryValue}>Rs {Math.round(totals.totalSpent)}</Text>
                                <Text style={styles.summarySubText}>Across all confirmed bookings</Text>
                            </View>

                            <View style={styles.statsRow}>
                                <View style={styles.statCard}>
                                    <Text style={styles.statLabel}>Pending Amount</Text>
                                    <Text style={styles.statValue}>Rs {Math.round(totals.pendingAmount)}</Text>
                                </View>
                                <View style={[styles.statCard, styles.statCardLast]}>
                                    <Text style={styles.statLabel}>Paid Bookings</Text>
                                    <Text style={styles.statValue}>{totals.paidCount}</Text>
                                </View>
                            </View>

                            <View style={styles.statsRow}>
                                <View style={styles.statCard}>
                                    <Text style={styles.statLabel}>My Requests</Text>
                                    <Text style={styles.statValue}>{requestsCount}</Text>
                                </View>
                                <View style={[styles.statCard, styles.statCardLast]}>
                                    <Text style={styles.statLabel}>Offers Received</Text>
                                    <Text style={styles.statValue}>{offersCount}</Text>
                                </View>
                            </View>
                        </>
                    ) : (
                        <>
                            {intents.length > 0 ? intents.map((item) => {
                                const statusStyle = getStatusStyles(item.status);
                                return (
                                    <View key={item._id} style={styles.transactionCard}>
                                        <View style={styles.transactionTopRow}>
                                            <Text style={styles.transactionTitle} numberOfLines={1}>
                                                {(item as any).game?.toUpperCase()} • {item.side} Side
                                            </Text>
                                            <Text style={styles.transactionAmount}>
                                                Rs {Math.round(item.pricing?.totalCost || 0)}
                                            </Text>
                                        </View>
                                        <Text style={styles.transactionMeta}>
                                            Matchroom: {item.matchroomId}
                                        </Text>
                                        <Text style={styles.transactionMeta}>
                                            Players: {(item as any).invitees?.length || 0}
                                        </Text>
                                        <Text style={styles.transactionMeta}>
                                            Created: {getMillis(item.createdAt) ? new Date(getMillis(item.createdAt)).toLocaleString() : "Unknown"}
                                        </Text>
                                        <View style={[styles.statusPill, { borderColor: statusStyle.borderColor }]}>
                                            <Text style={[styles.statusText, { color: statusStyle.color }]}>
                                                {item.status || "unknown"}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            }) : (
                                <View style={styles.emptyCard}>
                                    <Text style={styles.emptyTitle}>No transactions yet</Text>
                                    <Text style={styles.emptyText}>
                                        Your payment and booking transaction history will appear here.
                                    </Text>
                                </View>
                            )}
                        </>
                    )}
                </ScrollView>
            )}
        </Screen>
    );
}

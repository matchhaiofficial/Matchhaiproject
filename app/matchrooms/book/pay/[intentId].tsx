import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { useAction } from "convex/react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    Text,
    Pressable,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import AppHeader from "../../../../src/components/AppHeader";
import { AppIcon } from "../../../../src/components/AppIcon";
import { AppButton, AppCard, StatusPill } from "../../../../src/components/AppPrimitives";
import { DetailKeyValueRow, DetailSectionCard } from "../../../../src/components/DetailSurface";
import { useAuth } from "../../../../src/context/AuthContext";
import { useToast } from "../../../../src/hooks/useToast";
import { convex } from "../../../../src/lib/convex";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
    BookingIntent,
    confirmBookingTransaction,
    getBookingIntent
} from "../../../../src/services/convex/bookingService";
import { COLORS } from "../../../../src/theme";
import Logger from "../../../../src/utils/logger";
import { FEATURE_READINESS } from "../../../../src/config/featureReadiness";
import styles from "./pay.styles";

export default function MockPaymentScreen() {
    const { intentId } = useLocalSearchParams() as { intentId: string };
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const { showToast } = useToast();
    const startCheckout = useAction((api as any).easypaisa.startCheckout);

    const [intent, setIntent] = useState<BookingIntent | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [walletBalance, setWalletBalance] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState<"wallet" | "easypaisa">("wallet");
    const touchDebugEnabled = __DEV__ && process.env.EXPO_PUBLIC_TOUCH_DEBUG === '1';
    const ctaBottomGuard = Math.max(insets.bottom + 12, 96);

    const logScreenTouch = (tag: string, e: any) => {
        if (!touchDebugEnabled) return;
        const { pageX, pageY } = e.nativeEvent;
        Logger.debug("TouchDebug", "touch", { tag, pageX, pageY });
    };

    useEffect(() => {
        const fetchIntent = async () => {
            if (!intentId) return;
            try {
                const res = await getBookingIntent(intentId);
                if (res.ok && res.data) {
                    setIntent(res.data);
                } else {
                    showToast({ type: "error", title: "Error", message: "Booking request not found." });
                    router.back();
                }
            } catch (e) {
                Logger.error("MockPayment", "Fetch error", e);
            } finally {
                setLoading(false);
            }
        };
        fetchIntent();
    }, [intentId, router, showToast]);

    useEffect(() => {
        const loadWallet = async () => {
            if (!user?._id) return;
            try {
                const balance = await convex.query(api.wallet.getBalance, {
                    userId: user._id as Id<"users">,
                });
                setWalletBalance(Number(balance || 0));
            } catch {
                setWalletBalance(0);
            }
        };
        loadWallet();
    }, [user?._id]);

    const handleMockPayment = async () => {
        if (!intentId || !user) return;
        setProcessing(true);

        try {
            if (paymentMethod === "easypaisa") {
                const checkout: any = await startCheckout({
                    kind: "booking_intent",
                    bookingIntentId: intentId as Id<"bookingIntents">,
                    userId: user._id as Id<"users">,
                });
                const message = checkout.transactionType === "OTC"
                    ? `Use the Easypaisa OTC token ${checkout.paymentToken || ""}`.trim()
                    : "Approve the payment in Easypaisa. MatchHai will keep checking the status.";
                showToast({ type: "info", title: "Payment started", message });
                router.replace({
                    pathname: "/matchrooms/book/status/[intentId]",
                    params: {
                        intentId,
                        gateway: "easypaisa",
                        paymentStatus: "pending",
                        orderRefNum: String(checkout.orderRefNum),
                    },
                } as any);
                return;
            }

            const res = await confirmBookingTransaction(intentId, user._id, paymentMethod);
            if (res.ok) {
                // Navigate to status screen
                router.replace({
                    pathname: "/matchrooms/book/status/[intentId]",
                    params: { intentId: intentId }
                } as any);
            } else {
                showToast({ type: "error", title: "Payment Failed", message: res.message });
                setProcessing(false);
            }
        } catch (e) {
            Logger.error("MockPayment", "Transaction error", e);
            showToast({ type: "error", title: "Error", message: "An unexpected error occurred." });
            setProcessing(false);
        }
    };

    if (loading && !intent) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator color={COLORS.accent} size="large" />
            </View>
        );
    }

    if (!intent) return null;
    const hasEnoughWallet = walletBalance >= Number(intent.pricing?.totalCost || 0);

    return (
        <SafeAreaView
            style={styles.container}
            onTouchEndCapture={(e) => logScreenTouch("booking_pay_screen", e)}
        >
            <AppHeader
                title="Review & Pay"
                onBack={() => router.back()}
                inlineTitle
            />

            <View style={styles.body}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
            >
                <AppCard variant="elevated" style={styles.amountCard}>
                    <Text style={styles.amountLabel}>TOTAL AMOUNT</Text>
                    <Text style={styles.amountValue}>
                        {(intent.pricing as any)?.currency || "PKR"} {intent.pricing?.totalCost}
                    </Text>
                    <Text style={styles.seatCount}>
                        For {intent.selectedSlots.length} Reserved Seats
                    </Text>
                </AppCard>

                {/* Secure Payment Info */}
                <AppCard style={styles.infoBox}>
                    <AppIcon name="security" size={20} color={COLORS.success} />
                    <Text style={styles.infoText}>{FEATURE_READINESS.payments.card.walletOnlyInfo}</Text>
                </AppCard>

                {/* Summary */}
                <DetailSectionCard title="Booking Summary">
                    <DetailKeyValueRow label="Lobby" value={intent.game} />
                    <DetailKeyValueRow
                        label="Price per seat"
                        value={`${(intent.pricing as any)?.currency || "PKR"}${intent.pricing?.perPlayerCost}`}
                        last
                    />
                </DetailSectionCard>

                {/* Payment Methods (Mock) */}
                <DetailSectionCard
                    title="Payment Method"
                    subtitle="Only live payment paths are shown here."
                >
                    <Pressable
                        style={[
                            styles.methodOption,
                            paymentMethod === "wallet" && styles.methodOptionActive,
                        ]}
                        onPress={() => setPaymentMethod("wallet")}
                    >
                        <View style={styles.methodIcon}>
                            <AppIcon name="account-balance-wallet" size={24} color={COLORS.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.methodName}>MatchHai Wallet</Text>
                            <Text style={styles.methodDetail}>Balance: {(intent.pricing as any)?.currency || "PKR"} {Math.round(walletBalance)}</Text>
                        </View>
                        <StatusPill
                            tone={paymentMethod === "wallet" ? "info" : "neutral"}
                            label={paymentMethod === "wallet" ? "Selected" : "Available"}
                        />
                    </Pressable>
                    <Pressable
                        style={[
                            styles.methodOption,
                            paymentMethod === "easypaisa" && styles.methodOptionActive,
                        ]}
                        onPress={() => setPaymentMethod("easypaisa")}
                    >
                        <View style={styles.methodIcon}>
                            <AppIcon name="payments" size={24} color={COLORS.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.methodName}>{FEATURE_READINESS.payments.easypaisa.label}</Text>
                            <Text style={styles.methodDetail}>{FEATURE_READINESS.payments.easypaisa.description}</Text>
                        </View>
                        <StatusPill
                            tone={paymentMethod === "easypaisa" ? "info" : "neutral"}
                            label={paymentMethod === "easypaisa" ? "Selected" : "Available"}
                        />
                    </Pressable>
                    {!hasEnoughWallet && paymentMethod === "wallet" ? (
                        <Text style={[styles.methodDetail, { marginTop: 10, color: COLORS.warning }]}>
                            Insufficient wallet balance. Please add funds from Wallet.
                        </Text>
                    ) : null}
                </DetailSectionCard>
                <View style={{ width: '100%', marginTop: 8, marginBottom: ctaBottomGuard }}>
                    <View style={styles.footer}>
                <AppButton
                    size="lg"
                    onPressIn={() => {
                        if (touchDebugEnabled) {
                            Logger.debug("TouchDebug", "pressIn", { tag: "booking_pay_now" });
                        }
                    }}
                    onPress={handleMockPayment}
                    disabled={processing || !intent || (paymentMethod === "wallet" && !hasEnoughWallet)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={(processing || !intent || (paymentMethod === "wallet" && !hasEnoughWallet)) ? styles.payBtnDisabled : undefined}
                >
                    {processing ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <>
                            <Text style={styles.payBtnText}>
                                {paymentMethod === "wallet" ? "Pay with Wallet" : "Continue to Easypaisa"}
                            </Text>
                            <AppIcon
                                name={paymentMethod === "wallet" ? "lock" : "open-in-new"}
                                size={18}
                                color="#FFF"
                            />
                        </>
                    )}
                </AppButton>
                <Text style={styles.cancelHint}>
                    {paymentMethod === "wallet"
                        ? "Wallet payments confirm your seat instantly."
                        : "Easypaisa will return you to MatchHai after payment confirmation."}
                </Text>
                    </View>
                </View>
            </ScrollView>
            </View>
        </SafeAreaView>
    );
}

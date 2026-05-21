import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { useAction } from "convex/react";
import {
    ActivityIndicator,
    ScrollView,
    Text,
    TextInput,
    Pressable,
    View,
} from "react-native";

import AppHeader from "../../../../src/components/AppHeader";
import { AppIcon } from "../../../../src/components/AppIcon";
import {
    AppDialog,
    AppModalBody,
    AppModalFooter,
    AppModalHeader,
} from "../../../../src/components/AppModalPrimitives";
import { AppButton, AppCard, StatusPill } from "../../../../src/components/AppPrimitives";
import { DetailKeyValueRow, DetailSectionCard } from "../../../../src/components/DetailSurface";
import Screen from "../../../../src/components/Screen";
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
import {
    formatPakistaniPhone,
    isValidPakistaniPhone,
    normalizePakistaniPhone,
} from "../../../../src/utils/phoneUtils";
import { SLOT_ALREADY_FILLED_PAYMENT_MESSAGE } from "../../../../src/utils/paymentUiCopy";
import { FEATURE_READINESS } from "../../../../src/config/featureReadiness";
import styles from "./pay.styles";

const shouldFallbackToOtc = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error || "");
    return /ACCOUNT DOES N[O']?T? EXIST|ACCOUNT DOES NO EXIST|PAYMENT METHOD NOT ENABLED/i.test(message);
};

const getEasypaisaStartErrorMessage = (error: unknown) => {
    const raw = error instanceof Error ? error.message : String(error || "");
    const cleaned = raw
        .replace(/\[CONVEX[^\]]*\]\s*/gi, "")
        .replace(/\[Request ID:[^\]]*\]\s*/gi, "")
        .replace(/\bServer Error\b/gi, "")
        .replace(/\bUncaught (ConvexError|Error):\s*/gi, "")
        .split("Called by client")[0]
        .trim();

    if (/PAYMENT METHOD NOT ENABLED/i.test(raw)) {
        return "Easypaisa could not start this payment right now. Try again or use MatchHai Wallet.";
    }
    if (/slot is no longer available|selected slot is no longer available/i.test(raw)) {
        return SLOT_ALREADY_FILLED_PAYMENT_MESSAGE;
    }

    return cleaned || "Could not start the Easypaisa payment. Please try again.";
};

export default function MockPaymentScreen() {
    const { intentId } = useLocalSearchParams() as { intentId: string };
    const router = useRouter();
    const { user } = useAuth();
    const { showToast } = useToast();
    const startCheckout = useAction((api as any).easypaisa.startCheckout);

    const [intent, setIntent] = useState<BookingIntent | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [walletBalance, setWalletBalance] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState<"wallet" | "easypaisa">("wallet");
    const [easypaisaPhoneVisible, setEasypaisaPhoneVisible] = useState(false);
    const [easypaisaCheckoutPhone, setEasypaisaCheckoutPhone] = useState("");
    const [nowMs, setNowMs] = useState(Date.now());

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

    useEffect(() => {
        if (!intent?.expiresAt) return;
        const timer = setInterval(() => setNowMs(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [intent?.expiresAt]);

    useEffect(() => {
        if (!easypaisaPhoneVisible) {
            setEasypaisaCheckoutPhone(
                user?.phone ? formatPakistaniPhone(String(user.phone)) : "",
            );
        }
    }, [easypaisaPhoneVisible, user?.phone]);

    const startEasypaisaBookingCheckout = async () => {
        if (!intentId || !user?._id || processing) return;
        if (intent?.expiresAt && intent.expiresAt <= Date.now()) {
            showToast({
                type: "warning",
                title: "Slot hold expired",
                message: "Please request the slot again to continue.",
            });
            return;
        }
        if (!isValidPakistaniPhone(easypaisaCheckoutPhone)) {
            showToast({
                type: "warning",
                title: "Invalid number",
                message: "Enter a valid Pakistani mobile number for Easypaisa.",
            });
            return;
        }

        const normalizedPhone = normalizePakistaniPhone(easypaisaCheckoutPhone);
        const checkoutArgs = {
            kind: "booking_intent" as const,
            bookingIntentId: intentId as Id<"bookingIntents">,
            userId: user._id as Id<"users">,
            phone: normalizedPhone.phoneE164 || easypaisaCheckoutPhone,
            forceNew: true,
        };

        setProcessing(true);
        try {
            let checkout: any;
            try {
                checkout = await startCheckout({
                    ...checkoutArgs,
                    transactionType: "MA",
                });
            } catch (error) {
                if (!shouldFallbackToOtc(error)) {
                    throw error;
                }

                Logger.warn("ReviewPay", "Easypaisa mobile account checkout unavailable, falling back to OTC", {
                    intentId,
                });
                checkout = await startCheckout({
                    ...checkoutArgs,
                    transactionType: "OTC",
                });
            }

            const message = checkout.transactionType === "OTC"
                ? `Use the Easypaisa OTC token ${checkout.paymentToken || ""}`.trim()
                : "Approve the payment in Easypaisa. MatchHai will keep checking the status.";
            const attemptMessage = String(checkout.attemptMessage || "Starting a new payment attempt.");
            showToast({ type: "info", title: "Payment started", message: `${attemptMessage} ${message}` });
            setEasypaisaPhoneVisible(false);
            router.replace({
                pathname: "/matchrooms/book/status/[intentId]",
                params: {
                    intentId,
                    gateway: "easypaisa",
                    paymentStatus: "pending",
                    orderRefNum: String(checkout.orderRefNum),
                },
            } as any);
        } catch (error) {
            const message = getEasypaisaStartErrorMessage(error);
            Logger.warn("ReviewPay", "Easypaisa checkout unavailable", { message });
            showToast({ type: "error", title: "Payment unavailable", message });
        } finally {
            setProcessing(false);
        }
    };

    const handleMockPayment = async () => {
        if (!intentId || !user) return;
        if (intent?.expiresAt && intent.expiresAt <= Date.now()) {
            showToast({
                type: "warning",
                title: "Slot hold expired",
                message: "Please request the slot again to continue.",
            });
            return;
        }
        if (paymentMethod === "easypaisa") {
            setEasypaisaPhoneVisible(true);
            return;
        }

        setProcessing(true);

        try {
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
            const message = e instanceof Error ? e.message : String(e || "Payment could not be started.");
            Logger.warn("MockPayment", "Transaction unavailable", { message });
            showToast({ type: "error", title: "Payment unavailable", message });
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
    const isPaymentWindowExpired = Boolean(intent.expiresAt && intent.expiresAt <= nowMs);
    const payDisabled = processing || !intent || isPaymentWindowExpired || (paymentMethod === "wallet" && !hasEnoughWallet);

    return (
        <Screen
            style={styles.container}
            variant="stack"
            scroll={false}
            edges={["top", "bottom"]}
            contentStyle={styles.screenContent}
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
                        Pay now to reserve {intent.selectedSlots.length} seat{intent.selectedSlots.length === 1 ? "" : "s"}
                    </Text>
                </AppCard>

                {/* Secure Payment Info */}
                <AppCard style={styles.infoBox}>
                    <AppIcon name="security" size={20} color={COLORS.success} />
                    <Text style={styles.infoText}>
                        Your payment reserves your seat first. Funds are captured when the match starts or is confirmed.
                    </Text>
                </AppCard>

                {/* Summary */}
                <DetailSectionCard title="Booking Summary" style={styles.sectionCardSpacing}>
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
                    subtitle="Choose how to reserve your seat."
                    style={styles.sectionCardSpacing}
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
                        <View style={styles.methodCopy}>
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
                        <View style={styles.methodCopy}>
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
                    {isPaymentWindowExpired ? (
                        <Text style={styles.expiredText}>
                            This slot hold expired. Please request the slot again to continue.
                        </Text>
                    ) : null}
                </DetailSectionCard>
                <View style={styles.footerBlock}>
                    <View style={styles.footer}>
                <AppButton
                    size="lg"
                    onPress={handleMockPayment}
                    disabled={payDisabled}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={payDisabled ? styles.payBtnDisabled : undefined}
                >
                    {processing ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <>
                            <Text style={styles.payBtnText}>
                                {isPaymentWindowExpired
                                    ? "Slot Hold Expired"
                                    : paymentMethod === "wallet" ? "Reserve with Wallet" : "Continue to Easypaisa"}
                            </Text>
                            {!isPaymentWindowExpired ? (
                                <AppIcon
                                    name={paymentMethod === "wallet" ? "lock" : "open-in-new"}
                                    size={18}
                                    color="#FFF"
                                />
                            ) : null}
                        </>
                    )}
                </AppButton>
                <Text style={styles.cancelHint}>
                    {paymentMethod === "wallet"
                        ? "Your Wallet funds are reserved now and captured when the match starts or is confirmed."
                        : "After Easypaisa confirms payment, MatchHai reserves your seat and captures funds when the match starts or is confirmed."}
                </Text>
                    </View>
                </View>
            </ScrollView>
            </View>

            <AppDialog
                visible={easypaisaPhoneVisible}
                onClose={() => !processing && setEasypaisaPhoneVisible(false)}
                dismissDisabled={processing}
                cardStyle={styles.easypaisaDialogCard}
            >
                <AppModalHeader
                    title="Confirm Easypaisa Number"
                    subtitle="Use the number you want to pay with for this seat reservation."
                    onClose={() => !processing && setEasypaisaPhoneVisible(false)}
                    closeDisabled={processing}
                />
                <AppModalBody contentContainerStyle={styles.easypaisaDialogContent}>
                    <Text style={styles.easypaisaAmountLabel}>
                        Amount: {(intent.pricing as any)?.currency || "PKR"} {intent.pricing?.totalCost ?? 0}
                    </Text>
                    <Text style={styles.easypaisaPhoneLabel}>Mobile Account Number</Text>
                    <TextInput
                        style={styles.easypaisaPhoneInput}
                        keyboardType="phone-pad"
                        value={easypaisaCheckoutPhone}
                        onChangeText={(value) => setEasypaisaCheckoutPhone(formatPakistaniPhone(value))}
                        placeholder="03XX XXX XXXX"
                        placeholderTextColor={COLORS.textSecondary}
                        editable={!processing}
                    />
                </AppModalBody>
                <AppModalFooter style={styles.easypaisaDialogFooter}>
                    <View style={styles.easypaisaActions}>
                        <AppButton
                            variant="secondary"
                            style={styles.easypaisaActionButton}
                            onPress={() => setEasypaisaPhoneVisible(false)}
                            disabled={processing}
                        >
                            Cancel
                        </AppButton>
                        <AppButton
                            style={styles.easypaisaActionButton}
                            onPress={() => void startEasypaisaBookingCheckout()}
                            loading={processing}
                            disabled={processing}
                        >
                            Continue to Pay
                        </AppButton>
                    </View>
                </AppModalFooter>
            </AppDialog>
        </Screen>
    );
}

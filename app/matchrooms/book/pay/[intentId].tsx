import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../../../src/context/AuthContext";
import { db } from "../../../../src/config/firebaseConfig";
import {
    BookingIntent,
    confirmBookingTransaction,
    getBookingIntent
} from "../../../../src/services/bookingService";
import { COLORS } from "../../../../src/theme";
import Logger from "../../../../src/utils/logger";
import styles from "./pay.styles";

export default function MockPaymentScreen() {
    const { intentId } = useLocalSearchParams() as { intentId: string };
    const router = useRouter();
    const { user } = useAuth();

    const [intent, setIntent] = useState<BookingIntent | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [walletBalance, setWalletBalance] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState<"wallet" | "card">("wallet");
    const touchDebugEnabled = __DEV__ && process.env.EXPO_PUBLIC_TOUCH_DEBUG === '1';

    useEffect(() => {
        const fetchIntent = async () => {
            if (!intentId) return;
            try {
                const res = await getBookingIntent(intentId);
                if (res.ok && res.data) {
                    setIntent(res.data);
                } else {
                    Alert.alert("Error", "Booking request not found.");
                    router.back();
                }
            } catch (e) {
                Logger.error("MockPayment", "Fetch error", e);
            } finally {
                setLoading(false);
            }
        };
        fetchIntent();
    }, [intentId]);

    useEffect(() => {
        const loadWallet = async () => {
            if (!user?._id) return;
            try {
                const snap = await getDoc(doc(db, "users", user._id));
                setWalletBalance(snap.exists() ? Number(snap.data()?.walletBalance || 0) : 0);
            } catch {
                setWalletBalance(0);
            }
        };
        loadWallet();
    }, [user?._id]);

    const handleMockPayment = async () => {
        if (!intentId || !user) return;
        if (paymentMethod !== "wallet") {
            Alert.alert("Coming soon", "Card payments are not available yet. Please pay via wallet.");
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
                Alert.alert("Payment Failed", res.message);
                setProcessing(false);
            }
        } catch (e) {
            Logger.error("MockPayment", "Transaction error", e);
            Alert.alert("Error", "An unexpected error occurred.");
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
    const hasEnoughWallet = walletBalance >= Number(intent.pricing?.total || 0);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialIcons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Review & Pay</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.amountCard}>
                    <Text style={styles.amountLabel}>TOTAL AMOUNT</Text>
                    <Text style={styles.amountValue}>
                        {intent.pricing.currency} {intent.pricing.total}
                    </Text>
                    <Text style={styles.seatCount}>
                        For {intent.selectedSlots.length} Reserved Seats
                    </Text>
                </View>

                {/* Secure Payment Info */}
                <View style={styles.infoBox}>
                    <MaterialIcons name="security" size={20} color={COLORS.success} />
                    <Text style={styles.infoText}>Wallet payment is active. Card payment is coming soon.</Text>
                </View>

                {/* Summary */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>BOOKING SUMMARY</Text>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Lobby</Text>
                        <Text style={styles.detailValue}>{intent.game}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Price per seat</Text>
                        <Text style={styles.detailValue}>{intent.pricing.currency}{intent.pricing.perPlayer}</Text>
                    </View>
                </View>

                {/* Payment Methods (Mock) */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>PAYMENT METHOD</Text>
                    <TouchableOpacity
                        style={[
                            styles.methodOption,
                            paymentMethod === "wallet" && styles.methodOptionActive,
                        ]}
                        activeOpacity={0.7}
                        onPress={() => setPaymentMethod("wallet")}
                    >
                        <View style={styles.methodIcon}>
                            <MaterialIcons name="account-balance-wallet" size={24} color={COLORS.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.methodName}>MatchHai Wallet</Text>
                            <Text style={styles.methodDetail}>Balance: {intent.pricing.currency} {Math.round(walletBalance)}</Text>
                        </View>
                        <MaterialIcons
                            name={paymentMethod === "wallet" ? "radio-button-checked" : "radio-button-unchecked"}
                            size={20}
                            color={COLORS.accent}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.methodOption, styles.methodOptionDisabled]}
                        activeOpacity={0.7}
                        onPress={() => Alert.alert("Coming soon", "Card payments are not available yet.")}
                    >
                        <View style={styles.methodIcon}>
                            <MaterialIcons name="credit-card" size={24} color={COLORS.textSecondary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.methodName}>Credit / Debit Card</Text>
                            <Text style={styles.methodDetail}>Coming soon</Text>
                        </View>
                        <MaterialIcons name="lock" size={18} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                    {!hasEnoughWallet ? (
                        <Text style={[styles.methodDetail, { marginTop: 10, color: COLORS.warning }]}>
                            Insufficient wallet balance. Please add funds from Wallet.
                        </Text>
                    ) : null}
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.payBtn, (processing || !intent || !hasEnoughWallet) && styles.payBtnDisabled]}
                    onPressIn={() => {
                        if (touchDebugEnabled) {
                            Logger.debug("TouchDebug", "pressIn", { tag: "booking_pay_now" });
                        }
                    }}
                    onPress={handleMockPayment}
                    disabled={processing || !intent || !hasEnoughWallet}
                    activeOpacity={0.85}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    {processing ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <>
                            <Text style={styles.payBtnText}>Pay with Wallet</Text>
                            <MaterialIcons name="lock" size={18} color="#FFF" />
                        </>
                    )}
                </TouchableOpacity>
                <Text style={styles.cancelHint}>Card payments will be enabled after gateway integration.</Text>
            </View>
        </SafeAreaView>
    );
}

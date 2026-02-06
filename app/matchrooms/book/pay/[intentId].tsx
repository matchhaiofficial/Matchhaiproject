import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
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

    const handleMockPayment = async () => {
        if (!intentId || !user) return;

        setProcessing(true);
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
            const res = await confirmBookingTransaction(intentId, user.uid);
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
                    <Text style={styles.infoText}>Mock Secure Checkout</Text>
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
                    <TouchableOpacity style={styles.methodOption} activeOpacity={0.7}>
                        <View style={styles.methodIcon}>
                            <MaterialIcons name="payment" size={24} color={COLORS.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.methodName}>Simulated MatchHai Wallet</Text>
                            <Text style={styles.methodDetail}>Balance: Unlimited</Text>
                        </View>
                        <MaterialIcons name="radio-button-checked" size={20} color={COLORS.accent} />
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.payBtn, (processing || !intent) && styles.payBtnDisabled]}
                    onPressIn={() => {
                        if (touchDebugEnabled) {
                            Logger.debug("TouchDebug", "pressIn", { tag: "booking_pay_now" });
                        }
                    }}
                    onPress={handleMockPayment}
                    disabled={processing || !intent}
                    activeOpacity={0.85}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    {processing ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <>
                            <Text style={styles.payBtnText}>Pay Now</Text>
                            <MaterialIcons name="lock" size={18} color="#FFF" />
                        </>
                    )}
                </TouchableOpacity>
                <Text style={styles.cancelHint}>No actual charges will be applied in this demo.</Text>
            </View>
        </SafeAreaView>
    );
}

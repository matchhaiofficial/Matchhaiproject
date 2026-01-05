import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
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

import { db } from "../../../../src/config/firebaseConfig";
import { BookingIntent, updateBookingIntentStatus } from "../../../../src/services/bookingService";
import { COLORS } from "../../../../src/theme";
import Logger from "../../../../src/utils/logger";
import styles from "./status.styles";

export default function BookingStatusScreen() {
    const { intentId } = useLocalSearchParams() as { intentId: string };
    const router = useRouter();
    const [intent, setIntent] = useState<BookingIntent | null>(null);
    const [loading, setLoading] = useState(true);
    const [timeLeft, setTimeLeft] = useState<number>(0);

    useEffect(() => {
        if (!intentId) return;

        const unsubscribe = onSnapshot(doc(db, "booking_intents", intentId), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data() as BookingIntent;
                setIntent(data);

                // Calculate time left for timer
                if (data.expiresAt) {
                    let expiresAt: Date;
                    // Handle Firestore Timestamp or serialized object
                    if (data.expiresAt.toDate) {
                        expiresAt = data.expiresAt.toDate();
                    } else if (data.expiresAt.seconds) {
                        expiresAt = new Date(data.expiresAt.seconds * 1000);
                    } else {
                        expiresAt = new Date(data.expiresAt);
                    }

                    const diff = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
                    setTimeLeft(diff);
                }
            } else {
                Alert.alert("Error", "Booking request not found.");
                router.replace("/matchrooms" as any);
            }
            setLoading(false);
        }, (error) => {
            Logger.error("BookingStatus", "Snapshot error", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [intentId]);

    // Expiry timer
    useEffect(() => {
        if (timeLeft <= 0) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [timeLeft]);

    const formatTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hours > 0) {
            return `${hours}h ${mins}m ${secs}s`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleCancel = async () => {
        if (!intentId) return;
        Alert.alert("Cancel Request", "Are you sure you want to cancel this booking?", [
            { text: "No", style: "cancel" },
            {
                text: "Yes, Cancel",
                style: "destructive",
                onPress: async () => {
                    setLoading(true);
                    const res = await updateBookingIntentStatus(intentId, 'cancelled');
                    if (res.ok) {
                        router.back();
                    } else {
                        Alert.alert("Error", res.message);
                        setLoading(false);
                    }
                }
            }
        ]);
    };

    if (loading && !intent) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator color={COLORS.accent} size="large" />
            </View>
        );
    }

    if (!intent) return null;

    const isPendingApproval = intent.status === 'pending_approvals';
    const isApproved = intent.status === 'approved_pending_payment';
    const isCompleted = intent.status === 'confirmed';
    const isRejected = intent.status === 'rejected';

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Booking Status</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.statusDisplay}>
                    <View style={styles.statusIconBg}>
                        {isCompleted ? (
                            <MaterialIcons name="check-circle" size={60} color={COLORS.success} />
                        ) : isRejected ? (
                            <MaterialIcons name="error" size={60} color={COLORS.error} />
                        ) : (
                            <ActivityIndicator size="large" color={COLORS.accent} />
                        )}
                    </View>
                    <Text style={styles.statusTitle}>
                        {isCompleted ? "Booking Confirmed!" :
                            isRejected ? "Booking Rejected" :
                                isApproved ? "Ready for Payment" : "Waiting for Approval"}
                    </Text>

                    {timeLeft > 0 && (
                        <View style={styles.timerPill}>
                            <MaterialIcons name="schedule" size={16} color={COLORS.accent} />
                            <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
                        </View>
                    )}
                </View>

                {/* Progress Stepper */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>PROGRESS</Text>
                    <View style={styles.stepper}>
                        <View style={styles.stepContainer}>
                            <View style={styles.stepLineWrapper}>
                                <View style={[styles.stepIcon, styles.stepIconApproved]}>
                                    <MaterialIcons name="check" size={14} color="#FFF" />
                                </View>
                                <View style={[styles.stepLine, styles.stepLineActive]} />
                            </View>
                            <Text style={[styles.stepLabel, styles.stepLabelActive]}>Request Sent</Text>
                        </View>

                        <View style={styles.stepContainer}>
                            <View style={styles.stepLineWrapper}>
                                <View style={[
                                    styles.stepIcon,
                                    (isApproved || isCompleted) ? styles.stepIconApproved :
                                        isRejected ? styles.stepIconDeclined : styles.stepIconPending
                                ]}>
                                    {isRejected ? (
                                        <MaterialIcons name="close" size={14} color="#FFF" />
                                    ) : (isApproved || isCompleted) ? (
                                        <MaterialIcons name="check" size={14} color="#FFF" />
                                    ) : (
                                        <View style={styles.idleDot} />
                                    )}
                                </View>
                                <View style={[styles.stepLine, (isApproved || isCompleted) && styles.stepLineActive]} />
                            </View>
                            <Text style={[
                                styles.stepLabel,
                                isRejected ? styles.stepLabelDeclined :
                                    (isApproved || isCompleted || isPendingApproval) && styles.stepLabelActive
                            ]}>
                                {isRejected ? "Approval Rejected" : "Captain & Zone Approval"}
                            </Text>
                        </View>

                        <View style={styles.stepContainer}>
                            <View style={styles.stepLineWrapper}>
                                <View style={[
                                    styles.stepIcon,
                                    isCompleted ? styles.stepIconApproved :
                                        isApproved ? styles.stepIconPending : {}
                                ]}>
                                    {isCompleted ? (
                                        <MaterialIcons name="check" size={14} color="#FFF" />
                                    ) : (
                                        <View style={styles.idleDot} />
                                    )}
                                </View>
                            </View>
                            <Text style={[styles.stepLabel, isCompleted && styles.stepLabelActive]}>Payment Confirmation</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>SUMMARY</Text>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Seats Reserved</Text>
                        <Text style={styles.detailValue}>{intent.selectedSlots.length}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Total Amount</Text>
                        <Text style={styles.totalAmount}>{intent.pricing.currency} {intent.pricing.total}</Text>
                    </View>

                    {isApproved && (
                        <Text style={styles.expiredHint}>
                            Please pay within the timer to secure your seats.
                        </Text>
                    )}
                </View>

                <View style={styles.footer}>
                    {isApproved && (
                        <TouchableOpacity
                            style={styles.primaryBtn}
                            onPress={() => router.push({
                                pathname: "/matchrooms/book/pay/[intentId]",
                                params: { intentId: intentId }
                            } as any)}
                        >
                            <Text style={styles.primaryBtnText}>Proceed to Pay</Text>
                            <MaterialIcons name="payment" size={20} color="#FFF" />
                        </TouchableOpacity>
                    )}

                    {isCompleted && (
                        <TouchableOpacity
                            style={styles.primaryBtn}
                            onPress={() => router.replace(`/matchrooms/${intent.matchroomId}`)}
                        >
                            <Text style={styles.primaryBtnText}>Return to Lobby</Text>
                            <MaterialIcons name="group" size={20} color="#FFF" />
                        </TouchableOpacity>
                    )}

                    {!isApproved && !isCompleted && (
                        <View style={styles.footerRow}>
                            {/* Cancel Button */}
                            {!isRejected && (
                                <TouchableOpacity
                                    style={[styles.secondaryBtn, { flex: 1, borderColor: COLORS.error + '40' }]}
                                    onPress={handleCancel}
                                >
                                    <Text style={[styles.secondaryBtnText, { color: COLORS.error }]} numberOfLines={1}>Cancel</Text>
                                </TouchableOpacity>
                            )}

                            {/* Dashboard Button */}
                            <TouchableOpacity
                                style={[styles.secondaryBtn, { flex: 1 }]}
                                onPress={() => router.replace("/(player)/(tabs)/matchrooms" as any)}
                            >
                                <Text style={styles.secondaryBtnText} numberOfLines={1}>Dashboard</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

import { useLocalSearchParams, useRouter } from "expo-router";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    Text,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import AppHeader from "../../../../src/components/AppHeader";
import { AppIcon } from "../../../../src/components/AppIcon";
import { AppButton, AppCard, StatusPill } from "../../../../src/components/AppPrimitives";
import { DetailKeyValueRow, DetailSectionCard } from "../../../../src/components/DetailSurface";
import { BookingIntent } from "../../../../src/services/convex/bookingService";
import { useAuth } from "../../../../src/context/AuthContext";
import { useToast } from "../../../../src/hooks/useToast";
import { cancelBookingIntent } from "../../../../src/services/convex/bookingService";
import { COLORS } from "../../../../src/theme";
import Logger from "../../../../src/utils/logger";
import { buildLegacyMatchroomsHref } from "../../../../src/navigation/routes";
import styles from "./status.styles";

export default function BookingStatusScreen() {
    const { intentId, gateway, paymentStatus: paymentStatusParam, orderRefNum } = useLocalSearchParams() as {
        intentId: string;
        gateway?: string;
        paymentStatus?: string;
        orderRefNum?: string;
    };
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const { showToast } = useToast();
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [cancelling, setCancelling] = useState(false);
    const touchDebugEnabled = __DEV__ && process.env.EXPO_PUBLIC_TOUCH_DEBUG === '1';
    const ctaBottomGuard = Math.max(insets.bottom + 12, 96);

    const logScreenTouch = (tag: string, e: any) => {
        if (!touchDebugEnabled) return;
        const { pageX, pageY } = e.nativeEvent;
        Logger.debug("TouchDebug", "touch", { tag, pageX, pageY });
    };

    // Real-time query for booking intent (replaces onSnapshot)
    const intentData = useQuery(api.bookings.getIntentById,
        intentId ? { intentId: intentId as Id<"bookingIntents"> } : "skip"
    );
    const checkoutStatus = useQuery(
        api.easypaisa.getCheckoutStatus,
        user?._id && orderRefNum
            ? { userId: user._id as Id<"users">, orderRefNum }
            : "skip"
    );
    const syncCheckoutStatus = useAction((api as any).easypaisa.syncTransactionStatus);
    const intent = intentData as BookingIntent | null | undefined;

    // Handle not found
    useEffect(() => {
        if (intentData === null) {
            showToast({ type: "error", title: "Error", message: "Booking request not found." });
            router.replace("/matchrooms" as any);
        }
    }, [intentData, router, showToast]);

    // Calculate time left when intent data changes
    useEffect(() => {
        if (intent?.expiresAt) {
            const expiresAt = typeof intent.expiresAt === 'number'
                ? intent.expiresAt
                : new Date(intent.expiresAt).getTime();
            const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
            setTimeLeft(diff);
        }
    }, [intent?.expiresAt]);

    useEffect(() => {
        if (!user?._id || !orderRefNum || !checkoutStatus) {
            return;
        }
        if (!["created", "redirected", "token_received", "pending"].includes(String(checkoutStatus.status || ""))) {
            return;
        }

        const timer = setInterval(() => {
            syncCheckoutStatus({ orderRefNum, userId: user._id as Id<"users"> }).catch((error) => {
                Logger.error("BookingStatus", "Failed to sync Easypaisa status", error);
            });
        }, 5000);

        return () => clearInterval(timer);
    }, [checkoutStatus, orderRefNum, syncCheckoutStatus, user?._id]);

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
        if (!intentId || !user?._id) return;
        Alert.alert("Cancel Request", "Are you sure you want to cancel this booking?", [
            { text: "No", style: "cancel" },
            {
                text: "Yes, Cancel",
                style: "destructive",
                onPress: async () => {
                    setCancelling(true);
                    try {
                        const result = await cancelBookingIntent(intentId, user._id);
                        if (!result.ok) {
                            throw new Error(result.message);
                        }
                        router.back();
                    } catch (error: any) {
                        showToast({ type: "error", title: "Error", message: error?.message || "Failed to cancel booking" });
                        setCancelling(false);
                    }
                }
            }
        ]);
    };

    const loading = intent === undefined;

    if (loading && !cancelling) {
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
    const isGatewayPending = gateway === "easypaisa"
        && !isCompleted
        && (
            paymentStatusParam === "pending"
            || checkoutStatus?.status === "created"
            || checkoutStatus?.status === "redirected"
            || checkoutStatus?.status === "token_received"
            || checkoutStatus?.status === "pending"
        );

    return (
        <SafeAreaView
            style={styles.container}
            onTouchEndCapture={(e) => logScreenTouch("booking_status_screen", e)}
        >
            <AppHeader
                title="Booking Status"
                onBack={() => router.back()}
                inlineTitle
            />

            <View style={styles.body}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
            >
                <AppCard variant="elevated" style={styles.statusDisplay}>
                    <View style={styles.statusIconBg}>
                        {isCompleted ? (
                            <AppIcon name="check-circle" size={60} color={COLORS.success} />
                        ) : isRejected ? (
                            <AppIcon name="error" size={60} color={COLORS.error} />
                        ) : isGatewayPending ? (
                            <AppIcon name="hourglass-top" size={60} color={COLORS.warning} />
                        ) : (
                            <ActivityIndicator size="large" color={COLORS.accent} />
                        )}
                    </View>
                    <Text style={styles.statusTitle}>
                        {isCompleted ? "Booking Confirmed!" :
                            isRejected ? "Booking Rejected" :
                                isGatewayPending ? "Payment Processing" :
                                isApproved ? "Ready for Payment" : "Waiting for Approval"}
                    </Text>
                    <StatusPill
                        tone={
                            isCompleted
                                ? "success"
                                : isRejected
                                    ? "danger"
                                    : isGatewayPending
                                        ? "warning"
                                        : isApproved
                                            ? "info"
                                            : "neutral"
                        }
                        label={
                            isCompleted
                                ? "Confirmed"
                                : isRejected
                                    ? "Rejected"
                                    : isGatewayPending
                                        ? "Processing"
                                        : isApproved
                                            ? "Payment Ready"
                                            : "Pending Approval"
                        }
                        style={styles.statusPill}
                    />

                    {timeLeft > 0 && (
                        <View style={styles.timerPill}>
                            <AppIcon name="schedule" size={16} color={COLORS.accent} />
                            <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
                        </View>
                    )}
                </AppCard>

                {/* Progress Stepper */}
                <DetailSectionCard title="Progress">
                    <View style={styles.stepper}>
                        <View style={styles.stepContainer}>
                            <View style={styles.stepLineWrapper}>
                                <View style={[styles.stepIcon, styles.stepIconApproved]}>
                                    <AppIcon name="check" size={14} color="#FFF" />
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
                                        <AppIcon name="close" size={14} color="#FFF" />
                                    ) : (isApproved || isCompleted) ? (
                                        <AppIcon name="check" size={14} color="#FFF" />
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
                                        <AppIcon name="check" size={14} color="#FFF" />
                                    ) : (
                                        <View style={styles.idleDot} />
                                    )}
                                </View>
                            </View>
                            <Text style={[styles.stepLabel, isCompleted && styles.stepLabelActive]}>Payment Confirmation</Text>
                        </View>
                    </View>
                </DetailSectionCard>

                <DetailSectionCard title="Summary">
                    <DetailKeyValueRow label="Seats Reserved" value={intent.selectedSlots.length} />
                    <DetailKeyValueRow
                        label="Total Amount"
                        value={intent.pricing?.totalCost ?? 0}
                        valueTone="accent"
                        last
                        valueStyle={styles.totalAmount}
                    />

                    {isApproved && (
                        <Text style={styles.expiredHint}>
                            Please pay within the timer to secure your seats.
                        </Text>
                    )}
                    {isGatewayPending ? (
                        <Text style={[styles.expiredHint, { color: COLORS.warning }]}>
                            Easypaisa payment is pending. Approve it in Easypaisa and MatchHai will keep checking automatically.
                        </Text>
                    ) : null}
                    {orderRefNum ? (
                        <Text style={styles.expiredHint}>
                            Easypaisa Order: {orderRefNum}
                        </Text>
                    ) : null}
                    {checkoutStatus?.providerDescription ? (
                        <Text style={styles.expiredHint}>
                            Gateway message: {checkoutStatus.providerDescription}
                        </Text>
                    ) : null}
                    {checkoutStatus?.actionRequired ? (
                        <Text style={styles.expiredHint}>
                            Next step: {checkoutStatus.actionRequired === "pay_with_token"
                                ? `Pay with OTC token ${checkoutStatus.paymentToken || ""}`.trim()
                                : "Approve in Easypaisa"}
                        </Text>
                    ) : null}
                </DetailSectionCard>
                <View style={{ width: '100%', marginTop: 8, marginBottom: ctaBottomGuard }}>
                    <View style={styles.footer}>
                    {isGatewayPending ? (
                        <AppButton
                            size="lg"
                            onPress={async () => {
                                try {
                                    await syncCheckoutStatus({ orderRefNum, userId: user?._id as Id<"users"> });
                                    showToast({ type: "info", title: "Refreshing", message: "Asked MatchHai to sync the latest Easypaisa status." });
                                } catch (error) {
                                    Logger.error("BookingStatus", "Failed to refresh Easypaisa status", error);
                                    showToast({ type: "error", title: "Refresh failed", message: "Could not sync the Easypaisa payment status." });
                                }
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Text style={styles.primaryBtnText}>Refresh Easypaisa Status</Text>
                            <AppIcon name="refresh" size={20} color="#FFF" />
                        </AppButton>
                    ) : null}
                    {isApproved && (
                        <AppButton
                            size="lg"
                            onPressIn={() => {
                                if (touchDebugEnabled) {
                                    Logger.debug("TouchDebug", "pressIn", { tag: "booking_status_proceed_pay" });
                                }
                            }}
                            onPress={() => router.push({
                                pathname: "/matchrooms/book/pay/[intentId]",
                                params: { intentId: intentId }
                            } as any)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Text style={styles.primaryBtnText}>Proceed to Pay</Text>
                            <AppIcon name="payment" size={20} color="#FFF" />
                        </AppButton>
                    )}

                    {isCompleted && (
                        <AppButton
                            size="lg"
                            onPressIn={() => {
                                if (touchDebugEnabled) {
                                    Logger.debug("TouchDebug", "pressIn", { tag: "booking_status_return_lobby" });
                                }
                            }}
                            onPress={() => router.replace(`/matchrooms/${intent.matchroomId}`)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Text style={styles.primaryBtnText}>Return to Lobby</Text>
                            <AppIcon name="group" size={20} color="#FFF" />
                        </AppButton>
                    )}

                    {!isApproved && !isCompleted && (
                        <View style={styles.footerRow}>
                            {/* Cancel Button */}
                            {!isRejected && (
                                <AppButton
                                    variant="danger"
                                    onPressIn={() => {
                                        if (touchDebugEnabled) {
                                            Logger.debug("TouchDebug", "pressIn", { tag: "booking_status_cancel" });
                                        }
                                    }}
                                    onPress={handleCancel}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    style={styles.secondaryAction}
                                >
                                    <Text style={styles.secondaryDangerText} numberOfLines={1}>Cancel</Text>
                                </AppButton>
                            )}

                            {/* Dashboard Button */}
                            <AppButton
                                variant="secondary"
                                onPressIn={() => {
                                    if (touchDebugEnabled) {
                                        Logger.debug("TouchDebug", "pressIn", { tag: "booking_status_dashboard" });
                                    }
                                }}
                                onPress={() => router.replace(buildLegacyMatchroomsHref() as any)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={styles.secondaryAction}
                            >
                            <Text style={styles.secondaryBtnText} numberOfLines={1}>Dashboard</Text>
                        </AppButton>
                    </View>
                    )}
                    </View>
                </View>
            </ScrollView>
            </View>
        </SafeAreaView>
    );
}

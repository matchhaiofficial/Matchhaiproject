import { useLocalSearchParams, useRouter } from "expo-router";
import { useAction, useConvexAuth, useQuery } from "convex/react";
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

import AppHeader from "../../../../src/components/AppHeader";
import { AppIcon } from "../../../../src/components/AppIcon";
import { AppButton, AppCard, StatusPill } from "../../../../src/components/AppPrimitives";
import BottomActionBar from "../../../../src/components/BottomActionBar";
import { DetailKeyValueRow, DetailSectionCard } from "../../../../src/components/DetailSurface";
import Screen from "../../../../src/components/Screen";
import { BookingIntent } from "../../../../src/services/convex/bookingService";
import { useAuth } from "../../../../src/context/AuthContext";
import { useToast } from "../../../../src/hooks/useToast";
import { cancelBookingIntent } from "../../../../src/services/convex/bookingService";
import { COLORS } from "../../../../src/theme";
import Logger from "../../../../src/utils/logger";
import { PAYMENT_VERIFICATION_SAFE_MESSAGE, PAYMENT_SUPPORT_WITH_ORDER_HINT } from "../../../../src/utils/paymentUiCopy";
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
    const { user, loading: authLoading } = useAuth();
    const { isLoading: convexAuthLoading, isAuthenticated } = useConvexAuth();
    const { showToast } = useToast();
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [cancelling, setCancelling] = useState(false);
    const [refreshingPayment, setRefreshingPayment] = useState(false);

    const hasPaymentRouteContext = Boolean(
        orderRefNum || gateway === "easypaisa" || paymentStatusParam === "pending"
    );
    const protectedIntentReady = Boolean(
        intentId && user?._id && !authLoading && !convexAuthLoading && isAuthenticated
    );

    // Real-time query for booking intent (replaces onSnapshot)
    const intentData = useQuery(api.bookings.getIntentById,
        protectedIntentReady ? { intentId: intentId as Id<"bookingIntents"> } : "skip"
    );
    const syncCheckoutStatus = useAction((api as any).easypaisa.syncTransactionStatus);
    const intent = intentData as BookingIntent | null | undefined;
    const activeOrderRefNum = orderRefNum || intent?.activePaymentOrderRefNum;
    const hasEasypaisaAttempt = Boolean(activeOrderRefNum);
    const hasPaymentRecoveryContext = hasPaymentRouteContext || hasEasypaisaAttempt;
    const checkoutStatus = useQuery(
        api.easypaisa.getCheckoutStatus,
        user?._id && activeOrderRefNum
            ? { userId: user._id as Id<"users">, orderRefNum: activeOrderRefNum }
            : "skip"
    );
    const roomData = useQuery(
        api.matchrooms.getById,
        intent?.matchroomId ? { matchroomId: String(intent.matchroomId) } : "skip"
    ) as any;
    const intentIsCompleted = intent?.status === "confirmed";
    const settlementSummary = useQuery(
        (api as any).matchrooms.getSettlementSummary,
        intentIsCompleted && intent?.matchroomId ? { matchroomId: intent.matchroomId as Id<"matchrooms"> } : "skip",
    ) as any;

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
        if (!user?._id || !activeOrderRefNum || !checkoutStatus) {
            return;
        }
        if (!["created", "redirected", "token_received", "pending"].includes(String(checkoutStatus.status || ""))) {
            return;
        }

        const timer = setInterval(() => {
            syncCheckoutStatus({ orderRefNum: activeOrderRefNum, userId: user._id as Id<"users"> }).catch((error) => {
                Logger.error("BookingStatus", "Failed to sync Easypaisa status", error);
            });
        }, 5000);

        return () => clearInterval(timer);
    }, [activeOrderRefNum, checkoutStatus, syncCheckoutStatus, user?._id]);

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

    const handleRefreshPaymentStatus = async () => {
        if (!activeOrderRefNum || !user?._id || refreshingPayment) return;

        setRefreshingPayment(true);
        try {
            await syncCheckoutStatus({
                orderRefNum: activeOrderRefNum,
                userId: user._id as Id<"users">,
            });
            showToast({
                type: "info",
                title: "Refreshing",
                message: "Asked MatchHai to sync the latest Easypaisa status.",
            });
        } catch (error) {
            Logger.error("BookingStatus", "Failed to refresh Easypaisa status", error);
            showToast({
                type: "error",
                title: "Refresh failed",
                message: "Could not sync the Easypaisa payment status.",
            });
        } finally {
            setRefreshingPayment(false);
        }
    };

    const checkoutState = String(checkoutStatus?.status || "");
    const checkoutIsActive = ["created", "redirected", "token_received", "pending"].includes(checkoutState);

    const renderPaymentRecovery = () => {
        const title =
            checkoutState === "paid"
                ? "Payment Received"
                : ["failed", "expired", "cancelled"].includes(checkoutState)
                    ? "Payment not completed"
                    : "Payment Processing";
        const message =
            checkoutState === "paid"
                ? "MatchHai received your Easypaisa payment update and is completing the booking check."
                : ["failed", "expired", "cancelled"].includes(checkoutState)
                    ? "This Easypaisa attempt did not complete. You can refresh once or contact support with the order number."
                    : "Please stay on this screen while MatchHai verifies your Easypaisa payment.";

        return (
            <Screen
                style={styles.container}
                variant="stack"
                scroll={false}
                edges={["top", "bottom"]}
                contentStyle={styles.screenContent}
            >
                <AppHeader title="Booking Status" onBack={() => router.back()} inlineTitle />
                <View style={styles.body}>
                    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
                        <AppCard variant="elevated" style={styles.statusDisplay}>
                            <View style={styles.statusIconBg}>
                                {checkoutState === "paid" ? (
                                    <AppIcon name="check-circle" size={60} color={COLORS.success} />
                                ) : ["failed", "expired", "cancelled"].includes(checkoutState) ? (
                                    <AppIcon name="error" size={60} color={COLORS.error} />
                                ) : checkoutStatus === undefined ? (
                                    <ActivityIndicator size="large" color={COLORS.accent} />
                                ) : (
                                    <AppIcon name="hourglass-top" size={60} color={COLORS.warning} />
                                )}
                            </View>
                            <Text style={styles.statusTitle}>{title}</Text>
                            <StatusPill
                                tone={
                                    checkoutState === "paid"
                                        ? "success"
                                        : ["failed", "expired", "cancelled"].includes(checkoutState)
                                            ? "danger"
                                            : "warning"
                                }
                                label={checkoutState ? checkoutState.replace(/_/g, " ") : "Verifying"}
                                style={styles.statusPill}
                            />
                        </AppCard>

                        <DetailSectionCard title="Payment" style={styles.sectionCardSpacing}>
                            <Text style={styles.expiredHint}>{message}</Text>
                            {activeOrderRefNum ? (
                                <DetailKeyValueRow
                                    label="Order"
                                    value={activeOrderRefNum}
                                    style={styles.orderRow}
                                    labelStyle={styles.orderLabel}
                                    valueStyle={styles.orderValue}
                                />
                            ) : null}
                            <Text style={styles.expiredHint}>{PAYMENT_SUPPORT_WITH_ORDER_HINT}</Text>
                        </DetailSectionCard>
                    </ScrollView>
                </View>
                <BottomActionBar contentStyle={styles.bottomActionContent}>
                    <View style={styles.footer}>
                        {activeOrderRefNum && user?._id ? (
                            <AppButton
                                size="lg"
                                onPress={() => void handleRefreshPaymentStatus()}
                                loading={refreshingPayment}
                                disabled={refreshingPayment}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Text style={styles.primaryBtnText}>Refresh Payment Status</Text>
                                {!refreshingPayment ? <AppIcon name="refresh" size={20} color="#FFF" /> : null}
                            </AppButton>
                        ) : null}
                        <AppButton
                            variant="secondary"
                            onPress={() => router.push("/(player)/support" as any)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Text style={styles.secondaryBtnText} numberOfLines={1}>Contact Support</Text>
                        </AppButton>
                    </View>
                </BottomActionBar>
            </Screen>
        );
    };

    const renderNotFound = () => (
        <Screen
            style={styles.container}
            variant="stack"
            scroll={false}
            edges={["top", "bottom"]}
            contentStyle={styles.screenContent}
        >
            <AppHeader title="Booking Status" onBack={() => router.back()} inlineTitle />
            <View style={styles.loadingContainer}>
                <AppIcon name="error" size={60} color={COLORS.error} />
                <Text style={styles.statusTitle}>Booking not found</Text>
                <Text style={styles.expiredHint}>
                    We could not find this booking request. It may have expired or been cancelled.
                </Text>
                <AppButton
                    variant="secondary"
                    onPress={() => router.replace(buildLegacyMatchroomsHref() as any)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.notFoundAction}
                >
                    <Text style={styles.secondaryBtnText}>Back to Matchrooms</Text>
                </AppButton>
            </View>
        </Screen>
    );

    const loading = intent === undefined;

    if (loading && !cancelling && !hasPaymentRecoveryContext) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator color={COLORS.accent} size="large" />
            </View>
        );
    }

    if (!intent) {
        if (hasPaymentRecoveryContext) return renderPaymentRecovery();
        if (loading) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator color={COLORS.accent} size="large" />
                </View>
            );
        }
        return renderNotFound();
    }

    const isPendingApproval = intent.status === 'pending_approvals';
    const isApproved = intent.status === 'approved_pending_payment';
    const isCompleted = intent.status === 'confirmed';
    const isRejected = intent.status === 'rejected';
    const isExpired = intent.status === 'expired';
    const isCancelled = intent.status === 'cancelled';
    const isCheckoutPending = checkoutIsActive;
    const isLoadingActivePayment = Boolean(activeOrderRefNum && checkoutStatus === undefined);
    const isGatewayPending = hasEasypaisaAttempt
        && !isCompleted
        && (
            isCheckoutPending
            || isLoadingActivePayment
            || (gateway === "easypaisa" && paymentStatusParam === "pending" && !checkoutState)
        );
    const isGatewayFailed = hasEasypaisaAttempt
        && !isCompleted
        && ["failed", "expired", "cancelled"].includes(checkoutState);
    const isPaidAwaitingBooking = !isCompleted
        && (intent.paymentStatus === "paid" || checkoutState === "paid");
    const isZoneMatchroom = Boolean(roomData?.zoneId) || roomData?.locationMode === "zone";
    const isZoneApproved = !isZoneMatchroom || roomData?.zoneAdminApproved === true;
    const isFullyConfirmed = isCompleted && isZoneApproved;
    const statusTitle = isFullyConfirmed ? "Seat Reserved!" :
        isCompleted && isZoneMatchroom && !isZoneApproved ? "Seat Reserved" :
            isCancelled ? "Booking Cancelled" :
                isExpired ? "Booking Expired" :
            isRejected ? "Booking Rejected" :
                isGatewayFailed ? "Payment not completed" :
                    isPaidAwaitingBooking ? "Payment Received" :
                        isGatewayPending ? "Payment Processing" :
                    isApproved ? "Ready for Payment" : "Waiting for Approval";
    const statusLabel = isFullyConfirmed ? "Confirmed" :
        isCompleted && isZoneMatchroom && !isZoneApproved ? "Venue Pending" :
            isCancelled ? "Cancelled" :
                isExpired ? "Expired" :
            isRejected ? "Rejected" :
                isGatewayFailed ? "Retry Payment" :
                    isPaidAwaitingBooking ? "Confirming Seat" :
                        isGatewayPending ? "Processing" :
                    isApproved ? "Payment Ready" : "Pending Approval";
    const statusTone = isFullyConfirmed ? "success" :
        isCompleted && isZoneMatchroom && !isZoneApproved ? "warning" :
            isRejected || isExpired || isCancelled || isGatewayFailed ? "danger" :
                isGatewayPending || isPaidAwaitingBooking ? "warning" :
                    isApproved ? "info" : "neutral";
    const showRefreshPaymentAction = Boolean(
        activeOrderRefNum
        && user?._id
        && (isGatewayPending || isPaidAwaitingBooking)
    );
    const showPayAction = isApproved && !isGatewayPending && !isPaidAwaitingBooking;
    const showDashboardAction = !showRefreshPaymentAction && !showPayAction && !isCompleted;
    return (
        <Screen
            style={styles.container}
            variant="stack"
            scroll={false}
            edges={["top", "bottom"]}
            contentStyle={styles.screenContent}
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
                        {isFullyConfirmed || isCompleted ? (
                            <AppIcon name="check-circle" size={60} color={COLORS.success} />
                        ) : isRejected || isExpired || isCancelled || isGatewayFailed ? (
                            <AppIcon name="error" size={60} color={COLORS.error} />
                        ) : isGatewayPending ? (
                            <AppIcon name="hourglass-top" size={60} color={COLORS.warning} />
                        ) : (
                            <ActivityIndicator size="large" color={COLORS.accent} />
                        )}
                    </View>
                    <Text style={styles.statusTitle}>
                        {statusTitle}
                    </Text>
                    <StatusPill
                        tone={statusTone as any}
                        label={statusLabel}
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
                <DetailSectionCard title="Progress" style={styles.sectionCardSpacing}>
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
                                {isRejected ? "Captain Rejected" : "Captain Approval"}
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
                                {isCompleted ? <View style={[styles.stepLine, isZoneApproved && styles.stepLineActive]} /> : null}
                            </View>
                            <Text style={[styles.stepLabel, isCompleted && styles.stepLabelActive]}>Seat Reserved</Text>
                        </View>

                        <View style={styles.stepContainer}>
                            <View style={styles.stepLineWrapper}>
                                <View style={[
                                    styles.stepIcon,
                                    isZoneApproved && isCompleted ? styles.stepIconApproved :
                                        isCompleted ? styles.stepIconPending : {}
                                ]}>
                                    {isZoneApproved && isCompleted ? (
                                        <AppIcon name="check" size={14} color="#FFF" />
                                    ) : (
                                        <View style={styles.idleDot} />
                                    )}
                                </View>
                            </View>
                            <Text style={[styles.stepLabel, isZoneApproved && isCompleted && styles.stepLabelActive]}>Zone Approval</Text>
                        </View>
                    </View>
                </DetailSectionCard>

                <DetailSectionCard title="Summary" style={styles.sectionCardSpacing}>
                    <DetailKeyValueRow label="Seats Reserved" value={intent.selectedSlots.length} />
                    <DetailKeyValueRow
                        label="Total Amount"
                        value={`${(intent.pricing as any)?.currency || "PKR"} ${intent.pricing?.totalCost ?? 0}`}
                        valueTone="accent"
                        last
                        valueStyle={styles.totalAmount}
                    />

                    {isApproved && !isGatewayPending && !isGatewayFailed && !isPaidAwaitingBooking ? (
                        <Text style={styles.expiredHint}>
                            Pay within the timer to reserve your seats.
                        </Text>
                    ) : null}
                    {isGatewayPending ? (
                        <Text style={[styles.expiredHint, { color: COLORS.warning }]}>
                            Easypaisa payment is pending. Once confirmed, your seat is reserved and funds are kept in your MatchHai Wallet until capture.
                        </Text>
                    ) : null}
                    {isGatewayFailed ? (
                        <Text style={[styles.expiredHint, { color: COLORS.warning }]}>
                            Easypaisa did not complete this payment. Retry from Pay & Review if you still want this seat.
                        </Text>
                    ) : null}
                    {isPaidAwaitingBooking ? (
                        <Text style={[styles.expiredHint, { color: COLORS.warning }]}>
                            MatchHai received a payment update. Refresh once to complete the latest booking check.
                        </Text>
                    ) : null}
                    {isCompleted ? (
                        <Text style={styles.expiredHint}>
                            Your seat is reserved. Funds are captured when the match starts or is confirmed. If the match is cancelled before capture, funds return to your MatchHai Wallet.
                        </Text>
                    ) : null}
                    {activeOrderRefNum ? (
                        <DetailKeyValueRow
                            label="Order"
                            value={activeOrderRefNum}
                            style={styles.orderRow}
                            labelStyle={styles.orderLabel}
                            valueStyle={styles.orderValue}
                        />
                    ) : null}
                    {checkoutStatus?.lastError && !isCompleted ? (
                        <Text style={styles.expiredHint}>
                            Status: {PAYMENT_VERIFICATION_SAFE_MESSAGE}
                        </Text>
                    ) : null}
                    {activeOrderRefNum && !isCompleted && (isGatewayFailed || isGatewayPending || checkoutStatus?.lastError) ? (
                        <Text style={styles.expiredHint}>
                            {PAYMENT_SUPPORT_WITH_ORDER_HINT}
                        </Text>
                    ) : null}
                    {isGatewayPending && checkoutStatus?.actionRequired ? (
                        <Text style={styles.expiredHint}>
                            Next step: {checkoutStatus.actionRequired === "pay_with_token"
                                ? `Pay with OTC token ${checkoutStatus.paymentToken || ""}`.trim()
                                : "Approve in Easypaisa"}
                        </Text>
                    ) : null}
                </DetailSectionCard>
                {settlementSummary ? (
                    <DetailSectionCard title="Payment" style={styles.sectionCardSpacing}>
                        <DetailKeyValueRow
                            label="Funds"
                            value={settlementSummary.merchantSettlementStatus === "captured" ? "Captured" : "Reserved"}
                        />
                        <DetailKeyValueRow
                            label="Refunds"
                            value="Approved refunds return to your MatchHai Wallet"
                            style={styles.settlementRow}
                            labelStyle={styles.settlementLabel}
                            valueStyle={styles.settlementValue}
                        />
                        <DetailKeyValueRow
                            label="Venue"
                            value={
                                settlementSummary.venuePayoutStatus === "paid"
                                    ? "Payout completed"
                                    : "Payout after match completion"
                            }
                            last
                            style={styles.settlementRow}
                            labelStyle={styles.settlementLabel}
                            valueStyle={styles.settlementValue}
                        />
                    </DetailSectionCard>
                ) : null}
            </ScrollView>
            </View>
            <BottomActionBar contentStyle={styles.bottomActionContent}>
                <View style={styles.footer}>
                    {showRefreshPaymentAction ? (
                        <AppButton
                            size="lg"
                            onPress={() => void handleRefreshPaymentStatus()}
                            loading={refreshingPayment}
                            disabled={refreshingPayment}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Text style={styles.primaryBtnText}>
                                {isPaidAwaitingBooking ? "Continue Booking Check" : "Refresh Payment Status"}
                            </Text>
                            {!refreshingPayment ? <AppIcon name="refresh" size={20} color="#FFF" /> : null}
                        </AppButton>
                    ) : null}
                    {showPayAction ? (
                        <AppButton
                            size="lg"
                            onPress={() => router.push({
                                pathname: "/matchrooms/book/pay/[intentId]",
                                params: { intentId: intentId }
                            } as any)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Text style={styles.primaryBtnText}>
                                {isGatewayFailed ? "Retry Payment" : "Proceed to Pay"}
                            </Text>
                            <AppIcon name="payment" size={20} color="#FFF" />
                        </AppButton>
                    ) : null}
                    {isCompleted ? (
                        <AppButton
                            size="lg"
                            onPress={() => router.replace(`/matchrooms/${intent.matchroomId}`)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Text style={styles.primaryBtnText}>Return to Lobby</Text>
                            <AppIcon name="group" size={20} color="#FFF" />
                        </AppButton>
                    ) : null}
                    {activeOrderRefNum && !isCompleted && (isGatewayFailed || isGatewayPending) ? (
                        <AppButton
                            variant="secondary"
                            onPress={() => router.push("/(player)/support" as any)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Text style={styles.secondaryBtnText} numberOfLines={1}>Contact Support</Text>
                        </AppButton>
                    ) : null}
                    {showDashboardAction ? (
                        <View style={styles.footerRow}>
                            {!isRejected && !isExpired && !isCancelled ? (
                                <AppButton
                                    variant="danger"
                                    onPress={handleCancel}
                                    disabled={cancelling}
                                    loading={cancelling}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    style={styles.secondaryAction}
                                >
                                    <Text style={styles.secondaryDangerText} numberOfLines={1}>Cancel</Text>
                                </AppButton>
                            ) : null}
                            <AppButton
                                variant="secondary"
                                onPress={() => router.replace(buildLegacyMatchroomsHref() as any)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={styles.secondaryAction}
                            >
                                <Text style={styles.secondaryBtnText} numberOfLines={1}>Dashboard</Text>
                            </AppButton>
                        </View>
                    ) : null}
                </View>
            </BottomActionBar>
        </Screen>
    );
}

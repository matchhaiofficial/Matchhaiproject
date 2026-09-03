import { useLocalSearchParams, useRouter } from "expo-router";
import { useAction, useQuery } from "convex/react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, Pressable, Share, ScrollView, Text, TextInput, View } from "react-native";

import AppHeader from "../../src/components/AppHeader";
import { AppIcon } from "../../src/components/AppIcon";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { AppButton, StatusPill } from "../../src/components/AppPrimitives";
import { AppDialog, AppModalBody, AppModalFooter, AppModalHeader } from "../../src/components/AppModalPrimitives";
import { DetailSectionCard } from "../../src/components/DetailSurface";
import Screen from "../../src/components/Screen";
import { useAuth } from "../../src/context/AuthContext";
import { useToast } from "../../src/hooks/useToast";
import {
    TEAM_CHALLENGE_PAYMENTS_ENABLED,
    acceptTeamMatchChallenge,
    payTeamChallengeWithWallet,
    proposeTeamChallengeVenue,
    repairTeamMatchChallenge,
    rejectTeamMatchChallenge,
    type TeamMatchChallenge,
} from "../../src/services/teamMatchService";
import type { Zone } from "../../src/services/convex/zoneService";
import { COLORS } from "../../src/theme";
import { getCanonicalGameLabel } from "../../src/utils/gameLabels";
import { formatTeamChallengeShare } from "../../src/utils/shareContent";
import { getTeamMainRosterSize } from "../../src/constants/teamRosterRules";
import ZonePicker from "../matchrooms/create/components/ZonePicker";
import { formatPakistaniPhone, isValidPakistaniPhone, normalizePakistaniPhone } from "../../src/utils/phoneUtils";
import styles from "./challenge.styles";

const formatGameLabel = (value?: string | null) => {
    const key = String(value || "").trim().toLowerCase();
    if (!key) return "Match";
    return getCanonicalGameLabel(key);
};

const formatStatusLabel = (value?: string | null) =>
    String(value || "pending")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());

const paymentStateLabel = (state?: string | null) => {
    switch (String(state || "unpaid")) {
        case "held": return "Held";
        case "captured": return "Confirmed";
        case "released": return "Returned to wallet";
        case "refunded": return "Refunded";
        case "payment_required": return "Payment required";
        case "failed": return "Failed";
        case "expired": return "Expired";
        default: return "Unpaid";
    }
};

const getEasypaisaStatus = (value: any) => String(value?.status || "").trim().toLowerCase();
const isEasypaisaPaid = (value: any) => getEasypaisaStatus(value) === "paid";
const isEasypaisaStopped = (value: any) => ["failed", "cancelled", "expired"].includes(getEasypaisaStatus(value));

export default function TeamMatchChallengeDetails() {
    const params = useLocalSearchParams<{ id?: string | string[] }>();
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { showToast } = useToast();
    const challengeId = Array.isArray(params.id) ? params.id[0] : params.id;
    const startCheckout = useAction((api as any).easypaisa.startCheckout);
    const syncCheckoutStatus = useAction((api as any).easypaisa.syncTransactionStatus);

    const [submitting, setSubmitting] = useState(false);
    const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
    const [selectedLineup, setSelectedLineup] = useState<string[]>([]);

    const [easypaisaModalVisible, setEasypaisaModalVisible] = useState(false);
    const [easypaisaCheckoutPhone, setEasypaisaCheckoutPhone] = useState("");
    const [startingEasypaisa, setStartingEasypaisa] = useState(false);
    const [finishingEasypaisa, setFinishingEasypaisa] = useState(false);
    const [activeEasypaisaOrderRef, setActiveEasypaisaOrderRef] = useState<string | null>(null);
    const [easypaisaPay, setEasypaisaPay] = useState<{
        side: "teamA" | "teamB";
        amount: number;
    } | null>(null);
    const resumedOrderRef = useRef<string | null>(null);

    const checkoutStatus = useQuery(
        api.easypaisa.getCheckoutStatus,
        user?._id && activeEasypaisaOrderRef
            ? { userId: user._id as Id<"users">, orderRefNum: activeEasypaisaOrderRef }
            : "skip",
    );
    const challenge = useQuery(
        api.teamChallenges.getById,
        challengeId && user?._id
            ? {
                challengeId: challengeId as Id<"teamChallenges">,
                actorUid: user._id as Id<"users">,
            }
            : "skip",
    ) as TeamMatchChallenge | null | undefined;
    const loading = authLoading || (!!challengeId && !!user?._id && challenge === undefined);

    const opponentTeamWithMembers = useQuery(
        api.teams.getWithMembers,
        challenge?.opponentTeamId && user?._id && challenge.captainBUid === user._id
            ? { teamId: challenge.opponentTeamId as Id<"teams"> }
            : "skip",
    );

    const paymentSummary = useQuery(
        api.teamChallenges.getChallengePaymentSummary,
        challengeId && user?._id
            ? { challengeId: challengeId as Id<"teamChallenges">, actorUid: user._id as Id<"users"> }
            : "skip",
    ) as any;

    useEffect(() => {
        if (!challengeId || !user?._id) return;
        void repairTeamMatchChallenge(challengeId);
    }, [challengeId, user?._id]);

    const isCaptain = useMemo(() => {
        if (!challenge || !user?._id) return false;
        return challenge.captainAUid === user._id || challenge.captainBUid === user._id;
    }, [challenge, user?._id]);
    const isCaptainA = useMemo(() => !!challenge && challenge.captainAUid === user?._id, [challenge, user?._id]);
    const isCaptainB = useMemo(() => !!challenge && challenge.captainBUid === user?._id, [challenge, user?._id]);

    const normalizedStatus = String(challenge?.status || "").trim().toLowerCase();
    const normalizedAdminReviewStatus = String(challenge?.adminReviewStatus || "").trim().toLowerCase();
    const isAdminPending = normalizedStatus === "admin_pending" || normalizedAdminReviewStatus === "pending";
    const isPending = normalizedStatus === "pending";
    const isRejected = normalizedStatus === "rejected";
    const isAcceptedFlow = !!challenge && ["accepted", "venue_proposed", "venue_confirmed", "admin_pending", "completed"].includes(normalizedStatus);

    const myChoice = useMemo(() => {
        if (!challenge || !user?._id) return null;
        return challenge.captainVenueChoices?.[user._id] || null;
    }, [challenge, user?._id]);

    const bothConfirmed = useMemo(() => !!challenge?.matchroomId && !!challenge?.confirmedVenue, [challenge]);
    const proposalFromA = challenge?.proposedVenueByCaptainA || null;
    const alternativeFromB = challenge?.alternativeVenueByCaptainB || null;
    const hasAlternative = !!alternativeFromB?.zoneId;
    const canAcceptNow = !!(isPending && !isAdminPending && isCaptain && ((hasAlternative && isCaptainA) || (!hasAlternative && isCaptainB)));
    const canRejectNow = !!(isPending && !isAdminPending && isCaptain);
    const canProposeVenue = !!(isAcceptedFlow && isCaptain && !challenge?.matchroomId);

    // ---- Captain-paid payment state (server-owned, read via summary) ----
    const mySide: "teamA" | "teamB" | null = isCaptainA ? "teamA" : isCaptainB ? "teamB" : null;
    const isPaidChallenge =
        String(paymentSummary?.paymentMode || (Number(challenge?.pricePerPlayer || 0) > 0 ? "paid" : "free")) === "paid";
    const mySidePaymentState = mySide && paymentSummary ? String(paymentSummary[mySide]?.state || "unpaid") : "unpaid";
    const myAmountDue = Number(paymentSummary?.amountDuePerCaptain || 0);
    const challengeActiveForPay = !!challenge && !["rejected", "expired", "completed"].includes(normalizedStatus);
    // Team B can only pay after the challenge is accepted; Team A can pay any time
    // the challenge is active.
    const mySideCanPayNow = mySide === "teamA" ? isPending || isAcceptedFlow : isAcceptedFlow;
    const needsMyPayment =
        TEAM_CHALLENGE_PAYMENTS_ENABLED &&
        !!mySide &&
        isPaidChallenge &&
        challengeActiveForPay &&
        mySideCanPayNow &&
        myAmountDue > 0 &&
        ["unpaid", "payment_required", "failed"].includes(mySidePaymentState);

    const opponentMembers = useMemo(() => {
        const members = Array.isArray(opponentTeamWithMembers?.members) ? opponentTeamWithMembers.members : [];
        return members.map((member: any, index: number) => ({
            uid: String(member.odxerId || member.uid || ""),
            username: member.username || "Player",
            rosterRole: member.rosterRole || (index < getTeamMainRosterSize(challenge?.gameKey) ? "main" : "substitute"),
        })).filter((member) => member.uid);
    }, [challenge?.gameKey, opponentTeamWithMembers?.members]);

    const activeLineupSize = useMemo(
        () => getTeamMainRosterSize(challenge?.gameKey),
        [challenge?.gameKey],
    );

    const defaultOpponentLineup = useMemo(() => {
        const main = opponentMembers
            .filter((member) => member.rosterRole === "main")
            .slice(0, activeLineupSize)
            .map((member) => member.uid);
        return main.length > 0 ? main : opponentMembers.slice(0, activeLineupSize).map((member) => member.uid);
    }, [activeLineupSize, opponentMembers]);

    const hasOpponentSubstitutes = opponentMembers.some((member) => member.rosterRole === "substitute");

    useEffect(() => {
        if (!canAcceptNow || !isCaptainB || selectedLineup.length > 0) return;
        setSelectedLineup(defaultOpponentLineup);
    }, [canAcceptNow, defaultOpponentLineup, isCaptainB, selectedLineup.length]);

    const toggleLineupPlayer = (uid: string) => {
        setSelectedLineup((prev) => {
            if (prev.includes(uid)) {
                return prev.filter((item) => item !== uid);
            }
            if (prev.length >= activeLineupSize) {
                showToast({
                    type: "warning",
                    title: "Lineup full",
                    message: `Select exactly ${activeLineupSize} players. Remove one player before adding another.`,
                });
                return prev;
            }
            return [...prev, uid];
        });
    };

    const handleProposeVenue = async () => {
        if (!challengeId || !selectedZone || !isCaptain) return;
        setSubmitting(true);
        const result = await proposeTeamChallengeVenue({
            challengeId,
            zoneId: selectedZone.id,
            venueName: selectedZone.venueBrandName,
            areaLabel: selectedZone.primaryBranch?.areaLabel || null,
        });
        setSubmitting(false);
        if (!result.ok) {
            showToast({ type: "error", title: "Proposal failed", message: result.message || "Failed to save venue choice." });
            return;
        }
        if ((result as any)?.matchroomId) {
            showToast({ type: "success", title: "Confirmed", message: "Both captains selected the same venue. Matchroom created." });
            router.push(`/matchrooms/${(result as any).matchroomId}` as any);
        } else {
            showToast({ type: "success", title: "Saved", message: "Venue proposal saved. Waiting for other captain." });
        }
    };

    const handleAcceptChallenge = async () => {
        if (!challengeId || !isPending) return;
        const lineupForAccept: string[] | undefined = isCaptainB
            ? (selectedLineup.length > 0 ? selectedLineup : defaultOpponentLineup)
            : undefined;
        if (isCaptainB && hasOpponentSubstitutes && (lineupForAccept?.length || 0) !== activeLineupSize) {
            showToast({
                type: "warning",
                title: "Lineup required",
                message: `Select exactly ${activeLineupSize} players before accepting.`,
            });
            return;
        }
        setSubmitting(true);
        // Accept first. Payment is a separate, explicit captain step (the server
        // requires Team B to be accepted before it can pay/hold). Captains pay via
        // the "Pay your team" section below.
        const result = await acceptTeamMatchChallenge({ challengeId, lineupB: lineupForAccept });
        setSubmitting(false);
        if (!result.ok) {
            showToast({ type: "error", title: "Accept failed", message: result.message || "Failed to accept challenge." });
            return;
        }
        if (TEAM_CHALLENGE_PAYMENTS_ENABLED && isPaidChallenge) {
            showToast({ type: "success", title: "Accepted", message: "Challenge accepted. Pay your team's amount to confirm." });
            return;
        }
        showToast({ type: "success", title: "Accepted", message: "Challenge accepted. Continue with venue confirmation." });
    };

    const handlePayMyTeamWallet = async () => {
        if (!challengeId || !mySide) return;
        setSubmitting(true);
        const res = await payTeamChallengeWithWallet({ challengeId });
        setSubmitting(false);
        if (!res.ok) {
            showToast({ type: "error", title: "Payment failed", message: res.message || "Unable to pay from wallet." });
            return;
        }
        showToast({
            type: "success",
            title: "Payment held",
            message: "Your team's payment is held. It is charged only once the challenge is confirmed, and returned to your wallet if it is cancelled or expires.",
        });
    };

    const handlePayMyTeamEasypaisa = () => {
        if (!mySide || myAmountDue <= 0) return;
        setEasypaisaPay({ side: mySide, amount: myAmountDue });
        setEasypaisaCheckoutPhone(formatPakistaniPhone(String(user?.phone || "")));
        setEasypaisaModalVisible(true);
    };

    const handleStoppedEasypaisaPayment = React.useCallback((statusLike: any) => {
        const status = getEasypaisaStatus(statusLike);
        setActiveEasypaisaOrderRef(null);
        resumedOrderRef.current = null;
        showToast({
            type: status === "expired" ? "warning" : "error",
            title: status === "expired" ? "Payment expired" : "Payment failed",
            message: status === "expired"
                ? "This Easypaisa payment expired before confirmation."
                : "Easypaisa did not confirm this payment.",
        });
    }, [showToast]);

    const finishAfterEasypaisaPayment = React.useCallback(async (orderRefNum: string) => {
        if (!easypaisaPay || !challengeId) return;
        if (resumedOrderRef.current === orderRefNum) return;
        resumedOrderRef.current = orderRefNum;
        setFinishingEasypaisa(true);
        try {
            // The captain's escrow hold is placed SERVER-SIDE by the provider flow
            // (applyProviderUpdate -> holdSideFromProvider) once Easypaisa confirms
            // payment. There is nothing more to charge here — just close the modal;
            // the challenge/payment-summary queries refresh reactively.
            setEasypaisaModalVisible(false);
            setEasypaisaPay(null);
            setActiveEasypaisaOrderRef(null);
            showToast({
                type: "success",
                title: "Payment held",
                message: "Your Easypaisa payment is held for your team.",
            });
        } finally {
            setFinishingEasypaisa(false);
        }
    }, [challengeId, easypaisaPay, showToast]);

    const refreshEasypaisaPaymentStatus = React.useCallback(async (orderRefNum: string) => {
        if (!user?._id || !orderRefNum) return;
        try {
            const result = await syncCheckoutStatus({ orderRefNum, userId: user._id as Id<"users"> } as any);
            if (isEasypaisaPaid(result)) {
                await finishAfterEasypaisaPayment(orderRefNum);
                return;
            }
            if (isEasypaisaStopped(result)) {
                handleStoppedEasypaisaPayment(result);
            }
        } catch {
            // Keep polling; transient gateway inquiry errors should not strand the modal.
        }
    }, [finishAfterEasypaisaPayment, handleStoppedEasypaisaPayment, syncCheckoutStatus, user?._id]);

    const handleStartEasypaisaTopup = async () => {
        if (!user?._id || !easypaisaPay || !challengeId) return;
        const amount = Math.max(0, Math.ceil(Number(easypaisaPay.amount || 0)));
        if (amount <= 0) return;
        if (!isValidPakistaniPhone(easypaisaCheckoutPhone)) {
            showToast({ type: "warning", title: "Invalid number", message: "Enter a valid Pakistani mobile number for Easypaisa." });
            return;
        }

        setStartingEasypaisa(true);
        try {
            const normalized = normalizePakistaniPhone(easypaisaCheckoutPhone);
            // Carry the team-challenge hold context so the backend, on confirmed
            // payment, tops up the wallet AND moves it into the captain's team
            // escrow hold (see applyProviderUpdate -> holdSideFromProvider).
            const teamChallengeHold = {
                challengeId,
                side: easypaisaPay.side,
                captainUid: String(user._id),
                amount,
            };
            let checkout: any;
            try {
                checkout = await startCheckout({
                    kind: "wallet_topup",
                    amount,
                    userId: user._id as Id<"users">,
                    phone: normalized.phoneE164 || easypaisaCheckoutPhone,
                    transactionType: "MA",
                    teamChallengeHold,
                });
            } catch (error: any) {
                const message = String(error?.message || error || "");
                if (!/ACCOUNT DOES N[O']?T? EXIST/i.test(message) && !/ACCOUNT DOES NO EXIST/i.test(message)) {
                    throw error;
                }
                checkout = await startCheckout({
                    kind: "wallet_topup",
                    amount,
                    userId: user._id as Id<"users">,
                    phone: normalized.phoneE164 || easypaisaCheckoutPhone,
                    transactionType: "OTC",
                    teamChallengeHold,
                });
            }

            const orderRefNum = String(checkout.orderRefNum || "");
            setActiveEasypaisaOrderRef(orderRefNum || null);
            const paidImmediately = isEasypaisaPaid(checkout);
            const attemptMessage = String(checkout.attemptMessage || "Starting a new payment attempt.");
            showToast({
                type: paidImmediately ? "success" : "info",
                title: paidImmediately ? "Payment confirmed" : "Payment started",
                message: paidImmediately
                    ? "Payment received. Accepting the challenge now."
                    : checkout.transactionType === "OTC"
                    ? `${attemptMessage} Use token ${checkout.paymentToken || "generated by Easypaisa"} before it expires.`
                    : `${attemptMessage} Approve the payment in Easypaisa. MatchHai will keep checking the status.`,
            });
            if (paidImmediately && orderRefNum) {
                await finishAfterEasypaisaPayment(orderRefNum);
                return;
            }
            if (orderRefNum) {
                setTimeout(() => {
                    void refreshEasypaisaPaymentStatus(orderRefNum);
                }, 1200);
            }
        } catch (error: any) {
            showToast({ type: "error", title: "Payment failed", message: error?.message || "Could not start the Easypaisa payment." });
        } finally {
            setStartingEasypaisa(false);
        }
    };

    useEffect(() => {
        if (!activeEasypaisaOrderRef || !checkoutStatus || !easypaisaPay || !challengeId) return;
        if (isEasypaisaPaid(checkoutStatus)) {
            void finishAfterEasypaisaPayment(activeEasypaisaOrderRef);
            return;
        }
        if (isEasypaisaStopped(checkoutStatus)) {
            handleStoppedEasypaisaPayment(checkoutStatus);
        }
    }, [activeEasypaisaOrderRef, checkoutStatus, challengeId, finishAfterEasypaisaPayment, handleStoppedEasypaisaPayment, easypaisaPay]);

    useEffect(() => {
        if (!activeEasypaisaOrderRef || !user?._id) return;
        const timer = setInterval(() => {
            void refreshEasypaisaPaymentStatus(activeEasypaisaOrderRef);
        }, 2000);
        return () => clearInterval(timer);
    }, [activeEasypaisaOrderRef, refreshEasypaisaPaymentStatus, user?._id]);

    useEffect(() => {
        if (!activeEasypaisaOrderRef) return;
        const subscription = AppState.addEventListener("change", (state) => {
            if (state === "active") {
                void refreshEasypaisaPaymentStatus(activeEasypaisaOrderRef);
            }
        });
        return () => subscription.remove();
    }, [activeEasypaisaOrderRef, refreshEasypaisaPaymentStatus]);

    const easypaisaStatusMessage = activeEasypaisaOrderRef
        ? finishingEasypaisa || isEasypaisaPaid(checkoutStatus)
            ? "Payment confirmed. Holding your team's payment..."
            : "Waiting for payment confirmation..."
        : null;

    const handleRejectChallenge = async () => {
        if (!challengeId || !isPending) return;
        setSubmitting(true);
        const result = await rejectTeamMatchChallenge({ challengeId });
        setSubmitting(false);
        if (!result.ok) {
            showToast({ type: "error", title: "Reject failed", message: result.message || "Failed to reject challenge." });
            return;
        }
        showToast({ type: "success", title: "Rejected", message: "Challenge has been rejected." });
    };

    const handleOpenChat = () => {
        if (!challenge) return;
        if (!challenge.chatId) {
            showToast({ type: "warning", title: "Chat locked", message: "Chat becomes active after challenge acceptance." });
            return;
        }
        router.push(`/teams/challenge-chat?id=${challenge.id}` as any);
    };

    // Captain-to-captain share. The challenge route is captain-only (getById
    // returns null to anyone else), so a forwarded link only opens for the two
    // captains; everyone else sees a safe "unavailable" state. Copy carries no
    // payment/wallet/chat details.
    const handleShareChallenge = async () => {
        if (!challenge) return;
        try {
            const message = formatTeamChallengeShare({
                id: String(challenge.id || challengeId),
                teamAName: challenge.challengerTeamName,
                teamBName: challenge.opponentTeamName,
                game: challenge.gameKey,
                scheduledDate: challenge.scheduledDate,
                scheduledTime: challenge.scheduledTime,
                venue:
                    (challenge as any).venueName ||
                    (challenge as any).confirmedVenueName ||
                    undefined,
            });
            await Share.share({ message });
        } catch {
            // ignore
        }
    };

    if (loading) {
        return (
            <Screen style={styles.screen} scroll={false}>
                <View style={styles.loaderWrap}>
                    <ActivityIndicator color={COLORS.accent} />
                </View>
            </Screen>
        );
    }

    if (!challenge) {
        return (
            <Screen style={styles.screen} scroll={false}>
                <AppHeader title="Team Challenge" onBack={() => router.back()} inlineTitle />
                <View style={styles.loaderWrap}>
                    <Text style={styles.emptyText}>Challenge not found.</Text>
                </View>
            </Screen>
        );
    }

    const choices = challenge.captainVenueChoices || {};
    const captainAChoice = choices[challenge.captainAUid];
    const captainBChoice = choices[challenge.captainBUid];
    const showNoCommonHint = (challenge.commonAreas || []).length === 0;
    const statusLabel = formatStatusLabel(challenge.status);
    const gameLabel = formatGameLabel(challenge.gameKey);

    return (
        <Screen style={styles.screen} scroll={false}>
            <AppHeader
                title="Team Challenge"
                onBack={() => router.back()}
                inlineTitle
                rightAction={(
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        {isCaptain && (
                            <Pressable
                                onPress={() => void handleShareChallenge()}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                accessibilityRole="button"
                                accessibilityLabel="Share challenge"
                            >
                                <AppIcon name="share" size={18} color={COLORS.accent} />
                            </Pressable>
                        )}
                        <Pressable
                            onPress={handleOpenChat}
                            style={({ pressed }) => [
                                styles.chatButton,
                                !challenge.chatId && styles.chatButtonDisabled,
                                pressed && styles.chatButtonPressed,
                            ]}
                        >
                            <AppIcon
                                name="chat-bubble-outline"
                                size={18}
                                color={challenge.chatId ? COLORS.accent : COLORS.muted}
                            />
                        </Pressable>
                    </View>
                )}
            />
            <AppDialog
                visible={easypaisaModalVisible}
                onClose={() => !startingEasypaisa && !finishingEasypaisa && setEasypaisaModalVisible(false)}
                dismissDisabled={startingEasypaisa || finishingEasypaisa}
                keyboardAware={true}
            >
                <AppModalHeader
                    title="Confirm Easypaisa Number"
                    subtitle={`Pay PKR ${Math.max(0, Math.ceil(Number(easypaisaPay?.amount || 0)))} — your team's payment will be held until the challenge is confirmed.`}
                    onClose={() => !startingEasypaisa && !finishingEasypaisa && setEasypaisaModalVisible(false)}
                    closeDisabled={startingEasypaisa || finishingEasypaisa}
                />
                <AppModalBody scroll>
                    <Text style={{ color: COLORS.textSecondary, marginBottom: 10 }}>
                        Mobile Account Number
                    </Text>
                    <TextInput
                        style={{
                            backgroundColor: COLORS.inputBackground,
                            borderRadius: 14,
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            color: COLORS.text,
                            borderWidth: 1,
                            borderColor: COLORS.cardBorder,
                        }}
                        keyboardType="phone-pad"
                        value={easypaisaCheckoutPhone}
                        onChangeText={(value) => setEasypaisaCheckoutPhone(formatPakistaniPhone(value))}
                        placeholder="03XX XXX XXXX"
                        placeholderTextColor={COLORS.textSecondary}
                        editable={!startingEasypaisa && !finishingEasypaisa && !activeEasypaisaOrderRef}
                    />
                    {easypaisaStatusMessage ? (
                        <Text style={{ color: COLORS.warning, marginTop: 12 }}>
                            {easypaisaStatusMessage}
                        </Text>
                    ) : null}
                </AppModalBody>
                <AppModalFooter>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                        {activeEasypaisaOrderRef ? (
                            <>
                                <AppButton
                                    variant="secondary"
                                    style={{ flex: 1 }}
                                    onPress={() => setEasypaisaModalVisible(false)}
                                >
                                    Do this later
                                </AppButton>
                                <AppButton
                                    style={{ flex: 1 }}
                                    onPress={() => refreshEasypaisaPaymentStatus(activeEasypaisaOrderRef)}
                                    loading={finishingEasypaisa}
                                    disabled={startingEasypaisa || finishingEasypaisa}
                                >
                                    I've paid / Continue
                                </AppButton>
                            </>
                        ) : (
                            <>
                                <AppButton
                                    variant="secondary"
                                    style={{ flex: 1 }}
                                    onPress={() => setEasypaisaModalVisible(false)}
                                    disabled={startingEasypaisa || finishingEasypaisa}
                                >
                                    Cancel
                                </AppButton>
                                <AppButton
                                    style={{ flex: 1 }}
                                    onPress={handleStartEasypaisaTopup}
                                    loading={startingEasypaisa || finishingEasypaisa}
                                    disabled={startingEasypaisa || finishingEasypaisa}
                                >
                                    Continue to Pay
                                </AppButton>
                            </>
                        )}
                    </View>
                </AppModalFooter>
            </AppDialog>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <DetailSectionCard
                    title={`${challenge.challengerTeamName} vs ${challenge.opponentTeamName}`}
                    subtitle={`Game: ${gameLabel}`}
                    accessory={
                        <StatusPill
                            tone={
                                isRejected
                                    ? "danger"
                                    : isAdminPending
                                        ? "warning"
                                        : isAcceptedFlow
                                            ? "success"
                                            : "info"
                            }
                            label={statusLabel}
                        />
                    }
                >
                    <View style={styles.statusRow}>
                        {isAdminPending ? (
                            <View style={styles.pendingBadge}>
                                <Text style={styles.pendingBadgeText}>Admin Pending</Text>
                            </View>
                        ) : null}
                    </View>
                    <Text style={styles.meta}>Series: {String(challenge.seriesType || "BO1").toUpperCase()}</Text>
                    <Text style={styles.meta}>Date: {challenge.scheduledDate || "TBD"}</Text>
                    <Text style={styles.meta}>Time: {challenge.scheduledTime || "TBD"}</Text>
                    <Text style={styles.meta}>Price per player: {challenge.pricePerPlayer ? `PKR ${challenge.pricePerPlayer}` : "TBD"}</Text>
                    {challenge.zoneRateLabel ? <Text style={styles.meta}>Resource type: {challenge.zoneRateLabel}</Text> : null}
                    <Text style={styles.meta}>Team A payment: {paymentStateLabel(paymentSummary?.teamA?.state)}</Text>
                    <Text style={styles.meta}>Team B payment: {paymentStateLabel(paymentSummary?.teamB?.state)}</Text>
                    <Text style={styles.meta}>Team A proposed venue: {proposalFromA?.venueName || "Not selected"}</Text>
                    {proposalFromA?.areaLabel ? <Text style={styles.meta}>Area: {proposalFromA.areaLabel}</Text> : null}
                    {alternativeFromB?.venueName ? (
                        <Text style={styles.meta}>Team B alternative: {alternativeFromB.venueName}{alternativeFromB.areaLabel ? ` (${alternativeFromB.areaLabel})` : ""}</Text>
                    ) : null}
                </DetailSectionCard>

                {TEAM_CHALLENGE_PAYMENTS_ENABLED && isPaidChallenge && isCaptain ? (
                    <DetailSectionCard
                        title="Team Payment"
                        subtitle="Captain pays for the full team"
                        accessory={
                            <StatusPill
                                tone={mySidePaymentState === "held" || mySidePaymentState === "captured" ? "success" : "info"}
                                label={paymentStateLabel(mySidePaymentState)}
                            />
                        }
                    >
                        <Text style={styles.meta}>Your team amount: PKR {myAmountDue}</Text>
                        <Text style={styles.meta}>Team A: {paymentStateLabel(paymentSummary?.teamA?.state)}</Text>
                        <Text style={styles.meta}>Team B: {paymentStateLabel(paymentSummary?.teamB?.state)}</Text>
                        {needsMyPayment ? (
                            <>
                                <Text style={[styles.meta, { marginTop: 6 }]}>
                                    Your team&apos;s payment is held until the challenge is confirmed, and returned to your MatchHai wallet if it is cancelled or expires.
                                </Text>
                                <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                                    <AppButton
                                        style={{ flex: 1 }}
                                        onPress={handlePayMyTeamWallet}
                                        loading={submitting}
                                        disabled={submitting}
                                    >
                                        Pay with Wallet
                                    </AppButton>
                                    <AppButton
                                        variant="secondary"
                                        style={{ flex: 1 }}
                                        onPress={handlePayMyTeamEasypaisa}
                                        disabled={submitting}
                                    >
                                        Pay with Easypaisa
                                    </AppButton>
                                </View>
                            </>
                        ) : mySidePaymentState === "held" ? (
                            <Text style={[styles.meta, { marginTop: 6 }]}>Your team&apos;s payment is held.</Text>
                        ) : mySidePaymentState === "captured" ? (
                            <Text style={[styles.meta, { marginTop: 6 }]}>Your team&apos;s payment is confirmed.</Text>
                        ) : mySide === "teamB" && !isAcceptedFlow ? (
                            <Text style={[styles.meta, { marginTop: 6 }]}>Accept the challenge to pay your team&apos;s amount.</Text>
                        ) : null}
                    </DetailSectionCard>
                ) : null}

                {isAdminPending && (
                    <DetailSectionCard
                        title="Admin Review Pending"
                        accessory={<StatusPill tone="warning" label="Pending" />}
                    >
                        <Text style={styles.meta}>
                            Challenge has moved to admin review. Captain actions are locked until venue review is completed.
                        </Text>
                    </DetailSectionCard>
                )}

                {isPending && !isAdminPending && (
                    <DetailSectionCard
                        title="Pending Decision"
                        subtitle="Captain action required"
                    >
                        <Text style={styles.meta}>
                            {!isCaptain
                                ? "Waiting for the responding captain."
                                : canAcceptNow
                                    ? "Review this challenge and choose accept or reject."
                                    : hasAlternative
                                        ? "Waiting for Captain A to accept Team B's alternative venue."
                                        : "Waiting for challenged captain to accept, or reject if needed."}
                        </Text>
                        {canAcceptNow && isCaptainB && hasOpponentSubstitutes ? (
                            <View style={styles.lineupPanel}>
                                <Text style={styles.lineupTitle}>
                                    Active lineup ({selectedLineup.length}/{activeLineupSize})
                                </Text>
                                <Text style={styles.meta}>
                                    Main players are selected by default. Swap in a substitute if needed before accepting.
                                </Text>
                                <View style={styles.lineupGrid}>
                                    {opponentMembers.map((member) => {
                                        const selected = selectedLineup.includes(member.uid);
                                        const isSub = member.rosterRole === "substitute";
                                        return (
                                            <Pressable
                                                key={member.uid}
                                                onPress={() => toggleLineupPlayer(member.uid)}
                                                style={({ pressed }) => [
                                                    styles.lineupChip,
                                                    selected && styles.lineupChipSelected,
                                                    isSub && styles.lineupChipSub,
                                                    pressed && styles.chatButtonPressed,
                                                ]}
                                            >
                                                <Text style={[styles.lineupChipText, selected && styles.lineupChipTextSelected]}>
                                                    {member.username}
                                                </Text>
                                                {isSub ? <Text style={styles.lineupSubText}>SUB</Text> : null}
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </View>
                        ) : null}
                        <AppButton
                            onPress={handleAcceptChallenge}
                            disabled={!canAcceptNow || submitting}
                            size="md"
                            style={styles.challengeActionButton}
                        >
                            {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Accept Challenge</Text>}
                        </AppButton>
                        <AppButton
                            variant="danger"
                            onPress={handleRejectChallenge}
                            disabled={!canRejectNow || submitting}
                            size="md"
                            style={styles.challengeActionButton}
                        >
                            <Text style={styles.rejectButtonText}>Reject Challenge</Text>
                        </AppButton>
                    </DetailSectionCard>
                )}

                {isRejected && (
                    <DetailSectionCard title="Challenge Closed">
                        <View style={styles.rejectedBanner}>
                            <AppIcon name="cancel" size={18} color={COLORS.error} />
                            <Text style={styles.rejectedText}>Challenge has been rejected.</Text>
                        </View>
                    </DetailSectionCard>
                )}

                {isAcceptedFlow && (
                    <>
                        <DetailSectionCard title="Suggested Areas">
                            {showNoCommonHint ? (
                                <Text style={styles.meta}>No suggested areas available.</Text>
                            ) : (
                                <View style={styles.chipsWrap}>
                                    {(challenge.commonAreas || []).map((area) => (
                                        <View key={area} style={styles.chip}>
                                            <Text style={styles.chipText}>{area}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                            <Text style={styles.meta}>These are suggestions based on both teams' preferences. Captains still need to select a specific venue.</Text>
                        </DetailSectionCard>

                        {canProposeVenue && (
                            <DetailSectionCard title="Choose Venue">
                                <ZonePicker
                                    gameKey={challenge.gameKey}
                                    selectedZoneId={selectedZone?.id || myChoice?.zoneId || null}
                                    onZoneSelect={setSelectedZone}
                                    userPreferredAreas={challenge.commonAreas || []}
                                />
                                <Text style={styles.meta}>Your choice: {myChoice?.venueName || "None"}</Text>
                                <Text style={styles.meta}>Captain A choice: {captainAChoice?.venueName || "None"}</Text>
                                <Text style={styles.meta}>Captain B choice: {captainBChoice?.venueName || "None"}</Text>
                                <AppButton
                                    onPress={handleProposeVenue}
                                    disabled={!selectedZone || submitting || bothConfirmed}
                                    size="md"
                                    style={styles.challengeActionButton}
                                >
                                    {submitting ? (
                                        <ActivityIndicator color="#FFF" />
                                    ) : (
                                        <Text style={styles.primaryButtonText}>
                                            {bothConfirmed ? "Venue Confirmed" : "Propose / Confirm Venue"}
                                        </Text>
                                    )}
                                </AppButton>
                            </DetailSectionCard>
                        )}

                        {!isCaptain && (
                            <DetailSectionCard title="Captain Restriction">
                                <Text style={styles.meta}>Only captains can propose and confirm venue.</Text>
                            </DetailSectionCard>
                        )}
                    </>
                )}
            </ScrollView>
        </Screen>
    );
}

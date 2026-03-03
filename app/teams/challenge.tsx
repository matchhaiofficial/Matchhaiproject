import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";

import AppHeader from "../../src/components/AppHeader";
import Screen from "../../src/components/Screen";
import { useAuth } from "../../src/context/AuthContext";
import {
    acceptTeamMatchChallenge,
    getTeamMatchChallengeById,
    proposeTeamChallengeVenue,
    repairTeamMatchChallenge,
    rejectTeamMatchChallenge,
    subscribeTeamMatchChallenge,
    type TeamMatchChallenge,
} from "../../src/services/teamMatchService";
import type { Zone } from "../../src/services/convex/zoneService";
import { COLORS } from "../../src/theme";
import ZonePicker from "../matchrooms/create/components/ZonePicker";
import styles from "./challenge.styles";

const GAME_LABELS: Record<string, string> = {
    cs2: "CS2",
    fc26: "FC26",
    fc25: "FC25",
    tekken8: "Tekken 8",
    futsal: "Futsal",
    indoor_cricket: "Indoor Cricket",
    padel: "Padel",
    pickleball: "Pickleball",
};

const formatGameLabel = (value?: string | null) => {
    const key = String(value || "").trim().toLowerCase();
    if (!key) return "Match";
    return GAME_LABELS[key] || key.toUpperCase();
};

const formatStatusLabel = (value?: string | null) =>
    String(value || "pending")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function TeamMatchChallengeDetails() {
    const params = useLocalSearchParams<{ id?: string | string[] }>();
    const router = useRouter();
    const { user } = useAuth();
    const challengeId = Array.isArray(params.id) ? params.id[0] : params.id;

    const [challenge, setChallenge] = useState<TeamMatchChallenge | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [selectedZone, setSelectedZone] = useState<Zone | null>(null);

    useEffect(() => {
        if (!challengeId) return;
        let mounted = true;
        repairTeamMatchChallenge(challengeId).finally(() => {
            getTeamMatchChallengeById(challengeId).then((result) => {
                if (!mounted) return;
                if (!result.ok || !result.data) {
                    Alert.alert("Not found", result.message || "Challenge not found.");
                    router.back();
                    return;
                }
                setChallenge(result.data);
                setLoading(false);
            });
        });

        const unsub = subscribeTeamMatchChallenge(challengeId, (data) => {
            if (!mounted) return;
            if (!data) {
                setChallenge(null);
                setLoading(false);
                return;
            }
            setChallenge(data);
            setLoading(false);
        });

        return () => {
            mounted = false;
            unsub();
        };
    }, [challengeId, router]);

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
            Alert.alert("Proposal failed", result.message || "Failed to save venue choice.");
            return;
        }
        if ((result as any)?.matchroomId) {
            Alert.alert("Confirmed", "Both captains selected the same venue. Matchroom created.");
            router.push(`/matchrooms/${(result as any).matchroomId}` as any);
        } else {
            Alert.alert("Saved", "Venue proposal saved. Waiting for other captain.");
        }
    };

    const handleAcceptChallenge = async () => {
        if (!challengeId || !isPending) return;
        setSubmitting(true);
        const result = await acceptTeamMatchChallenge({ challengeId });
        setSubmitting(false);
        if (!result.ok) {
            if ((result.message || "").toLowerCase().includes("resolved")) {
                const latest = await getTeamMatchChallengeById(challengeId);
                if (latest.ok && latest.data) setChallenge(latest.data);
            }
            Alert.alert("Accept failed", result.message || "Failed to accept challenge.");
            return;
        }
        if ((result as any).matchroomId) {
            Alert.alert("Accepted", "Challenge accepted and matchroom created.");
            router.push(`/matchrooms/${(result as any).matchroomId}` as any);
            return;
        }
        Alert.alert("Accepted", "Challenge accepted. Continue with venue confirmation.");
    };

    const handleRejectChallenge = async () => {
        if (!challengeId || !isPending) return;
        setSubmitting(true);
        const result = await rejectTeamMatchChallenge({ challengeId });
        setSubmitting(false);
        if (!result.ok) {
            if ((result.message || "").toLowerCase().includes("resolved")) {
                const latest = await getTeamMatchChallengeById(challengeId);
                if (latest.ok && latest.data) setChallenge(latest.data);
            }
            Alert.alert("Reject failed", result.message || "Failed to reject challenge.");
            return;
        }
        Alert.alert("Rejected", "Challenge has been rejected.");
    };

    const handleOpenChat = () => {
        if (!challenge) return;
        if (!challenge.chatId) {
            Alert.alert("Chat locked", "Chat becomes active after challenge acceptance.");
            return;
        }
        router.push(`/teams/challenge-chat?id=${challenge.id}` as any);
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
                    <Pressable
                        onPress={handleOpenChat}
                        style={({ pressed }) => [
                            styles.chatButton,
                            !challenge.chatId && styles.chatButtonDisabled,
                            pressed && styles.chatButtonPressed,
                        ]}
                    >
                        <MaterialIcons
                            name="chat-bubble-outline"
                            size={18}
                            color={challenge.chatId ? COLORS.accent : COLORS.muted}
                        />
                    </Pressable>
                )}
            />
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.card}>
                    <Text style={styles.title}>{challenge.challengerTeamName} vs {challenge.opponentTeamName}</Text>
                    <Text style={styles.meta}>Game: {gameLabel}</Text>
                    <View style={styles.statusRow}>
                        <Text style={styles.meta}>Status: {statusLabel}</Text>
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
                    <Text style={styles.meta}>Team A proposed venue: {proposalFromA?.venueName || "Not selected"}</Text>
                    {proposalFromA?.areaLabel ? <Text style={styles.meta}>Area: {proposalFromA.areaLabel}</Text> : null}
                    {alternativeFromB?.venueName ? (
                        <Text style={styles.meta}>Team B alternative: {alternativeFromB.venueName}{alternativeFromB.areaLabel ? ` (${alternativeFromB.areaLabel})` : ""}</Text>
                    ) : null}
                </View>

                {isAdminPending && (
                    <View style={styles.card}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Admin Review Pending</Text>
                            <View style={styles.pendingBadge}>
                                <Text style={styles.pendingBadgeText}>Pending</Text>
                            </View>
                        </View>
                        <Text style={styles.meta}>
                            Challenge has moved to admin review. Captain actions are locked until venue review is completed.
                        </Text>
                    </View>
                )}

                {isPending && !isAdminPending && (
                    <View style={styles.card}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Pending Decision</Text>
                            <Text style={styles.meta}>Captain action required</Text>
                        </View>
                        <Text style={styles.meta}>
                            {!isCaptain
                                ? "Waiting for the responding captain."
                                : canAcceptNow
                                    ? "Review this challenge and choose accept or reject."
                                    : hasAlternative
                                        ? "Waiting for Captain A to accept Team B's alternative venue."
                                        : "Waiting for challenged captain to accept, or reject if needed."}
                        </Text>
                        <Pressable
                            style={({ pressed }) => [
                                styles.primaryButton,
                                (!canAcceptNow || submitting) && styles.primaryButtonDisabled,
                                pressed && canAcceptNow && !submitting && styles.primaryButtonPressed,
                            ]}
                            onPress={handleAcceptChallenge}
                            disabled={!canAcceptNow || submitting}
                        >
                            {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Accept Challenge</Text>}
                        </Pressable>
                        <Pressable
                            style={({ pressed }) => [
                                styles.rejectButton,
                                (!canRejectNow || submitting) && styles.primaryButtonDisabled,
                                pressed && canRejectNow && !submitting && styles.primaryButtonPressed,
                            ]}
                            onPress={handleRejectChallenge}
                            disabled={!canRejectNow || submitting}
                        >
                            <Text style={styles.rejectButtonText}>Reject Challenge</Text>
                        </Pressable>
                    </View>
                )}

                {isRejected && (
                    <View style={styles.card}>
                        <View style={styles.rejectedBanner}>
                            <MaterialIcons name="cancel" size={18} color={COLORS.error} />
                            <Text style={styles.rejectedText}>Challenge has been rejected.</Text>
                        </View>
                    </View>
                )}

                {isAcceptedFlow && (
                    <>
                        <View style={styles.card}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Common Preferred Areas</Text>
                            </View>
                            {showNoCommonHint ? (
                                <Text style={styles.meta}>No common preferred areas found. Captains can still pick any suitable venue.</Text>
                            ) : (
                                <View style={styles.chipsWrap}>
                                    {(challenge.commonAreas || []).map((area) => (
                                        <View key={area} style={styles.chip}>
                                            <Text style={styles.chipText}>{area}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>

                        {canProposeVenue && (
                            <View style={styles.card}>
                                <View style={styles.sectionHeader}>
                                    <Text style={styles.sectionTitle}>Choose Venue</Text>
                                </View>
                                <ZonePicker
                                    gameKey={challenge.gameKey}
                                    selectedZoneId={selectedZone?.id || myChoice?.zoneId || null}
                                    onZoneSelect={setSelectedZone}
                                    userPreferredAreas={challenge.commonAreas || []}
                                />
                                <Text style={styles.meta}>Your choice: {myChoice?.venueName || "None"}</Text>
                                <Text style={styles.meta}>Captain A choice: {captainAChoice?.venueName || "None"}</Text>
                                <Text style={styles.meta}>Captain B choice: {captainBChoice?.venueName || "None"}</Text>
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.primaryButton,
                                        (!selectedZone || submitting || bothConfirmed) && styles.primaryButtonDisabled,
                                        pressed && selectedZone && !submitting && !bothConfirmed && styles.primaryButtonPressed,
                                    ]}
                                    onPress={handleProposeVenue}
                                    disabled={!selectedZone || submitting || bothConfirmed}
                                >
                                    {submitting ? (
                                        <ActivityIndicator color="#FFF" />
                                    ) : (
                                        <Text style={styles.primaryButtonText}>
                                            {bothConfirmed ? "Venue Confirmed" : "Propose / Confirm Venue"}
                                        </Text>
                                    )}
                                </Pressable>
                            </View>
                        )}

                        {!isCaptain && (
                            <View style={styles.card}>
                                <Text style={styles.meta}>Only captains can propose and confirm venue.</Text>
                            </View>
                        )}
                    </>
                )}
            </ScrollView>
        </Screen>
    );
}

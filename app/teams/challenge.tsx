import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TouchableOpacity, View } from "react-native";

import AppHeader from "../../src/components/AppHeader";
import Screen from "../../src/components/Screen";
import { useAuth } from "../../src/context/AuthContext";
import {
    acceptTeamMatchChallenge,
    getTeamMatchChallengeById,
    proposeTeamChallengeVenue,
    repairTeamMatchChallenge,
    rejectTeamMatchChallenge,
    suggestTeamMatchChallengeAlternativeZone,
    subscribeTeamMatchChallenge,
    type TeamMatchChallenge,
} from "../../src/services/teamMatchService";
import type { Zone } from "../../src/services/zoneService";
import { COLORS } from "../../src/theme";
import ZonePicker from "../matchrooms/create/components/ZonePicker";
import styles from "../matchrooms/create/create.styles";

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

        const unsub = subscribeTeamMatchChallenge(
            challengeId,
            (data) => {
                if (!mounted) return;
                if (!data) {
                    setChallenge(null);
                    setLoading(false);
                    return;
                }
                setChallenge(data);
                setLoading(false);
            },
        );

        return () => {
            mounted = false;
            unsub();
        };
    }, [challengeId, router]);

    const isCaptain = useMemo(() => {
        if (!challenge || !user?.uid) return false;
        return challenge.captainAUid === user.uid || challenge.captainBUid === user.uid;
    }, [challenge, user?.uid]);
    const isCaptainA = useMemo(() => !!challenge && challenge.captainAUid === user?.uid, [challenge, user?.uid]);
    const isCaptainB = useMemo(() => !!challenge && challenge.captainBUid === user?.uid, [challenge, user?.uid]);
    const isPending = challenge?.status === "pending";

    const myChoice = useMemo(() => {
        if (!challenge || !user?.uid) return null;
        return challenge.captainVenueChoices?.[user.uid] || null;
    }, [challenge, user?.uid]);

    const bothConfirmed = useMemo(() => !!challenge?.matchroomId && !!challenge?.confirmedVenue, [challenge]);
    const proposalFromA = challenge?.proposedVenueByCaptainA || null;
    const alternativeFromB = challenge?.alternativeVenueByCaptainB || null;
    const canCaptainBAccept = isPending && isCaptainB && !alternativeFromB;
    const canCaptainAAcceptAlternative = isPending && isCaptainA && !!alternativeFromB;
    const canSuggestAlternative = isPending && isCaptainB;

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
            Alert.alert("Accept failed", result.message || "Failed to accept challenge.");
            return;
        }
        if ((result as any).matchroomId) {
            Alert.alert("Accepted", "Challenge accepted and matchroom created.");
            router.push(`/matchrooms/${(result as any).matchroomId}` as any);
            return;
        }
        Alert.alert("Accepted", "Challenge accepted. Continue in captain workspace.");
    };

    const handleRejectChallenge = async () => {
        if (!challengeId || !isPending) return;
        setSubmitting(true);
        const result = await rejectTeamMatchChallenge({ challengeId });
        setSubmitting(false);
        if (!result.ok) {
            Alert.alert("Reject failed", result.message || "Failed to reject challenge.");
            return;
        }
        Alert.alert("Rejected", "Challenge has been declined.");
    };

    const handleSuggestAlternative = async () => {
        if (!challengeId || !selectedZone || !canSuggestAlternative) return;
        setSubmitting(true);
        const result = await suggestTeamMatchChallengeAlternativeZone({
            challengeId,
            zoneId: selectedZone.id,
            venueName: selectedZone.venueBrandName,
            areaLabel: selectedZone.primaryBranch?.areaLabel || null,
        });
        setSubmitting(false);
        if (!result.ok) {
            Alert.alert("Suggestion failed", result.message || "Failed to suggest alternative.");
            return;
        }
        Alert.alert("Submitted", "Alternative zone sent to Team A captain.");
    };

    if (loading) {
        return (
            <Screen style={styles.screen} scroll={false}>
                <View style={styles.centered}>
                    <ActivityIndicator color={COLORS.accent} />
                </View>
            </Screen>
        );
    }

    if (!challenge) {
        return (
            <Screen style={styles.screen} scroll={false}>
                <AppHeader title="Challenge" onBack={() => router.back()} />
                <View style={styles.centered}>
                    <Text style={styles.helperText}>Challenge not found.</Text>
                </View>
            </Screen>
        );
    }

    const choices = challenge.captainVenueChoices || {};
    const captainAChoice = choices[challenge.captainAUid];
    const captainBChoice = choices[challenge.captainBUid];
    const showNoCommonHint = (challenge.commonAreas || []).length === 0;

    return (
        <Screen style={styles.screen} scroll={false}>
            <AppHeader title="Team Challenge" onBack={() => router.back()} inlineTitle />
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.section}>
                    <View style={styles.infoBox}>
                        <Text style={styles.infoBoxText}>{challenge.challengerTeamName} vs {challenge.opponentTeamName}</Text>
                        <Text style={styles.infoBoxSmall}>Game: {String(challenge.gameKey || "").toUpperCase()}</Text>
                        <Text style={styles.infoBoxSmall}>Status: {challenge.status}</Text>
                        <Text style={styles.infoBoxSmall}>Series: {String(challenge.seriesType || "BO1").toUpperCase()}</Text>
                        <Text style={styles.infoBoxSmall}>Date: {challenge.scheduledDate || "TBD"}</Text>
                        <Text style={styles.infoBoxSmall}>Time: {challenge.scheduledTime || "TBD"}</Text>
                        <Text style={styles.infoBoxSmall}>Price per player: {challenge.pricePerPlayer ? `PKR ${challenge.pricePerPlayer}` : "TBD"}</Text>
                        <Text style={styles.infoBoxSmall}>Team A proposed zone: {proposalFromA?.venueName || "Not selected"}</Text>
                    </View>
                    {proposalFromA?.areaLabel ? (
                        <Text style={styles.helperTextTiny}>Proposed area: {proposalFromA.areaLabel}</Text>
                    ) : null}
                    {alternativeFromB ? (
                        <View style={[styles.infoBox, { backgroundColor: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.35)" }]}>
                            <Text style={[styles.infoBoxText, { color: COLORS.successBright }]}>Team B alternative zone</Text>
                            <Text style={styles.infoBoxSmall}>{alternativeFromB.venueName}</Text>
                            {alternativeFromB.areaLabel ? (
                                <Text style={styles.infoBoxSmall}>{alternativeFromB.areaLabel}</Text>
                            ) : null}
                        </View>
                    ) : null}
                    {challenge.matchroomId ? (
                        <Pressable
                            style={({ pressed }) => [
                                styles.optionChip,
                                styles.optionChipActive,
                                { alignSelf: "flex-start", marginTop: 8 },
                                pressed && { opacity: 0.9 },
                            ]}
                            onPress={() => router.push(`/matchrooms/${challenge.matchroomId}` as any)}
                        >
                            <Text style={[styles.optionChipText, styles.optionChipTextActive]}>Open Matchroom</Text>
                        </Pressable>
                    ) : null}
                </View>

                {isPending ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>Pending Decision</Text>
                        {canCaptainBAccept ? (
                            <Text style={styles.helperText}>Team B captain can accept Team A proposal or suggest alternative.</Text>
                        ) : null}
                        {canCaptainAAcceptAlternative ? (
                            <Text style={styles.helperText}>Team A captain can accept Team B alternative zone.</Text>
                        ) : null}
                        {!canCaptainBAccept && !canCaptainAAcceptAlternative ? (
                            <Text style={styles.submitHintText}>Waiting for the other captain to take action.</Text>
                        ) : null}

                        {canSuggestAlternative ? (
                            <>
                                <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Suggest Alternative Zone</Text>
                                <ZonePicker
                                    gameKey={challenge.gameKey}
                                    selectedZoneId={selectedZone?.id || alternativeFromB?.zoneId || null}
                                    onZoneSelect={setSelectedZone}
                                />
                                <View style={{ marginTop: 12 }}>
                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.primaryButton,
                                            (!selectedZone || submitting) && styles.primaryButtonDisabled,
                                            !(!selectedZone || submitting) && { backgroundColor: COLORS.warning },
                                            pressed && selectedZone && !submitting && styles.primaryButtonPressed,
                                        ]}
                                        onPress={handleSuggestAlternative}
                                        disabled={!selectedZone || submitting}
                                    >
                                        {submitting ? (
                                            <ActivityIndicator color="#FFF" />
                                        ) : (
                                            <Text style={[styles.primaryButtonText, { color: COLORS.background }]}>Suggest Alternative</Text>
                                        )}
                                    </Pressable>
                                </View>
                            </>
                        ) : null}

                        {(canCaptainBAccept || canCaptainAAcceptAlternative) ? (
                            <View style={{ marginTop: 12 }}>
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.primaryButton,
                                        submitting && styles.primaryButtonDisabled,
                                        pressed && !submitting && styles.primaryButtonPressed,
                                    ]}
                                    onPress={handleAcceptChallenge}
                                    disabled={submitting}
                                >
                                    {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Accept Challenge</Text>}
                                </Pressable>
                            </View>
                        ) : null}

                        {(isCaptainA || isCaptainB) ? (
                            <View style={{ marginTop: 12 }}>
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.primaryButton,
                                        submitting && styles.primaryButtonDisabled,
                                        !submitting && { backgroundColor: COLORS.error },
                                        pressed && !submitting && styles.primaryButtonPressed,
                                    ]}
                                    onPress={handleRejectChallenge}
                                    disabled={submitting}
                                >
                                    {submitting ? (
                                        <ActivityIndicator color="#FFF" />
                                    ) : (
                                        <Text style={[styles.primaryButtonText, { color: COLORS.text }]}>Reject Challenge</Text>
                                    )}
                                </Pressable>
                            </View>
                        ) : null}
                    </View>
                ) : null}

                {!!challenge.chatId ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>Captains Chat</Text>
                        <TouchableOpacity
                            style={[styles.optionChip, styles.optionChipActive, { alignSelf: "flex-start" }]}
                            onPress={() => router.push(`/teams/challenge-chat?id=${challenge.id}` as any)}
                        >
                            <MaterialIcons name="chat" size={16} color={COLORS.text} style={{ marginRight: 8 }} />
                            <Text style={[styles.optionChipText, styles.optionChipTextActive]}>Open Chat</Text>
                        </TouchableOpacity>
                        <Text style={styles.helperTextTiny}>Captain-only chat opens once challenge is accepted.</Text>
                    </View>
                ) : null}

                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Common Preferred Areas</Text>
                    {showNoCommonHint ? (
                        <Text style={styles.submitHintText}>
                            No common preferred areas found. Discuss in chat and choose any suitable venue.
                        </Text>
                    ) : (
                        <View style={styles.chipRow}>
                            {(challenge.commonAreas || []).map((area) => (
                                <View key={area} style={[styles.optionChip, styles.optionChipActive]}>
                                    <Text style={[styles.optionChipText, styles.optionChipTextActive]}>{area}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                {isCaptain && !challenge.matchroomId && !isPending ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>Choose Venue</Text>
                        <ZonePicker
                            gameKey={challenge.gameKey}
                            selectedZoneId={selectedZone?.id || myChoice?.zoneId || null}
                            onZoneSelect={setSelectedZone}
                            userPreferredAreas={challenge.commonAreas || []}
                        />
                        <Text style={styles.helperTextTiny}>Your choice: {myChoice?.venueName || "None"}</Text>
                        <Text style={styles.helperTextTiny}>Captain A choice: {captainAChoice?.venueName || "None"}</Text>
                        <Text style={styles.helperTextTiny}>Captain B choice: {captainBChoice?.venueName || "None"}</Text>

                        <View style={{ marginTop: 12 }}>
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
                    </View>
                ) : null}

                {!isCaptain ? (
                    <View style={styles.section}>
                        <Text style={styles.submitHintText}>Only captains can propose and confirm venue.</Text>
                    </View>
                ) : null}
            </ScrollView>
        </Screen>
    );
}

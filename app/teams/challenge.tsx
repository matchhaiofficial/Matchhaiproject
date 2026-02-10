import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";

import AppHeader from "../../src/components/AppHeader";
import Screen from "../../src/components/Screen";
import { useAuth } from "../../src/context/AuthContext";
import {
    getTeamMatchChallengeById,
    proposeTeamChallengeVenue,
    subscribeTeamMatchChallenge,
    type TeamMatchChallenge,
} from "../../src/services/teamMatchService";
import type { Zone } from "../../src/services/zoneService";
import { COLORS } from "../../src/theme";
import ZonePicker from "../matchrooms/create/components/ZonePicker";
import styles from "./challenge.styles";

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

    const myChoice = useMemo(() => {
        if (!challenge || !user?.uid) return null;
        return challenge.captainVenueChoices?.[user.uid] || null;
    }, [challenge, user?.uid]);

    const bothConfirmed = useMemo(() => !!challenge?.matchroomId && !!challenge?.confirmedVenue, [challenge]);

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
                <AppHeader title="Challenge" onBack={() => router.back()} />
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

    return (
        <Screen style={styles.screen} scroll={false}>
            <AppHeader title="Team Challenge" onBack={() => router.back()} inlineTitle />
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.card}>
                    <Text style={styles.title}>{challenge.challengerTeamName} vs {challenge.opponentTeamName}</Text>
                    <Text style={styles.meta}>Game: {String(challenge.gameKey || "").toUpperCase()}</Text>
                    <Text style={styles.meta}>Status: {challenge.status}</Text>
                    {challenge.matchroomId ? (
                        <TouchableOpacity
                            style={styles.inlineButton}
                            onPress={() => router.push(`/matchrooms/${challenge.matchroomId}` as any)}
                        >
                            <Text style={styles.inlineButtonText}>Open Matchroom</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>

                <View style={styles.card}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Captains Chat</Text>
                        <TouchableOpacity
                            style={styles.chatButton}
                            onPress={() => router.push(`/teams/challenge-chat?id=${challenge.id}` as any)}
                        >
                            <MaterialIcons name="chat" size={16} color="#FFF" />
                            <Text style={styles.chatButtonText}>Open Chat</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.meta}>
                        This chat is captain-only and created immediately after acceptance.
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Common Preferred Areas</Text>
                    {showNoCommonHint ? (
                        <Text style={styles.warningText}>
                            No common preferred areas found. Discuss in chat and choose any suitable venue.
                        </Text>
                    ) : (
                        <Text style={styles.meta}>
                            {(challenge.commonAreas || []).join(", ")}
                        </Text>
                    )}
                </View>

                {isCaptain ? (
                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>Choose Venue</Text>
                        <ZonePicker
                            gameKey={challenge.gameKey}
                            selectedZoneId={selectedZone?.id || myChoice?.zoneId || null}
                            onZoneSelect={setSelectedZone}
                            userPreferredAreas={challenge.commonAreas || []}
                        />

                        <Text style={styles.meta}>Your choice: {myChoice?.venueName || "None"}</Text>
                        <Text style={styles.meta}>Captain A choice: {captainAChoice?.venueName || "None"}</Text>
                        <Text style={styles.meta}>Captain B choice: {captainBChoice?.venueName || "None"}</Text>

                        <TouchableOpacity
                            style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
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
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.card}>
                        <Text style={styles.warningText}>Only captains can propose and confirm venue.</Text>
                    </View>
                )}
            </ScrollView>
        </Screen>
    );
}

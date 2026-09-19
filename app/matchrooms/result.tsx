// app/matchrooms/result.tsx
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
import AppHeader from '../../src/components/AppHeader';
import { AppIcon } from '../../src/components/AppIcon';
import { GameImageIcon } from '../../src/components/GameImageIcon';
import Screen from '../../src/components/Screen';
import { useAuth } from '../../src/context/AuthContext';
import { getMatchroomById, submitCaptainReport } from '../../src/services/convex/matchService';
import { COLORS } from '../../src/theme';
import Logger from '../../src/utils/logger';
import styles from '../../app-shared/matchrooms/result.styles';

interface MatchData {
    id: string;
    gameKey: string;
    title: string;
    team1Players: { uid: string; name: string }[];
    team2Players: { uid: string; name: string }[];
    team1Captain: string;
    team2Captain: string;
    resultVerification?: any;
}

type ResultPlayer = { uid: string; name: string };

function playersForSlots(room: any, slots: any[]): ResultPlayer[] {
    const playersByUid = new Map(
        (room.players || []).map((player: any) => [String(player.uid), player])
    );
    const resolved = new Map<string, ResultPlayer>();

    for (const slot of slots || []) {
        const uid = String(
            slot?.user?.uid || slot?.uid || slot?.reservedFor?.uid || slot?.reservedForUid || ""
        ).trim();
        if (!uid) continue;

        const player: any = playersByUid.get(uid);
        const name = String(
            player?.username || slot?.user?.username || slot?.reservedFor?.username || "Player"
        ).trim();
        resolved.set(uid, { uid, name: name || "Player" });
    }

    return Array.from(resolved.values());
}

export default function MatchResultSubmission() {
    const params = useLocalSearchParams();
    const matchroomId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [matchData, setMatchData] = useState<MatchData | null>(null);
    const [selectedWinner, setSelectedWinner] = useState<'team1' | 'team2' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const touchDebugEnabled = __DEV__ && process.env.EXPO_PUBLIC_TOUCH_DEBUG === '1';
    const { user } = useAuth();

    const currentUserId = user?._id;

    const loadMatchData = useCallback(async () => {
        if (!matchroomId) return;

        try {
            const res = await getMatchroomById(matchroomId);
            if (!res.ok) {
                setError(res.message || "Failed to load match");
                return;
            }

            const room = res.data;
            if (!room) {
                setError("Match data not found");
                return;
            }
            // Slot sides are the server-authoritative team assignment. Retain
            // the old player-order fallback only for pre-slot legacy rooms.
            let team1 = playersForSlots(room, room.slotsA || []);
            let team2 = playersForSlots(room, room.slotsB || []);
            if (team1.length === 0 || team2.length === 0) {
                const mid = Math.ceil(room.players.length / 2);
                team1 = room.players.slice(0, mid).map((player) => ({
                    uid: player.uid,
                    name: player.username,
                }));
                team2 = room.players.slice(mid).map((player) => ({
                    uid: player.uid,
                    name: player.username,
                }));
            }

            setMatchData({
                id: room.id!,
                gameKey: room.game,
                title: room.title,
                team1Players: team1,
                team2Players: team2,
                team1Captain: room.resultVerification?.team1Captain || room.captainUidA || room.hostUid,
                team2Captain: room.resultVerification?.team2Captain || room.captainUidB || (team2[0]?.uid || ''),
                resultVerification: room.resultVerification
            });
        } catch (err) {
            setError("An error occurred");
        } finally {
            setLoading(false);
        }
    }, [matchroomId]);

    useEffect(() => {
        loadMatchData();
    }, [loadMatchData]);

    const handleSubmit = async () => {
        if (!selectedWinner || !matchData || !currentUserId) return;

        setSubmitting(true);
        setError(null);

        try {
            const res = await submitCaptainReport(matchroomId, currentUserId, selectedWinner);

            if (res.ok) {
                console.log(`[MatchResult] Submitted: Match ${matchroomId}, Winner: ${selectedWinner}`);
                router.back();
            } else {
                setError(res.message || "Failed to submit result");
            }
        } catch (err: any) {
            setError(err.message || 'Failed to submit result');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <Screen style={styles.container} scroll={false}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                    <Text style={styles.loadingText}>Loading match data...</Text>
                </View>
            </Screen>
        );
    }

    if (error) {
        return (
            <Screen style={styles.container} scroll={false}>
                <View style={styles.errorContainer}>
                    <AppIcon name="error-outline" size={48} color={COLORS.error} />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            </Screen>
        );
    }

    if (!matchData) {
        return (
            <Screen style={styles.container} scroll={false}>
                <View style={styles.errorContainer}>
                    <AppIcon name="error-outline" size={48} color={COLORS.error} />
                    <Text style={styles.errorText}>Match not found</Text>
                </View>
            </Screen>
        );
    }

    const isCaptain =
        currentUserId === matchData.team1Captain || currentUserId === matchData.team2Captain;
    const isTeam1Captain = currentUserId === matchData.team1Captain;
    const isTeam2Captain = currentUserId === matchData.team2Captain;

    const alreadySubmitted =
        !!((isTeam1Captain && matchData.resultVerification?.captainReports?.team1Captain) ||
            (isTeam2Captain && matchData.resultVerification?.captainReports?.team2Captain));

    const otherCaptainSubmitted = isTeam1Captain
        ? matchData.resultVerification?.captainReports?.team2Captain
        : matchData.resultVerification?.captainReports?.team1Captain;

    if (!isCaptain) {
        return (
            <Screen style={styles.container} scroll={false}>
                <View style={styles.errorContainer}>
                    <AppIcon name="block" size={48} color={COLORS.warning} />
                    <Text style={styles.errorText}>Only team captains can submit match results</Text>
                </View>
            </Screen>
        );
    }

    return (
        <Screen style={styles.container} scroll={false}>
            <AppHeader title="Submit Match Result" onBack={() => router.back()} inlineTitle />

            <ScrollView contentContainerStyle={[styles.scrollContent, styles.scrollContentInsideScreen]}>
                <View style={styles.header}>
                    <Text style={styles.subtitle}>
                        Select the winning team. The match result will be verified once both captains agree.
                    </Text>
                </View>

                <View style={styles.matchInfoCard}>
                    <View style={styles.matchInfoRow}>
                        <AppIcon name="sports-esports" size={16} color={COLORS.accent} />
                        <Text style={styles.matchInfoLabel}>Match:</Text>
                        <Text style={styles.matchInfoValue}>{matchData.title}</Text>
                    </View>
                    <View style={styles.matchInfoRow}>
                        <GameImageIcon
                            game={matchData.gameKey}
                            size={34}
                            fallbackIconName="videogame-asset"
                            fallbackIconColor={COLORS.accent}
                        />
                        <Text style={styles.matchInfoLabel}>Game:</Text>
                        <Text style={styles.matchInfoValue}>{matchData.gameKey.toUpperCase()}</Text>
                    </View>
                </View>

                {alreadySubmitted && (
                    <View style={styles.alreadySubmittedCard}>
                        <Text style={styles.alreadySubmittedTitle}>✓ Result Submitted</Text>
                        <Text style={styles.alreadySubmittedText}>
                            You have already submitted your result.
                            {otherCaptainSubmitted
                                ? ' Waiting for verification...'
                                : ' Waiting for the other captain to submit their result.'}
                        </Text>
                    </View>
                )}

                <Text style={styles.sectionLabel}>Which team won?</Text>

                {/* Team 1 */}
                <Pressable
                    style={({ pressed }) => [
                        styles.teamCard,
                        selectedWinner === 'team1' && styles.teamCardSelected,
                        alreadySubmitted && styles.teamCardDisabled,
                        pressed && !alreadySubmitted && styles.teamCardPressed,
                    ]}
                    onPress={() => !alreadySubmitted && setSelectedWinner('team1')}
                    disabled={alreadySubmitted}
                >
                    <View style={styles.teamHeader}>
                        <View style={styles.teamTitleRow}>
                            <Text style={styles.teamName}>Team 1</Text>
                            {isTeam1Captain && (
                                <AppIcon name="star" size={16} color={COLORS.warning} style={styles.captainStar} />
                            )}
                        </View>
                        {selectedWinner === 'team1' && (
                            <AppIcon name="check-circle" size={24} style={styles.selectedIcon} />
                        )}
                    </View>
                    <View style={styles.teamPlayers}>
                        {matchData.team1Players.map((player) => (
                            <View key={player.uid} style={styles.playerRow}>
                                <View style={styles.playerDot} />
                                <Text style={styles.playerName}>{player.name}</Text>
                            </View>
                        ))}
                    </View>
                </Pressable>

                {/* Team 2 */}
                <Pressable
                    style={({ pressed }) => [
                        styles.teamCard,
                        selectedWinner === 'team2' && styles.teamCardSelected,
                        alreadySubmitted && styles.teamCardDisabled,
                        pressed && !alreadySubmitted && styles.teamCardPressed,
                    ]}
                    onPress={() => !alreadySubmitted && setSelectedWinner('team2')}
                    disabled={alreadySubmitted}
                >
                    <View style={styles.teamHeader}>
                        <View style={styles.teamTitleRow}>
                            <Text style={styles.teamName}>Team 2</Text>
                            {isTeam2Captain && (
                                <AppIcon name="star" size={16} color={COLORS.warning} style={styles.captainStar} />
                            )}
                        </View>
                        {selectedWinner === 'team2' && (
                            <AppIcon name="check-circle" size={24} style={styles.selectedIcon} />
                        )}
                    </View>
                    <View style={styles.teamPlayers}>
                        {matchData.team2Players.map((player) => (
                            <View key={player.uid} style={styles.playerRow}>
                                <View style={styles.playerDot} />
                                <Text style={styles.playerName}>{player.name}</Text>
                            </View>
                        ))}
                    </View>
                </Pressable>

                {!alreadySubmitted && (
                    <Pressable
                        style={({ pressed }) => [
                            styles.submitButton,
                            (!selectedWinner || submitting) && styles.submitButtonDisabled,
                            pressed && selectedWinner && !submitting && styles.submitButtonPressed,
                        ]}
                        onPressIn={() => {
                            if (touchDebugEnabled) {
                                Logger.debug("TouchDebug", "pressIn", { tag: "result_submit" });
                            }
                        }}
                        onPress={handleSubmit}
                        disabled={!selectedWinner || submitting}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        {submitting ? (
                            <ActivityIndicator size="small" color={COLORS.backgroundDark} />
                        ) : (
                            <Text style={styles.submitButtonText}>Submit Result</Text>
                        )}
                    </Pressable>
                )}

                {otherCaptainSubmitted && (
                    <View style={styles.statusCard}>
                        <View style={styles.statusRow}>
                            <View style={[styles.statusDot, styles.statusDotSuccess]} />
                            <Text style={styles.statusText}>Other captain has submitted their result</Text>
                        </View>
                        <View style={styles.statusRow}>
                            <View style={[styles.statusDot, styles.statusDotPending]} />
                            <Text style={styles.statusText}>
                                {alreadySubmitted
                                    ? 'Verifying results...'
                                    : 'Submit your result to complete verification'}
                            </Text>
                        </View>
                    </View>
                )}
            </ScrollView>
        </Screen>
    );
}

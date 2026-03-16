// app/matchrooms/result.tsx
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { getMatchroomById, submitCaptainReport } from '../../src/services/convex/matchService';
import { COLORS } from '../../src/theme';
import Logger from '../../src/utils/logger';
import styles from './result.styles';

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
            // Transform Matchroom to MatchData interface expected by UI
            // (Or update UI to use Matchroom directly - simpler to map here for now)

            // Mock team splitting for MVP visualization if not strictly defined
            // Assume first half players are team 1, second half team 2
            const mid = Math.ceil(room.players.length / 2);
                const team1 = room.players.slice(0, mid);
                const team2 = room.players.slice(mid);

                setMatchData({
                    id: room.id!,
                    gameKey: room.game,
                    title: room.title,
                    team1Players: team1.map(p => ({ uid: p.uid, name: p.username })),
                    team2Players: team2.map(p => ({ uid: p.uid, name: p.username })),
                    team1Captain: room.resultVerification?.team1Captain || room.hostUid, // fallback to host
                    team2Captain: room.resultVerification?.team2Captain || (team2[0]?.uid || ''), // fallback to first of team 2
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
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                    <Text style={styles.loadingText}>Loading match data...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <MaterialIcons name="error-outline" size={48} color={COLORS.error} />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!matchData) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <MaterialIcons name="error-outline" size={48} color={COLORS.error} />
                    <Text style={styles.errorText}>Match not found</Text>
                </View>
            </SafeAreaView>
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
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <MaterialIcons name="block" size={48} color={COLORS.warning} />
                    <Text style={styles.errorText}>Only team captains can submit match results</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
                <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
            </Pressable>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.title}>Submit Match Result</Text>
                    <Text style={styles.subtitle}>
                        Select the winning team. The match result will be verified once both captains agree.
                    </Text>
                </View>

                <View style={styles.matchInfoCard}>
                    <View style={styles.matchInfoRow}>
                        <MaterialIcons name="sports-esports" size={16} color={COLORS.accent} />
                        <Text style={styles.matchInfoLabel}>Match:</Text>
                        <Text style={styles.matchInfoValue}>{matchData.title}</Text>
                    </View>
                    <View style={styles.matchInfoRow}>
                        <MaterialIcons name="videogame-asset" size={16} color={COLORS.accent} />
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
                <TouchableOpacity
                    style={[
                        styles.teamCard,
                        selectedWinner === 'team1' && styles.teamCardSelected,
                        alreadySubmitted && styles.teamCardDisabled,
                    ]}
                    onPress={() => !alreadySubmitted && setSelectedWinner('team1')}
                    disabled={alreadySubmitted}
                >
                    <View style={styles.teamHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.teamName}>Team 1</Text>
                            {isTeam1Captain && (
                                <MaterialIcons name="star" size={16} color={COLORS.warning} style={{ marginLeft: 8 }} />
                            )}
                        </View>
                        {selectedWinner === 'team1' && (
                            <MaterialIcons name="check-circle" size={24} color={COLORS.accent} />
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
                </TouchableOpacity>

                {/* Team 2 */}
                <TouchableOpacity
                    style={[
                        styles.teamCard,
                        selectedWinner === 'team2' && styles.teamCardSelected,
                        alreadySubmitted && styles.teamCardDisabled,
                    ]}
                    onPress={() => !alreadySubmitted && setSelectedWinner('team2')}
                    disabled={alreadySubmitted}
                >
                    <View style={styles.teamHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.teamName}>Team 2</Text>
                            {isTeam2Captain && (
                                <MaterialIcons name="star" size={16} color={COLORS.warning} style={{ marginLeft: 8 }} />
                            )}
                        </View>
                        {selectedWinner === 'team2' && (
                            <MaterialIcons name="check-circle" size={24} color={COLORS.accent} />
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
                </TouchableOpacity>

                {!alreadySubmitted && (
                    <TouchableOpacity
                        style={[
                            styles.submitButton,
                            (!selectedWinner || submitting) && styles.submitButtonDisabled,
                        ]}
                        onPressIn={() => {
                            if (touchDebugEnabled) {
                                Logger.debug("TouchDebug", "pressIn", { tag: "result_submit" });
                            }
                        }}
                        onPress={handleSubmit}
                        disabled={!selectedWinner || submitting}
                        activeOpacity={0.85}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        {submitting ? (
                            <ActivityIndicator size="small" color={COLORS.background} />
                        ) : (
                            <Text style={styles.submitButtonText}>Submit Result</Text>
                        )}
                    </TouchableOpacity>
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
        </SafeAreaView>
    );
}

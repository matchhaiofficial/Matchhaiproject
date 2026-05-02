// app/matchrooms/vote.tsx
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from '../../src/components/AppHeader';
import { AppIcon } from '../../src/components/AppIcon';
import { useAuth } from '../../src/context/AuthContext';
import { getMatchroomById, submitParticipantVote } from '../../src/services/convex/matchService';
import { COLORS } from '../../src/theme';
import Logger from '../../src/utils/logger';
import styles from './vote.styles';

interface VoteData {
    id: string;
    gameKey: string;
    title: string;
    team1Captain: string;
    team2Captain: string;
    resultVerification: {
        status: 'participant_vote';
        captainReports: {
            team1Captain?: { result: 'team1' | 'team2' };
            team2Captain?: { result: 'team1' | 'team2' };
        };
        participantVotes?: {
            [uid: string]: 'team1' | 'team2' | 'unknown';
        };
        deadline: Date;
    };
    totalParticipants: number;
}

export default function ParticipantVoting() {
    const params = useLocalSearchParams();
    const matchroomId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [voteData, setVoteData] = useState<VoteData | null>(null);
    const [selectedVote, setSelectedVote] = useState<'team1' | 'team2' | 'unknown' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const touchDebugEnabled = __DEV__ && process.env.EXPO_PUBLIC_TOUCH_DEBUG === '1';
    const { user } = useAuth();

    const currentUserId = user?._id;

    const loadVoteData = useCallback(async () => {
        if (!matchroomId) return;

        try {
            const res = await getMatchroomById(matchroomId);
            if (!res.ok) {
                setError(res.message || "Failed to load match");
                return;
            }

            const room = res.data!;
                const rv = room.resultVerification;
                if (!rv) {
                    setError("Voting not started");
                    return;
                }

                setVoteData({
                    id: room.id!,
                    gameKey: room.game,
                    title: room.title,
                    team1Captain: rv.team1Captain || '',
                    team2Captain: rv.team2Captain || '',
                    resultVerification: {
                        status: 'participant_vote',
                        captainReports: rv.captainReports || {},
                        participantVotes: rv.participantVotes || {},
                        deadline: rv.deadline ? new Date(typeof rv.deadline === 'number' ? rv.deadline : rv.deadline.seconds ? rv.deadline.seconds * 1000 : Date.now()) : new Date() // Fallback
                    },
                    totalParticipants: room.players.length
                });
        } catch (err) {
            setError("An error occurred loading voting data");
        } finally {
            setLoading(false);
        }
    }, [matchroomId]);

    useEffect(() => {
        loadVoteData();
    }, [loadVoteData]);

    const handleSubmit = async () => {
        if (!selectedVote || !voteData || !currentUserId) return;

        setSubmitting(true);
        setError(null);

        try {
            const res = await submitParticipantVote(matchroomId, currentUserId, selectedVote);

            if (res.ok) {
                console.log(`[Vote] Submitting: Match ${matchroomId}, Vote: ${selectedVote}`);
                // Refresh data to show submitted state
                loadVoteData();
            } else {
                setError(res.message || 'Failed to submit vote');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to submit vote');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                    <Text style={styles.loadingText}>Loading voting data...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <AppIcon name="error-outline" size={48} color={COLORS.error} />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!voteData) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <AppIcon name="error-outline" size={48} color={COLORS.error} />
                    <Text style={styles.errorText}>Match not found</Text>
                </View>
            </SafeAreaView>
        );
    }

    const alreadyVoted = currentUserId && voteData.resultVerification.participantVotes?.[currentUserId];
    const votes = voteData.resultVerification.participantVotes || {};
    const team1Votes = Object.values(votes).filter((v) => v === 'team1').length;
    const team2Votes = Object.values(votes).filter((v) => v === 'team2').length;
    const totalVotes = Object.keys(votes).length;
    const votingProgress = (totalVotes / voteData.totalParticipants) * 100;

    const team1CaptainChoice = voteData.resultVerification.captainReports.team1Captain?.result;
    const team2CaptainChoice = voteData.resultVerification.captainReports.team2Captain?.result;

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                title="Vote on Result"
                onBack={() => router.back()}
                inlineTitle
                style={styles.appHeader}
            />

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.subtitle}>
                        Captains disagreed on the result. Your vote will help determine the winner.
                    </Text>
                </View>

                <View style={styles.disputeCard}>
                    <Text style={styles.disputeTitle}>⚠️ Result Disputed</Text>
                    <Text style={styles.disputeText}>
                        The captains submitted different results. Please vote honestly based on what you witnessed.
                    </Text>

                    <View style={styles.captainReports}>
                        <View style={styles.captainReport}>
                            <Text style={styles.captainLabel}>Team 1 Captain</Text>
                            <Text style={styles.captainChoice}>
                                Reported: {team1CaptainChoice === 'team1' ? 'Team 1 Won' : 'Team 2 Won'}
                            </Text>
                        </View>
                        <View style={styles.captainReport}>
                            <Text style={styles.captainLabel}>Team 2 Captain</Text>
                            <Text style={styles.captainChoice}>
                                Reported: {team2CaptainChoice === 'team1' ? 'Team 1 Won' : 'Team 2 Won'}
                            </Text>
                        </View>
                    </View>
                </View>

                {alreadyVoted && (
                    <View style={styles.alreadyVotedCard}>
                        <Text style={styles.alreadyVotedTitle}>✓ Vote Submitted</Text>
                        <Text style={styles.alreadyVotedText}>
                            You voted for {alreadyVoted === 'team1' ? 'Team 1' : alreadyVoted === 'team2' ? 'Team 2' : 'Unsure'}.
                            Waiting for other participants...
                        </Text>
                    </View>
                )}

                <Text style={styles.sectionLabel}>Who won the match?</Text>

                {/* Team 1 Vote */}
                <Pressable
                    style={({ pressed }) => [
                        styles.voteOption,
                        selectedVote === 'team1' && styles.voteOptionSelected,
                        alreadyVoted && styles.voteOptionDisabled,
                        pressed && !alreadyVoted && styles.voteOptionPressed,
                    ]}
                    onPress={() => !alreadyVoted && setSelectedVote('team1')}
                    disabled={!!alreadyVoted}
                >
                    <View style={styles.voteHeader}>
                        <View style={styles.voteTitleRow}>
                            <Text style={styles.voteTeamName}>Team 1 Won</Text>
                            {selectedVote === 'team1' && (
                                <AppIcon name="check-circle" size={20} style={styles.selectedIcon} />
                            )}
                        </View>
                        <View style={styles.voteCount}>
                            <Text style={styles.voteCountText}>{team1Votes} votes</Text>
                        </View>
                    </View>
                </Pressable>

                {/* Team 2 Vote */}
                <Pressable
                    style={({ pressed }) => [
                        styles.voteOption,
                        selectedVote === 'team2' && styles.voteOptionSelected,
                        alreadyVoted && styles.voteOptionDisabled,
                        pressed && !alreadyVoted && styles.voteOptionPressed,
                    ]}
                    onPress={() => !alreadyVoted && setSelectedVote('team2')}
                    disabled={!!alreadyVoted}
                >
                    <View style={styles.voteHeader}>
                        <View style={styles.voteTitleRow}>
                            <Text style={styles.voteTeamName}>Team 2 Won</Text>
                            {selectedVote === 'team2' && (
                                <AppIcon name="check-circle" size={20} style={styles.selectedIcon} />
                            )}
                        </View>
                        <View style={styles.voteCount}>
                            <Text style={styles.voteCountText}>{team2Votes} votes</Text>
                        </View>
                    </View>
                </Pressable>

                {/* Unsure Option */}
                <Pressable
                    style={({ pressed }) => [
                        styles.voteOption,
                        selectedVote === 'unknown' && styles.voteOptionSelected,
                        alreadyVoted && styles.voteOptionDisabled,
                        pressed && !alreadyVoted && styles.voteOptionPressed,
                    ]}
                    onPress={() => !alreadyVoted && setSelectedVote('unknown')}
                    disabled={!!alreadyVoted}
                >
                    <View style={styles.voteHeader}>
                        <View style={styles.voteTitleRow}>
                            <Text style={styles.voteTeamName}>I Don't Know</Text>
                            {selectedVote === 'unknown' && (
                                <AppIcon name="check-circle" size={20} style={styles.selectedIcon} />
                            )}
                        </View>
                    </View>
                </Pressable>

                {!alreadyVoted && (
                    <Pressable
                        style={({ pressed }) => [
                            styles.submitButton,
                            (!selectedVote || submitting) && styles.submitButtonDisabled,
                            pressed && selectedVote && !submitting && styles.submitButtonPressed,
                        ]}
                        onPressIn={() => {
                            if (touchDebugEnabled) {
                                Logger.debug("TouchDebug", "pressIn", { tag: "vote_submit" });
                            }
                        }}
                        onPress={handleSubmit}
                        disabled={!selectedVote || submitting}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        {submitting ? (
                            <ActivityIndicator size="small" color={COLORS.backgroundDark} />
                        ) : (
                            <Text style={styles.submitButtonText}>Submit Vote</Text>
                        )}
                    </Pressable>
                )}

                {/* Voting Progress */}
                <View style={styles.progressCard}>
                    <Text style={styles.progressLabel}>Voting Progress</Text>
                    <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${votingProgress}%` }]} />
                    </View>
                    <Text style={styles.progressText}>
                        {totalVotes} / {voteData.totalParticipants} participants voted
                    </Text>
                    <Text style={styles.deadlineText}>
                        Voting closes in 24 hours
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}


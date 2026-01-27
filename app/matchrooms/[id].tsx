import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    Share,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import SkillAssessmentModal from "../../src/components/SkillAssessmentModal";
import SkillBadge from "../../src/components/SkillBadge";
import { db } from "../../src/config/firebaseConfig";
import { SKILL_ASSESSMENT_CONFIG } from "../../src/constants/skillQuestions";
import { useAuth } from "../../src/context/AuthContext";
import { isWithinFairnessBand } from "../../src/services/bookingService";
import { cancelUserPendingMatchroomRequests } from "../../src/services/functions";
import { deleteMatchroom, getMatchroom, isUserInActiveMatchroom, joinMatchroom, leaveMatchroom, Matchroom, requestJoinMatchroom, cancelMatchJoinRequest, startMatch } from "../../src/services/matchService";
import { GameSkillScore } from "../../src/services/skillRatingService";
import { COLORS, SPACING } from "../../src/theme";
import Logger from "../../src/utils/logger";
import { isRoomExpired, isRoomLocked } from "../../src/utils/matchroomLifecycle";
import styles from "./detail.styles";

export default function MatchroomDetails() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuth();

    const [room, setRoom] = useState<Matchroom | null>(null);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [starting, setStarting] = useState(false);
    const [isRequested, setIsRequested] = useState(false);
    const [requestLoading, setRequestLoading] = useState(false);

    // Role Selection State
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [selectedRole, setSelectedRole] = useState<string | null>(null);
    const [profile, setProfile] = useState<any>(null);

    const [playerRatings, setPlayerRatings] = useState<Record<string, GameSkillScore | null>>({});

    const fetchRoom = async () => {
        if (!id || typeof id !== 'string') return;
        try {
            const res = await getMatchroom(id);
            if (res.ok && res.data) {
                setRoom(res.data);
            } else {
                Alert.alert("Error", "Matchroom not found");
                router.back();
            }
        } catch (e) {
            Logger.error("MatchroomDetails", "Error fetching room", e);
        } finally {
            setLoading(false);
        }
    };

    const checkRequestStatus = async () => {
        if (!user || !id) return;
        try {
            const q = query(
                collection(db, "notifications"),
                where("fromUid", "==", user.uid),
                where("type", "==", "match_join_request"),
                where("status", "==", "pending")
            );
            const snap = await getDocs(q);
            let requested = false;
            snap.forEach(doc => {
                if (doc.data().meta?.matchroomId === id) {
                    requested = true;
                }
            });
            setIsRequested(requested);
        } catch (e) {
            Logger.error("MatchroomDetails", "Error checking request status", e);
        }
    };

    useEffect(() => {
        fetchRoom();
        checkRequestStatus();
    }, [id, user]);

    useEffect(() => {
        if (user) {
            import('../../src/services/userService').then(({ getUserProfile }) => {
                getUserProfile(user.uid).then(res => {
                    if (res.ok) setProfile(res.data);
                });
            });
        }
    }, [user]);

    // Fetch ratings when players list updates
    useEffect(() => {
        if (!room) return;

        const fetchRatings = async () => {
            const ratings: Record<string, GameSkillScore | null> = {};
            const players = room?.players || [];
            await Promise.all(players.map(async (p) => {
                // Optimization: Don't refetch if already have it (though simple MVP re-fetch is safer for updates)
                try {
                    const uDoc = await getDoc(doc(db, "users", p.uid));
                    if (uDoc.exists()) {
                        ratings[p.uid] = uDoc.data().skillScores?.[room.game] || null;
                    }
                } catch (e) {
                    console.error("Failed to fetch rating for", p.username);
                }
            }));
            setPlayerRatings(ratings);
        };
        fetchRatings();
    }, [room?.players, room?.game]);



    const handleCancelRequest = async () => {
        if (!user || !id) return;
        setRequestLoading(true);
        try {
            const res = await cancelMatchJoinRequest(id as string, user.uid);
            if (res.ok) {
                setIsRequested(false);
                Alert.alert("Cancelled", "Join request removed.");
            } else {
                Alert.alert("Error", res.message || "Failed to cancel request.");
            }
        } catch (e) {
            Logger.error("MatchroomDetails", "Error cancelling request", e);
        } finally {
            setRequestLoading(false);
        }
    };


    const handleRequestJoin = async (role?: string) => {
        if (!room || !user || !id) return;

        // BUSY CHECK
        const busyCheck = await isUserInActiveMatchroom(user.uid);
        if (busyCheck.inRoom && busyCheck.roomId !== id) {
            Alert.alert("Already Busy", busyCheck.message);
            return;
        }

        setJoining(true);
        try {
            const res = await requestJoinMatchroom(room, {
                uid: user.uid,
                username: user.displayName || 'Player',
            }, role || 'Flex');

            if (res.ok) {
                Alert.alert("Request Sent", "Your request to join has been sent to the host.");
                setIsRequested(true);
            } else {
                Alert.alert("Error", res.message || "Failed to send request.");
            }
        } catch (e) {
            Logger.error("MatchroomDetails", "Error requesting join", e);
        } finally {
            setJoining(false);
        }
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Join my ${room?.game} lobby on MatchHai! ${room?.title}`,
            });
        } catch (error) {
            // ignore
        }
    };

    const handleStartMatch = async () => {
        if (!room) return;
        setStarting(true);
        try {
            // Snapshot ratings
            const ratingsSnapshot: Record<string, number> = {};
            const playersArr = room.players || [];

            // Parallel fetch of profiles to get skill scores
            await Promise.all(playersArr.map(async (p) => {
                try {
                    const uDoc = await getDoc(doc(db, "users", p.uid));
                    if (uDoc.exists()) {
                        const uData = uDoc.data();
                        const gameScore = uData.skillScores?.[room.game];
                        // Default to 1000 or beginner rating if no score found
                        ratingsSnapshot[p.uid] = gameScore?.rating || 1000;
                    } else {
                        ratingsSnapshot[p.uid] = 1000;
                    }
                } catch (err) {
                    console.error("Error fetching user rating", err);
                    ratingsSnapshot[p.uid] = 1000;
                }
            }));

            // Assign Captains (MVP: Host vs First Opponent)
            const team2Player = playersArr.find(p => p.uid !== room.hostUid);
            const team2Captain = team2Player ? team2Player.uid : undefined;

            const res = await startMatch(id as string, ratingsSnapshot, room.hostUid, team2Captain);
            if (res.ok) {
                Alert.alert("Match Started", "Good luck! Submit results after the game.");
                fetchRoom();
            } else {
                Alert.alert("Error", "Failed to start match");
            }
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "An error occurred");
        } finally {
            setStarting(false);
        }
    };

    const handleResultSubmission = () => {
        router.push(`/matchrooms/result?id=${id}`);
    };

    const handleVote = () => {
        router.push(`/matchrooms/vote?id=${id}`);
    };

    const handleLeave = () => {
        if (!room || !user || !id) return;

        // Check lock (10/10)
        const slotsA = room.slotsA || [];
        const slotsB = room.slotsB || [];
        const confirmedCount = [...slotsA, ...slotsB].filter(s => s?.status === 'confirmed').length;
        if (confirmedCount >= 10) {
            Alert.alert("Locked", "The matchroom is full and locked. You cannot leave at this stage.");
            return;
        }

        Alert.alert(
            "Leave Matchroom",
            "Are you sure you want to leave? If you have paid, there will be NO REFUND.",
            [
                { text: "Stay", style: "cancel" },
                {
                    text: "Leave",
                    style: "destructive",
                    onPress: async () => {
                        setJoining(true); // Reuse state for loading
                        try {
                            const res = await leaveMatchroom(id as string, user.uid);
                            if (res.ok) {
                                Alert.alert("Left", "You have left the matchroom.");
                                fetchRoom();
                            } else {
                                Alert.alert("Error", res.message || "Failed to leave");
                            }
                        } catch (e) {
                            Logger.error("MatchroomDetails", "Leave error", e);
                        } finally {
                            setJoining(false);
                        }
                    }
                }
            ]
        );
    };

    const handleDelete = () => {
        if (!room) return;

        if (room.zoneAdminApproved) {
            Alert.alert("Cannot Delete", "This lobby has been approved by the Zone Admin and cannot be deleted.");
            return;
        }

        // Conditional Deletion Thresholds
        const playerCount = room.players?.length || 0;
        const game = room.game?.toLowerCase();
        let threshold = 2; // Default for FC26, Tekken 8, Padel, Pickleball (Host + 1)

        if (game === 'cs2') {
            threshold = 3;
        } else if (game === 'futsal' || game === 'cricket' || game === 'indoorcricket') {
            threshold = 6;
        }

        if (playerCount >= threshold) {
            Alert.alert(
                "Deletion Blocked",
                `This lobby cannot be deleted because it has ${playerCount} players joined. Minimum required to lock deletion for ${room.game.toUpperCase()} is ${threshold}.`
            );
            return;
        }

        Alert.alert(
            "Delete Lobby",
            "Are you sure you want to delete this lobby? This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const res = await deleteMatchroom(id as string);
                            if (res.ok) {
                                // Explicitly target the tabs route to avoid conflict with /matchrooms stack
                                router.replace("/(player)/(tabs)/matchrooms");
                            } else {
                                Alert.alert("Error", res.message || "Failed to delete");
                                setLoading(false);
                            }
                        } catch (e) {
                            Logger.error("DeleteMatch", "Error", e);
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const isHost = useMemo(() => user?.uid === room?.hostUid, [user?.uid, room?.hostUid]);
    const playersArr = useMemo(() => room?.players || [], [room?.players]);
    const isJoined = useMemo(() => playersArr.some((p: any) => p.uid === user?.uid), [playersArr, user?.uid]);
    const isFull = useMemo(() => playersArr.length >= (room?.maxPlayers || 0), [playersArr.length, room?.maxPlayers]);

    // Lifecycle states
    const isExpired = useMemo(() => (room ? isRoomExpired(room) : false), [room]);
    const isLocked = useMemo(() => (room ? isRoomLocked(room) : false), [room]);
    const canJoin = useMemo(() => !isExpired && !isLocked && !isJoined && !isFull, [isExpired, isLocked, isJoined, isFull]);

    if (loading) {
        return (
            <SafeAreaView style={styles.screen}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator color={COLORS.accent} />
                </View>
            </SafeAreaView>
        );
    }

    if (!room) return null;

    // Calculate available roles
    const availableRoles: any[] = []; // room.requiredRoles removed from schema

    return (
        <SafeAreaView style={styles.screen}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Lobby Details</Text>
                <View style={{ flex: 1 }} />
                {isJoined && !isHost && (
                    <TouchableOpacity onPress={handleLeave} style={{ marginRight: 16 }}>
                        <MaterialIcons name="exit-to-app" size={24} color={COLORS.error} />
                    </TouchableOpacity>
                )}
                {isHost && (
                    <TouchableOpacity onPress={handleDelete} style={{ marginRight: 16 }}>
                        <MaterialIcons name="delete-outline" size={24} color={COLORS.error} />
                    </TouchableOpacity>
                )}
                <TouchableOpacity onPress={handleShare}>
                    <MaterialIcons name="share" size={24} color={COLORS.accent} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Expired Banner */}
                {isExpired && (
                    <View style={[styles.banner, styles.expiredBanner]}>
                        <MaterialIcons name="warning" size={20} color="#FFF" />
                        <Text style={styles.bannerText}>
                            This matchroom has expired (valid for 48 hours)
                        </Text>
                    </View>
                )}

                {/* Locked Banner */}
                {isLocked && !isExpired && (
                    <View style={[styles.banner, styles.lockedBanner]}>
                        <MaterialIcons name="lock" size={20} color="#FFF" />
                        <Text style={styles.bannerText}>
                            Matchroom is full and locked
                        </Text>
                    </View>
                )}

                {/* Main Card */}
                <View style={styles.mainCard}>
                    <View style={styles.gameDateRow}>
                        <View style={styles.gameBadge}>
                            <Text style={styles.gameText}>{room.game}</Text>
                        </View>
                        <Text style={styles.dateText}>
                            {room.startTime ? new Date(room.startTime.seconds * 1000).toLocaleDateString() : (room.scheduledDate || 'Flexible Date')}
                        </Text>
                    </View>
                    <Text style={styles.title}>{room.title}</Text>
                    <Text style={styles.description}>{room.description || "No description provided."}</Text>
                </View>

                {/* Info Grid */}
                <View style={styles.infoGrid}>
                    <View style={styles.infoItem}>
                        <MaterialIcons name="schedule" size={20} color={COLORS.accent} style={styles.infoIcon} />
                        <View>
                            <Text style={styles.infoLabel}>TIME</Text>
                            <Text style={styles.infoValue}>
                                {(() => {
                                    // Start Time Logic
                                    const dateStr = room.scheduledDate || '';
                                    const timeStr = room.scheduledTime || '00:00';

                                    // Parse Scheduled Date (DD/MM/YYYY or YYYY-MM-DD or empty)
                                    let start = new Date();
                                    if (dateStr.includes('/')) {
                                        const [day, month, year] = dateStr.split('/').map(Number);
                                        start = new Date(year, month - 1, day);
                                    } else if (dateStr) {
                                        const parsed = new Date(dateStr);
                                        if (!isNaN(parsed.getTime())) start = parsed;
                                    }

                                    // Parse Scheduled Time (e.g. "14:30")
                                    const [hours, mins] = timeStr.split(':').map(Number);
                                    if (!isNaN(hours)) {
                                        start.setHours(hours, mins || 0);
                                    }

                                    // Helper for 12h format
                                    const format12h = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

                                    // Display Start
                                    const startDisplay = room.startTime
                                        ? format12h(new Date(room.startTime.seconds * 1000))
                                        : (room.scheduledTime ? format12h(start) : 'Flexible');

                                    // Calculate End Time
                                    let duration = room.durationMinutes;

                                    // Legacy Fallback for Duration
                                    if (!duration) {
                                        if (room.format?.includes('BO1')) duration = 60;
                                        else if (room.format?.includes('BO3')) duration = (room.game === 'fc26') ? 60 : 180;
                                        else if (room.format?.includes('BO5')) duration = (room.game === 'fc26') ? 120 : 300;
                                        else if (room.format?.includes('BO7')) duration = 60; // Tekken
                                        // Simple default fallback
                                        else duration = 60;
                                    }

                                    // Compute End Time
                                    if (room.scheduledTime && duration) {
                                        const end = new Date(start.getTime() + duration * 60000);
                                        const endDisplay = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                        return `${startDisplay} - ${endDisplay}`;
                                    }

                                    return startDisplay;
                                })()}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.infoItem}>
                        <MaterialIcons name="location-on" size={20} color={COLORS.accent} style={styles.infoIcon} />
                        <View>
                            <Text style={styles.infoLabel}>LOCATION</Text>
                            <Text style={styles.infoValue}>{room.location || 'Online'}</Text>
                        </View>
                    </View>
                    <View style={styles.infoItem}>
                        <MaterialIcons name="attach-money" size={20} color={COLORS.successBright} style={styles.infoIcon} />
                        <View>
                            <Text style={styles.infoLabel}>PRICE</Text>
                            <Text style={[styles.infoValue, { color: COLORS.successBright }]}>
                                {(room.pricing?.perPlayer || (room as any).pricePerPlayer) ? `Rs.${room.pricing?.perPlayer || (room as any).pricePerPlayer}` : 'Free'}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.infoItem}>
                        <MaterialIcons name="bar-chart" size={20} color={COLORS.accent} style={styles.infoIcon} />
                        <View>
                            <Text style={styles.infoLabel}>SKILL LEVEL</Text>
                            <Text style={styles.infoValue}>{room.skillLevel || 'All Levels'}</Text>
                        </View>
                    </View>
                </View>

                {/* Squad Section */}
                <Text style={styles.sectionTitle}>
                    Squad ({room.players?.length || 0}/{room.maxPlayers})
                </Text>

                <View style={styles.playersContainer}>
                    {(room.players || []).map((player) => (
                        <View key={player.uid} style={styles.playerRow}>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>{player.username.charAt(0).toUpperCase()}</Text>
                            </View>
                            <View style={styles.playerInfo}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={styles.playerName}>{player.username}</Text>
                                    {player.uid === room.hostUid && (
                                        <View style={styles.hostBadge}>
                                            <Text style={styles.hostText}>HOST</Text>
                                        </View>
                                    )}
                                </View>
                                {player.role && <Text style={styles.playerRole}>{player.role}</Text>}
                            </View>

                            {/* Skill Badge */}
                            {playerRatings[player.uid] && (
                                <View style={{ marginRight: SPACING.sm }}>
                                    <SkillBadge
                                        tier={playerRatings[player.uid]!.tier}
                                        rating={playerRatings[player.uid]!.rating}
                                        size="compact"
                                    />
                                </View>
                            )}

                            {player.uid === user?.uid && (
                                <MaterialIcons name="person" size={16} color={COLORS.textSecondary} />
                            )}
                        </View>
                    ))}
                </View>
            </ScrollView>

            {/* Footer Actions */}
            <View style={styles.footer}>
                {/* Expired state - show message only */}
                {isExpired ? (
                    <View style={[styles.fullButton, styles.expiredBanner]}>
                        <Text style={styles.fullText}>Matchroom Expired</Text>
                    </View>
                ) : (room.status !== 'in-progress' && room.status !== 'completed') ? (
                    !isJoined ? (
                        <View style={{ gap: SPACING.md }}>
                            {(isFull || room.isLocked) ? (
                                <View style={[styles.fullButton, (room.isLocked && !isFull) ? styles.lockedBanner : null]}>
                                    <Text style={styles.fullText}>
                                        {room.isLocked && !isFull ? 'Lobby Locked' : 'Lobby Full'}
                                    </Text>
                                </View>
                            ) : null}

                            <View style={{ marginTop: SPACING.xs }}>
                                {isRequested ? (
                                    <TouchableOpacity
                                        onPress={handleCancelRequest}
                                        disabled={requestLoading}
                                        style={styles.cancelRequestButton}
                                    >
                                        {requestLoading ? (
                                            <ActivityIndicator color={COLORS.error} />
                                        ) : (
                                            <Text style={styles.cancelRequestButtonText}>Cancel Join Request</Text>
                                        )}
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        onPress={() => handleRequestJoin()}
                                        disabled={joining}
                                        style={styles.getRequestButton}
                                    >
                                        {joining ? (
                                            <ActivityIndicator color="#fff" />
                                        ) : (
                                            <Text style={styles.getRequestButtonText}>Request to Join</Text>
                                        )}
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    ) : (
                        <View style={styles.footerRow}>
                            {isHost && (isFull || room.isLocked) ? (
                                <TouchableOpacity
                                    onPress={handleStartMatch}
                                    disabled={starting}
                                    style={[styles.joinButton, { flex: 1, backgroundColor: COLORS.success }]}
                                >
                                    {starting ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.joinButtonText}>Start Match</Text>
                                    )}
                                </TouchableOpacity>
                            ) : (
                                <View style={[styles.joinedButton, { flex: 1.5 }]}>
                                    <Text style={styles.joinedText}>
                                        {isHost ? "Waiting..." : "You are in!"}
                                    </Text>
                                </View>
                            )}

                            {/* Self-Leave Button if not Host (Host deletes) */}
                            {!isHost && (
                                <TouchableOpacity
                                    onPress={handleLeave}
                                    disabled={joining}
                                    style={[styles.secondaryButton, { flex: 1 }]}
                                >
                                    {joining ? (
                                        <ActivityIndicator color={COLORS.error} />
                                    ) : (
                                        <Text style={styles.secondaryButtonText}>Leave</Text>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                    )
                ) : (
                    // Match In Progress or Verifying
                    <View style={{ gap: SPACING.sm }}>
                        <View style={styles.statusBanner}>
                            <Text style={styles.statusText}>
                                Status: {room.status === 'in-progress' ? 'In Progress' : 'Verifying Results'}
                            </Text>
                        </View>

                        {/* Captain Result Action */}
                        {(room.status === 'in-progress' || room.resultVerification?.status === 'pending') && isJoined && (
                            <TouchableOpacity
                                onPress={handleResultSubmission}
                                style={[styles.joinButton, { backgroundColor: COLORS.warning }]}
                            >
                                <Text style={styles.joinButtonText}>Report Result</Text>
                            </TouchableOpacity>
                        )}

                        {/* Participant Vote Action */}
                        {room.resultVerification?.status === 'participant_vote' && isJoined && (
                            <TouchableOpacity
                                onPress={handleVote}
                                style={[styles.joinButton, { backgroundColor: COLORS.error }]}
                            >
                                <Text style={styles.joinButtonText}>Vote on Dispute</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>

        </SafeAreaView >
    );
}

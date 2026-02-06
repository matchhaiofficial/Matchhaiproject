import { FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Pressable,
    ScrollView,
    Share,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import AppHeader from "../../src/components/AppHeader";
import Screen from "../../src/components/Screen";

import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import SkillBadge from "../../src/components/SkillBadge";
import { db } from "../../src/config/firebaseConfig";
import { useAuth } from "../../src/context/AuthContext";
import { inviteToMatchroom, kickFromMatchroom, transferMatchroomCaptain } from "../../src/services/functions";
import { cancelMatchJoinRequest, deleteMatchroom, getMatchroom, isUserInActiveMatchroom, leaveMatchroom, Matchroom, requestJoinMatchroom, startMatch } from "../../src/services/matchService";
import { getUserSportRoleLabel } from "../../src/services/userService";
import { GameSkillScore } from "../../src/services/skillRatingService";
import { COLORS, SPACING } from "../../src/theme";
import Logger from "../../src/utils/logger";
import { isRoomExpired, isRoomLocked } from "../../src/utils/matchroomLifecycle";
import styles from "./detail.styles";

const DEFAULT_SKILL_RATING = 45;
const clampRating = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export default function MatchroomDetails() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuth();
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    const [room, setRoom] = useState<Matchroom | null>(null);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [starting, setStarting] = useState(false);
    const [requestedSlots, setRequestedSlots] = useState<Map<string, string>>(new Map());
    const [genericRequestStatus, setGenericRequestStatus] = useState<string | null>(null);
    const [requestLoading, setRequestLoading] = useState(false);

    // Role Selection State
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [selectedRole, setSelectedRole] = useState<string | null>(null);
    const [profile, setProfile] = useState<any>(null);

    const [playerRatings, setPlayerRatings] = useState<Record<string, GameSkillScore | null>>({});

    // Invitation State
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [friends, setFriends] = useState<any[]>([]);
    const [loadingFriends, setLoadingFriends] = useState(false);
    const [invitingSlot, setInvitingSlot] = useState<{ team: 'A' | 'B', slotId: string } | null>(null);
    const touchDebugEnabled = __DEV__ && process.env.EXPO_PUBLIC_TOUCH_DEBUG === '1';

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
                where("status", "in", ["pending", "rejected"])
            );
            const snap = await getDocs(q);
            const slots = new Map<string, string>();
            let genericStatus: string | null = null;

            snap.forEach(doc => {
                const data = doc.data();
                if (data.meta?.matchroomId === id) {
                    if (data.meta.slotId) {
                        slots.set(data.meta.slotId, data.status);
                    } else {
                        genericStatus = data.status;
                    }
                }
            });
            setRequestedSlots(slots);
            setGenericRequestStatus(genericStatus);
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
                        const rawScore = uDoc.data().skillScores?.[room.game] as GameSkillScore | undefined;
                        if (rawScore && typeof rawScore.rating === 'number') {
                            ratings[p.uid] = { ...rawScore, rating: clampRating(rawScore.rating) };
                        } else {
                            ratings[p.uid] = rawScore || null;
                        }
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
                setRequestedSlots(new Map());
                setGenericRequestStatus(null);
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


    const handleRequestJoin = async (team?: string, slotId?: string) => {
        if (!room || !user || !id) return;

        // BUSY CHECK
        const busyCheck = await isUserInActiveMatchroom(user.uid, room as any);
        if (busyCheck.inRoom && busyCheck.roomId !== id) {
            Alert.alert("Already Busy", busyCheck.message);
            return;
        }

        setJoining(true);
        try {
            // Determine Role from Profile - Ensure we have latest profile
            let currentProfile = profile;
            if (!currentProfile && user) {
                const { getUserProfile } = await import('../../src/services/userService');
                const res = await getUserProfile(user.uid);
                if (res.ok) {
                    currentProfile = res.data;
                    setProfile(res.data);
                }
            }

            let gameplayRole = 'Flex';
            if (currentProfile) {
                gameplayRole = getUserSportRoleLabel(currentProfile, room.game) || 'Flex';
                // Specific normalization for CS2 common typo/lengthy labels if needed
                if (gameplayRole === 'AW Per') gameplayRole = 'AWPer';
                if (gameplayRole === 'In-Game Leader (IGL)') gameplayRole = 'IGL';
            }

            const res = await requestJoinMatchroom(room, {
                uid: user.uid,
                username: profile?.username || user.displayName || 'Player',
            }, gameplayRole, team || 'Any', slotId); // NEW: pass slotId

            if (res.ok) {
                Alert.alert("Request Sent", "Your request to join has been sent to the host.");
                // Optimistic update
                if (slotId) {
                    setRequestedSlots(prev => new Map(prev).set(slotId, 'pending'));
                } else {
                    setGenericRequestStatus('pending');
                }
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
                        // Default to mid rating if no score found
                        if (typeof gameScore?.rating === 'number') {
                            ratingsSnapshot[p.uid] = clampRating(gameScore.rating);
                        } else {
                            ratingsSnapshot[p.uid] = DEFAULT_SKILL_RATING;
                        }
                    } else {
                        ratingsSnapshot[p.uid] = DEFAULT_SKILL_RATING;
                    }
                } catch (err) {
                    console.error("Error fetching user rating", err);
                    ratingsSnapshot[p.uid] = DEFAULT_SKILL_RATING;
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

    const handleTransferCaptain = async (team: 'A' | 'B', newCaptainUid: string, teammateName: string) => {
        if (!user || !id || !room) return;

        Alert.alert(
            "Transfer Captaincy",
            `Are you sure you want to make ${teammateName} the captain of Team ${team}? You will lose your captain powers for this team.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Transfer",
                    onPress: async () => {
                        setJoining(true); // Reuse loading state
                        try {
                            const res = await transferMatchroomCaptain({
                                matchroomId: id as string,
                                team,
                                newCaptainUid
                            });
                            if (res.ok) {
                                Alert.alert("Success", res.message);
                                fetchRoom();
                            } else {
                                Alert.alert("Error", res.message || "Transfer failed");
                            }
                        } catch (e) {
                            Logger.error("TransferCaptain", "Error", e);
                        } finally {
                            setJoining(false);
                        }
                    }
                }
            ]
        );
    };

    const fetchFriends = async () => {
        if (!user) return;
        setLoadingFriends(true);
        try {
            const friendsRef = collection(db, 'users', user.uid, 'friends');
            const snap = await getDocs(friendsRef);
            const friendsList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setFriends(friendsList);
        } catch (e) {
            Logger.error("MatchroomDetails", "Error fetching friends", e);
        } finally {
            setLoadingFriends(false);
        }
    };

    const handleInvitePress = (team: 'A' | 'B', slotId: string) => {
        setInvitingSlot({ team, slotId });
        setShowInviteModal(true);
        fetchFriends();
    };

    const handleSendInvite = async (friend: any) => {
        if (!invitingSlot || !id || !room) return;

        setJoining(true); // Reuse loading state for invite progress
        try {
            const res = await inviteToMatchroom({
                matchroomId: id as string,
                toUid: friend.uid,
                team: invitingSlot.team,
                slotId: invitingSlot.slotId,
                role: 'Flex', // Default, will pull from their profile on join
                fromUsername: profile?.username || user?.displayName || 'Captain'
            });

            if (res.ok) {
                Alert.alert("Invitation Sent", `Sent invitation to ${friend.username}`);
                setShowInviteModal(false);
            } else {
                Alert.alert("Error", res.message || "Failed to send invitation");
            }
        } catch (e) {
            Logger.error("MatchroomDetails", "Error sending invite", e);
        } finally {
            setJoining(false);
        }
    };


    const handleKick = async (playerUid: string, playerName: string) => {
        if (!id || !user || !room) return;

        Alert.alert(
            "Kick Player",
            `Are you sure you want to remove ${playerName} from the matchroom?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Kick",
                    style: "destructive",
                    onPress: async () => {
                        setJoining(true);
                        try {
                            const res = await kickFromMatchroom({
                                matchroomId: id as string,
                                playerUid
                            });
                            if (res.ok) {
                                Alert.alert("Success", "Player removed.");
                                fetchRoom();
                            } else {
                                Alert.alert("Error", res.message || "Kick failed");
                            }
                        } catch (e) {
                            Logger.error("MatchroomDetails", "Kick error", e);
                        } finally {
                            setJoining(false);
                        }
                    }
                }
            ]
        );
    };


    const handleManagePlayer = (team: 'A' | 'B', playerUid: string, playerName: string) => {
        if (!id || !user || !room) return;

        const isCurrentCaptain = team === 'A'
            ? captainUidAResolved === playerUid
            : captainUidBResolved === playerUid;

        Alert.alert(
            "Manage Player",
            `Choose an action for ${playerName}`,
            [
                { text: "Cancel", style: "cancel" },
                // Only show "Make Captain" if they aren't already the captain of that team
                ...(!isCurrentCaptain ? [{
                    text: "Make Captain",
                    onPress: () => handleTransferCaptain(team, playerUid, playerName)
                }] : []),
                {
                    text: "Kick Player",
                    style: "destructive",
                    onPress: () => handleKick(playerUid, playerName)
                }
            ]
        );
    };


    const isHost = useMemo(() => user?.uid === room?.hostUid, [user?.uid, room?.hostUid]);
    const playersArr = useMemo(() => room?.players || [], [room?.players]);
    const participantUids = useMemo(() => {
        const slots = [...(room?.slotsA || []), ...(room?.slotsB || [])];
        const slotUids = slots
            .map((s: any) => s?.user?.uid || s?.uid)
            .filter(Boolean);
        return new Set<string>([
            ...(room?.playerUids || []),
            ...slotUids,
            room?.hostUid,
            room?.zoneOwnerUid,
        ].filter(Boolean));
    }, [room]);
    const isJoined = useMemo(() => !!user?.uid && participantUids.has(user.uid), [participantUids, user?.uid]);
    const isFull = useMemo(() => playersArr.length >= (room?.maxPlayers || 0), [playersArr.length, room?.maxPlayers]);

    // Lifecycle states
    const isExpired = useMemo(() => (room ? isRoomExpired(room) : false), [room]);
    const isLocked = useMemo(() => (room ? isRoomLocked(room) : false), [room]);
    const canJoin = useMemo(() => !isExpired && !isLocked && !isJoined && !isFull, [isExpired, isLocked, isJoined, isFull]);
    const matchCode = room?.matchCode || (room?.id ? room.id.slice(-6).toUpperCase() : '');
    const qrValue = room?.id ? `matchhai://matchrooms/${room.id}` : '';

    const { displaySlotsA, displaySlotsB } = useMemo(() => {
        const slotsA = room?.slotsA || [];
        const slotsB = room?.slotsB || [];
        if (slotsA.length === 0 && slotsB.length === 0) {
            return { displaySlotsA: slotsA, displaySlotsB: slotsB };
        }
        const assigned = new Set<string>();
        slotsA.forEach((s: any) => s?.user?.uid && assigned.add(s.user.uid));
        slotsB.forEach((s: any) => s?.user?.uid && assigned.add(s.user.uid));
        const unassigned = (room?.players || []).filter((p: any) => !assigned.has(p.uid));
        let idx = 0;
        const fill = (slots: any[]) =>
            slots.map((slot) => {
                if (slot.user || slot.uid) return slot;
                if (idx < unassigned.length) {
                    const p = unassigned[idx++];
                    return {
                        ...slot,
                        uid: p.uid,
                        user: { uid: p.uid, username: p.username },
                        status: 'confirmed',
                        role: slot.role || p.role || 'Flex'
                    };
                }
                return slot;
            });
        return { displaySlotsA: fill(slotsA), displaySlotsB: fill(slotsB) };
    }, [room]);

    if (loading) {
        return (
            <Screen style={styles.screen} scroll={false}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator color={COLORS.accent} />
                </View>
            </Screen>
        );
    }

    const captainUidAResolved = room?.captainUidA || room?.hostUid;
    const captainUidBResolved = room?.captainUidB || null;
    const canManageTeamA = isHost || (!!captainUidAResolved && user?.uid === captainUidAResolved);
    const canManageTeamB = isHost || (!!captainUidBResolved && user?.uid === captainUidBResolved) || (!captainUidBResolved && isHost);
    const canInviteTeamA = !!captainUidAResolved && user?.uid === captainUidAResolved;
    const canInviteTeamB = !!user?.uid && (user.uid === captainUidBResolved || (!captainUidBResolved && isHost));

    if (!room) return null;

    // Calculate available roles
    const availableRoles: any[] = []; // room.requiredRoles removed from schema

    return (
        <Screen style={styles.screen} scroll={false}>
            <AppHeader
                title="Lobby Details"
                onBack={() => router.back()}
                inlineTitle
                rightAction={(
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        {isJoined && !isHost && (
                            <TouchableOpacity
                                onPressIn={() => {
                                    if (touchDebugEnabled) {
                                        Logger.debug("TouchDebug", "pressIn", { tag: "lobby_header_leave" });
                                    }
                                }}
                                onPress={handleLeave}
                                activeOpacity={0.85}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <MaterialIcons name="exit-to-app" size={24} color={COLORS.error} />
                            </TouchableOpacity>
                        )}
                        {isHost && (
                            <TouchableOpacity
                                onPressIn={() => {
                                    if (touchDebugEnabled) {
                                        Logger.debug("TouchDebug", "pressIn", { tag: "lobby_header_delete" });
                                    }
                                }}
                                onPress={handleDelete}
                                activeOpacity={0.85}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <MaterialIcons name="delete-outline" size={24} color={COLORS.error} />
                            </TouchableOpacity>
                        )}
                        {user?.uid && participantUids.has(user.uid) && (
                            <TouchableOpacity
                                onPressIn={() => {
                                    if (touchDebugEnabled) {
                                        Logger.debug("TouchDebug", "pressIn", { tag: "lobby_header_chat" });
                                    }
                                }}
                                onPress={() => router.push(`/matchrooms/chat/${id}`)}
                                activeOpacity={0.85}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <MaterialIcons name="chat" size={24} color={COLORS.accent} />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            onPressIn={() => {
                                if (touchDebugEnabled) {
                                    Logger.debug("TouchDebug", "pressIn", { tag: "lobby_header_share" });
                                }
                            }}
                            onPress={handleShare}
                            activeOpacity={0.85}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <MaterialIcons name="share" size={24} color={COLORS.accent} />
                        </TouchableOpacity>
                    </View>
                )}
            />

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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

                {/* Matchroom QR (Locked Rooms) */}
                {isLocked && qrValue ? (
                    <View style={styles.qrCard}>
                        <View style={styles.qrHeader}>
                            <Text style={styles.qrTitle}>Matchroom QR</Text>
                            <Text style={styles.qrSubtitle}>Scan to open this lobby</Text>
                        </View>
                        <View style={styles.qrBody}>
                            <QRCode value={qrValue} size={140} backgroundColor="transparent" color={COLORS.text} />
                            <View style={styles.qrInfo}>
                                <Text style={styles.qrCodeLabel}>Match Code</Text>
                                <Text style={styles.qrCodeValue}>{matchCode || '—'}</Text>
                                <Text style={styles.qrHint}>Admin can use this code if QR fails.</Text>
                            </View>
                        </View>
                    </View>
                ) : null}

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
                                        const series = (room as any).seriesType;
                                        if (series === 'BO1') duration = 60;
                                        else if (series === 'BO3') duration = (room.game === 'fc26') ? 60 : 180;
                                        else if (series === 'BO5') duration = (room.game === 'fc26') ? 120 : 300;
                                        else if (series === 'BO7') duration = 60; // Tekken
                                        else if (series === 'BO20') duration = 120;
                                        else if (series === 'BO40') duration = 180;
                                        else if ((room as any).durationHours) duration = (room as any).durationHours * 60;
                                        else if (room.format?.includes('BO1')) duration = 60;
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
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md }}>
                    <Text style={styles.sectionTitle}>
                        {(room.slotsA?.length || 0) > 0 ? 'Teams' : `Squad (${room.players?.length || 0}/${room.maxPlayers})`}
                    </Text>
                    {(room.slotsA?.length || 0) > 0 && (
                        <Text style={[styles.dateText, { fontSize: 12 }]}>
                            {room.players?.length || 0}/{room.maxPlayers} Players
                        </Text>
                    )}
                </View>

                {(room.slotsA?.length || 0) > 0 ? (
                    <View style={[styles.teamsWrapper, { flexDirection: width < 600 ? 'column' : 'row' }]}>
                        {/* Team A */}
                        <View style={[styles.teamContainer, { flex: width < 600 ? 0 : 1, width: width < 600 ? '100%' : 'auto' }]}>
                            <View style={styles.teamTitleContainer}>
                                <Text style={styles.teamTitle}>TEAM A</Text>
                            </View>
                            {(displaySlotsA || []).map((slot, idx) => (
                                <View key={slot.slotId || `A${idx}`} style={styles.slotRow}>
                                    <View style={styles.slotAvatar}>
                                        <Text style={styles.slotAvatarText}>
                                            {slot.user ? slot.user.username.charAt(0).toUpperCase() : (idx + 1)}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.slotInfo}
                                        disabled={!slot.user || slot.user.uid === user?.uid || !canManageTeamA}
                                        onPress={() => slot.user && handleManagePlayer('A', slot.user.uid, slot.user.username)}
                                    >
                                        {slot.user ? (
                                            <View>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                                        <Text style={styles.slotName} numberOfLines={1}>{slot.user.username}</Text>
                                                        {captainUidAResolved === slot.user.uid && (
                                                            <FontAwesome5 name="crown" size={10} color={COLORS.warning} style={{ marginLeft: 4 }} />
                                                        )}
                                                    </View>
                                                    {canManageTeamA && slot.user.uid !== user?.uid && (
                                                        <TouchableOpacity
                                                            onPress={() => handleManagePlayer('A', slot.user!.uid, slot.user!.username)}
                                                            style={{ padding: 4 }}
                                                        >
                                                            <MaterialIcons name="more-vert" size={16} color={COLORS.muted} />
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                                    <Text style={styles.slotRoleName}>
                                                        {slot.role && slot.role !== 'Captain' && slot.role !== 'Player' && !slot.role.startsWith('Team') ? slot.role : 'Flex'}
                                                    </Text>
                                                    {playerRatings[slot.user.uid] && (
                                                        <View style={{ marginLeft: 8 }}>
                                                            <SkillBadge
                                                                tier={playerRatings[slot.user.uid]!.tier}
                                                                rating={playerRatings[slot.user.uid]!.rating}
                                                                size="compact"
                                                            />
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
                                        ) : (
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <MaterialIcons name="add-circle-outline" size={14} color={COLORS.textSecondary} style={{ marginRight: 6, opacity: 0.5 }} />
                                                <Text style={styles.emptySlotName}>Available Slot</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                    {!slot.user && (
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                            {canInviteTeamA && (
                                                <TouchableOpacity
                                                    style={styles.inviteSlotButton}
                                                    onPress={() => handleInvitePress('A', slot.slotId)}
                                                >
                                                    <Text style={styles.inviteSlotText}>Invite</Text>
                                                </TouchableOpacity>
                                            )}
                                            {!isJoined && canJoin && (
                                                (() => {
                                                    const status = requestedSlots.get(slot.slotId);
                                                    if (status === 'pending') {
                                                        return (
                                                            <TouchableOpacity
                                                                style={[styles.joinSlotButton, { backgroundColor: COLORS.muted }]}
                                                                onPress={() => Alert.alert("Cancel Request?", "Do you want to cancel your request for this slot?", [
                                                                    { text: "No", style: "cancel" },
                                                                    { text: "Yes, Cancel", style: "destructive", onPress: handleCancelRequest }
                                                                ])}
                                                            >
                                                                <Text style={styles.joinSlotText}>Requested</Text>
                                                            </TouchableOpacity>
                                                        );
                                                    } else if (status === 'rejected') {
                                                        return (
                                                            <TouchableOpacity
                                                                style={[styles.joinSlotButton, { backgroundColor: COLORS.error }]}
                                                                onPress={() => Alert.alert("Request Rejected", "The host has rejected your request for this slot.", [
                                                                    { text: "Dismiss", onPress: handleCancelRequest }
                                                                ])}
                                                            >
                                                                <Text style={styles.joinSlotText}>Rejected</Text>
                                                            </TouchableOpacity>
                                                        );
                                                    } else {
                                                        return (
                                                            <TouchableOpacity
                                                                style={styles.joinSlotButton}
                                                                onPress={() => handleRequestJoin(`Team A`, slot.slotId)}
                                                            >
                                                                <Text style={styles.joinSlotText}>Join</Text>
                                                            </TouchableOpacity>
                                                        );
                                                    }
                                                })()
                                            )}
                                        </View>
                                    )}
                                </View>
                            ))}
                        </View>

                        {/* Team B */}
                        <View style={[styles.teamContainer, { flex: width < 600 ? 0 : 1, width: width < 600 ? '100%' : 'auto' }]}>
                            <View style={styles.teamTitleContainer}>
                                <Text style={styles.teamTitle}>TEAM B</Text>
                            </View>
                            {(displaySlotsB || []).map((slot, idx) => (
                                <View key={slot.slotId || `B${idx}`} style={styles.slotRow}>
                                    <View style={styles.slotAvatar}>
                                        <Text style={styles.slotAvatarText}>
                                            {slot.user ? slot.user.username.charAt(0).toUpperCase() : (idx + 1)}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.slotInfo}
                                        disabled={!slot.user || slot.user.uid === user?.uid || !canManageTeamB}
                                        onPress={() => slot.user && handleManagePlayer('B', slot.user.uid, slot.user.username)}
                                    >
                                        {slot.user ? (
                                            <View>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                                        <Text style={styles.slotName} numberOfLines={1}>{slot.user.username}</Text>
                                                        {captainUidBResolved === slot.user.uid && (
                                                            <FontAwesome5 name="crown" size={10} color={COLORS.warning} style={{ marginLeft: 4 }} />
                                                        )}
                                                    </View>
                                                    {canManageTeamB && slot.user.uid !== user?.uid && (
                                                        <TouchableOpacity
                                                            onPress={() => handleManagePlayer('B', slot.user!.uid, slot.user!.username)}
                                                            style={{ padding: 4 }}
                                                        >
                                                            <MaterialIcons name="more-vert" size={16} color={COLORS.muted} />
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                                    <Text style={styles.slotRoleName}>
                                                        {slot.role && slot.role !== 'Captain' && slot.role !== 'Player' && !slot.role.startsWith('Team') ? slot.role : 'Flex'}
                                                    </Text>
                                                    {playerRatings[slot.user.uid] && (
                                                        <View style={{ marginLeft: 8 }}>
                                                            <SkillBadge
                                                                tier={playerRatings[slot.user.uid]!.tier}
                                                                rating={playerRatings[slot.user.uid]!.rating}
                                                                size="compact"
                                                            />
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
                                        ) : (
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <MaterialIcons name="add-circle-outline" size={14} color={COLORS.textSecondary} style={{ marginRight: 6, opacity: 0.5 }} />
                                                <Text style={styles.emptySlotName}>Available Slot</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                    {!slot.user && (
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                            {canInviteTeamB && (
                                                <TouchableOpacity
                                                    style={styles.inviteSlotButton}
                                                    onPress={() => handleInvitePress('B', slot.slotId)}
                                                >
                                                    <Text style={styles.inviteSlotText}>Invite</Text>
                                                </TouchableOpacity>
                                            )}
                                            {!isJoined && canJoin && (
                                                (() => {
                                                    const status = requestedSlots.get(slot.slotId);
                                                    if (status === 'pending') {
                                                        return (
                                                            <TouchableOpacity
                                                                style={[styles.joinSlotButton, { backgroundColor: COLORS.muted }]}
                                                                onPress={() => Alert.alert("Cancel Request?", "Do you want to cancel your request for this slot?", [
                                                                    { text: "No", style: "cancel" },
                                                                    { text: "Yes, Cancel", style: "destructive", onPress: handleCancelRequest }
                                                                ])}
                                                            >
                                                                <Text style={styles.joinSlotText}>Requested</Text>
                                                            </TouchableOpacity>
                                                        );
                                                    } else if (status === 'rejected') {
                                                        return (
                                                            <TouchableOpacity
                                                                style={[styles.joinSlotButton, { backgroundColor: COLORS.error }]}
                                                                onPress={() => Alert.alert("Request Rejected", "The host has rejected your request for this slot.", [
                                                                    { text: "Dismiss", onPress: handleCancelRequest }
                                                                ])}
                                                            >
                                                                <Text style={styles.joinSlotText}>Rejected</Text>
                                                            </TouchableOpacity>
                                                        );
                                                    } else {
                                                        return (
                                                            <TouchableOpacity
                                                                style={styles.joinSlotButton}
                                                                onPress={() => handleRequestJoin(`Team B`, slot.slotId)}
                                                            >
                                                                <Text style={styles.joinSlotText}>Join</Text>
                                                            </TouchableOpacity>
                                                        );
                                                    }
                                                })()
                                            )}
                                        </View>
                                    )}
                                </View>
                            ))}
                        </View>
                    </View>
                ) : (
                    <View style={styles.playersContainer}>
                        {(room.players || []).map((player, idx) => (
                            <View key={player.uid} style={styles.slotRow}>
                                <View style={styles.slotAvatar}>
                                    <Text style={styles.slotAvatarText}>{player.username.charAt(0).toUpperCase()}</Text>
                                </View>
                                <View style={styles.slotInfo}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                            <Text style={styles.slotName}>{player.username}</Text>
                                            {player.uid === room.hostUid && (
                                                <View style={[styles.captainBadge, { marginLeft: 8 }]}>
                                                    <Text style={styles.captainText}>HOST</Text>
                                                </View>
                                            )}
                                        </View>
                                        {player.uid === user?.uid && (
                                            <MaterialIcons name="person" size={16} color={COLORS.accent} style={{ opacity: 0.6 }} />
                                        )}
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                        {player.role && (
                                            <Text style={styles.slotRoleName}>
                                                {player.role && player.role !== 'Captain' && player.role !== 'Player' && !player.role.startsWith('Team') ? player.role : 'Flex'}
                                            </Text>
                                        )}
                                        {playerRatings[player.uid] && (
                                            <View style={{ marginLeft: 8 }}>
                                                <SkillBadge
                                                    tier={playerRatings[player.uid]!.tier}
                                                    rating={playerRatings[player.uid]!.rating}
                                                    size="compact"
                                                />
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

            </ScrollView>

            {/* Footer Actions */}
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + SPACING.sm, SPACING.lg + 12) }]}>
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
                                {requestedSlots.size > 0 || genericRequestStatus ? (
                                    <View>
                                        <Text style={{ textAlign: 'center', color: COLORS.muted, marginBottom: 8 }}>
                                            {genericRequestStatus === 'rejected' || Array.from(requestedSlots.values()).includes('rejected')
                                                ? "Some requests were rejected."
                                                : (requestedSlots.size > 0
                                                    ? `You have requested ${requestedSlots.size} slot${requestedSlots.size > 1 ? 's' : ''}.`
                                                    : 'Request Sent. Waiting for host approval.')}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() => {
                                                if (touchDebugEnabled) {
                                                    Logger.debug("TouchDebug", "press", { tag: "lobby_cancel_request" });
                                                }
                                                handleCancelRequest();
                                            }}
                                            onPressIn={() => {
                                                if (touchDebugEnabled) {
                                                    Logger.debug("TouchDebug", "pressIn", { tag: "lobby_cancel_request" });
                                                }
                                            }}
                                            disabled={requestLoading}
                                            style={styles.cancelRequestButton}
                                            activeOpacity={0.85}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            {requestLoading ? (
                                                <ActivityIndicator color={COLORS.error} />
                                            ) : (
                                                <Text style={styles.cancelRequestButtonText}>Cancel Request</Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.getRequestButton}
                                        onPress={() => {
                                            if (touchDebugEnabled) {
                                                Logger.debug("TouchDebug", "press", { tag: "lobby_request_join" });
                                            }
                                            handleRequestJoin();
                                        }}
                                        onPressIn={() => {
                                            if (touchDebugEnabled) {
                                                Logger.debug("TouchDebug", "pressIn", { tag: "lobby_request_join" });
                                            }
                                        }}
                                        activeOpacity={0.85}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Text style={styles.getRequestButtonText}>Request to Join</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    ) : (
                        <View style={styles.footerRow}>
                            {isHost && (isFull || room.isLocked) ? (
                                <TouchableOpacity
                                    onPressIn={() => {
                                        if (touchDebugEnabled) {
                                            Logger.debug("TouchDebug", "pressIn", { tag: "lobby_start_match" });
                                        }
                                    }}
                                    onPress={handleStartMatch}
                                    disabled={starting}
                                    style={[styles.joinButton, { flex: 1, backgroundColor: COLORS.success }]}
                                    activeOpacity={0.85}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
                                    onPress={() => {
                                        if (touchDebugEnabled) {
                                            Logger.debug("TouchDebug", "press", { tag: "lobby_leave" });
                                        }
                                        handleLeave();
                                    }}
                                    onPressIn={() => {
                                        if (touchDebugEnabled) {
                                            Logger.debug("TouchDebug", "pressIn", { tag: "lobby_leave" });
                                        }
                                    }}
                                    disabled={joining}
                                    style={[styles.secondaryButton, { flex: 1 }]}
                                    activeOpacity={0.85}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
                                onPressIn={() => {
                                    if (touchDebugEnabled) {
                                        Logger.debug("TouchDebug", "pressIn", { tag: "lobby_report_result" });
                                    }
                                }}
                                onPress={handleResultSubmission}
                                style={[styles.joinButton, { backgroundColor: COLORS.warning }]}
                                activeOpacity={0.85}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Text style={styles.joinButtonText}>Report Result</Text>
                            </TouchableOpacity>
                        )}

                        {/* Participant Vote Action */}
                        {room.resultVerification?.status === 'participant_vote' && isJoined && (
                            <TouchableOpacity
                                onPressIn={() => {
                                    if (touchDebugEnabled) {
                                        Logger.debug("TouchDebug", "pressIn", { tag: "lobby_vote_dispute" });
                                    }
                                }}
                                onPress={handleVote}
                                style={[styles.joinButton, { backgroundColor: COLORS.error }]}
                                activeOpacity={0.85}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Text style={styles.joinButtonText}>Vote on Dispute</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>

            {/* Invite Friends Modal */}
            <Modal
                visible={showInviteModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowInviteModal(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setShowInviteModal(false)}
                >
                    <Pressable style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Invite Teammate</Text>
                            <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                                <MaterialIcons name="close" size={24} color={COLORS.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {loadingFriends ? (
                            <View style={{ padding: 40, alignItems: 'center' }}>
                                <ActivityIndicator color={COLORS.accent} />
                            </View>
                        ) : (
                            <FlatList
                                data={friends}
                                keyExtractor={(item: any) => item.uid || item.id}
                                ListEmptyComponent={
                                    <View style={styles.friendListEmpty}>
                                        <MaterialIcons name="person-add-disabled" size={48} color={COLORS.overlayMedium} />
                                        <Text style={styles.emptyModalText}>No friends found to invite.</Text>
                                    </View>
                                }
                                renderItem={({ item }: { item: any }) => (
                                    <View style={styles.friendItem}>
                                        <View style={styles.friendAvatar}>
                                            <Text style={[styles.avatarText, { color: COLORS.accent }]}>
                                                {item.username?.charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                        <Text style={styles.friendName}>{item.username}</Text>
                                        <TouchableOpacity
                                            style={styles.sendInviteButton}
                                            onPress={() => handleSendInvite(item)}
                                            disabled={joining}
                                        >
                                            <Text style={styles.sendInviteText}>Invite</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                                contentContainerStyle={{ paddingVertical: 16 }}
                            />
                        )}
                    </Pressable>
                </Pressable>
            </Modal>
        </Screen>
    );
}

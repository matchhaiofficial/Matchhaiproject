import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, deleteDoc, doc, getDoc, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Dimensions, FlatList, PanResponder, Pressable, StatusBar, Text, TouchableOpacity, View } from "react-native";
import AppHeader from "../../src/components/AppHeader";
import Screen from "../../src/components/Screen";
import SegmentedTabs from "../../src/components/SegmentedTabs";
import { db } from "../../src/config/firebaseConfig";
import { useAuth } from "../../src/context/AuthContext";
import { claimSeatTransaction } from "../../src/services/bookingService";
import { respondFriendRequest, respondToJoinRequest, respondToMatchroomInvite, respondToMatchroomJoinRequest, respondToTeamInvite } from "../../src/services/functions";
import { COLORS } from "../../src/theme";
import Logger from "../../src/utils/logger";
import styles from "./inbox.styles";

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = -80;

interface Notification {
    id: string;
    type:
        | 'friend_request'
        | 'team_invite'
        | 'team_join_request'
        | 'team_join_decision'
        | 'match_booking_captain_approval'
        | 'match_seat_invitation'
        | 'match_join_request'
        | 'team_match_challenge'
        | 'team_match_challenge_update'
        | 'booking_request_accepted'
        | 'booking_request_rejected'
        | 'booking_counter_offer';
    fromUid: string;
    fromUsername: string;
    status: 'pending' | 'accepted' | 'declined' | 'rejected';
    createdAt: any;
    expiresAt?: any;
    title?: string;
    message?: string;
    reason?: string;
    meta?: {
        teamId?: string;
        teamName?: string;
        game?: string;
        gameKey?: string;
        requesterSnapshot?: {
            city?: string;
            skillTier?: Record<string, string>;
            linked?: { steam?: boolean; faceit?: boolean; psn?: boolean; xbox?: boolean };
        };
        matchroomId?: string;
        matchroomTitle?: string;
        intentId?: string;
        side?: string;
        role?: string;
        challengeId?: string;
        challengerTeamName?: string;
        opponentTeamName?: string;
    };
}

const getTimeAgo = (timestamp: any): string => {
    if (!timestamp?.toDate) return 'Just now';
    const now = new Date();
    const then = timestamp.toDate();
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString();
};

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
    if (!key || key === "match") return "match";
    return GAME_LABELS[key] || key.toUpperCase();
};

const REASON_LABELS: Record<string, string> = {
    full_booked: "Venue is fully booked",
    fully_booked: "Venue is fully booked",
    team_full: "Team is full",
    room_full: "Room is full",
    room_locked: "Room is locked",
    room_expired: "Room has expired",
    slot_unavailable: "Selected slot is unavailable",
    time_conflict: "Schedule conflict",
};

const toTitleCase = (value: string) =>
    value
        .split(" ")
        .filter(Boolean)
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
        .join(" ");

const normalizeReasonLabel = (reason?: string | null) => {
    const key = String(reason || "").trim().toLowerCase();
    if (!key) return "";
    if (REASON_LABELS[key]) return REASON_LABELS[key];
    return toTitleCase(key.replace(/[_-]+/g, " "));
};

const extractReasonCode = (message?: string | null) => {
    const text = String(message || "").trim();
    if (!text) return "";
    const match = text.match(/reason:\s*([a-z0-9_-]+)/i);
    return (match?.[1] || "").trim().toLowerCase();
};

export default function Inbox() {
    const router = useRouter();
    const { user } = useAuth();

    const [activeTab, setActiveTab] = useState<'pending' | 'resolved'>('pending');
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const touchDebugEnabled = __DEV__ && process.env.EXPO_PUBLIC_TOUCH_DEBUG === '1';

    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, "notifications"),
            where("toUid", "==", user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: Notification[] = [];
            snapshot.forEach(doc => {
                list.push({ id: doc.id, ...doc.data() } as Notification);
            });
            list.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            setNotifications(list);
            setLoading(false);
        }, (error) => {
            Logger.error("Inbox", "Error listening to notifications", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const handleFriendResponse = async (notifId: string, decision: 'accept' | 'decline') => {
        if (processing) return;
        setProcessing(notifId);
        try {
            const res = await respondFriendRequest({ notificationId: notifId, decision });
            if (!res.ok) alert(res.message);
        } catch (e) {
            console.error(e);
        } finally {
            setProcessing(null);
        }
    };

    const handleJoinResponse = async (notifId: string, decision: 'accept' | 'reject') => {
        if (processing) return;
        setProcessing(notifId);
        try {
            const res = await respondToJoinRequest({ notificationId: notifId, decision });
            if (!res.ok) alert(res.message || 'Failed to respond.');
        } catch (e) {
            console.error(e);
        } finally {
            setProcessing(null);
        }
    };

    const handleMatchJoinResponse = async (notifId: string, decision: 'accept' | 'reject') => {
        if (processing) return;
        setProcessing(notifId);
        try {
            const res = await respondToMatchroomJoinRequest({ notificationId: notifId, decision });
            if (!res.ok) alert(res.message || 'Failed to respond.');
        } catch (e) {
            console.error(e);
        } finally {
            setProcessing(null);
        }
    };

    const handleInviteResponse = async (notifId: string, decision: 'accept' | 'decline') => {
        if (processing) return;
        setProcessing(notifId);
        try {
            const res = await respondToTeamInvite({ notificationId: notifId, decision });
            if (!res.ok) alert(res.message || 'Failed to respond.');
        } catch (e) {
            console.error(e);
        } finally {
            setProcessing(null);
        }
    };

    const handleBookingApproval = async (notifId: string, intentId: string, decision: 'approved' | 'rejected') => {
        if (processing) return;
        setProcessing(notifId);
        try {
            // Update the intent
            const intentRef = doc(db, "booking_intents", intentId);
            await updateDoc(intentRef, {
                'approvals.captain.status': decision,
                'approvals.captain.decidedBy': user?.uid,
                'approvals.captain.decidedAt': serverTimestamp(),
                // If rejected, update overall status
                ...(decision === 'rejected' ? { status: 'rejected' } : {})
            });

            // Update notification
            await updateDoc(doc(db, "notifications", notifId), {
                status: decision === 'approved' ? 'accepted' : 'rejected'
            });

        } catch (e) {
            Logger.error("Inbox", "Error handling booking approval", e);
            alert("Failed to update approval.");
        } finally {
            setProcessing(null);
        }
    };

    const handleSeatInvitation = async (notifId: string, matchroomId: string, intentId: string | undefined, side: string, role: string, decision: 'accept' | 'decline') => {
        if (processing) return;
        setProcessing(notifId);
        try {
            if (decision === 'accept') {
                if (intentId) {
                    // Booking Intent Flow (Legacy)
                    const intentSnap = await getDoc(doc(db, "booking_intents", intentId));
                    if (intentSnap.exists()) {
                        const data = intentSnap.data();
                        const slotIds = data.selectedSlots as string[];
                        const invitees = data.invitees as any[];
                        const myIdx = invitees.findIndex(i => i.uid === user?.uid);
                        if (myIdx !== -1) {
                            const mySlotId = slotIds[myIdx];
                            const res = await claimSeatTransaction(matchroomId, intentId, mySlotId);
                            if (!res.ok) {
                                alert(res.message);
                                setProcessing(null);
                                return;
                            }
                        }
                    }
                } else {
                    // Direct Captain Invitation Flow (New)
                    const res = await respondToMatchroomInvite({ notificationId: notifId, decision: 'accept' });
                    if (!res.ok) {
                        alert(res.message || 'Failed to join seat.');
                        setProcessing(null);
                        return;
                    }
                }
            } else if (decision === 'decline') {
                // Handle decline for both types
                if (!intentId) {
                    await respondToMatchroomInvite({ notificationId: notifId, decision: 'decline' });
                }
            }

            // Update notification
            await updateDoc(doc(db, "notifications", notifId), {
                status: decision === 'accept' ? 'accepted' : 'rejected'
            });

        } catch (e) {
            Logger.error("Inbox", "Error handling seat invitation", e);
            alert("Failed to respond to invitation.");
        } finally {
            setProcessing(null);
        }
    };

    // Delete a single notification
    const handleDeleteNotification = async (notifId: string) => {
        try {
            await deleteDoc(doc(db, "notifications", notifId));
        } catch (e) {
            Logger.error("Inbox", "Error deleting notification", e);
            Alert.alert("Error", "Failed to delete notification.");
        }
    };

    // Clear all resolved notifications
    const handleClearAllHistory = async () => {
        const resolvedNotifs = notifications.filter(n => n.status !== 'pending');
        if (resolvedNotifs.length === 0) return;

        Alert.alert(
            "Clear All History",
            `Are you sure you want to delete ${resolvedNotifs.length} notification(s)?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear All",
                    style: "destructive",
                    onPress: async () => {
                        setDeleting(true);
                        try {
                            const batch = writeBatch(db);
                            resolvedNotifs.forEach(n => {
                                batch.delete(doc(db, "notifications", n.id));
                            });
                            await batch.commit();
                        } catch (e) {
                            Logger.error("Inbox", "Error clearing history", e);
                            Alert.alert("Error", "Failed to clear history.");
                        } finally {
                            setDeleting(false);
                        }
                    }
                }
            ]
        );
    };

    const pendingCount = notifications.filter(n => {
        const isRejectedChallengeNotification =
            (n.type === 'team_match_challenge' || n.type === 'team_match_challenge_update') &&
            n.status === 'rejected';
        if (isRejectedChallengeNotification) return false;
        if (n.status !== 'pending') return false;
        if (n.expiresAt) {
            const expiresMs = n.expiresAt?.toMillis ? n.expiresAt.toMillis() : (n.expiresAt instanceof Date ? n.expiresAt.getTime() : n.expiresAt);
            if (expiresMs < Date.now()) return false;
        }
        return true;
    }).length;

    const filtered = notifications.filter(n => {
        const isRejectedChallengeNotification =
            (n.type === 'team_match_challenge' || n.type === 'team_match_challenge_update') &&
            n.status === 'rejected';
        if (isRejectedChallengeNotification) return false;

        const isPending = n.status === 'pending';

        // Expiration check for pending items
        if (isPending && n.expiresAt) {
            const expiresMs = n.expiresAt?.toMillis ? n.expiresAt.toMillis() : (n.expiresAt instanceof Date ? n.expiresAt.getTime() : n.expiresAt);
            if (expiresMs < Date.now()) {
                return false; // Hide expired pending items
            }
        }

        if (activeTab === 'pending') return isPending;
        return !isPending;
    });

    const openProfile = (uid?: string) => {
        if (!uid) return;
        router.push(`/(player)/profile/${uid}` as any);
    };

    const openTeam = (teamId?: string) => {
        if (!teamId) return;
        router.push(`/teams/${teamId}` as any);
    };

    const openMatchroom = (matchroomId?: string) => {
        if (!matchroomId) return;
        router.push(`/matchrooms/${matchroomId}` as any);
    };

    const openChallenge = (challengeId?: string) => {
        if (!challengeId) return;
        router.push(`/teams/challenge?id=${challengeId}` as any);
    };

    // Swipeable row component for delete action
    const SwipeableRow = ({ children, onDelete, canSwipe }: { children: React.ReactNode; onDelete: () => void; canSwipe: boolean }) => {
        const translateX = useRef(new Animated.Value(0)).current;
        const rowOpacity = useRef(new Animated.Value(1)).current;
        const isDeleting = useRef(false);
        const gestureActive = useRef(false);

        const DELETE_THRESHOLD = SCREEN_WIDTH * 0.35;

        const panResponder = useRef(
            PanResponder.create({
                // Capture phase - claim gesture before children
                onStartShouldSetPanResponderCapture: () => false,
                onMoveShouldSetPanResponderCapture: (_, gestureState) => {
                    // Capture LEFT swipes before scroll view can
                    const isLeftSwipe = gestureState.dx < -10;
                    const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
                    return isLeftSwipe && isHorizontal && !isDeleting.current;
                },

                onStartShouldSetPanResponder: () => false,
                onMoveShouldSetPanResponder: (_, gestureState) => {
                    const isLeftSwipe = gestureState.dx < -10;
                    const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
                    return isLeftSwipe && isHorizontal && !isDeleting.current;
                },

                // Reject termination - don't let other responders steal our gesture
                onPanResponderTerminationRequest: () => !gestureActive.current,

                onPanResponderGrant: () => {
                    gestureActive.current = true;
                    translateX.stopAnimation();
                    translateX.setValue(0);
                },

                onPanResponderMove: (_, gestureState) => {
                    if (isDeleting.current || !gestureActive.current) return;
                    // Only allow left movement (negative dx)
                    const clampedDx = Math.max(-SCREEN_WIDTH, Math.min(0, gestureState.dx));
                    translateX.setValue(clampedDx);
                },

                onPanResponderRelease: (_, gestureState) => {
                    gestureActive.current = false;
                    if (isDeleting.current) return;

                    const shouldDelete = gestureState.dx < -DELETE_THRESHOLD ||
                        (gestureState.vx < -0.8 && gestureState.dx < -50);

                    if (shouldDelete) {
                        triggerDelete();
                    } else {
                        Animated.spring(translateX, {
                            toValue: 0,
                            useNativeDriver: true,
                            friction: 8,
                            tension: 60,
                        }).start();
                    }
                },

                onPanResponderTerminate: () => {
                    gestureActive.current = false;
                    if (!isDeleting.current) {
                        Animated.spring(translateX, {
                            toValue: 0,
                            useNativeDriver: true,
                            friction: 8,
                            tension: 60,
                        }).start();
                    }
                },
            })
        ).current;

        const triggerDelete = () => {
            if (isDeleting.current) return;
            isDeleting.current = true;

            // Smooth slide out and fade animation
            Animated.parallel([
                Animated.timing(translateX, {
                    toValue: -SCREEN_WIDTH,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.sequence([
                    Animated.delay(100),
                    Animated.timing(rowOpacity, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: true,
                    }),
                ]),
            ]).start(() => {
                onDelete();
            });
        };

        // Scale up delete icon as you swipe further
        const deleteScale = translateX.interpolate({
            inputRange: [-DELETE_THRESHOLD, -100, 0],
            outputRange: [1.3, 1, 0.9],
            extrapolate: 'clamp',
        });

        // Fade in delete content as you swipe
        const deleteOpacity = translateX.interpolate({
            inputRange: [-80, -30, 0],
            outputRange: [1, 0.7, 0],
            extrapolate: 'clamp',
        });

        return (
            <Animated.View style={{
                marginBottom: 12,
                overflow: 'hidden',
                opacity: rowOpacity,
            }}>
                <View style={{ position: 'relative' }}>
                    {/* Full-width red background that reveals as card slides */}
                    <View
                        style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: 0,
                            bottom: 0,
                            backgroundColor: COLORS.error,
                            borderRadius: 12,
                        }}
                    >
                        {/* Delete icon container - stays right-aligned */}
                        <Animated.View
                            style={{
                                position: 'absolute',
                                right: 0,
                                top: 0,
                                bottom: 0,
                                width: 100,
                                justifyContent: 'center',
                                alignItems: 'center',
                                opacity: deleteOpacity,
                            }}
                        >
                            <TouchableOpacity
                                onPress={triggerDelete}
                                style={{
                                    flex: 1,
                                    width: '100%',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                }}
                                activeOpacity={0.8}
                            >
                                <Animated.View style={{ transform: [{ scale: deleteScale }] }}>
                                    <MaterialIcons name="delete" size={28} color="#FFF" />
                                </Animated.View>
                                <Text style={{ color: '#FFF', fontSize: 12, marginTop: 4, fontWeight: '600' }}>Delete</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </View>
                    {/* Swipeable card */}
                    <Animated.View
                        style={{
                            transform: [{ translateX }],
                            backgroundColor: COLORS.cardBackground,
                            borderRadius: 12,
                        }}
                        {...(canSwipe ? panResponder.panHandlers : {})}
                    >
                        {children}
                    </Animated.View>
                </View>
            </Animated.View>
        );
    };

    const renderItem = ({ item }: { item: Notification }) => {
        const isRequest = item.type === 'friend_request';
        const isJoinRequest = item.type === 'team_join_request';
        const isMatchJoinRequest = item.type === 'match_join_request';
        const isTeamInvite = item.type === 'team_invite';
        const isDecision = item.type === 'team_join_decision';
        const isBookingApproval = item.type === 'match_booking_captain_approval';
        const isSeatInv = item.type === 'match_seat_invitation';
        const isTeamChallenge = item.type === 'team_match_challenge';
        const isTeamChallengeUpdate = item.type === 'team_match_challenge_update';
        const isBookingRequestAccepted = item.type === 'booking_request_accepted';
        const isBookingRequestRejected = item.type === 'booking_request_rejected';
        const isBookingCounterOffer = item.type === 'booking_counter_offer';
        const isBookingNotification = isBookingRequestAccepted || isBookingRequestRejected || isBookingCounterOffer;
        const isPending = item.status === 'pending';
        const isProcessing = processing === item.id;
        const challengeGameLabel = formatGameLabel(item.meta?.gameKey || item.meta?.game);
        const reasonCode = String(item.reason || extractReasonCode(item.message)).trim().toLowerCase();
        const friendlyReason = normalizeReasonLabel(reasonCode);
        const senderName = (item.fromUsername || '').trim() || (isBookingNotification ? 'Venue Admin' : 'Someone');
        const fallbackMessage = (() => {
            const raw = String(item.message || item.title || '').trim();
            if (raw) {
                if (/^reason:/i.test(raw)) {
                    return friendlyReason ? ` sent an update. Reason: ${friendlyReason}.` : ' sent an update.';
                }
                const sentence = /[.!?]$/.test(raw) ? raw : `${raw}.`;
                return ` ${sentence}`;
            }
            if (friendlyReason) return ` sent an update. Reason: ${friendlyReason}.`;
            return ' sent an update.';
        })();
        const hasKnownMessage =
            isRequest ||
            isTeamInvite ||
            isJoinRequest ||
            isDecision ||
            isBookingApproval ||
            isMatchJoinRequest ||
            isSeatInv ||
            isTeamChallenge ||
            isTeamChallengeUpdate ||
            isBookingNotification;
        const typeLabel = isRequest
            ? "Friend Request"
            : isJoinRequest
                ? "Team Join Request"
                : isMatchJoinRequest
                    ? "Matchroom Join Request"
                    : isTeamInvite
                        ? "Team Invitation"
                        : isBookingApproval
                            ? "Booking Approval"
                            : isSeatInv
                                ? "Seat Invitation"
                                : isBookingRequestAccepted
                                    ? "Booking Accepted"
                                    : isBookingRequestRejected
                                        ? "Booking Declined"
                                        : isBookingCounterOffer
                                            ? "Counter Offer"
                                : isTeamChallenge
                                    ? "Team Match Challenge"
                                    : isTeamChallengeUpdate
                                        ? "Challenge Update"
                                        : "Team Update";

        const isInfoType = isJoinRequest || isMatchJoinRequest || isTeamInvite || isBookingApproval || isSeatInv || isTeamChallenge || isTeamChallengeUpdate;
        const iconColor = isInfoType ? COLORS.accent : COLORS.success;
        const iconBg = isInfoType ? 'rgba(66, 165, 245, 0.1)' : 'rgba(76, 175, 80, 0.1)';

        const cardContent = (
            <View style={[styles.notificationCard, { marginBottom: 0 }]}>
                <View style={styles.cardHeader}>
                    <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
                        <MaterialIcons
                            name={isRequest ? "person-add" : (isJoinRequest || isTeamInvite ? "group" : (isBookingApproval ? "gavel" : (isSeatInv ? "event-seat" : (isTeamChallenge || isTeamChallengeUpdate ? "sports-esports" : "info"))))}
                            size={20}
                            color={iconColor}
                        />
                    </View>
                    <View style={styles.headerInfo}>
                        <Text style={styles.typeText}>{typeLabel}</Text>
                        <Text style={styles.timeText}>{getTimeAgo(item.createdAt)}</Text>
                    </View>
                    {!isPending && (
                        <View style={[
                            styles.statusBadge,
                            { backgroundColor: (item.status === 'accepted') ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)' }
                        ]}>
                            <Text style={[
                                styles.statusText,
                                { color: (item.status === 'accepted') ? COLORS.success : COLORS.error }
                            ]}>
                                {item.status.toUpperCase()}
                            </Text>
                        </View>
                    )}
                </View>

                <View style={styles.cardBody}>
                    <View style={styles.messageWrap}>
                        <Text style={styles.messageText}>
                            <Text
                                style={styles.highlightText}
                                onPress={item.fromUid ? () => openProfile(item.fromUid) : undefined}
                            >
                                {senderName}
                            </Text>
                            {isRequest && " wants to connect with you."}
                            {isTeamInvite && (
                                <>
                                    {" invited you to join "}
                                    <Text style={styles.inlineLinkText} onPress={() => openTeam(item.meta?.teamId)}>
                                        {item.meta?.teamName || "team"}
                                    </Text>
                                </>
                            )}
                            {isJoinRequest && (
                                <>
                                    {" wants to join "}
                                    <Text style={styles.inlineLinkText} onPress={() => openTeam(item.meta?.teamId)}>
                                        {item.meta?.teamName || "team"}
                                    </Text>
                                </>
                            )}
                            {isDecision && (
                                <>
                                    {item.status === 'accepted' ? " accepted your request to join " : " declined your request for "}
                                    <Text style={styles.inlineLinkText} onPress={() => openTeam(item.meta?.teamId)}>
                                        {item.meta?.teamName || "team"}
                                    </Text>
                                </>
                            )}
                            {isBookingApproval && (
                                <>
                                    {" requested to book multiple seats in your matchroom"}
                                    {!!item.meta?.matchroomTitle && (
                                        <>
                                            {" "}
                                            <Text style={styles.inlineLinkText} onPress={() => openMatchroom(item.meta?.matchroomId)}>
                                                {item.meta.matchroomTitle}
                                            </Text>
                                        </>
                                    )}
                                    {"."}
                                </>
                            )}
                            {isMatchJoinRequest && (
                                <>
                                    {" wants to join your matchroom "}
                                    <Text style={styles.inlineLinkText} onPress={() => openMatchroom(item.meta?.matchroomId)}>
                                        {item.meta?.matchroomTitle || "matchroom"}
                                    </Text>
                                    {" as "}
                                    <Text style={styles.inlineLinkText}>{item.meta?.role || "player"}</Text>
                                </>
                            )}
                            {isSeatInv && (
                                <>
                                    {" invited you to join a squad for a "}
                                    <Text style={styles.inlineLinkText}>{item.meta?.game}</Text>
                                    {" match."}
                                </>
                            )}
                            {isTeamChallenge && (
                                <>
                                    {item.status === 'pending' ? (
                                        <>
                                            {" challenged your team for "}
                                            <Text style={styles.challengeGameText}>{challengeGameLabel}</Text>
                                            {"."}
                                        </>
                                    ) : (
                                        <>
                                            {" challenge has been marked as "}
                                            <Text style={styles.inlineLinkText}>{item.status}</Text>
                                            {"."}
                                        </>
                                    )}
                                </>
                            )}
                            {isTeamChallengeUpdate && (
                                <>
                                    {item.status === 'accepted' ? (
                                        item.meta?.matchroomId ? (
                                            " accepted and confirmed. Matchroom is ready."
                                        ) : (
                                            " accepted. Open challenge workspace to continue."
                                        )
                                    ) : (
                                        " updated challenge status. Open the challenge workspace to continue."
                                    )}
                                </>
                            )}
                            {isBookingRequestAccepted && " accepted your booking request."}
                            {isBookingRequestRejected && (
                                <>
                                    {" declined your booking request."}
                                    {friendlyReason ? ` Reason: ${friendlyReason}.` : ""}
                                </>
                            )}
                            {isBookingCounterOffer && " sent a counter-offer for your booking request."}
                            {!hasKnownMessage && fallbackMessage}
                        </Text>
                    </View>

                    {isJoinRequest && isPending && item.meta?.requesterSnapshot && (
                        <View style={styles.requestMetaBox}>
                            <Text style={styles.requestMetaText}>
                                City: {item.meta.requesterSnapshot.city || 'N/A'} | Tier: {item.meta.requesterSnapshot.skillTier?.[item.meta.game || ''] || 'No rank'}
                            </Text>
                        </View>
                    )}
                    <View style={styles.contextChipsRow}>
                        {!!item.fromUid && (
                            <Pressable style={styles.contextChip} onPress={() => openProfile(item.fromUid)}>
                                <MaterialIcons name="person-outline" size={14} color={COLORS.accent} />
                                <Text style={styles.contextChipText}>Profile</Text>
                            </Pressable>
                        )}
                        {!!item.meta?.teamId && (
                            <Pressable style={styles.contextChip} onPress={() => openTeam(item.meta?.teamId)}>
                                <MaterialIcons name="groups-2" size={14} color={COLORS.accent} />
                                <Text style={styles.contextChipText}>Team</Text>
                            </Pressable>
                        )}
                        {!!item.meta?.matchroomId && (
                            <Pressable style={styles.contextChip} onPress={() => openMatchroom(item.meta?.matchroomId)}>
                                <MaterialIcons name="sports-esports" size={14} color={COLORS.accent} />
                                <Text style={styles.contextChipText}>Matchroom</Text>
                            </Pressable>
                        )}
                        {!!item.meta?.challengeId && (
                            <Pressable style={styles.contextChip} onPress={() => openChallenge(item.meta?.challengeId)}>
                                <MaterialIcons name="bolt" size={14} color={COLORS.accent} />
                                <Text style={styles.contextChipText}>Challenge</Text>
                            </Pressable>
                        )}
                    </View>
                </View>

                {isPending && (isRequest || isJoinRequest || isMatchJoinRequest || isTeamInvite || isBookingApproval || isSeatInv) && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            disabled={!!processing}
                            onPressIn={() => {
                                if (touchDebugEnabled) {
                                    Logger.debug("TouchDebug", "pressIn", { tag: "inbox_accept", id: item.id, type: item.type });
                                }
                            }}
                            onPress={() => {
                                if (isRequest) handleFriendResponse(item.id, 'accept');
                                else if (isJoinRequest) handleJoinResponse(item.id, 'accept');
                                else if (isMatchJoinRequest) handleMatchJoinResponse(item.id, 'accept');
                                else if (isTeamInvite) handleInviteResponse(item.id, 'accept');
                                else if (isBookingApproval) handleBookingApproval(item.id, item.meta!.intentId!, 'approved');
                                else if (isSeatInv) handleSeatInvitation(item.id, item.meta?.matchroomId || '', item.meta?.intentId, item.meta?.side || '', item.meta?.role || 'Flex', 'accept');
                            }}
                            style={styles.acceptButton}
                            activeOpacity={0.85}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            {isProcessing ? (
                                <ActivityIndicator color="#FFF" size="small" />
                            ) : (
                                <Text style={styles.buttonText}>
                                    {isSeatInv ? "Claim Seat" : "Approve"}
                                </Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            disabled={!!processing}
                            onPressIn={() => {
                                if (touchDebugEnabled) {
                                    Logger.debug("TouchDebug", "pressIn", { tag: "inbox_reject", id: item.id, type: item.type });
                                }
                            }}
                            onPress={() => {
                                if (isRequest) handleFriendResponse(item.id, 'decline');
                                else if (isJoinRequest) handleJoinResponse(item.id, 'reject');
                                else if (isMatchJoinRequest) handleMatchJoinResponse(item.id, 'reject');
                                else if (isTeamInvite) handleInviteResponse(item.id, 'decline');
                                else if (isBookingApproval) handleBookingApproval(item.id, item.meta!.intentId!, 'rejected');
                                else if (isSeatInv) handleSeatInvitation(item.id, item.meta?.matchroomId || '', item.meta?.intentId, item.meta?.side || '', item.meta?.role || 'Flex', 'decline');
                            }}
                            style={styles.declineButton}
                            activeOpacity={0.85}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Text style={styles.declineButtonText}>Reject</Text>
                        </TouchableOpacity>
                    </View>
                )}
                {(item.meta?.challengeId && (isTeamChallenge || isTeamChallengeUpdate || item.status !== 'pending')) && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={styles.openChallengeButton}
                            onPress={() => openChallenge(item.meta?.challengeId)}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.buttonText}>Open Challenge</Text>
                        </TouchableOpacity>
                        {!!item.meta?.matchroomId && (
                            <TouchableOpacity
                                style={styles.acceptButton}
                                onPress={() => openMatchroom(item.meta?.matchroomId)}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.buttonText}>View Matchroom</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>
        );

        // Only allow swipe-to-delete for resolved (history) items
        if (!isPending) {
            return (
                <SwipeableRow onDelete={() => handleDeleteNotification(item.id)} canSwipe={true}>
                    {cardContent}
                </SwipeableRow>
            );
        }

        return <View style={{ marginBottom: 12 }}>{cardContent}</View>;
    };

    return (
        <Screen style={styles.screen} scroll={false}>
            <StatusBar barStyle="light-content" />
            <AppHeader title="Inbox" onBack={() => router.back()} inlineTitle />

            <SegmentedTabs
                items={[
                    { key: 'pending', label: 'Pending', badge: pendingCount > 0 ? pendingCount : undefined },
                    { key: 'resolved', label: 'History' },
                ]}
                value={activeTab}
                onChange={setActiveTab}
                style={styles.segmentTabs}
            />

            {/* Clear All Button - Only visible in History tab when there are items */}
            {activeTab === 'resolved' && notifications.filter(n => {
                const isRejectedChallengeNotification =
                    (n.type === 'team_match_challenge' || n.type === 'team_match_challenge_update') &&
                    n.status === 'rejected';
                if (isRejectedChallengeNotification) return false;
                return n.status !== 'pending';
            }).length > 0 && (
                <TouchableOpacity
                    onPress={handleClearAllHistory}
                    onPressIn={() => {
                        if (touchDebugEnabled) {
                            Logger.debug("TouchDebug", "pressIn", { tag: "inbox_clear_history" });
                        }
                    }}
                    disabled={deleting}
                    style={styles.clearHistoryButton}
                    activeOpacity={0.85}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    {deleting ? (
                        <ActivityIndicator size="small" color={COLORS.error} />
                    ) : (
                        <>
                            <MaterialIcons name="delete-sweep" size={20} color={COLORS.error} />
                            <Text style={styles.clearHistoryText}>
                                Clear All History
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            )}

            {loading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyContent}>
                            <View style={styles.emptyIconContainer}>
                                <MaterialIcons name="inbox" size={40} color={COLORS.muted} />
                            </View>
                            <Text style={styles.emptyTitle}>
                                All Caught Up!
                            </Text>
                            <Text style={styles.emptySubtitle}>
                                {activeTab === 'pending'
                                    ? "No new requests right now."
                                    : "You haven't resolved any notifications yet."}
                            </Text>
                        </View>
                    }
                />
            )}
        </Screen>
    );
}

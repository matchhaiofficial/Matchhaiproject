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
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    useWindowDimensions,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import AppHeader from "../../src/components/AppHeader";
import Screen from "../../src/components/Screen";

import { collection, doc, getDoc, getDocs, limit, query, where, onSnapshot, orderBy } from "firebase/firestore";
import SkillBadge from "../../src/components/SkillBadge";
import { db } from "../../src/config/firebaseConfig";
import { useAuth } from "../../src/context/AuthContext";
import { getUserProfile } from "../../src/services/userService";
import { inviteToMatchroom, kickFromMatchroom, transferMatchroomCaptain } from "../../src/services/functions";
import { cancelMatchJoinRequest, deleteMatchroom, getMatchroom, isUserInActiveMatchroom, leaveMatchroom, Matchroom, requestJoinMatchroom, resolveMatchResultByAdmin, respondToMatchJoinRequest, startMatch } from "../../src/services/matchService";
import { getUserSportRoleLabel } from "../../src/services/userService";
import { submitMatchroomComplain } from "../../src/services/reportService";
import {
    acceptZoneBookingRequest,
    rejectZoneBookingRequest,
    sendZoneCounterOffer,
} from "../../src/services/zoneAdminBookingService";
import { GameSkillScore, SkillTier } from "../../src/services/skillRatingService";
import { COLORS, SPACING } from "../../src/theme";
import Logger from "../../src/utils/logger";
import { isRoomExpired, isRoomLocked, canSubmitComplain } from "../../src/utils/matchroomLifecycle";
import styles from "./detail.styles";

const DEFAULT_SKILL_RATING = 45;
const clampRating = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const WALKIN_SKILL_TIERS: SkillTier[] = ['Beginner', 'Intermediate', 'Advanced', 'Pro', 'Elite'];
const normalizeWalkInSkillTier = (value: unknown): SkillTier | null => {
    if (typeof value !== 'string') return null;
    const match = WALKIN_SKILL_TIERS.find((tier) => tier === value);
    return match || null;
};

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

    // Host/Admin Side: Incoming Requests
    const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
    const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

    // Role Selection State
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [selectedRole, setSelectedRole] = useState<string | null>(null);
    const [profile, setProfile] = useState<any>(null);

    const [playerRatings, setPlayerRatings] = useState<Record<string, GameSkillScore | null>>({});

    // Complain State
    const [showComplainModal, setShowComplainModal] = useState(false);
    const [complainReason, setComplainReason] = useState("");
    const [complainDescription, setComplainDescription] = useState("");
    const [submittingComplain, setSubmittingComplain] = useState(false);

    const COMPLAIN_REASONS = [
        "Toxic Behavior",
        "Cheating/Hacking",
        "AFK/Griefing",
        "Impersonation",
        "Inappropriate Name",
        "Other"
    ];

    // Invitation State
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [friends, setFriends] = useState<any[]>([]);
    const [loadingFriends, setLoadingFriends] = useState(false);
    const [invitingSlot, setInvitingSlot] = useState<{ team: 'A' | 'B', slotId: string } | null>(null);
    const touchDebugEnabled = __DEV__ && process.env.EXPO_PUBLIC_TOUCH_DEBUG === '1';

    // Zone Admin Inline Actions State
    const [showSuggestModal, setShowSuggestModal] = useState(false);
    const [counterPrice, setCounterPrice] = useState("");
    const [counterMessage, setCounterMessage] = useState("");
    const [counterExpiryMinutes, setCounterExpiryMinutes] = useState("10");
    const [counterDateValue, setCounterDateValue] = useState<Date>(new Date(Date.now() + 2 * 60 * 60 * 1000));
    const [adminProcessing, setAdminProcessing] = useState<"accept" | "reject" | "counter" | null>(null);
    const [resolvingResult, setResolvingResult] = useState(false);

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

    // Listen for incoming join requests (Host/Admin only)
    useEffect(() => {
        if (!id || !user || !room) return;
        const isHost = user.uid === room.hostUid;
        const isAdmin = profile?.role === 'zone-admin' || profile?.role === 'super-admin'; // weak check, but okay for visibility

        if (!isHost && !isAdmin) return;

        const q = query(
            collection(db, 'notifications'),
            where('meta.matchroomId', '==', id),
            where('type', '==', 'match_join_request'),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc')
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const reqs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setIncomingRequests(reqs);
        }, (err) => {
            Logger.warn("MatchroomDetails", "Failed to listen for requests", err);
        });

        return () => unsub();
    }, [id, user, room?.hostUid, profile?.role]);

    const handleRespondToRequest = async (req: any, decision: 'accept' | 'reject') => {
        if (!user) return;
        setProcessingRequestId(req.id);
        try {
            const res = await respondToMatchJoinRequest(req.id, decision, user.uid);
            if (res.ok) {
                if (decision === 'accept') {
                    Alert.alert("Accepted", `${req.fromUsername} has joined.`);
                    fetchRoom(); // Refresh room to show new player
                }
            } else {
                Alert.alert("Error", res.message);
            }
        } catch (e) {
            Logger.error("MatchroomDetails", "Respond error", e);
        } finally {
            setProcessingRequestId(null);
        }
    };

    useEffect(() => {
        if (!user) return;
        getUserProfile(user.uid).then(res => {
            if (res.ok) setProfile(res.data);
        });
    }, [user]);

    const isZoneAdmin = profile?.role === "zone-admin" || profile?.role === "super-admin";
    const rawBookingRequestId = useMemo(() => {
        if (!room) return null;
        const raw: any = room as any;
        return raw.bookingRequestId || raw.requestId || raw.booking?.requestId || raw.bookingRequest?.id || null;
    }, [room]);
    const [bookingRequestId, setBookingRequestId] = useState<string | null>(null);

    useEffect(() => {
        setBookingRequestId(rawBookingRequestId || null);
    }, [rawBookingRequestId]);

    useEffect(() => {
        if (!isZoneAdmin || bookingRequestId || !room?.id) return;
        let cancelled = false;
        const resolveRequestId = async () => {
            try {
                const q = query(
                    collection(db, "booking_requests"),
                    where("matchroomId", "==", room.id),
                    limit(1),
                );
                const snapshot = await getDocs(q);
                const docSnap = snapshot.docs[0];
                if (!cancelled && docSnap) {
                    setBookingRequestId(docSnap.id);
                }
            } catch (e) {
                Logger.warn("MatchroomDetails", "Failed to resolve booking request by matchroomId", e);
            }
        };
        resolveRequestId();
        return () => {
            cancelled = true;
        };
    }, [bookingRequestId, isZoneAdmin, room?.id]);

    const openBookingQueue = () => {
        router.push({
            pathname: "/zone/modules/bookings",
            params: {
                segment: "requests",
                requestId: bookingRequestId || undefined,
                matchroomId: room?.id,
            },
        } as any);
    };

    // ── Zone Admin Inline Handlers ──────────────────────────────────
    const handleZoneAccept = async () => {
        if (!room?.zoneId || !user?.uid || !bookingRequestId) {
            Alert.alert("Missing data", "Cannot accept — booking request or zone info not found.");
            return;
        }
        setAdminProcessing("accept");
        try {
            const result = await acceptZoneBookingRequest({
                requestId: bookingRequestId,
                adminUid: user.uid,
                zoneId: room.zoneId,
                requestOwnerUid: room.hostUid,
                location: room.location || undefined,
                note: "Accepted from matchroom detail",
            });
            if (!result.ok) {
                Alert.alert("Accept failed", result.message);
            } else {
                Alert.alert("Accepted", "Booking request has been confirmed.");
                fetchRoom();
            }
        } catch (e: any) {
            Logger.error("MatchroomDetails", "Zone accept error", e);
            Alert.alert("Error", "An unexpected error occurred.");
        } finally {
            setAdminProcessing(null);
        }
    };

    const handleZoneReject = () => {
        if (!room?.zoneId || !user?.uid || !bookingRequestId) {
            Alert.alert("Missing data", "Cannot reject — booking request or zone info not found.");
            return;
        }
        Alert.alert(
            "Reject Booking",
            "Are you sure you want to reject this booking request?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Reject",
                    style: "destructive",
                    onPress: async () => {
                        setAdminProcessing("reject");
                        try {
                            const result = await rejectZoneBookingRequest({
                                requestId: bookingRequestId,
                                adminUid: user!.uid,
                                zoneId: room!.zoneId!,
                                requestOwnerUid: room!.hostUid,
                                reason: "fully_booked",
                                note: "Rejected from matchroom detail",
                            });
                            if (!result.ok) {
                                Alert.alert("Reject failed", result.message);
                            } else {
                                Alert.alert("Rejected", "Booking request has been declined.");
                                fetchRoom();
                            }
                        } catch (e: any) {
                            Logger.error("MatchroomDetails", "Zone reject error", e);
                            Alert.alert("Error", "An unexpected error occurred.");
                        } finally {
                            setAdminProcessing(null);
                        }
                    },
                },
            ],
        );
    };

    const handleZoneSuggest = async () => {
        if (!room?.zoneId || !user?.uid || !bookingRequestId) return;

        const parsedPrice = Number.parseInt(counterPrice, 10);
        const parsedExpiry = Number.parseInt(counterExpiryMinutes, 10);
        if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
            Alert.alert("Invalid price", "Enter a valid counter-offer price.");
            return;
        }

        const counterDate = counterDateValue.toISOString().slice(0, 10);
        const counterTime = counterDateValue.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        setAdminProcessing("counter");
        try {
            const result = await sendZoneCounterOffer({
                requestId: bookingRequestId,
                requestOwnerUid: room.hostUid,
                zoneId: room.zoneId,
                zoneName: room.location || "Zone",
                zoneOwnerUid: user.uid,
                proposedDate: counterDate,
                proposedTime: counterTime,
                pricePerPlayer: parsedPrice,
                currency: room.pricing?.currency || "PKR",
                location: room.location || "",
                message: counterMessage.trim(),
                expiresInMinutes: Number.isFinite(parsedExpiry) ? parsedExpiry : 10,
            });

            if (!result.ok) {
                Alert.alert("Counter-offer failed", result.message);
                return;
            }

            Alert.alert("Alternative sent", "Player can accept this from their offers inbox.");
            setShowSuggestModal(false);
            setCounterPrice("");
            setCounterMessage("");
        } catch (e: any) {
            Logger.error("MatchroomDetails", "Zone suggest error", e);
            Alert.alert("Error", "An unexpected error occurred.");
        } finally {
            setAdminProcessing(null);
        }
    };

    const toDateDisplay = (d: Date) =>
        `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    const toTimeDisplay = (d: Date) =>
        d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });

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

    const handleResolveResult = () => {
        if (!id || !user?.uid) return;

        const finalizeWithWinner = async (winner: "team1" | "team2") => {
            setResolvingResult(true);
            try {
                const result = await resolveMatchResultByAdmin(id as string, user.uid, winner);
                if (!result.ok) {
                    Alert.alert("Unable to Finalize", result.message || "Could not resolve result.");
                    return;
                }
                Alert.alert("Result Finalized", "Match has been marked as completed.");
                fetchRoom();
            } catch (error) {
                Logger.error("MatchroomDetails", "Resolve result error", error);
                Alert.alert("Error", "Something went wrong while finalizing result.");
            } finally {
                setResolvingResult(false);
            }
        };

        Alert.alert(
            "Finalize Match Result",
            "Choose the final winner. This will mark the match as completed.",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Team 1 Won", onPress: () => finalizeWithWinner("team1") },
                { text: "Team 2 Won", onPress: () => finalizeWithWinner("team2") },
            ],
        );
    };

    const handleComplain = async () => {
        if (!user || !room) return;
        if (!complainReason) {
            Alert.alert("Reason Required", "Please select a reason for your complaint.");
            return;
        }

        setSubmittingComplain(true);
        const result = await submitMatchroomComplain({
            matchroomId: room.id!,
            game: room.game,
            title: room.title,
            reason: complainReason,
            description: complainDescription,
            reporterUid: user.uid,
            reporterUsername: user.displayName || "Anonymous"
        });

        setSubmittingComplain(false);
        if (result.ok) {
            Alert.alert("Submitted", result.message);
            setShowComplainModal(false);
            setComplainReason("");
            setComplainDescription("");
        } else {
            Alert.alert("Error", result.message);
        }
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
                                if (isZoneAdmin) {
                                    // Admins should stay in their dashboard context
                                    router.replace("/zone/modules/bookings");
                                } else {
                                    // Explicitly target the tabs route to avoid conflict with /matchrooms stack
                                    router.replace("/(player)/(tabs)/matchrooms");
                                }
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
    const isWalkInRoom = useMemo(
        () => String((room as any)?.bookingSource || '').toLowerCase() === 'walkin',
        [room],
    );
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

    // Lifecycle states
    const isExpired = useMemo(() => (room ? isRoomExpired(room) : false), [room]);
    const isLocked = useMemo(() => (room ? isRoomLocked(room) : false), [room]);
    const { displaySlotsA, displaySlotsB } = useMemo(() => {
        const slotsA = room?.slotsA || [];
        const slotsB = room?.slotsB || [];

        const hasStoredSlots = slotsA.length > 0 || slotsB.length > 0;
        if (!hasStoredSlots && isWalkInRoom && (room?.maxPlayers || 0) > 0) {
            let totalSeats = Math.max(1, Number(room?.maxPlayers || 0));
            // Patch for CS2 5v5 erroneously saved as 5 players
            if (room?.game === 'cs2' && totalSeats === 5) {
                totalSeats = 10;
            }
            const bookedSeats = Math.min(
                totalSeats,
                Math.max(Number((room as any)?.currentPlayers || 0), (room?.players || []).length),
            );
            const knownPlayers = (room?.players || []).slice(0, totalSeats);
            const walkInRosterRaw = Array.isArray((room as any)?.walkIn?.roster) ? (room as any).walkIn.roster : [];
            if (knownPlayers.length === 0 && walkInRosterRaw.length > 0) {
                walkInRosterRaw.slice(0, totalSeats).forEach((entry: any, idx: number) => {
                    knownPlayers.push({
                        uid: String(entry?.uid || `walkin_guest_${idx + 1}`),
                        username: String(entry?.username || '').trim() || `Player ${idx + 1}`,
                        role: 'Player',
                        skillTier: normalizeWalkInSkillTier(entry?.skillTier) || undefined,
                    } as any);
                });
            }

            type LobbySlot = {
                slotId: string;
                status: 'open' | 'confirmed' | 'reserved';
                role: string;
                uid?: string;
                user?: { uid: string; username: string; skillTier?: SkillTier };
            };

            const createSlot = (slotId: string): LobbySlot => ({
                slotId,
                status: 'open' as const,
                role: 'Player',
            });

            const localSlotsA =
                totalSeats % 2 === 0
                    ? Array.from({ length: Math.max(1, totalSeats / 2) }, (_, idx) => createSlot(`A${idx + 1}`))
                    : Array.from({ length: totalSeats }, (_, idx) => createSlot(`A${idx + 1}`));
            const localSlotsB =
                totalSeats % 2 === 0
                    ? Array.from({ length: Math.max(1, totalSeats / 2) }, (_, idx) => createSlot(`B${idx + 1}`))
                    : [];

            const allSlots = [...localSlotsA, ...localSlotsB];
            for (let index = 0; index < allSlots.length; index += 1) {
                const slot = allSlots[index];
                if (index < knownPlayers.length) {
                    const player = knownPlayers[index];
                    slot.status = 'confirmed';
                    slot.uid = player.uid;
                    slot.user = {
                        uid: player.uid,
                        username: player.username,
                        skillTier: normalizeWalkInSkillTier((player as any)?.skillTier) || undefined,
                    };
                    slot.role = player.role || 'Player';
                } else if (index < bookedSeats) {
                    slot.status = 'reserved';
                    slot.role = 'Booked';
                }
            }

            return { displaySlotsA: localSlotsA, displaySlotsB: localSlotsB };
        }

        if (!hasStoredSlots) {
            // Reconstruct slots if missing but we know maxPlayers (e.g. for structured games like CS2/FC26)
            const totalPlayers = room?.maxPlayers || 0;
            if (totalPlayers > 0 && totalPlayers % 2 === 0) {
                const teamSize = totalPlayers / 2;
                const localSlotsA = Array.from({ length: teamSize }, (_, idx) => ({
                    slotId: `A${idx + 1}`,
                    status: 'open' as const,
                    role: 'Player',
                }));
                const localSlotsB = Array.from({ length: teamSize }, (_, idx) => ({
                    slotId: `B${idx + 1}`,
                    status: 'open' as const,
                    role: 'Player',
                }));

                const players = room?.players || [];
                const fillSlots = (slots: any[], startIndex: number) =>
                    slots.map((slot, idx) => {
                        const p = players[startIndex + idx];
                        if (p) {
                            return {
                                ...slot,
                                uid: p.uid,
                                user: { uid: p.uid, username: p.username },
                                status: 'confirmed' as const,
                                role: p.role || 'Player'
                            };
                        }
                        return slot;
                    });

                return {
                    displaySlotsA: fillSlots(localSlotsA, 0),
                    displaySlotsB: fillSlots(localSlotsB, teamSize)
                };
            }
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
    }, [isWalkInRoom, room]);

    const occupiedSeatCount = useMemo(() => {
        const allSlots = [...(displaySlotsA || []), ...(displaySlotsB || [])];
        if (allSlots.length > 0) {
            return allSlots.filter((slot: any) => {
                const state = String(slot?.status || '').toLowerCase();
                return Boolean(slot?.user || slot?.uid || state === 'confirmed' || state === 'reserved');
            }).length;
        }
        return Math.max(Number((room as any)?.currentPlayers || 0), playersArr.length);
    }, [displaySlotsA, displaySlotsB, playersArr.length, room]);

    const isFull = useMemo(() => occupiedSeatCount >= (room?.maxPlayers || 0), [occupiedSeatCount, room?.maxPlayers]);
    const canJoin = useMemo(() => !isExpired && !isLocked && !isJoined && !isFull, [isExpired, isLocked, isJoined, isFull]);
    const resultStatus = room?.resultVerification?.status;
    const hasCaptainReport = useMemo(
        () => Boolean(room?.resultVerification?.captainReports?.team1Captain || room?.resultVerification?.captainReports?.team2Captain),
        [room?.resultVerification?.captainReports?.team1Captain, room?.resultVerification?.captainReports?.team2Captain],
    );
    const canResolveResult = useMemo(() => {
        if (!room || !user?.uid || room.status === "completed") return false;

        const team1Captain = room.resultVerification?.team1Captain || room.hostUid;
        const fallbackTeam2Captain =
            room.resultVerification?.team2Captain ||
            (room.players || []).map((player) => player.uid).find((uid) => uid && uid !== team1Captain);
        const allowedResolvers = new Set(
            [room.hostUid, room.zoneOwnerUid, team1Captain, fallbackTeam2Captain].filter(Boolean) as string[],
        );
        if (!allowedResolvers.has(user.uid)) return false;

        return (
            resultStatus === "participant_vote" ||
            resultStatus === "admin_review" ||
            (resultStatus === "pending" && hasCaptainReport)
        );
    }, [hasCaptainReport, resultStatus, room, user?.uid]);
    const lifecycleStatusLabel = useMemo(() => {
        if (!room) return "In Progress";
        if (room.status === "completed" || resultStatus === "resolved") return "Completed";
        if (resultStatus === "participant_vote" || resultStatus === "admin_review") return "Verifying Results";
        return "In Progress";
    }, [resultStatus, room]);
    const matchCode = room?.matchCode || (room?.id ? room.id.slice(-6).toUpperCase() : '');
    const qrValue = room?.id ? `matchhai://matchrooms/${room.id}` : '';

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

    const getSkillBadgeProps = (uid?: string, fallbackTierRaw?: unknown) => {
        if (uid && playerRatings[uid]) {
            return {
                tier: playerRatings[uid]!.tier,
                rating: playerRatings[uid]!.rating,
                showRating: true as const,
            };
        }
        const walkInTier = normalizeWalkInSkillTier(fallbackTierRaw);
        if (walkInTier) {
            return {
                tier: walkInTier,
                showRating: false as const,
            };
        }
        return null;
    };

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
                        {room && (isJoined || isZoneAdmin) && canSubmitComplain(room) && (
                            <TouchableOpacity
                                onPress={() => setShowComplainModal(true)}
                                activeOpacity={0.7}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <MaterialIcons name="flag" size={24} color={COLORS.error} />
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            />

            <ScrollView
                contentContainerStyle={[styles.content, isZoneAdmin ? styles.adminContent : null]}
                showsVerticalScrollIndicator={false}
            >
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
                        {(displaySlotsA?.length || 0) > 0 ? 'Teams' : `Squad (${occupiedSeatCount}/${room.maxPlayers})`}
                    </Text>
                    {(displaySlotsA?.length || 0) > 0 && (
                        <Text style={[styles.dateText, { fontSize: 12 }]}>
                            {occupiedSeatCount}/{room.maxPlayers} Players
                        </Text>
                    )}
                </View>

                {(displaySlotsA?.length || 0) > 0 ? (
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
                                                    {(() => {
                                                        const badge = getSkillBadgeProps(
                                                            slot.user?.uid,
                                                            (slot.user as any)?.skillTier,
                                                        );
                                                        if (!badge) return null;
                                                        return (
                                                            <View style={{ marginLeft: 8 }}>
                                                                <SkillBadge
                                                                    tier={badge.tier}
                                                                    rating={badge.rating}
                                                                    size="compact"
                                                                    showRating={badge.showRating}
                                                                />
                                                            </View>
                                                        );
                                                    })()}
                                                </View>
                                            </View>
                                        ) : (
                                            (() => {
                                                const isBookedPlaceholder = slot.status === 'reserved' || slot.status === 'confirmed';
                                                return (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                        <MaterialIcons
                                                            name={isBookedPlaceholder ? "event-seat" : "add-circle-outline"}
                                                            size={14}
                                                            color={COLORS.textSecondary}
                                                            style={{ marginRight: 6, opacity: 0.5 }}
                                                        />
                                                        <Text style={styles.emptySlotName}>
                                                            {isBookedPlaceholder ? 'Booked Seat' : 'Available Slot'}
                                                        </Text>
                                                    </View>
                                                );
                                            })()
                                        )}
                                    </TouchableOpacity>
                                    {!slot.user && slot.status === 'open' && (
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                            {canInviteTeamA && (
                                                <TouchableOpacity
                                                    style={styles.inviteSlotButton}
                                                    onPress={() => handleInvitePress('A', slot.slotId)}
                                                >
                                                    <Text style={styles.inviteSlotText}>Invite</Text>
                                                </TouchableOpacity>
                                            )}
                                            {!isJoined && canJoin && !isZoneAdmin && (
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
                                                    {(() => {
                                                        const badge = getSkillBadgeProps(
                                                            slot.user?.uid,
                                                            (slot.user as any)?.skillTier,
                                                        );
                                                        if (!badge) return null;
                                                        return (
                                                            <View style={{ marginLeft: 8 }}>
                                                                <SkillBadge
                                                                    tier={badge.tier}
                                                                    rating={badge.rating}
                                                                    size="compact"
                                                                    showRating={badge.showRating}
                                                                />
                                                            </View>
                                                        );
                                                    })()}
                                                </View>
                                            </View>
                                        ) : (
                                            (() => {
                                                const isBookedPlaceholder = slot.status === 'reserved' || slot.status === 'confirmed';
                                                return (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                        <MaterialIcons
                                                            name={isBookedPlaceholder ? "event-seat" : "add-circle-outline"}
                                                            size={14}
                                                            color={COLORS.textSecondary}
                                                            style={{ marginRight: 6, opacity: 0.5 }}
                                                        />
                                                        <Text style={styles.emptySlotName}>
                                                            {isBookedPlaceholder ? 'Booked Seat' : 'Available Slot'}
                                                        </Text>
                                                    </View>
                                                );
                                            })()
                                        )}
                                    </TouchableOpacity>
                                    {!slot.user && slot.status === 'open' && (
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                            {canInviteTeamB && (
                                                <TouchableOpacity
                                                    style={styles.inviteSlotButton}
                                                    onPress={() => handleInvitePress('B', slot.slotId)}
                                                >
                                                    <Text style={styles.inviteSlotText}>Invite</Text>
                                                </TouchableOpacity>
                                            )}
                                            {!isJoined && canJoin && !isZoneAdmin && (
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
                                        {(() => {
                                            const badge = getSkillBadgeProps(
                                                player.uid,
                                                (player as any)?.skillTier,
                                            );
                                            if (!badge) return null;
                                            return (
                                                <View style={{ marginLeft: 8 }}>
                                                    <SkillBadge
                                                        tier={badge.tier}
                                                        rating={badge.rating}
                                                        size="compact"
                                                        showRating={badge.showRating}
                                                    />
                                                </View>
                                            );
                                        })()}
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* ── Pending Join Requests (Host / Admin only) ── */}
                {incomingRequests.length > 0 && (isHost || isZoneAdmin) && (
                    <View style={{
                        marginTop: SPACING.lg,
                        padding: SPACING.md,
                        backgroundColor: 'rgba(255,255,255,0.04)',
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.08)',
                    }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm }}>
                            <MaterialIcons name="person-add" size={18} color={COLORS.accent} />
                            <Text style={{
                                color: COLORS.textPrimary,
                                fontSize: 15,
                                fontWeight: '700',
                                marginLeft: 8,
                            }}>
                                Pending Join Requests ({incomingRequests.length})
                            </Text>
                        </View>

                        {incomingRequests.map((req: any) => (
                            <View key={req.id} style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 10,
                                borderBottomWidth: 1,
                                borderBottomColor: 'rgba(255,255,255,0.06)',
                            }}>
                                {/* Avatar */}
                                <View style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 18,
                                    backgroundColor: COLORS.accent,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 10,
                                }}>
                                    <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>
                                        {(req.fromUsername || 'P').charAt(0).toUpperCase()}
                                    </Text>
                                </View>

                                {/* Info */}
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: COLORS.textPrimary, fontWeight: '600', fontSize: 14 }}>
                                        {req.fromUsername || 'Player'}
                                    </Text>
                                    <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 2 }}>
                                        Role: {req.meta?.role || 'Flex'} • Team: {req.meta?.targetTeam || 'Any'}
                                    </Text>
                                </View>

                                {/* Accept / Reject Buttons */}
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <TouchableOpacity
                                        style={{
                                            backgroundColor: COLORS.success || '#4CAF50',
                                            paddingHorizontal: 12,
                                            paddingVertical: 6,
                                            borderRadius: 8,
                                        }}
                                        disabled={processingRequestId === req.id}
                                        onPress={() => handleRespondToRequest(req, 'accept')}
                                    >
                                        {processingRequestId === req.id ? (
                                            <ActivityIndicator size="small" color="#FFF" />
                                        ) : (
                                            <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 12 }}>Accept</Text>
                                        )}
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={{
                                            backgroundColor: COLORS.error || '#F44336',
                                            paddingHorizontal: 12,
                                            paddingVertical: 6,
                                            borderRadius: 8,
                                        }}
                                        disabled={processingRequestId === req.id}
                                        onPress={() => handleRespondToRequest(req, 'reject')}
                                    >
                                        {processingRequestId === req.id ? (
                                            <ActivityIndicator size="small" color="#FFF" />
                                        ) : (
                                            <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 12 }}>Reject</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

            </ScrollView>

            {/* Footer Actions */}
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + SPACING.sm, SPACING.lg + 12) }]}>
                {isZoneAdmin ? (
                    <View style={{ gap: SPACING.sm }}>
                        <Text style={{ textAlign: "center", color: COLORS.textSecondary }}>
                            Booking actions (zone admin)
                        </Text>
                        <View style={styles.footerRow}>
                            <TouchableOpacity
                                style={[styles.joinButton, { flex: 1 }]}
                                onPress={handleZoneAccept}
                                disabled={adminProcessing !== null}
                                activeOpacity={0.85}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                {adminProcessing === "accept" ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <Text style={styles.joinButtonText}>Accept</Text>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.secondaryButton, { flex: 1 }]}
                                onPress={handleZoneReject}
                                disabled={adminProcessing !== null}
                                activeOpacity={0.85}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                {adminProcessing === "reject" ? (
                                    <ActivityIndicator size="small" color={COLORS.error} />
                                ) : (
                                    <Text style={styles.secondaryButtonText}>Reject</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            style={[styles.joinButton, { backgroundColor: COLORS.warning }]}
                            onPress={() => setShowSuggestModal(true)}
                            disabled={adminProcessing !== null}
                            activeOpacity={0.85}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <MaterialIcons name="edit" size={18} color="#FFF" />
                                <Text style={styles.joinButtonText}>Suggest Alternative</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                ) : isExpired ? (
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
                                    !isLocked && !isFull && (
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
                                    )
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
                                Status: {lifecycleStatusLabel}
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

                        {canResolveResult && (
                            <TouchableOpacity
                                onPressIn={() => {
                                    if (touchDebugEnabled) {
                                        Logger.debug("TouchDebug", "pressIn", { tag: "lobby_finalize_result" });
                                    }
                                }}
                                onPress={handleResolveResult}
                                style={[styles.joinButton, { backgroundColor: COLORS.accent }]}
                                activeOpacity={0.85}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                disabled={resolvingResult}
                            >
                                {resolvingResult ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.joinButtonText}>Finalize Result</Text>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* Complain Button (Visible for In-Progress or Completed 24h) */}
                {room && (isJoined || isZoneAdmin) && canSubmitComplain(room) && (
                    <TouchableOpacity
                        style={styles.complainBtn}
                        onPress={() => setShowComplainModal(true)}
                        activeOpacity={0.7}
                    >
                        <MaterialIcons name="report-problem" size={20} color={COLORS.error} />
                        <Text style={styles.complainBtnText}>Complain</Text>
                    </TouchableOpacity>
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

            {/* Complain Modal */}
            <Modal
                visible={showComplainModal}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setShowComplainModal(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => !submittingComplain && setShowComplainModal(false)}
                >
                    <Pressable style={[styles.modalContent, { maxHeight: '80%' }]}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Report Matchroom</Text>
                                <Text style={styles.modalSubtitle}>Help us keep MatchHai safe</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowComplainModal(false)} disabled={submittingComplain}>
                                <MaterialIcons name="close" size={24} color={COLORS.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={{ marginTop: 8 }}
                            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
                            showsVerticalScrollIndicator={false}
                        >
                            <Text style={[styles.cardLabel, { marginBottom: 12, marginTop: 16 }]}>Select Reason</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                                {COMPLAIN_REASONS.map((reason) => (
                                    <TouchableOpacity
                                        key={reason}
                                        style={[
                                            styles.reasonChip,
                                            complainReason === reason && styles.reasonChipActive
                                        ]}
                                        onPress={() => setComplainReason(reason)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[
                                            styles.reasonText,
                                            complainReason === reason && styles.reasonTextActive
                                        ]}>{reason}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={[styles.cardLabel, { marginTop: 20, marginBottom: 10 }]}>Additional Details (Optional)</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="Provide more context to help our moderators..."
                                placeholderTextColor={COLORS.muted}
                                multiline
                                value={complainDescription}
                                onChangeText={setComplainDescription}
                                selectionColor={COLORS.accent}
                            />

                            <TouchableOpacity
                                style={[styles.modalActionButton, (submittingComplain || !complainReason) && { opacity: 0.6 }]}
                                onPress={handleComplain}
                                disabled={submittingComplain || !complainReason}
                                activeOpacity={0.8}
                            >
                                {submittingComplain ? (
                                    <ActivityIndicator color="#FFF" size="small" />
                                ) : (
                                    <Text style={styles.modalActionText}>Submit Report</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Suggest Alternative Modal (Zone Admin) */}
            <Modal
                visible={showSuggestModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => !adminProcessing && setShowSuggestModal(false)}
            >
                <TouchableWithoutFeedback onPress={() => !adminProcessing && setShowSuggestModal(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={[styles.modalContent, { maxHeight: '85%' }]}>
                                <View style={styles.modalHeader}>
                                    <View>
                                        <Text style={styles.modalTitle}>Suggest Alternative</Text>
                                        <Text style={styles.modalSubtitle}>Propose a different time or price</Text>
                                    </View>
                                    <Pressable
                                        onPress={() => setShowSuggestModal(false)}
                                        disabled={adminProcessing !== null}
                                    >
                                        <MaterialIcons name="close" size={24} color={COLORS.textSecondary} />
                                    </Pressable>
                                </View>

                                <ScrollView
                                    style={{ marginTop: 8 }}
                                    contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
                                    showsVerticalScrollIndicator={false}
                                >
                                    <Text style={[styles.cardLabel, { marginBottom: 8, marginTop: 16 }]}>Counter Price (PKR)</Text>
                                    <TextInput
                                        value={counterPrice}
                                        onChangeText={setCounterPrice}
                                        keyboardType="numeric"
                                        style={styles.input}
                                        placeholder="e.g. 1500"
                                        placeholderTextColor={COLORS.muted}
                                    />

                                    <Text style={[styles.cardLabel, { marginBottom: 8, marginTop: 12 }]}>Suggested Date & Time</Text>
                                    <View style={styles.suggestDateRow}>
                                        <View style={styles.suggestDateField}>
                                            <MaterialIcons name="calendar-today" size={16} color={COLORS.accent} />
                                            <Text style={styles.suggestDateFieldText}>{toDateDisplay(counterDateValue)}</Text>
                                        </View>
                                        <View style={styles.suggestDateField}>
                                            <MaterialIcons name="access-time" size={16} color={COLORS.accent} />
                                            <Text style={styles.suggestDateFieldText}>{toTimeDisplay(counterDateValue)}</Text>
                                        </View>
                                    </View>

                                    <Text style={[styles.cardLabel, { marginBottom: 8, marginTop: 12 }]}>Offer Expires In (Minutes)</Text>
                                    <TextInput
                                        value={counterExpiryMinutes}
                                        onChangeText={setCounterExpiryMinutes}
                                        keyboardType="numeric"
                                        style={styles.input}
                                        placeholder="e.g. 15"
                                        placeholderTextColor={COLORS.muted}
                                    />

                                    <Text style={[styles.cardLabel, { marginBottom: 8, marginTop: 12 }]}>Note to Player</Text>
                                    <TextInput
                                        value={counterMessage}
                                        onChangeText={setCounterMessage}
                                        style={[styles.input, styles.textArea]}
                                        placeholder="e.g. We have slots available at 10 PM instead..."
                                        placeholderTextColor={COLORS.muted}
                                        multiline
                                    />

                                    <TouchableOpacity
                                        style={[
                                            styles.suggestSubmitButton,
                                            (adminProcessing || !counterPrice) && { opacity: 0.6 },
                                        ]}
                                        onPress={handleZoneSuggest}
                                        disabled={adminProcessing !== null || !counterPrice}
                                        activeOpacity={0.8}
                                    >
                                        {adminProcessing === "counter" ? (
                                            <ActivityIndicator size="small" color="#FFF" />
                                        ) : (
                                            <Text style={styles.modalActionText}>Send Suggestion</Text>
                                        )}
                                    </TouchableOpacity>
                                </ScrollView>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </Screen>
    );
}

import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { collection, doc, getDocs, limit, query, serverTimestamp, setDoc, where } from "firebase/firestore";

import AppHeader from "../../../src/components/AppHeader";
import SegmentedTabs from "../../../src/components/SegmentedTabs";
import Screen from "../../../src/components/Screen";
import MatchroomCard from "../../matchrooms/components/MatchroomCard";
import { useAuth } from "../../../src/context/AuthContext";
import { useZoneData } from "../../../src/hooks/useZoneData";
import { db } from "../../../src/config/firebaseConfig";
import { type Matchroom } from "../../../src/services/matchService";
import {
    acceptZoneBookingRequest,
    rejectZoneBookingRequest,
    sendZoneCounterOffer,
    subscribeZoneBookingQueue,
    subscribeZoneMatchrooms,
    type ZoneBookingAssetType,
    type ZoneBookingQueueItem,
    type ZoneMatchroomListItem,
} from "../../../src/services/zoneAdminBookingService";
import { COLORS, SPACING } from "../../../src/theme";
import Logger from "../../../src/utils/logger";
import styles from "./bookings.styles";

type Segment = "requests" | "matchrooms" | "walkins";
type RequestFilter = "all" | "open" | "pending_payment" | "accepted";
type AssetFilter = "all" | ZoneBookingAssetType;

const REQUEST_FILTERS: RequestFilter[] = ["all", "open", "pending_payment", "accepted"];
const ASSET_FILTERS: AssetFilter[] = ["all", "pc", "court", "mixed", "unknown"];
const ACTIVE_QUEUE_STATUSES = new Set(["open", "pending_payment", "accepted"]);

const toMillis = (value: any) => {
    if (!value) return 0;
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?.seconds === "number") return value.seconds * 1000;
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    return 0;
};

const chunk = <T,>(items: T[], size: number) => {
    const result: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        result.push(items.slice(i, i + size));
    }
    return result;
};

const normalizeGameKey = (value: unknown) => String(value || "").trim().toLowerCase();
const computeAssetTypeFromGame = (gameKey: string): ZoneBookingAssetType => {
    if (["cs2", "fc25", "fc26", "tekken8"].includes(gameKey)) return "pc";
    if (["futsal", "indoor_cricket", "padel", "pickleball"].includes(gameKey)) return "court";
    return "unknown";
};

const normalizeLinkedRequest = (id: string, data: Record<string, any>): ZoneBookingQueueItem => {
    const gameKey = normalizeGameKey(data.gameKey);
    return {
        id,
        userId: data.userId || "",
        userName: data.userName || "Player",
        title: data.title || "Booking Request",
        gameKey,
        maxPlayers: Number(data.maxPlayers || 0),
        reservedSlots: Number(data.reservedSlots || 0) || undefined,
        teamMode: data.teamMode,
        preferredDate: data.preferredDate,
        preferredTime: data.preferredTime,
        preferredAreas: Array.isArray(data.preferredAreas) ? data.preferredAreas : [],
        budgetPerPlayer: Number(data.budgetPerPlayer || 0) || undefined,
        currency: data.currency || "PKR",
        status: data.status || "open",
        paymentStatus: data.paymentStatus || "unpaid",
        locationMode: data.locationMode,
        zoneId: data.zoneId,
        lifecycleStatus: data.lifecycleStatus,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        assetType: computeAssetTypeFromGame(gameKey),
        priorityFlags: [],
        raw: data,
    };
};

const getRequestMatchroomId = (item?: ZoneBookingQueueItem | null) => {
    if (!item) return null;
    const raw = item.raw || {};
    return raw.matchroomId || raw.matchroom?.id || raw.meta?.matchroomId || null;
};

const formatDateTime = (value: Date) => ({
    date: value.toISOString().slice(0, 10),
    time: value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
});

const formatDate = (value: any) => {
    const millis = toMillis(value);
    if (!millis) return "N/A";
    return new Date(millis).toLocaleString();
};

const toDateString = (value: any) => {
    if (!value) return undefined;
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length >= 8) return trimmed;
    }
    const millis = toMillis(value);
    if (!millis) return undefined;
    return new Date(millis).toISOString().slice(0, 10);
};

const requestToMatchroomCardData = (item: ZoneBookingQueueItem): Matchroom => ({
    id: getRequestMatchroomId(item) || item.id,
    hostUid: item.userId,
    hostName: item.userName,
    game: item.gameKey.toUpperCase(),
    title: item.title,
    description: "Booking request",
    status: item.status as any,
    maxPlayers: item.maxPlayers,
    currentPlayers: item.reservedSlots || item.maxPlayers,
    players: [],
    playerUids: [],
    createdAt: item.createdAt || new Date(),
    location: item.preferredAreas?.[0] || "Zone Venue",
    pricing: {
        perPlayer: item.budgetPerPlayer || 0,
        currency: item.currency || "PKR",
    },
    scheduledDate: toDateString(item.preferredDate),
    scheduledTime: item.preferredTime,
    slotsA: [],
    slotsB: [],
    paymentStatus: (item.paymentStatus || "unpaid") as any,
});

const toMatchroomCardData = (room: ZoneMatchroomListItem, fallbackLocation?: string): Matchroom => ({
    id: room.id,
    hostUid: room.hostUid || room.zoneOwnerUid || "",
    hostName: room.hostName || "Zone Host",
    game: room.game,
    title: room.title,
    description: "Zone booking matchroom",
    status: room.status as any,
    maxPlayers: room.maxPlayers || 0,
    currentPlayers: room.currentPlayers || 0,
    players: [],
    playerUids: [],
    createdAt: room.createdAt || new Date(),
    location: room.location || fallbackLocation || "Zone Venue",
    pricing: {
        perPlayer: room.pricePerPlayer || 0,
        currency: room.currency || "PKR",
    },
    scheduledDate: room.scheduledDate,
    scheduledTime: room.scheduledTime,
    hostSkillTier: room.hostSkillTier as any,
    hostSkillScore: room.hostSkillScore,
    format: room.format,
    seriesType: room.seriesType,
    durationHours: room.durationHours,
    overs: room.overs,
    slotsA: room.slotsA || [],
    slotsB: room.slotsB || [],
    paymentStatus: (room.paymentStatus || "unpaid") as any,
    bookingSource: room.bookingSource || undefined,
});

export default function ZoneBookingsModule() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        segment?: Segment | Segment[];
        requestId?: string | string[];
        matchroomId?: string | string[];
    }>();
    const { user } = useAuth();
    const { zone } = useZoneData();

    const [segment, setSegment] = useState<Segment>("requests");
    const [showFilters, setShowFilters] = useState(true);
    const [requestFilter, setRequestFilter] = useState<RequestFilter>("all");
    const [assetFilter, setAssetFilter] = useState<AssetFilter>("all");
    const [showCounterModal, setShowCounterModal] = useState(false);
    const [queue, setQueue] = useState<ZoneBookingQueueItem[]>([]);
    const [linkedRequests, setLinkedRequests] = useState<ZoneBookingQueueItem[]>([]);
    const [matchrooms, setMatchrooms] = useState<ZoneMatchroomListItem[]>([]);
    const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
    const [loadingQueue, setLoadingQueue] = useState(true);
    const [loadingMatchrooms, setLoadingMatchrooms] = useState(true);
    const [processingAction, setProcessingAction] = useState<"accept" | "reject" | "counter" | null>(null);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [matchroomLookupDone, setMatchroomLookupDone] = useState(false);
    const [backfillInProgress, setBackfillInProgress] = useState(false);

    const [rejectReason, setRejectReason] = useState("fully_booked");
    const [rejectNote, setRejectNote] = useState("");
    const [rejectAlternative, setRejectAlternative] = useState("");

    const [counterPrice, setCounterPrice] = useState("");
    const [counterMessage, setCounterMessage] = useState("");
    const [counterExpiryMinutes, setCounterExpiryMinutes] = useState("10");
    const [focusedMatchroomId, setFocusedMatchroomId] = useState<string | null>(null);

    const deepSegment = Array.isArray(params.segment) ? params.segment[0] : params.segment;
    const deepRequestId = Array.isArray(params.requestId) ? params.requestId[0] : params.requestId;
    const deepMatchroomId = Array.isArray(params.matchroomId) ? params.matchroomId[0] : params.matchroomId;

    const branchAreas = useMemo(() => {
        const allAreas = new Set<string>();
        const rawBranches = Array.isArray(zone?.branches) ? zone.branches : [];
        rawBranches.forEach((branch: any) => {
            if (branch?.areaLabel) {
                allAreas.add(String(branch.areaLabel));
            }
        });
        if (zone?.primaryBranch?.areaLabel) {
            allAreas.add(String(zone.primaryBranch.areaLabel));
        }
        return Array.from(allAreas);
    }, [zone?.branches, zone?.primaryBranch?.areaLabel]);

    const primaryBranch = useMemo(() => {
        const branches = Array.isArray(zone?.branches) ? zone?.branches : [];
        const primary = branches.find((item: any) => item?.isPrimary);
        return primary || branches[0] || null;
    }, [zone?.branches]);

    const walkInCount = useMemo(
        () => matchrooms.filter((item) => item.bookingSource === "walkin").length,
        [matchrooms],
    );
    const walkInRooms = useMemo(
        () => matchrooms.filter((item) => item.bookingSource === "walkin"),
        [matchrooms],
    );

    const combinedQueue = useMemo(() => {
        if (!linkedRequests.length) return queue;
        const merged = new Map<string, ZoneBookingQueueItem>();
        queue.forEach((item) => merged.set(item.id, item));
        linkedRequests.forEach((item) => merged.set(item.id, item));
        return Array.from(merged.values());
    }, [linkedRequests, queue]);

    useEffect(() => {
        if (!zone?.id) {
            setLoadingQueue(false);
            setLoadingMatchrooms(false);
            return;
        }

        const unsubQueue = subscribeZoneBookingQueue(
            zone.id,
            branchAreas,
            (rows) => {
                setQueue(rows);
                setLoadingQueue(false);
                setSelectedRequestId((prev) => prev || rows[0]?.id || null);
            },
            (error) => {
                setLoadingQueue(false);
                if (error?.code === "permission-denied") {
                    setErrorText("Booking queue permission denied by Firestore rules.");
                } else {
                    setErrorText("Failed to load booking queue.");
                }
            },
        );

        const unsubMatchrooms = subscribeZoneMatchrooms(
            zone.id,
            user?.uid,
            (rows) => {
                setMatchrooms(rows);
                setLoadingMatchrooms(false);
            },
            (error) => {
                setLoadingMatchrooms(false);
                if (error?.code === "permission-denied") {
                    setErrorText("Matchroom list permission denied by Firestore rules.");
                } else {
                    setErrorText("Failed to load matchrooms.");
                }
            },
            {
                locationHints: [
                    zone.venueBrandName || "",
                    zone.primaryBranch?.branchDisplayName || "",
                    zone.primaryBranch?.areaLabel || "",
                    ...branchAreas,
                ],
            },
        );

        return () => {
            unsubQueue();
            unsubMatchrooms();
        };
    }, [branchAreas, user?.uid, zone?.id]);

    useEffect(() => {
        let cancelled = false;
        const resolveLinkedRequests = async () => {
            if (!matchrooms.length) {
                setLinkedRequests([]);
                return;
            }
            try {
                setBackfillInProgress(true);
                const ids = Array.from(new Set(matchrooms.map((item) => item.id).filter(Boolean)));
                const batches = chunk(ids, 10);
                const collected: ZoneBookingQueueItem[] = [];
                const linkedMatchroomIds = new Set<string>();

                for (const batch of batches) {
                    const q = query(
                        collection(db, "booking_requests"),
                        where("matchroomId", "in", batch),
                    );
                    const snapshot = await getDocs(q);
                    snapshot.docs.forEach((docSnap: any) => {
                        const data = docSnap.data() as Record<string, any>;
                        const status = String(data.status || "open");
                        if (data.matchroomId) {
                            linkedMatchroomIds.add(String(data.matchroomId));
                        }
                        if (ACTIVE_QUEUE_STATUSES.has(status)) {
                            collected.push(normalizeLinkedRequest(docSnap.id, data));
                        }
                    });
                }

                const matchroomMap = new Map(matchrooms.map((room) => [room.id, room]));
                const missing = ids.filter((id) => !linkedMatchroomIds.has(id));
                for (const matchroomId of missing) {
                    const room = matchroomMap.get(matchroomId);
                    if (!room || room.bookingSource === "walkin") continue;
                    const docId = `matchroom_request_${matchroomId}`;
                    const gameKey = normalizeGameKey(room.game);
                    const requestData = {
                        userId: room.hostUid || "",
                        userName: room.hostName || "Player",
                        gameKey,
                        title: room.title || "Matchroom Booking",
                        description: "Matchroom created. Awaiting zone admin approval.",
                        maxPlayers: Number(room.maxPlayers || 0),
                        reservedSlots: Number(room.currentPlayers || 0) || undefined,
                        preferredDate: room.scheduledDate || null,
                        preferredTime: room.scheduledTime || null,
                        flexibilityWindow: "Exact time",
                        preferredAreas: room.location ? [room.location] : [],
                        budgetPerPlayer: Number(room.pricePerPlayer || 0) || 0,
                        currency: room.currency || "PKR",
                        locationMode: "zone",
                        zoneId: zone?.id || null,
                        status: "open",
                        paymentStatus: room.paymentStatus || "unpaid",
                        lifecycleStatus: "matchroom_admin_pending",
                        matchroomId,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    };
                    await setDoc(doc(db, "booking_requests", docId), requestData, { merge: true });
                    collected.push(normalizeLinkedRequest(docId, requestData));
                }

                if (!cancelled) {
                    setLinkedRequests(collected);
                }
            } catch (e) {
                if (!cancelled) {
                    setLinkedRequests([]);
                }
            } finally {
                if (!cancelled) {
                    setBackfillInProgress(false);
                }
            }
        };
        resolveLinkedRequests();
        return () => {
            cancelled = true;
        };
    }, [matchrooms, zone?.id]);

    useEffect(() => {
        if (deepSegment === "matchrooms" || deepSegment === "requests") {
            setSegment(deepSegment);
        }
        if (deepRequestId) {
            setSelectedRequestId(deepRequestId);
        }
        if (deepMatchroomId) {
            setFocusedMatchroomId(deepMatchroomId);
            if (!deepRequestId) {
                setSegment("requests");
            }
        }
    }, [deepMatchroomId, deepRequestId, deepSegment]);

    useEffect(() => {
        if (!deepMatchroomId || deepRequestId || selectedRequestId || !zone?.id) return;
        let cancelled = false;
        const resolveRequestId = async () => {
            try {
                const q = query(
                    collection(db, "booking_requests"),
                    where("matchroomId", "==", deepMatchroomId),
                    limit(1),
                );
                const snapshot = await getDocs(q);
                const docSnap = snapshot.docs[0];
                if (!cancelled && docSnap) {
                    setSelectedRequestId(docSnap.id);
                }
                if (!cancelled) {
                    setMatchroomLookupDone(true);
                }
            } catch (e) {
                // If we can't resolve, leave selection empty and let admin handle manually.
                if (!cancelled) {
                    setMatchroomLookupDone(true);
                }
            }
        };
        resolveRequestId();
        return () => {
            cancelled = true;
        };
    }, [deepMatchroomId, deepRequestId, selectedRequestId, zone?.id]);

    useEffect(() => {
        if (!deepMatchroomId || !matchroomLookupDone || selectedRequestId) return;
        Alert.alert(
            "No booking request linked",
            "This matchroom doesn't have a booking request linked yet. Please select one from the Requests list.",
        );
    }, [deepMatchroomId, matchroomLookupDone, selectedRequestId]);

    const filteredQueue = useMemo(
        () =>
            combinedQueue.filter((item) => {
                const requestOk = requestFilter === "all" ? true : item.status === requestFilter;
                const assetOk = assetFilter === "all" ? true : item.assetType === assetFilter;
                return requestOk && assetOk;
            }),
        [assetFilter, combinedQueue, requestFilter],
    );

    const selectedRequest = useMemo(
        () => combinedQueue.find((item) => item.id === selectedRequestId) || null,
        [combinedQueue, selectedRequestId],
    );
    const selectedMatchroomId = useMemo(
        () => getRequestMatchroomId(selectedRequest),
        [selectedRequest],
    );

    useEffect(() => {
        setSelectedRequestId((prev) => {
            if (prev && combinedQueue.some((item) => item.id === prev)) return prev;
            return combinedQueue[0]?.id || null;
        });
    }, [combinedQueue]);

    const handleAccept = async (targetRequest?: ZoneBookingQueueItem) => {
        const req = targetRequest || selectedRequest;
        if (!zone?.id || !user?.uid || !req) return;
        setProcessingAction("accept");
        const result = await acceptZoneBookingRequest({
            requestId: req.id,
            adminUid: user.uid,
            zoneId: zone.id,
            requestOwnerUid: req.userId,
            branchId: primaryBranch?.id || undefined,
            branchName: primaryBranch?.branchDisplayName || undefined,
            location: zone.primaryBranch?.areaLabel || zone.venueBrandName || undefined,
            zoneName: zone.venueBrandName || undefined,
            note: "Accepted via admin queue",
        });
        setProcessingAction(null);
        if (!result.ok) {
            Alert.alert("Accept failed", result.message);
            return;
        }
        Alert.alert("Accepted", "Booking request moved to confirmed lifecycle.");
    };

    const handleReject = async () => {
        if (!zone?.id || !user?.uid || !selectedRequest) return;
        setProcessingAction("reject");
        const result = await rejectZoneBookingRequest({
            requestId: selectedRequest.id,
            adminUid: user.uid,
            zoneId: zone.id,
            requestOwnerUid: selectedRequest.userId,
            reason: rejectReason,
            note: rejectNote.trim() || undefined,
            alternative: rejectAlternative.trim() || undefined,
        });
        setProcessingAction(null);
        if (!result.ok) {
            Alert.alert("Reject failed", result.message);
            return;
        }
        Alert.alert("Rejected", "Rejection reason and alternatives were saved.");
    };

    const handleCounterOffer = async () => {
        if (!zone?.id || !user?.uid || !selectedRequest) return;

        const parsedPrice = Number.parseInt(counterPrice, 10);
        const parsedExpiry = Number.parseInt(counterExpiryMinutes, 10);
        if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
            Alert.alert("Invalid price", "Enter a valid counter-offer price.");
            return;
        }

        const counterDateTime = formatDateTime(new Date(Date.now() + 2 * 60 * 60 * 1000));
        setProcessingAction("counter");
        try {
            const result = await sendZoneCounterOffer({
                requestId: selectedRequest.id,
                requestOwnerUid: selectedRequest.userId,
                zoneId: zone.id,
                zoneName: zone.venueBrandName || "Zone",
                zoneOwnerUid: user.uid,
                branchId: primaryBranch?.id || undefined,
                branchName: primaryBranch?.branchDisplayName || null,
                proposedDate: counterDateTime.date,
                proposedTime: counterDateTime.time,
                pricePerPlayer: parsedPrice,
                currency: selectedRequest.currency || "PKR",
                location: zone.primaryBranch?.areaLabel || "",
                message: counterMessage.trim(),
                expiresInMinutes: Number.isFinite(parsedExpiry) ? parsedExpiry : 10,
            });

            if (!result.ok) {
                Alert.alert("Counter-offer failed", result.message);
                return;
            }

            Alert.alert("Alternative sent", "Player can accept this from their offers inbox.");
            setShowCounterModal(false);
            setCounterPrice(""); // Reset on success
            setCounterMessage("");
        } catch (error: any) {
            Logger.error("bookings", "handleCounterOffer crashed", error);
            Alert.alert("Error", "An unexpected error occurred while sending the offer.");
        } finally {
            setProcessingAction(null);
        }
    };

    return (
        <Screen style={styles.screen} scroll={false}>
            <AppHeader
                title="Bookings & Matchrooms"
                subtitle="Live queue, decisions, walk-ins, and lifecycle visibility"
                onBack={() => router.back()}
                inlineTitle
            />

            <SegmentedTabs
                items={[
                    { key: "requests", label: "Requests", badge: filteredQueue.length },
                    { key: "matchrooms", label: "Matchrooms", badge: matchrooms.length },
                    { key: "walkins", label: "Walk-ins", badge: walkInCount },
                ]}
                value={segment}
                onChange={(value) => setSegment(value)}
                style={styles.segmentTabs}
                itemTextStyle={styles.tabTitle}
            />

            {errorText ? (
                <View style={styles.errorBox}>
                    <MaterialIcons name="error-outline" size={16} color={COLORS.error} />
                    <Text style={styles.errorText}>{errorText}</Text>
                </View>
            ) : null}

            {segment === "requests" ? (
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    <Pressable
                        style={styles.filtersToggle}
                        onPress={() => setShowFilters((prev) => !prev)}
                    >
                        <View style={styles.filtersToggleLeft}>
                            <MaterialIcons name="tune" size={16} color={COLORS.accent} />
                            <Text style={styles.filtersToggleText}>Filters</Text>
                        </View>
                        <MaterialIcons
                            name={showFilters ? "expand-less" : "expand-more"}
                            size={18}
                            color={COLORS.textSecondary}
                        />
                    </Pressable>

                    {showFilters ? (
                        <View style={styles.filtersWrap}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {REQUEST_FILTERS.map((filter) => (
                                    <Pressable
                                        key={filter}
                                        onPress={() => setRequestFilter(filter)}
                                        style={[
                                            styles.filterChip,
                                            requestFilter === filter && styles.filterChipActive,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.filterChipText,
                                                requestFilter === filter && styles.filterChipTextActive,
                                            ]}
                                        >
                                            {filter}
                                        </Text>
                                    </Pressable>
                                ))}
                            </ScrollView>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {ASSET_FILTERS.map((filter) => (
                                    <Pressable
                                        key={filter}
                                        onPress={() => setAssetFilter(filter)}
                                        style={[
                                            styles.filterChip,
                                            assetFilter === filter && styles.filterChipActive,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.filterChipText,
                                                assetFilter === filter && styles.filterChipTextActive,
                                            ]}
                                        >
                                            {filter}
                                        </Text>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        </View>
                    ) : null}

                    {loadingQueue ? (
                        <ActivityIndicator size="small" color={COLORS.accent} />
                    ) : backfillInProgress ? (
                        <Text style={styles.emptyText}>Syncing matchroom requests...</Text>
                    ) : filteredQueue.length === 0 ? (
                        <Text style={styles.emptyText}>No requests found for selected filters.</Text>
                    ) : (
                        filteredQueue.map((item) => {
                            const selected = selectedRequestId === item.id;
                            const matchroomId = getRequestMatchroomId(item);
                            return (
                                <View key={item.id} style={selected ? styles.matchroomFocusedWrap : undefined}>
                                    <MatchroomCard
                                        room={requestToMatchroomCardData(item)}
                                        onAcceptPress={() => {
                                            setSelectedRequestId(item.id);
                                            handleAccept(item);
                                        }}
                                        onPress={() => {
                                            setSelectedRequestId(selected ? null : item.id);
                                        }}
                                        acceptLabel="Accept"
                                        containerStyle={selected ? { marginBottom: 0 } : undefined}
                                    />
                                    {/* Inline actions inside the room card when selected */}
                                    {selected && (
                                        <View style={styles.inlineActionsCard}>
                                            <View style={styles.actionsRow}>
                                                <Pressable
                                                    style={[styles.actionButton, styles.counterButton]}
                                                    onPress={() => setShowCounterModal(true)}
                                                    disabled={processingAction !== null}
                                                >
                                                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                                                        <MaterialIcons name="edit" size={16} color="#FFF" />
                                                        <Text style={[styles.actionText, { marginLeft: 6 }]}>Suggest Alternative</Text>
                                                    </View>
                                                </Pressable>
                                            </View>
                                            <View style={styles.actionsRow}>
                                                <Pressable
                                                    style={[styles.actionButton, styles.acceptButton]}
                                                    onPress={() => handleAccept()}
                                                    disabled={processingAction !== null}
                                                >
                                                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                                                        {processingAction === "accept" ? (
                                                            <ActivityIndicator size="small" color="#FFF" />
                                                        ) : (
                                                            <>
                                                                <MaterialIcons name="check" size={16} color="#FFF" />
                                                                <Text style={[styles.actionText, { marginLeft: 4 }]}>Accept</Text>
                                                            </>
                                                        )}
                                                    </View>
                                                </Pressable>
                                                <Pressable
                                                    style={[styles.actionButton, styles.rejectButton]}
                                                    onPress={handleReject}
                                                    disabled={processingAction !== null}
                                                >
                                                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                                                        {processingAction === "reject" ? (
                                                            <ActivityIndicator size="small" color="#FFF" />
                                                        ) : (
                                                            <>
                                                                <MaterialIcons name="close" size={16} color="#FFF" />
                                                                <Text style={[styles.actionText, { marginLeft: 4 }]}>Reject</Text>
                                                            </>
                                                        )}
                                                    </View>
                                                </Pressable>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            );
                        })
                    )}
                </ScrollView>
            ) : null}

            {segment === "matchrooms" ? (
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {loadingMatchrooms ? (
                        <ActivityIndicator size="small" color={COLORS.accent} />
                    ) : matchrooms.length === 0 ? (
                        <Text style={styles.emptyText}>No matchrooms found for this zone.</Text>
                    ) : (
                        <>
                            <View style={styles.resultsCount}>
                                <Text style={styles.resultsCountText}>
                                    {matchrooms.length} matchroom{matchrooms.length !== 1 ? "s" : ""} found
                                </Text>
                            </View>
                            {matchrooms.map((item) => (
                                <View
                                    key={item.id}
                                    style={
                                        focusedMatchroomId === item.id
                                            ? styles.matchroomFocusedWrap
                                            : styles.walkinMatchroomItem
                                    }
                                >
                                    <MatchroomCard
                                        room={toMatchroomCardData(
                                            item,
                                            zone?.primaryBranch?.areaLabel || zone?.venueBrandName || "Zone Venue",
                                        )}
                                        containerStyle={focusedMatchroomId === item.id ? { marginBottom: 0 } : undefined}
                                    />
                                </View>
                            ))}
                        </>
                    )}
                </ScrollView>
            ) : null}

            {segment === "walkins" ? (
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    <View style={styles.walkinCard}>
                        <Text style={styles.walkinTitle}>Create Walk-in Matchroom</Text>
                        <Text style={styles.walkinSubtitle}>
                            Use the same Create Matchroom flow as player dashboard, with admin walk-in controls.
                        </Text>
                        <Pressable
                            style={[styles.actionButton, styles.walkinCreateButton]}
                            onPress={() =>
                                router.push({
                                    pathname: "/matchrooms/create",
                                    params: {
                                        mode: "zone_walkin_admin",
                                        zoneId: zone?.id || "",
                                        zoneName: zone?.venueBrandName || "",
                                        branchId: primaryBranch?.id || zone?.primaryBranch?.id || "",
                                        t: Date.now().toString(),
                                    },
                                } as any)
                            }
                            disabled={processingAction !== null}
                        >
                            <Text style={styles.walkinCreateText}>Create Walk-in Matchroom</Text>
                        </Pressable>
                    </View>

                    <View style={[styles.counterHeader, { marginTop: SPACING.lg }]}>
                        <Text style={styles.detailsTitle}>Existing Walk-ins</Text>
                        <Text style={styles.emptyText}>{walkInRooms.length}</Text>
                    </View>
                    {walkInRooms.length === 0 ? (
                        <Text style={styles.emptyText}>No walk-in matchrooms yet.</Text>
                    ) : (
                        walkInRooms.map((item) => (
                            <View key={`walkin-${item.id}`} style={styles.walkinMatchroomItem}>
                                <MatchroomCard
                                    room={toMatchroomCardData(
                                        item,
                                        zone?.primaryBranch?.areaLabel || zone?.venueBrandName || "Zone Venue",
                                    )}
                                />
                            </View>
                        ))
                    )}
                </ScrollView>
            ) : null}

            <Modal
                visible={showCounterModal}
                animationType="slide"
                transparent
                onRequestClose={() => !processingAction && setShowCounterModal(false)}
            >
                <TouchableWithoutFeedback onPress={() => !processingAction && setShowCounterModal(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={styles.modalContent}>
                                <View style={styles.modalHeader}>
                                    <View>
                                        <Text style={styles.modalTitle}>Suggest Alternative</Text>
                                        <Text style={styles.modalSubtitle}>Price and note</Text>
                                    </View>
                                    <Pressable
                                        onPress={() => setShowCounterModal(false)}
                                        disabled={processingAction !== null}
                                    >
                                        <MaterialIcons name="close" size={24} color={COLORS.textSecondary} />
                                    </Pressable>
                                </View>

                                <ScrollView style={styles.counterForm} showsVerticalScrollIndicator={false}>
                                    <Text style={styles.formLabel}>Counter Price (PKR)</Text>
                                    <TextInput
                                        value={counterPrice}
                                        onChangeText={setCounterPrice}
                                        keyboardType="numeric"
                                        style={styles.input}
                                        placeholder="1500"
                                        placeholderTextColor={COLORS.muted}
                                    />

                                    <View style={{ marginBottom: SPACING.sm }}>
                                        <Text style={styles.emptyText}>
                                            Suggested time is auto-set (2 hours from now).
                                        </Text>
                                    </View>

                                    <Text style={styles.formLabel}>Offer Expires In (Minutes)</Text>
                                    <TextInput
                                        value={counterExpiryMinutes}
                                        onChangeText={setCounterExpiryMinutes}
                                        keyboardType="numeric"
                                        style={styles.input}
                                        placeholder="10"
                                        placeholderTextColor={COLORS.muted}
                                    />

                                    <Text style={styles.formLabel}>Note to Player</Text>
                                    <TextInput
                                        value={counterMessage}
                                        onChangeText={setCounterMessage}
                                        style={[styles.input, styles.inputMultiline]}
                                        placeholder="Optional note"
                                        placeholderTextColor={COLORS.muted}
                                        multiline
                                    />

                                    <Pressable
                                        style={[
                                            styles.actionButton,
                                            styles.counterButton,
                                            { marginTop: 20, height: 54, width: "100%" },
                                            (processingAction || !counterPrice) && { opacity: 0.6 },
                                        ]}
                                        onPress={handleCounterOffer}
                                        disabled={processingAction !== null || !counterPrice}
                                    >
                                        {processingAction === "counter" ? (
                                            <ActivityIndicator size="small" color="#FFF" />
                                        ) : (
                                            <Text style={[styles.actionText, { fontSize: 16 }]}>Send Suggestion</Text>
                                        )}
                                    </Pressable>
                                </ScrollView>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </Screen>
    );
}


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
    createZoneWalkInMatchroom,
    rejectZoneBookingRequest,
    sendZoneCounterOffer,
    subscribeZoneBookingQueue,
    subscribeZoneMatchrooms,
    type ZoneBookingAssetType,
    type ZoneBookingQueueItem,
    type ZoneMatchroomListItem,
} from "../../../src/services/zoneAdminBookingService";
import { COLORS } from "../../../src/theme";
import styles from "./bookings.styles";

type Segment = "requests" | "matchrooms" | "walkins";
type RequestFilter = "all" | "open" | "pending_payment" | "accepted";
type AssetFilter = "all" | ZoneBookingAssetType;
type WalkInPaymentMode = "venue_pay" | "guest_pay" | "mixed";

const REQUEST_FILTERS: RequestFilter[] = ["all", "open", "pending_payment", "accepted"];
const ASSET_FILTERS: AssetFilter[] = ["all", "pc", "court", "mixed", "unknown"];
const ACTIVE_QUEUE_STATUSES = new Set(["open", "pending_payment", "accepted"]);
const WALKIN_GAMES = [
    { key: "cs2", label: "CS2" },
    { key: "fc26", label: "FC26" },
    { key: "tekken8", label: "Tekken 8" },
    { key: "futsal", label: "Futsal" },
    { key: "padel", label: "Padel" },
    { key: "pickleball", label: "Pickleball" },
];

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

const toDateDisplay = (value: Date) =>
    `${String(value.getDate()).padStart(2, "0")}/${String(value.getMonth() + 1).padStart(2, "0")}/${value.getFullYear()}`;

const toTimeDisplay = (value: Date) =>
    value.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });

const parseTimeToDraft = (date: Date) => {
    const hour24 = date.getHours();
    const period: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM";
    return {
        hour: hour24 % 12 || 12,
        minute: date.getMinutes() >= 30 ? 30 : 0,
        period,
    };
};

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
    id: item.id,
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
    const [queue, setQueue] = useState<ZoneBookingQueueItem[]>([]);
    const [linkedRequests, setLinkedRequests] = useState<ZoneBookingQueueItem[]>([]);
    const [matchrooms, setMatchrooms] = useState<ZoneMatchroomListItem[]>([]);
    const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
    const [loadingQueue, setLoadingQueue] = useState(true);
    const [loadingMatchrooms, setLoadingMatchrooms] = useState(true);
    const [processingAction, setProcessingAction] = useState<"accept" | "reject" | "counter" | "walkin" | null>(null);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [matchroomLookupDone, setMatchroomLookupDone] = useState(false);
    const [backfillInProgress, setBackfillInProgress] = useState(false);

    const [rejectReason, setRejectReason] = useState("fully_booked");
    const [rejectNote, setRejectNote] = useState("");
    const [rejectAlternative, setRejectAlternative] = useState("");

    const [counterPrice, setCounterPrice] = useState("");
    const [counterDateValue, setCounterDateValue] = useState<Date>(new Date(Date.now() + 2 * 60 * 60 * 1000));
    const [counterMessage, setCounterMessage] = useState("");
    const [counterExpiryMinutes, setCounterExpiryMinutes] = useState("10");
    const [focusedMatchroomId, setFocusedMatchroomId] = useState<string | null>(null);

    const [walkInTitle, setWalkInTitle] = useState("Walk-in Matchroom");
    const [walkInGame, setWalkInGame] = useState("cs2");
    const [walkInSeatCount, setWalkInSeatCount] = useState("10");
    const [walkInDuration, setWalkInDuration] = useState("60");
    const [walkInKnownPlayers, setWalkInKnownPlayers] = useState("0");
    const [walkInPrice, setWalkInPrice] = useState("0");
    const [walkInPaymentMode, setWalkInPaymentMode] = useState<WalkInPaymentMode>("venue_pay");
    const [walkInDateValue, setWalkInDateValue] = useState<Date>(new Date(Date.now() + 60 * 60 * 1000));
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [dateTarget, setDateTarget] = useState<null | "counter" | "walkin">(null);
    const [timeTarget, setTimeTarget] = useState<null | "counter" | "walkin">(null);
    const [dateDraft, setDateDraft] = useState<Date | null>(null);
    const [monthCursor, setMonthCursor] = useState<Date>(() => {
        const base = new Date();
        base.setDate(1);
        base.setHours(0, 0, 0, 0);
        return base;
    });
    const [timeDraft, setTimeDraft] = useState<{ hour: number; minute: number; period: "AM" | "PM" }>({
        hour: 12,
        minute: 0,
        period: "PM",
    });

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

        const counterDateTime = formatDateTime(counterDateValue);
        setProcessingAction("counter");
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
        setProcessingAction(null);
        if (!result.ok) {
            Alert.alert("Counter-offer failed", result.message);
            return;
        }

        Alert.alert("Alternative sent", "Player can accept this from their offers inbox.");
    };

    const handleCreateWalkIn = async () => {
        if (!zone?.id || !zone?.ownerUid || !user?.uid) return;
        const seatCount = Number.parseInt(walkInSeatCount, 10);
        const durationMinutes = Number.parseInt(walkInDuration, 10);
        const knownPlayers = Number.parseInt(walkInKnownPlayers, 10);
        const walkInPriceValue = Number.parseInt(walkInPrice, 10);

        if (!Number.isFinite(seatCount) || seatCount <= 0) {
            Alert.alert("Invalid seats", "Enter a valid seat count.");
            return;
        }
        if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
            Alert.alert("Invalid duration", "Enter a valid duration in minutes.");
            return;
        }
        if (!Number.isFinite(knownPlayers) || knownPlayers < 0) {
            Alert.alert("Invalid known players", "Enter a valid known players count.");
            return;
        }

        const walkInDateTime = formatDateTime(walkInDateValue);
        setProcessingAction("walkin");
        const result = await createZoneWalkInMatchroom({
            zoneId: zone.id,
            zoneOwnerUid: zone.ownerUid,
            branchId: primaryBranch?.id || null,
            branchName: primaryBranch?.branchDisplayName || null,
            adminUid: user.uid,
            adminName: user.displayName || zone.ownerFullName || "Zone Admin",
            gameKey: walkInGame,
            title: walkInTitle.trim() || "Walk-in Matchroom",
            scheduledDate: walkInDateTime.date,
            scheduledTime: walkInDateTime.time,
            durationMinutes,
            seatCount,
            paymentMode: walkInPaymentMode,
            pricePerPlayer: Number.isFinite(walkInPriceValue) ? walkInPriceValue : 0,
            currency: "PKR",
        });
        setProcessingAction(null);

        if (!result.ok) {
            Alert.alert("Walk-in failed", result.message);
            return;
        }

        Alert.alert("Walk-in created", "Matchroom created from admin dashboard.");
        setSegment("matchrooms");
    };

    const openDatePicker = (target: "counter" | "walkin") => {
        const sourceDate = target === "counter" ? counterDateValue : walkInDateValue;
        const monthStart = new Date(sourceDate);
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        setDateTarget(target);
        setDateDraft(sourceDate);
        setMonthCursor(monthStart);
        setShowDatePicker(true);
    };

    const openTimePicker = (target: "counter" | "walkin") => {
        const sourceDate = target === "counter" ? counterDateValue : walkInDateValue;
        setTimeTarget(target);
        setTimeDraft(parseTimeToDraft(sourceDate));
        setShowTimePicker(true);
    };

    const applyDateDraft = () => {
        if (!dateDraft || !dateTarget) {
            setShowDatePicker(false);
            return;
        }
        if (dateTarget === "counter") {
            setCounterDateValue((prev) => new Date(
                dateDraft.getFullYear(),
                dateDraft.getMonth(),
                dateDraft.getDate(),
                prev.getHours(),
                prev.getMinutes(),
                0,
                0,
            ));
        } else {
            setWalkInDateValue((prev) => new Date(
                dateDraft.getFullYear(),
                dateDraft.getMonth(),
                dateDraft.getDate(),
                prev.getHours(),
                prev.getMinutes(),
                0,
                0,
            ));
        }
        setShowDatePicker(false);
    };

    const applyTimeDraft = () => {
        if (!timeTarget) {
            setShowTimePicker(false);
            return;
        }
        const normalizedHour = timeDraft.hour % 12;
        const hour24 = timeDraft.period === "PM" ? normalizedHour + 12 : normalizedHour;
        if (timeTarget === "counter") {
            setCounterDateValue((prev) => new Date(
                prev.getFullYear(),
                prev.getMonth(),
                prev.getDate(),
                hour24,
                timeDraft.minute,
                0,
                0,
            ));
        } else {
            setWalkInDateValue((prev) => new Date(
                prev.getFullYear(),
                prev.getMonth(),
                prev.getDate(),
                hour24,
                timeDraft.minute,
                0,
                0,
            ));
        }
        setShowTimePicker(false);
    };

    const monthYearLabel = monthCursor.toLocaleString("en-US", { month: "long", year: "numeric" });
    const daysInMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();
    const firstWeekday = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1).getDay();
    const hours12 = Array.from({ length: 12 }).map((_, idx) => idx + 1);
    const minutes = [0, 30];
    const periods: Array<"AM" | "PM"> = ["AM", "PM"];
    const isSameDay = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();

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
                                        acceptLabel="Accept"
                                    />
                                </View>
                            );
                        })
                    )}

                    {selectedRequest && (
                        <View style={styles.detailsCard}>
                            <Text style={styles.detailsTitle}>Manage Request</Text>
                            <Text style={styles.detailsLine}>User: {selectedRequest.userName}</Text>
                            <Text style={styles.detailsLine}>Game: {selectedRequest.gameKey.toUpperCase()}</Text>
                            <Text style={styles.detailsLine}>Status: {selectedRequest.status}</Text>

                            <View style={styles.counterHeader}>
                                <Text style={styles.detailsTitle}>Counter Offer</Text>
                            </View>

                            <Text style={styles.formLabel}>Counter Price (PKR)</Text>
                            <TextInput
                                value={counterPrice}
                                onChangeText={setCounterPrice}
                                keyboardType="numeric"
                                style={styles.input}
                                placeholder="e.g. 1500"
                                placeholderTextColor={COLORS.muted}
                            />

                            <Text style={styles.formLabel}>Expires In (Minutes)</Text>
                            <TextInput
                                value={counterExpiryMinutes}
                                onChangeText={setCounterExpiryMinutes}
                                keyboardType="numeric"
                                style={styles.input}
                                placeholder="e.g. 10"
                                placeholderTextColor={COLORS.muted}
                            />

                            <Text style={styles.formLabel}>Message (Optional)</Text>
                            <TextInput
                                value={counterMessage}
                                onChangeText={setCounterMessage}
                                style={[styles.input, styles.inputMultiline]}
                                placeholder="e.g. Alternative timing available..."
                                placeholderTextColor={COLORS.muted}
                                multiline
                            />

                            <View style={styles.actionsRow}>
                                <Pressable
                                    style={[styles.actionButton, styles.counterButton]}
                                    onPress={handleCounterOffer}
                                    disabled={processingAction !== null}
                                >
                                    <Text style={styles.actionText}>Send Counter</Text>
                                </Pressable>
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
                                    {matchrooms.length} matchroom{matchrooms.length !== 1 ? 's' : ''} found
                                </Text>
                            </View>
                            {matchrooms.map((item) => (
                                <View key={item.id} style={focusedMatchroomId === item.id ? styles.matchroomFocusedWrap : undefined}>
                                    <MatchroomCard
                                        room={toMatchroomCardData(
                                            item,
                                            zone?.primaryBranch?.areaLabel || zone?.venueBrandName || "Zone Venue",
                                        )}
                                    />
                                    {item.bookingSource === "walkin" ? (
                                        <View style={styles.walkinChipOverlay}>
                                            <View style={styles.walkinChip}>
                                                <Text style={styles.flagText}>
                                                    walk-in / {item.walkInPaymentMode || "venue_pay"}
                                                </Text>
                                            </View>
                                        </View>
                                    ) : null}
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
                            Create booking for walk-ins with venue-pay, guest-pay, or mixed mode.
                        </Text>

                        <Text style={styles.formLabel}>Matchroom Title</Text>
                        <TextInput
                            value={walkInTitle}
                            onChangeText={setWalkInTitle}
                            style={styles.input}
                            placeholder="e.g. Walk-in Futsal 5v5"
                            placeholderTextColor={COLORS.muted}
                        />

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                            {WALKIN_GAMES.map((item) => (
                                <Pressable
                                    key={item.key}
                                    onPress={() => setWalkInGame(item.key)}
                                    style={[styles.filterChip, walkInGame === item.key && styles.filterChipActive]}
                                >
                                    <Text style={[styles.filterChipText, walkInGame === item.key && styles.filterChipTextActive]}>
                                        {item.label}
                                    </Text>
                                </Pressable>
                            ))}
                        </ScrollView>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                            {(["venue_pay", "guest_pay", "mixed"] as WalkInPaymentMode[]).map((mode) => (
                                <Pressable
                                    key={mode}
                                    onPress={() => setWalkInPaymentMode(mode)}
                                    style={[styles.filterChip, walkInPaymentMode === mode && styles.filterChipActive]}
                                >
                                    <Text style={[styles.filterChipText, walkInPaymentMode === mode && styles.filterChipTextActive]}>
                                        {mode}
                                    </Text>
                                </Pressable>
                            ))}
                        </ScrollView>

                        <View style={styles.formGrid}>
                            <View style={styles.halfInput}>
                                <Text style={styles.formLabel}>Seat Count</Text>
                                <TextInput
                                    value={walkInSeatCount}
                                    onChangeText={setWalkInSeatCount}
                                    keyboardType="numeric"
                                    style={styles.input}
                                    placeholder="e.g. 10"
                                    placeholderTextColor={COLORS.muted}
                                />
                            </View>
                            <View style={styles.halfInput}>
                                <Text style={styles.formLabel}>Duration (Mins)</Text>
                                <TextInput
                                    value={walkInDuration}
                                    onChangeText={setWalkInDuration}
                                    keyboardType="numeric"
                                    style={styles.input}
                                    placeholder="e.g. 90"
                                    placeholderTextColor={COLORS.muted}
                                />
                            </View>
                        </View>

                        <View style={styles.formGrid}>
                            <View style={styles.halfInput}>
                                <Text style={styles.formLabel}>Known Players</Text>
                                <TextInput
                                    value={walkInKnownPlayers}
                                    onChangeText={setWalkInKnownPlayers}
                                    keyboardType="numeric"
                                    style={styles.input}
                                    placeholder="e.g. 4"
                                    placeholderTextColor={COLORS.muted}
                                />
                            </View>
                            <View style={styles.halfInput}>
                                <Text style={styles.formLabel}>Price Per Player</Text>
                                <TextInput
                                    value={walkInPrice}
                                    onChangeText={setWalkInPrice}
                                    keyboardType="numeric"
                                    style={styles.input}
                                    placeholder="e.g. 1500"
                                    placeholderTextColor={COLORS.muted}
                                />
                            </View>
                        </View>

                        <View style={styles.dateRow}>
                            <Pressable style={styles.dateField} onPress={() => openDatePicker("walkin")}>
                                <MaterialIcons name="event" size={16} color={COLORS.accent} />
                                <Text style={styles.dateFieldText}>{toDateDisplay(walkInDateValue)}</Text>
                            </Pressable>
                            <Pressable style={styles.dateField} onPress={() => openTimePicker("walkin")}>
                                <MaterialIcons name="schedule" size={16} color={COLORS.accent} />
                                <Text style={styles.dateFieldText}>{toTimeDisplay(walkInDateValue)}</Text>
                            </Pressable>
                        </View>

                        <Text style={styles.walkinInfo}>
                            Branch: {primaryBranch?.branchDisplayName || zone?.primaryBranch?.branchDisplayName || "Primary"}
                        </Text>

                        <Pressable
                            style={[styles.actionButton, styles.walkinCreateButton]}
                            onPress={handleCreateWalkIn}
                            disabled={processingAction !== null}
                        >
                            {processingAction === "walkin" ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <Text style={styles.actionText}>Create Walk-in Matchroom</Text>
                            )}
                        </Pressable>
                    </View>
                </ScrollView>
            ) : null}

            <Modal
                visible={showDatePicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDatePicker(false)}
            >
                <View style={styles.pickerOverlay}>
                    <TouchableWithoutFeedback onPress={() => setShowDatePicker(false)}>
                        <View style={styles.pickerBackdrop} />
                    </TouchableWithoutFeedback>
                    <View style={styles.pickerSheet}>
                        <View style={styles.pickerHandle} />
                        <View style={styles.pickerHeader}>
                            <Pressable onPress={() => setShowDatePicker(false)}>
                                <Text style={styles.pickerAction}>Cancel</Text>
                            </Pressable>
                            <Text style={styles.pickerTitle}>Select Date</Text>
                            <Pressable onPress={applyDateDraft}>
                                <Text style={styles.pickerAction}>Done</Text>
                            </Pressable>
                        </View>
                        <View style={styles.calendarContainer}>
                            <View style={styles.calendarHeader}>
                                <Pressable
                                    style={styles.calendarNavButton}
                                    onPress={() => {
                                        const prev = new Date(monthCursor);
                                        prev.setMonth(prev.getMonth() - 1);
                                        setMonthCursor(prev);
                                    }}
                                >
                                    <Text style={styles.calendarNavText}>{"<"}</Text>
                                </Pressable>
                                <Text style={styles.calendarTitle}>{monthYearLabel}</Text>
                                <Pressable
                                    style={styles.calendarNavButton}
                                    onPress={() => {
                                        const next = new Date(monthCursor);
                                        next.setMonth(next.getMonth() + 1);
                                        setMonthCursor(next);
                                    }}
                                >
                                    <Text style={styles.calendarNavText}>{">"}</Text>
                                </Pressable>
                            </View>
                            <View style={styles.weekdayRow}>
                                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
                                    <Text key={label} style={styles.weekdayLabel}>{label}</Text>
                                ))}
                            </View>
                            <View style={styles.calendarGrid}>
                                {Array.from({ length: firstWeekday }).map((_, idx) => (
                                    <View key={`empty-${idx}`} style={styles.dayCell} />
                                ))}
                                {Array.from({ length: daysInMonth }).map((_, idx) => {
                                    const dayNumber = idx + 1;
                                    const date = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), dayNumber);
                                    const selected = dateDraft ? isSameDay(dateDraft, date) : false;
                                    return (
                                        <Pressable
                                            key={`day-${dayNumber}`}
                                            style={[styles.dayCell, selected && styles.dayCellSelected]}
                                            onPress={() => setDateDraft(date)}
                                        >
                                            <Text style={[styles.dayText, selected && styles.dayTextSelected]}>
                                                {dayNumber}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={showTimePicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowTimePicker(false)}
            >
                <View style={styles.pickerOverlay}>
                    <TouchableWithoutFeedback onPress={() => setShowTimePicker(false)}>
                        <View style={styles.pickerBackdrop} />
                    </TouchableWithoutFeedback>
                    <View style={styles.pickerSheet}>
                        <View style={styles.pickerHandle} />
                        <View style={styles.pickerHeader}>
                            <Pressable onPress={() => setShowTimePicker(false)}>
                                <Text style={styles.pickerAction}>Cancel</Text>
                            </Pressable>
                            <Text style={styles.pickerTitle}>Select Time</Text>
                            <Pressable onPress={applyTimeDraft}>
                                <Text style={styles.pickerAction}>Done</Text>
                            </Pressable>
                        </View>
                        <View style={styles.timePickerRow}>
                            <View style={styles.timeColumn}>
                                {hours12.map((hour) => {
                                    const selected = timeDraft.hour === hour;
                                    return (
                                        <Pressable
                                            key={`h-${hour}`}
                                            style={[styles.timeOption, selected && styles.timeOptionActive]}
                                            onPress={() => setTimeDraft((prev) => ({ ...prev, hour }))}
                                        >
                                            <Text style={[styles.timeOptionText, selected && styles.timeOptionTextActive]}>
                                                {String(hour).padStart(2, "0")}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                            <View style={styles.timeColumn}>
                                {minutes.map((minute) => {
                                    const selected = timeDraft.minute === minute;
                                    return (
                                        <Pressable
                                            key={`m-${minute}`}
                                            style={[styles.timeOption, selected && styles.timeOptionActive]}
                                            onPress={() => setTimeDraft((prev) => ({ ...prev, minute }))}
                                        >
                                            <Text style={[styles.timeOptionText, selected && styles.timeOptionTextActive]}>
                                                {String(minute).padStart(2, "0")}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                            <View style={styles.timeColumn}>
                                {periods.map((period) => {
                                    const selected = timeDraft.period === period;
                                    return (
                                        <Pressable
                                            key={`p-${period}`}
                                            style={[styles.timeOption, selected && styles.timeOptionActive]}
                                            onPress={() => setTimeDraft((prev) => ({ ...prev, period }))}
                                        >
                                            <Text style={[styles.timeOptionText, selected && styles.timeOptionTextActive]}>
                                                {period}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>
        </Screen>
    );
}


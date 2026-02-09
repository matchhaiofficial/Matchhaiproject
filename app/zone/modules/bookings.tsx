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

import AppHeader from "../../../src/components/AppHeader";
import SegmentedTabs from "../../../src/components/SegmentedTabs";
import Screen from "../../../src/components/Screen";
import MatchroomCard from "../../matchrooms/components/MatchroomCard";
import { useAuth } from "../../../src/context/AuthContext";
import { useZoneData } from "../../../src/hooks/useZoneData";
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

const toMatchroomCardData = (room: ZoneMatchroomListItem, fallbackLocation?: string): Matchroom => ({
    id: room.id,
    hostUid: room.zoneOwnerUid || "",
    hostName: "Zone Host",
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
        perPlayer: 0,
        currency: "PKR",
    },
    scheduledDate: room.scheduledDate,
    scheduledTime: room.scheduledTime,
    slotsA: [],
    slotsB: [],
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
    const [matchrooms, setMatchrooms] = useState<ZoneMatchroomListItem[]>([]);
    const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
    const [loadingQueue, setLoadingQueue] = useState(true);
    const [loadingMatchrooms, setLoadingMatchrooms] = useState(true);
    const [processingAction, setProcessingAction] = useState<"accept" | "reject" | "counter" | "walkin" | null>(null);
    const [errorText, setErrorText] = useState<string | null>(null);

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
        if (deepSegment === "matchrooms" || deepSegment === "requests") {
            setSegment(deepSegment);
        }
        if (deepRequestId) {
            setSelectedRequestId(deepRequestId);
        }
        if (deepMatchroomId) {
            setFocusedMatchroomId(deepMatchroomId);
            setSegment("matchrooms");
        }
    }, [deepMatchroomId, deepRequestId, deepSegment]);

    const filteredQueue = useMemo(
        () =>
            queue.filter((item) => {
                const requestOk = requestFilter === "all" ? true : item.status === requestFilter;
                const assetOk = assetFilter === "all" ? true : item.assetType === assetFilter;
                return requestOk && assetOk;
            }),
        [assetFilter, queue, requestFilter],
    );

    const selectedRequest = useMemo(
        () => queue.find((item) => item.id === selectedRequestId) || null,
        [queue, selectedRequestId],
    );

    useEffect(() => {
        setSelectedRequestId((prev) => {
            if (prev && queue.some((item) => item.id === prev)) return prev;
            return queue[0]?.id || null;
        });
    }, [queue]);

    const handleAccept = async () => {
        if (!zone?.id || !user?.uid || !selectedRequest) return;
        setProcessingAction("accept");
        const result = await acceptZoneBookingRequest({
            requestId: selectedRequest.id,
            adminUid: user.uid,
            zoneId: zone.id,
            requestOwnerUid: selectedRequest.userId,
            branchId: primaryBranch?.id || undefined,
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

        Alert.alert("Counter-offer sent", "Player can accept this from their offers inbox.");
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
                    ) : filteredQueue.length === 0 ? (
                        <Text style={styles.emptyText}>No requests found for selected filters.</Text>
                    ) : (
                        filteredQueue.map((item) => {
                            const selected = selectedRequestId === item.id;
                            return (
                                <Pressable
                                    key={item.id}
                                    style={[styles.requestCard, selected && styles.requestCardActive]}
                                    onPress={() => setSelectedRequestId(item.id)}
                                >
                                    <View style={styles.requestTopRow}>
                                        <Text style={styles.requestTitle} numberOfLines={1}>
                                            {item.title}
                                        </Text>
                                        <Text style={styles.requestStatus}>{item.status}</Text>
                                    </View>
                                    <Text style={styles.requestMeta}>
                                        {item.userName} / {item.gameKey.toUpperCase()} / {item.assetType}
                                    </Text>
                                    <Text style={styles.requestMeta}>
                                        Players: {item.maxPlayers} / Budget: {item.currency || "PKR"} {item.budgetPerPlayer || 0}
                                    </Text>
                                    {item.priorityFlags.length ? (
                                        <View style={styles.flagRow}>
                                            {item.priorityFlags.map((flag) => (
                                                <View key={`${item.id}_${flag}`} style={styles.flagPill}>
                                                    <Text style={styles.flagText}>{flag}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    ) : null}
                                </Pressable>
                            );
                        })
                    )}

                    {selectedRequest ? (
                        <View style={styles.detailsCard}>
                            <Text style={styles.detailsTitle}>Request Details</Text>
                            <Text style={styles.detailsLine}>Requested by: {selectedRequest.userName}</Text>
                            <Text style={styles.detailsLine}>Date/Time: {selectedRequest.preferredDate ? formatDate(selectedRequest.preferredDate) : "N/A"} {selectedRequest.preferredTime || ""}</Text>
                            <Text style={styles.detailsLine}>Areas: {(selectedRequest.preferredAreas || []).join(", ") || "N/A"}</Text>
                            <Text style={styles.detailsLine}>Payment: {selectedRequest.paymentStatus || "unpaid"}</Text>

                            <View style={styles.actionsRow}>
                                <Pressable
                                    style={[styles.actionButton, styles.acceptButton]}
                                    onPress={handleAccept}
                                    disabled={processingAction !== null}
                                >
                                    {processingAction === "accept" ? (
                                        <ActivityIndicator size="small" color="#FFF" />
                                    ) : (
                                        <Text style={styles.actionText}>Accept</Text>
                                    )}
                                </Pressable>
                                <Pressable
                                    style={[styles.actionButton, styles.rejectButton]}
                                    onPress={handleReject}
                                    disabled={processingAction !== null}
                                >
                                    {processingAction === "reject" ? (
                                        <ActivityIndicator size="small" color="#FFF" />
                                    ) : (
                                        <Text style={styles.actionText}>Reject</Text>
                                    )}
                                </Pressable>
                            </View>

                            <Text style={styles.formLabel}>Reject reason</Text>
                            <TextInput
                                value={rejectReason}
                                onChangeText={setRejectReason}
                                style={styles.input}
                                placeholder="fully_booked"
                                placeholderTextColor={COLORS.muted}
                            />
                            <TextInput
                                value={rejectNote}
                                onChangeText={setRejectNote}
                                style={styles.input}
                                placeholder="Maintenance in progress"
                                placeholderTextColor={COLORS.muted}
                            />
                            <TextInput
                                value={rejectAlternative}
                                onChangeText={setRejectAlternative}
                                style={styles.input}
                                placeholder="Tomorrow 7:00 PM, Court 2"
                                placeholderTextColor={COLORS.muted}
                            />

                            <View style={styles.counterHeader}>
                                <Text style={styles.detailsTitle}>Counter-offer</Text>
                                <Pressable
                                    style={[styles.actionButton, styles.counterButton]}
                                    onPress={handleCounterOffer}
                                    disabled={processingAction !== null}
                                >
                                    {processingAction === "counter" ? (
                                        <ActivityIndicator size="small" color="#FFF" />
                                    ) : (
                                        <Text style={styles.actionText}>Send Offer</Text>
                                    )}
                                </Pressable>
                            </View>
                            <TextInput
                                value={counterPrice}
                                onChangeText={setCounterPrice}
                                style={styles.input}
                                keyboardType="numeric"
                                placeholder="2500"
                                placeholderTextColor={COLORS.muted}
                            />
                            <View style={styles.dateRow}>
                                <Pressable style={styles.dateField} onPress={() => openDatePicker("counter")}>
                                    <MaterialIcons name="event" size={16} color={COLORS.accent} />
                                    <Text style={styles.dateFieldText}>{toDateDisplay(counterDateValue)}</Text>
                                </Pressable>
                                <Pressable style={styles.dateField} onPress={() => openTimePicker("counter")}>
                                    <MaterialIcons name="schedule" size={16} color={COLORS.accent} />
                                    <Text style={styles.dateFieldText}>{toTimeDisplay(counterDateValue)}</Text>
                                </Pressable>
                            </View>
                            <TextInput
                                value={counterExpiryMinutes}
                                onChangeText={setCounterExpiryMinutes}
                                style={styles.input}
                                keyboardType="numeric"
                                placeholder="10"
                                placeholderTextColor={COLORS.muted}
                            />
                            <TextInput
                                value={counterMessage}
                                onChangeText={setCounterMessage}
                                style={[styles.input, styles.inputMultiline]}
                                multiline
                                placeholder="Free drink included"
                                placeholderTextColor={COLORS.muted}
                            />
                        </View>
                    ) : null}
                </ScrollView>
            ) : null}

            {segment === "matchrooms" ? (
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {loadingMatchrooms ? (
                        <ActivityIndicator size="small" color={COLORS.accent} />
                    ) : matchrooms.length === 0 ? (
                        <Text style={styles.emptyText}>No matchrooms found for this zone.</Text>
                    ) : (
                        matchrooms.map((item) => (
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
                        ))
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

                        <TextInput
                            value={walkInTitle}
                            onChangeText={setWalkInTitle}
                            style={styles.input}
                            placeholder="Walk-in Futsal 5v5"
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
                            <TextInput
                                value={walkInSeatCount}
                                onChangeText={setWalkInSeatCount}
                                keyboardType="numeric"
                                style={[styles.input, styles.halfInput]}
                                placeholder="10"
                                placeholderTextColor={COLORS.muted}
                            />
                            <TextInput
                                value={walkInDuration}
                                onChangeText={setWalkInDuration}
                                keyboardType="numeric"
                                style={[styles.input, styles.halfInput]}
                                placeholder="90"
                                placeholderTextColor={COLORS.muted}
                            />
                        </View>

                        <View style={styles.formGrid}>
                            <TextInput
                                value={walkInKnownPlayers}
                                onChangeText={setWalkInKnownPlayers}
                                keyboardType="numeric"
                                style={[styles.input, styles.halfInput]}
                                placeholder="4"
                                placeholderTextColor={COLORS.muted}
                            />
                            <TextInput
                                value={walkInPrice}
                                onChangeText={setWalkInPrice}
                                keyboardType="numeric"
                                style={[styles.input, styles.halfInput]}
                                placeholder="1500"
                                placeholderTextColor={COLORS.muted}
                            />
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


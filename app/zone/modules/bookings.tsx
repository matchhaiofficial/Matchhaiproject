import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Text,
    View,
} from "react-native";

import AppHeader from "../../../src/components/AppHeader";
import { AppIcon } from "../../../src/components/AppIcon";
import SegmentedTabs from "../../../src/components/SegmentedTabs";
import Screen from "../../../src/components/Screen";
import MatchroomCard from "../../matchrooms/components/MatchroomCard";
import { useAuth } from "../../../src/context/AuthContext";
import { useRouteLogger } from "../../../src/hooks/useRouteLogger";
import { useToast } from "../../../src/hooks/useToast";
import { useZoneData } from "../../../src/hooks/useZoneData";
import { convex } from "../../../src/lib/convex";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { type Matchroom } from "../../../src/services/convex/matchService";
import {
    subscribeZoneBookingQueue,
    subscribeZoneMatchrooms,
    type ZoneBookingQueueItem,
    type ZoneMatchroomListItem,
} from "../../../src/services/convex/zoneAdminBookingService";
import {
    subscribeBranchResources,
    subscribeZoneBranches,
    type ZoneBranch,
    type ZoneBranchResource,
} from "../../../src/services/convex/zoneAdminResourceService";
import { COLORS, SPACING } from "../../../src/theme";
import Logger from "../../../src/utils/logger";
import { toLocalDateString } from "../../../src/utils/scheduleTime";
import {
    ZoneBookingsAllocationSheet,
    type ZoneBookingAllocationResourceOption,
} from "./components/ZoneBookingsAllocationSheet";
import { ZoneBookingsCounterOfferSheets } from "./components/ZoneBookingsCounterOfferSheets";
import { ZoneBookingsHistorySection } from "./components/ZoneBookingsHistorySection";
import { ZoneBookingsMatchroomsSection } from "./components/ZoneBookingsMatchroomsSection";
import { ZoneBookingsRequestsSection } from "./components/ZoneBookingsRequestsSection";
import { ZoneBookingsWalkinsSection } from "./components/ZoneBookingsWalkinsSection";
import { useZoneBookingsActions } from "./hooks/useZoneBookingsActions";
import {
    getRequestMatchroomId,
    toDateString,
    toScheduleMillis,
    useZoneBookingsViewModel,
} from "./hooks/useZoneBookingsViewModel";
import styles from "./bookings.styles";

type Segment = "requests" | "pending" | "matchrooms" | "walkins" | "history";
type MatchroomFilter = "all" | "open" | "locked" | "cancelled";
type GameFilter = "all" | "cs2" | "cs16" | "valorant" | "fc26" | "tekken8" | "futsal" | "indoor_cricket" | "padel" | "pickleball";
type TimeOfDayFilter = "all" | "day" | "night";
type DateRangeFilter = "all" | "today" | "next7";
type RequestTypeFilter = "all" | "direct" | "broadcast";
type RequestStatusFilter = "all" | "open" | "pending_payment";
type PaymentFilter = "all" | "paid" | "unpaid";
type SourceFilter = "all" | "online" | "walkin" | "admin";
type FilterOption = { key: string; label: string };
type BookingFilterGroup = {
    key: string;
    label: string;
    options: readonly FilterOption[];
    value: string;
    onSelect: (value: string) => void;
};

const MATCHROOM_STATUS_OPTIONS: FilterOption[] = [
    { key: "all", label: "All" },
    { key: "open", label: "Open" },
    { key: "locked", label: "Locked" },
    { key: "cancelled", label: "Cancelled" },
];
const GAME_FILTERS: Array<{ key: GameFilter; label: string }> = [
    { key: "all", label: "All games" },
    { key: "cs2", label: "CS2" },
    { key: "cs16", label: "CS 1.6" },
    { key: "valorant", label: "Valorant" },
    { key: "fc26", label: "FC26" },
    { key: "tekken8", label: "Tekken 8" },
    { key: "futsal", label: "Futsal" },
    { key: "indoor_cricket", label: "Cricket" },
    { key: "padel", label: "Padel" },
    { key: "pickleball", label: "Pickleball" },
];
const TIME_OF_DAY_FILTERS: Array<{ key: TimeOfDayFilter; label: string }> = [
    { key: "all", label: "Any time" },
    { key: "day", label: "Day (6am-6pm)" },
    { key: "night", label: "Night (6pm-6am)" },
];
const DATE_RANGE_FILTERS: FilterOption[] = [
    { key: "all", label: "Any date" },
    { key: "today", label: "Today" },
    { key: "next7", label: "Next 7 Days" },
];
const REQUEST_TYPE_FILTERS: FilterOption[] = [
    { key: "all", label: "Any type" },
    { key: "direct", label: "Direct" },
    { key: "broadcast", label: "Broadcast" },
];
const REQUEST_STATUS_FILTERS: FilterOption[] = [
    { key: "all", label: "Any status" },
    { key: "open", label: "Open" },
    { key: "pending_payment", label: "Pending Payment" },
];
const PAYMENT_STATUS_OPTIONS: FilterOption[] = [
    { key: "all", label: "Any payment" },
    { key: "paid", label: "Paid" },
    { key: "unpaid", label: "Unpaid" },
];
const BOOKING_SOURCE_OPTIONS: FilterOption[] = [
    { key: "all", label: "Any source" },
    { key: "online", label: "Online" },
    { key: "walkin", label: "Walk-in" },
    { key: "admin", label: "Admin" },
];

const CS_STYLE_GAMES = new Set(["cs2", "cs16", "valorant"]);
const CONSOLE_GAMES = new Set(["fc25", "fc26", "tekken8"]);
const COURT_GAME_ASSETS: Record<string, string> = {
    futsal: "futsal",
    indoor_cricket: "indoor_cricket",
    cricket: "indoor_cricket",
    padel: "padel",
    pickleball: "pickleball",
};

const normalizeGameKey = (value?: string | null) => {
    const gameKey = String(value || "").trim().toLowerCase();
    return gameKey === "fc25" ? "fc26" : gameKey;
};

const normalizeResourceToken = (value?: string | null) =>
    String(value || "").trim().toLowerCase();

const getTierFromRateKey = (value?: string | null) => {
    const [, tier] = normalizeResourceToken(value).split(":");
    return tier || "";
};

const formatEnumLabel = (value?: string | null) =>
    String(value || "")
        .replace(/[_-]/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
        .trim();

const inferResourceTier = (resource: ZoneBranchResource) => {
    const explicit = normalizeResourceToken(resource.tier);
    if (explicit) return explicit;
    const label = normalizeResourceToken(`${resource.label} ${resource.roomLabel || ""}`);
    if (label.includes("elite")) return "elite";
    if (label.includes("premium")) return "premium";
    if (label.includes("regular")) return "regular";
    if (label.includes("ps5") || label.includes("playstation 5")) return "ps5";
    if (label.includes("xbox")) return "xbox";
    return "";
};

const getAllocationResourceProfile = (request?: ZoneBookingQueueItem | null) => {
    const gameKey = normalizeGameKey(request?.gameKey);
    const requestedTier =
        normalizeResourceToken(request?.requestedResourceTier) ||
        getTierFromRateKey(request?.selectedZoneRateKey);
    const requestedSurface = normalizeResourceToken(request?.requestedResourceSurface);

    if (CS_STYLE_GAMES.has(gameKey)) {
        const tier = ["regular", "premium", "elite"].includes(requestedTier) ? requestedTier : "";
        return {
            assetType: "pc",
            requiredCount: 2,
            tier,
            resourceLabel: tier ? `${formatEnumLabel(tier)} PC rooms` : "PC rooms",
            roomSize: 5,
            unit: "pc_room" as const,
        };
    }

    if (CONSOLE_GAMES.has(gameKey)) {
        const tier = ["ps5", "xbox"].includes(requestedTier) ? requestedTier : "";
        return {
            assetType: "console",
            requiredCount: 1,
            tier,
            resourceLabel: tier ? formatEnumLabel(tier) : "Console",
            unit: "resource" as const,
        };
    }

    const courtAssetType = COURT_GAME_ASSETS[gameKey];
    if (courtAssetType) {
        return {
            assetType: courtAssetType,
            requiredCount: 1,
            surface: requestedSurface,
            unit: "resource" as const,
        };
    }

    return {
        assetType: normalizeResourceToken(request?.requestedResourceAssetType) || request?.assetType || "unknown",
        requiredCount: 1,
        resourceLabel: "Resource",
        unit: "resource" as const,
    };
};

const resourceMatchesAllocationProfile = (
    resource: ZoneBranchResource,
    profile: ReturnType<typeof getAllocationResourceProfile>,
    request?: ZoneBookingQueueItem | null,
) => {
    if (!resource.isActive) return false;
    if (resource.lifecycleStatus === "held") {
        const linkedRequestId = String(resource.holdRequestId || resource.bookingRequestId || "");
        if (linkedRequestId && linkedRequestId !== String(request?.id || "")) {
            return false;
        }
    }
    if (normalizeResourceToken(resource.assetType) !== profile.assetType) return false;
    if ("tier" in profile && profile.tier && inferResourceTier(resource) !== profile.tier) {
        return false;
    }
    if ("surface" in profile && profile.surface && normalizeResourceToken(resource.surface) !== profile.surface) {
        return false;
    }
    return true;
};

const sortAllocationResources = (resources: ZoneBranchResource[]) =>
    [...resources].sort((a, b) =>
        `${a.roomLabel || ""} ${a.label}`.localeCompare(`${b.roomLabel || ""} ${b.label}`),
    );

const buildAllocationResourceOptions = (
    request: ZoneBookingQueueItem | null,
    resources: ZoneBranchResource[],
): ZoneBookingAllocationResourceOption[] => {
    const profile = getAllocationResourceProfile(request);
    const matchingResources = sortAllocationResources(
        resources.filter((resource) => resourceMatchesAllocationProfile(resource, profile, request)),
    );

    if (profile.unit === "pc_room") {
        const grouped = new Map<string, ZoneBranchResource[]>();
        matchingResources.forEach((resource) => {
            const roomKey = `${inferResourceTier(resource) || "pc"}:${resource.roomLabel || "Room"}`;
            const current = grouped.get(roomKey) || [];
            current.push(resource);
            grouped.set(roomKey, current);
        });

        const options: ZoneBookingAllocationResourceOption[] = [];
        Array.from(grouped.entries()).forEach(([roomKey, roomResources]) => {
            const sortedRoomResources = sortAllocationResources(roomResources);
            const roomSize = profile.roomSize;
            for (let index = 0; index < sortedRoomResources.length; index += roomSize) {
                const chunk = sortedRoomResources.slice(index, index + roomSize);
                if (chunk.length < roomSize) continue;
                const baseLabel = chunk[0]?.roomLabel || "PC Room";
                const label = sortedRoomResources.length > roomSize
                    ? `${baseLabel} ${Math.floor(index / roomSize) + 1}`
                    : baseLabel;
                options.push({
                    id: `${roomKey}:${index}`,
                    label,
                    meta: `${formatEnumLabel(inferResourceTier(chunk[0])) || "PC"} | ${roomSize} PCs available`,
                    resourceIds: chunk.map((resource) => resource.id),
                });
            }
        });
        return options;
    }

    return matchingResources.map((resource) => ({
        id: resource.id,
        label: resource.roomLabel ? `${resource.label} | ${resource.roomLabel}` : resource.label,
        meta: [resource.assetType, inferResourceTier(resource) || resource.surface, resource.lifecycleStatus]
            .filter(Boolean)
            .join(" | "),
        resourceIds: [resource.id],
    }));
};

const getRequestFixedBranch = (
    request: ZoneBookingQueueItem | null,
    branches: ZoneBranch[],
    primaryBranch?: ZoneBranch | null,
) => {
    if (!request) return primaryBranch || branches[0] || null;

    const raw = request.raw || {};
    const explicitBranchId = String(
        request.allocatedBranchId ||
        raw.branchId ||
        raw.selectedBranchId ||
        raw.targetBranchId ||
        raw.confirmedBranchId ||
        "",
    ).trim();
    if (explicitBranchId) {
        const explicit = branches.find((branch) => String(branch.id) === explicitBranchId);
        if (explicit) return explicit;
    }

    const requestedArea = normalizeResourceToken(
        request.targetAreaLabel ||
        raw.targetAreaLabel ||
        raw.branchAreaLabel ||
        raw.areaLabel ||
        request.preferredAreas?.[0],
    );
    if (requestedArea) {
        const areaMatch = branches.find(
            (branch) => normalizeResourceToken(branch.areaLabel) === requestedArea,
        );
        if (areaMatch) return areaMatch;
    }

    return primaryBranch || branches[0] || null;
};

const getRequiredResourceCount = (request?: ZoneBookingQueueItem | null) => {
    return getAllocationResourceProfile(request).requiredCount;
};

const getAllocationValidationMessage = (
    request: ZoneBookingQueueItem | null,
    selectedCount: number,
) => {
    if (!request) return "Select a booking request first.";
    const gameKey = normalizeGameKey(request.gameKey);
    const requiredCount = getRequiredResourceCount(request);
    if (CS_STYLE_GAMES.has(gameKey)) {
        if (selectedCount !== requiredCount) {
            return `CS/Valorant bookings require exactly ${requiredCount} PC rooms.`;
        }
        return null;
    }
    if (CONSOLE_GAMES.has(gameKey)) {
        if (selectedCount !== 1) {
            return "Console bookings require exactly 1 selected console.";
        }
        return null;
    }
    if (request.assetType === "court") {
        if (selectedCount !== 1) {
            return "Court bookings require exactly 1 selected resource.";
        }
        return null;
    }
    if (selectedCount < 1) {
        return "Select at least 1 resource. Asset type is not fully classified, so verify the allocation before accepting.";
    }
    return "Asset type is not fully classified. Verify the selected resources before accepting.";
};

const formatDateTime = (value: Date) => ({
    // Local calendar date (NOT UTC) so late-night times keep the correct day.
    date: toLocalDateString(value),
    time: value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
});

const createDefaultScheduleOption = () => {
    const suggested = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const start = formatDateTime(suggested);
    const end = formatDateTime(new Date(suggested.getTime() + 60 * 60 * 1000));
    return { ...start, endTime: end.time };
};

const toClockMinutes = (value?: string | null) => {
    const raw = String(value || "").trim();
    const twelveHour = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (twelveHour) {
        let hour = Number(twelveHour[1]) || 0;
        const minute = Number(twelveHour[2]) || 0;
        const period = twelveHour[3].toUpperCase();
        if (period === "PM" && hour !== 12) hour += 12;
        if (period === "AM" && hour === 12) hour = 0;
        return hour * 60 + minute;
    }
    const twentyFourHour = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (!twentyFourHour) return null;
    const hour = Math.max(0, Math.min(23, Number(twentyFourHour[1]) || 0));
    const minute = Math.max(0, Math.min(59, Number(twentyFourHour[2]) || 0));
    return hour * 60 + minute;
};

const fromClockMinutes = (value: number) => {
    const normalized = ((Math.round(value / 15) * 15) % 1440 + 1440) % 1440;
    const hour24 = Math.floor(normalized / 60);
    const minute = normalized % 60;
    const period = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 % 12 || 12;
    return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`;
};

const parseTimeToDraft = (value?: string | null) => {
    const minutes = toClockMinutes(value);
    if (minutes === null) {
        return { hour: 12, minute: 0, period: "PM" as const };
    }
    const hour24 = Math.floor(minutes / 60);
    return {
        hour: hour24 % 12 || 12,
        minute: minutes % 60,
        period: (hour24 >= 12 ? "PM" : "AM") as "AM" | "PM",
    };
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
    locationMode: item.locationMode as any,
    broadcastAreas: item.preferredAreas || [],
    broadcastRequestStatus:
        item.locationMode === "broadcast" ? "waiting_for_zones" : undefined,
    pricing: {
        perPlayer: item.budgetPerPlayer || 0,
        currency: item.currency || "PKR",
    },
    scheduledDate: toDateString(item.preferredDate),
    scheduledTime: item.preferredTime,
    expiresAt: item.responseExpiresAt,
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
    const { showToast } = useToast();

    const [segment, setSegment] = useState<Segment>("requests");
    const [showFilters, setShowFilters] = useState(false);
    const [matchroomFilter, setMatchroomFilter] = useState<MatchroomFilter>("all");
    const [gameFilter, setGameFilter] = useState<GameFilter>("all");
    const [timeOfDayFilter, setTimeOfDayFilter] = useState<TimeOfDayFilter>("all");
    const [requestDateRange, setRequestDateRange] = useState<DateRangeFilter>("all");
    const [requestBranch, setRequestBranch] = useState<string>("all");
    const [requestType, setRequestType] = useState<RequestTypeFilter>("all");
    const [requestStatus, setRequestStatus] = useState<RequestStatusFilter>("all");
    const [matchroomDateRange, setMatchroomDateRange] = useState<DateRangeFilter>("all");
    const [matchroomBranch, setMatchroomBranch] = useState<string>("all");
    const [matchroomPayment, setMatchroomPayment] = useState<PaymentFilter>("all");
    const [matchroomSource, setMatchroomSource] = useState<SourceFilter>("all");
    const [requestSearchQuery, setRequestSearchQuery] = useState("");
    const [matchroomSearchQuery, setMatchroomSearchQuery] = useState("");
    const [showCounterModal, setShowCounterModal] = useState(false);
    const [showAllocationSheet, setShowAllocationSheet] = useState(false);
    const [queue, setQueue] = useState<ZoneBookingQueueItem[]>([]);
    const [matchrooms, setMatchrooms] = useState<ZoneMatchroomListItem[]>([]);
    const [allocationBranches, setAllocationBranches] = useState<ZoneBranch[]>([]);
    const [allocationBranchId, setAllocationBranchId] = useState<string | null>(null);
    const [allocationResources, setAllocationResources] = useState<ZoneBranchResource[]>([]);
    const [allocationSelectedResourceIds, setAllocationSelectedResourceIds] = useState<string[]>([]);
    const [loadingAllocationBranches, setLoadingAllocationBranches] = useState(false);
    const [loadingAllocationResources, setLoadingAllocationResources] = useState(false);
    const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
    const [loadingQueue, setLoadingQueue] = useState(true);
    const [loadingMatchrooms, setLoadingMatchrooms] = useState(true);
    const [processingAction, setProcessingAction] = useState<"accept" | "reject" | "counter" | null>(null);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [matchroomLookupDone, setMatchroomLookupDone] = useState(false);
    useRouteLogger("ZoneBookingsModule", {
        segment,
        requestStatus,
        gameFilter,
        timeOfDayFilter,
        zoneId: zone?.id,
        userId: user?._id,
    });

    const [rejectReason, setRejectReason] = useState("fully_booked");
    const [rejectNote, setRejectNote] = useState("");
    const [rejectAlternative, setRejectAlternative] = useState("");

    const [counterOptions, setCounterOptions] = useState<Array<{ date: string; time: string; endTime?: string }>>([
        createDefaultScheduleOption(),
    ]);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [editingOptionIndex, setEditingOptionIndex] = useState<number | null>(null);
    const [editingTimeField, setEditingTimeField] = useState<"start" | "end">("start");
    const [dateDraft, setDateDraft] = useState<Date | null>(new Date());
    const [monthCursor, setMonthCursor] = useState(new Date());
    const [timeDraft, setTimeDraft] = useState(parseTimeToDraft(createDefaultScheduleOption().time));
    const [focusedMatchroomId, setFocusedMatchroomId] = useState<string | null>(null);

    const zoneOffers = useQuery(
        api.bookings.listOffersByZone,
        zone?.id ? { zoneId: zone.id as Id<"zones"> } : "skip",
    );
    const historyRows = useQuery(
        api.zoneAdminBooking.listBookingHistoryForZone,
        zone?.id && segment === "history" ? { zoneId: zone.id, limit: 20 } : "skip",
    );

    const deepSegment = Array.isArray(params.segment) ? params.segment[0] : params.segment;
    const deepRequestId = Array.isArray(params.requestId) ? params.requestId[0] : params.requestId;
    const deepMatchroomId = Array.isArray(params.matchroomId) ? params.matchroomId[0] : params.matchroomId;

    const {
        branchAreas,
        primaryBranch,
        walkInCount,
        walkInRooms,
        combinedQueue,
        filteredQueue,
        selectedRequest,
        selectedMatchroomId,
        minDate,
        firstWeekday,
        daysInMonth,
        monthYearLabel,
    } = useZoneBookingsViewModel({
        zone,
        queue,
        matchrooms,
        gameFilter,
        timeOfDayFilter,
        dateRangeFilter: requestDateRange,
        branchFilter: requestBranch,
        requestTypeFilter: requestType,
        requestStatusFilter: requestStatus,
        searchQuery: requestSearchQuery,
        selectedRequestId,
        monthCursor,
    });

    const activeRequestFilterCount = useMemo(
        () =>
            (gameFilter !== "all" ? 1 : 0) +
            (timeOfDayFilter !== "all" ? 1 : 0) +
            (requestDateRange !== "all" ? 1 : 0) +
            (requestBranch !== "all" ? 1 : 0) +
            (requestType !== "all" ? 1 : 0) +
            (requestStatus !== "all" ? 1 : 0),
        [gameFilter, timeOfDayFilter, requestDateRange, requestBranch, requestType, requestStatus],
    );

    const branchOptions = useMemo<FilterOption[]>(() => {
        const branches = Array.isArray((zone as any)?.branches) ? (zone as any).branches : [];
        return [
            { key: "all", label: "Any branch" },
            ...branches.map((branch: any) => ({
                key: String(branch?.id),
                label: branch?.branchDisplayName || branch?.areaLabel || "Branch",
            })),
        ];
    }, [(zone as any)?.branches]);

    const requestFilterGroups = useMemo<BookingFilterGroup[]>(
        () => [
            { key: "game", label: "Game", options: GAME_FILTERS, value: gameFilter, onSelect: (value) => setGameFilter(value as GameFilter) },
            { key: "time", label: "Time of day", options: TIME_OF_DAY_FILTERS, value: timeOfDayFilter, onSelect: (value) => setTimeOfDayFilter(value as TimeOfDayFilter) },
            { key: "date", label: "Date range", options: DATE_RANGE_FILTERS, value: requestDateRange, onSelect: (value) => setRequestDateRange(value as DateRangeFilter) },
            { key: "branch", label: "Branch", options: branchOptions, value: requestBranch, onSelect: (value) => setRequestBranch(value) },
            { key: "type", label: "Request type", options: REQUEST_TYPE_FILTERS, value: requestType, onSelect: (value) => setRequestType(value as RequestTypeFilter) },
            { key: "status", label: "Request status", options: REQUEST_STATUS_FILTERS, value: requestStatus, onSelect: (value) => setRequestStatus(value as RequestStatusFilter) },
        ],
        [gameFilter, timeOfDayFilter, requestDateRange, requestBranch, requestType, requestStatus, branchOptions],
    );

    const matchroomFilterGroups = useMemo<BookingFilterGroup[]>(
        () => [
            { key: "status", label: "Matchroom status", options: MATCHROOM_STATUS_OPTIONS, value: matchroomFilter, onSelect: (value) => setMatchroomFilter(value as MatchroomFilter) },
            { key: "date", label: "Date range", options: DATE_RANGE_FILTERS, value: matchroomDateRange, onSelect: (value) => setMatchroomDateRange(value as DateRangeFilter) },
            { key: "branch", label: "Branch", options: branchOptions, value: matchroomBranch, onSelect: (value) => setMatchroomBranch(value) },
            { key: "payment", label: "Payment status", options: PAYMENT_STATUS_OPTIONS, value: matchroomPayment, onSelect: (value) => setMatchroomPayment(value as PaymentFilter) },
            { key: "source", label: "Booking source", options: BOOKING_SOURCE_OPTIONS, value: matchroomSource, onSelect: (value) => setMatchroomSource(value as SourceFilter) },
        ],
        [matchroomFilter, matchroomDateRange, matchroomBranch, matchroomPayment, matchroomSource, branchOptions],
    );

    const resetRequestFilters = useCallback(() => {
        setGameFilter("all");
        setTimeOfDayFilter("all");
        setRequestDateRange("all");
        setRequestBranch("all");
        setRequestType("all");
        setRequestStatus("all");
    }, []);

    const resetMatchroomFilters = useCallback(() => {
        setMatchroomFilter("all");
        setMatchroomDateRange("all");
        setMatchroomBranch("all");
        setMatchroomPayment("all");
        setMatchroomSource("all");
    }, []);

    const originalStartMinutes = useMemo(
        () => toClockMinutes(selectedRequest?.preferredTime) ?? toClockMinutes(counterOptions[0]?.time) ?? 12 * 60,
        [counterOptions, selectedRequest?.preferredTime],
    );
    const originalDurationMinutes = useMemo(() => {
        const explicitMinutes = Number((selectedRequest?.raw as any)?.durationMinutes || 0);
        if (Number.isFinite(explicitMinutes) && explicitMinutes > 0) return explicitMinutes;
        const durationHours = Number(selectedRequest?.raw?.durationHours || 0);
        if (Number.isFinite(durationHours) && durationHours > 0) return Math.round(durationHours * 60);
        return 60;
    }, [selectedRequest?.raw]);
    const allowedStartMin = originalStartMinutes - 120;
    const allowedStartMax = originalStartMinutes + 120;
    const originalEndMinutes = originalStartMinutes + originalDurationMinutes;
    const allowedEndMin = originalEndMinutes - 120;
    const allowedEndMax = originalEndMinutes + 120;

    const counterValidationMessage = useMemo(() => {
        const option = counterOptions[0];
        if (!option?.date || !option?.time || !option?.endTime) return "Date, start time, and end time are required.";
        const start = toClockMinutes(option.time);
        const end = toClockMinutes(option.endTime);
        if (start === null || end === null) return "Use a valid start and end time.";
        if (end <= start) return "Ending booking time must be after the starting time.";
        if (start < allowedStartMin || start > allowedStartMax || end < allowedEndMin || end > allowedEndMax) {
            return "Alternative time must stay within 2 hours of the original booking window.";
        }
        return "";
    }, [allowedEndMax, allowedEndMin, allowedStartMax, allowedStartMin, counterOptions]);

    const pendingOffers = useMemo(() => {
        const now = Date.now();
        return ((zoneOffers || []) as any[])
            .filter((offer) => offer.status === "pending" && (!offer.expiresAt || offer.expiresAt > now))
            .sort((left, right) => (right.createdAt || 0) - (left.createdAt || 0));
    }, [zoneOffers]);

    const pendingRequestIds = useMemo(
        () => new Set(pendingOffers.map((offer) => String(offer.requestId))),
        [pendingOffers],
    );

    const visibleRequestsQueue = useMemo(
        () =>
            filteredQueue.filter((item) =>
                ["open", "pending_payment"].includes(String(item.status || "")) &&
                !pendingRequestIds.has(String(item.id)),
            ),
        [filteredQueue, pendingRequestIds],
    );

    const filteredMatchrooms = useMemo(() => {
        const normalizedSearch = matchroomSearchQuery.trim().toLowerCase();
        const branches = Array.isArray((zone as any)?.branches) ? (zone as any).branches : [];
        const todayStart = (() => {
            const date = new Date();
            date.setHours(0, 0, 0, 0);
            return date.getTime();
        })();
        return matchrooms.filter((item) => {
            const statusOk =
                matchroomFilter === "all" ||
                String(item.status || "").toLowerCase() === matchroomFilter;

            let dateOk = true;
            if (matchroomDateRange !== "all") {
                const millis = toScheduleMillis(item.scheduledDate);
                dateOk = millis
                    ? matchroomDateRange === "today"
                        ? millis >= todayStart && millis < todayStart + 24 * 60 * 60 * 1000
                        : millis >= todayStart && millis < todayStart + 7 * 24 * 60 * 60 * 1000
                    : false;
            }

            // Branch matching prefers branchId; falls back to location substring; unknown passes.
            let branchOk = true;
            if (matchroomBranch !== "all") {
                const branchId = String(item.branchId || "").trim();
                if (branchId) {
                    branchOk = branchId === matchroomBranch;
                } else {
                    const targetBranch = branches.find((branch: any) => String(branch?.id) === matchroomBranch);
                    const location = String(item.location || "").trim().toLowerCase();
                    if (targetBranch && location) {
                        const area = String(targetBranch.areaLabel || "").toLowerCase();
                        const name = String(targetBranch.branchDisplayName || "").toLowerCase();
                        branchOk = (!!area && location.includes(area)) || (!!name && location.includes(name));
                    } else {
                        branchOk = true;
                    }
                }
            }

            let paymentOk = true;
            if (matchroomPayment !== "all") {
                const paid = String(item.paymentStatus || "").toLowerCase() === "paid";
                paymentOk = matchroomPayment === "paid" ? paid : !paid;
            }

            let sourceOk = true;
            if (matchroomSource !== "all") {
                const source = String(item.bookingSource || "").toLowerCase();
                const isWalkin = source.includes("walk");
                const isAdmin = source.includes("admin");
                sourceOk =
                    matchroomSource === "walkin"
                        ? isWalkin
                        : matchroomSource === "admin"
                            ? isAdmin
                            : !isWalkin && !isAdmin;
            }

            const searchOk =
                normalizedSearch.length === 0 ||
                [
                    item.title,
                    item.game,
                    item.location,
                    item.scheduledDate,
                    item.scheduledTime,
                    item.hostName,
                ]
                    .join(" ")
                    .toLowerCase()
                    .includes(normalizedSearch);
            return statusOk && dateOk && branchOk && paymentOk && sourceOk && searchOk;
        });
    }, [
        matchroomFilter,
        matchroomDateRange,
        matchroomBranch,
        matchroomPayment,
        matchroomSource,
        matchroomSearchQuery,
        matchrooms,
        (zone as any)?.branches,
    ]);

    const activeMatchroomFilterCount = useMemo(
        () =>
            (matchroomFilter !== "all" ? 1 : 0) +
            (matchroomDateRange !== "all" ? 1 : 0) +
            (matchroomBranch !== "all" ? 1 : 0) +
            (matchroomPayment !== "all" ? 1 : 0) +
            (matchroomSource !== "all" ? 1 : 0),
        [matchroomFilter, matchroomDateRange, matchroomBranch, matchroomPayment, matchroomSource],
    );

    const updateCounterOption = (index: number, patch: Partial<{ date: string; time: string; endTime?: string }>) => {
        setCounterOptions((prev) =>
            prev.map((option, optionIndex) => {
                if (optionIndex !== index) return option;
                if (patch.time) {
                    const startRaw = toClockMinutes(patch.time);
                    const start = startRaw === null
                        ? null
                        : Math.max(allowedStartMin, Math.min(allowedStartMax, startRaw));
                    return {
                        ...option,
                        ...patch,
                        time: start === null ? patch.time : fromClockMinutes(start),
                        endTime: start === null ? option.endTime : fromClockMinutes(start + originalDurationMinutes),
                    };
                }
                if (patch.endTime) {
                    const endRaw = toClockMinutes(patch.endTime);
                    const end = endRaw === null
                        ? null
                        : Math.max(allowedEndMin, Math.min(allowedEndMax, endRaw));
                    return {
                        ...option,
                        ...patch,
                        endTime: end === null ? patch.endTime : fromClockMinutes(end),
                    };
                }
                return { ...option, ...patch };
            }),
        );
    };

    const removeCounterOption = (index: number) => {
        setCounterOptions((prev) => {
            if (prev.length === 1) return prev;
            return prev.filter((_, optionIndex) => optionIndex !== index);
        });
    };

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
                setErrorText("Failed to load booking queue.");
            },
        );

        const unsubMatchrooms = subscribeZoneMatchrooms(
            zone.id,
            user?._id,
            (rows) => {
                setMatchrooms(rows);
                setLoadingMatchrooms(false);
            },
            (error) => {
                setLoadingMatchrooms(false);
                setErrorText("Failed to load matchrooms.");
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
    }, [branchAreas, user?._id, zone?.id]);

    useEffect(() => {
        if (deepSegment === "matchrooms" || deepSegment === "requests" || deepSegment === "history") {
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
                // Use Convex to look up booking requests by zone, then filter by matchroomId
                const allRequests = await convex.query(api.bookings.listRequestsByZone, {
                    zoneId: zone.id as Id<"zones">,
                });
                const match = allRequests.find((r: any) => r.matchroomId === deepMatchroomId);
                if (!cancelled && match) {
                    setSelectedRequestId((match as any)._id);
                }
                if (!cancelled) {
                    setMatchroomLookupDone(true);
                }
            } catch (e) {
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
        showToast({
            type: "warning",
            title: "No booking request linked",
            message: "This matchroom doesn't have a booking request linked yet. Please select one from the Requests list.",
        });
    }, [deepMatchroomId, matchroomLookupDone, selectedRequestId, showToast]);

    useEffect(() => {
        setSelectedRequestId((prev) => {
            if (prev && combinedQueue.some((item) => item.id === prev)) return prev;
            return combinedQueue[0]?.id || null;
        });
    }, [combinedQueue]);

    const {
        handleAccept,
        handleReject,
        handleCounterOffer,
    } = useZoneBookingsActions({
        zone,
        user,
        primaryBranch,
        selectedRequest,
        counterOptions,
        setProcessingAction,
        setShowCounterModal,
        setCounterOptions,
        rejectReason,
        rejectNote,
        rejectAlternative,
        createDefaultScheduleOption,
    });

    useEffect(() => {
        if (!showAllocationSheet || !zone?.id) {
            setAllocationBranches([]);
            setAllocationResources([]);
            setAllocationSelectedResourceIds([]);
            setAllocationBranchId(null);
            setLoadingAllocationBranches(false);
            setLoadingAllocationResources(false);
            return;
        }

        setLoadingAllocationBranches(true);
        const unsub = subscribeZoneBranches(
            zone.id,
            (rows) => {
                setAllocationBranches(rows);
                setLoadingAllocationBranches(false);
                setAllocationBranchId(
                    getRequestFixedBranch(selectedRequest, rows, primaryBranch)?.id || null,
                );
            },
            () => {
                setLoadingAllocationBranches(false);
                setErrorText("Failed to load branch resources.");
            },
        );

        return () => unsub();
    }, [primaryBranch, selectedRequest, showAllocationSheet, zone?.id]);

    useEffect(() => {
        if (!showAllocationSheet || !zone?.id || !allocationBranchId) {
            setAllocationResources([]);
            setLoadingAllocationResources(false);
            return;
        }

        setLoadingAllocationResources(true);
        const unsub = subscribeBranchResources(
            zone.id,
            allocationBranchId,
            (rows) => {
                setAllocationResources(
                    rows.filter((resource) => ["available", "held"].includes(resource.lifecycleStatus)),
                );
                setLoadingAllocationResources(false);
            },
            () => {
                setLoadingAllocationResources(false);
                setErrorText("Failed to load branch resources.");
            },
        );

        return () => unsub();
    }, [allocationBranchId, showAllocationSheet, zone?.id]);

    useEffect(() => {
        if (!showAllocationSheet) return;
        setAllocationSelectedResourceIds([]);
    }, [allocationBranchId, selectedRequest?.id, showAllocationSheet]);

    const allocationResourceOptions = useMemo(
        () => buildAllocationResourceOptions(selectedRequest, allocationResources),
        [allocationResources, selectedRequest],
    );

    const allocationFixedBranch = useMemo(
        () => getRequestFixedBranch(selectedRequest, allocationBranches, primaryBranch),
        [allocationBranches, primaryBranch, selectedRequest],
    );

    const allocationBranchesForSheet = useMemo(
        () => (allocationFixedBranch ? [allocationFixedBranch] : []),
        [allocationFixedBranch],
    );

    const allocationSelectedUnitCount = useMemo(
        () =>
            allocationResourceOptions.filter((option) =>
                option.resourceIds.every((resourceId) => allocationSelectedResourceIds.includes(resourceId)),
            ).length,
        [allocationResourceOptions, allocationSelectedResourceIds],
    );

    const allocationSelectionSummary = useMemo(() => {
        if (!selectedRequest) return "Select resources";
        const profile = getAllocationResourceProfile(selectedRequest);
        if (profile.unit === "pc_room") return `${profile.requiredCount} PC rooms required`;
        if (profile.assetType === "console") return "1 console required";
        if (selectedRequest.assetType === "court") return "1 court required";
        return `${profile.requiredCount} resource${profile.requiredCount === 1 ? "" : "s"} required`;
    }, [selectedRequest]);

    const allocationValidationMessage = useMemo(
        () => getAllocationValidationMessage(selectedRequest, allocationSelectedUnitCount),
        [allocationSelectedUnitCount, selectedRequest],
    );
    const allocationCanSubmit = useMemo(() => {
        if (!selectedRequest || !allocationBranchId || loadingAllocationBranches || loadingAllocationResources) {
            return false;
        }
        return allocationSelectedUnitCount === getRequiredResourceCount(selectedRequest);
    }, [
        allocationBranchId,
        allocationSelectedUnitCount,
        loadingAllocationBranches,
        loadingAllocationResources,
        selectedRequest,
    ]);

    const toggleAllocationResourceOption = (resourceIds: string[]) => {
        const optionSelected = resourceIds.every((resourceId) =>
            allocationSelectedResourceIds.includes(resourceId),
        );
        if (optionSelected) {
            setAllocationSelectedResourceIds((prev) =>
                prev.filter((resourceId) => !resourceIds.includes(resourceId)),
            );
            return;
        }

        const requiredCount = getRequiredResourceCount(selectedRequest);
        if (allocationSelectedUnitCount >= requiredCount) {
            showToast({
                type: "warning",
                title: "Selection limit reached",
                message: `This booking allows ${requiredCount} selection${requiredCount === 1 ? "" : "s"}.`,
            });
            return;
        }

        setAllocationSelectedResourceIds((prev) => [
            ...prev.filter((resourceId) => !resourceIds.includes(resourceId)),
            ...resourceIds,
        ]);
    };

    const openAllocationSheet = (targetRequest?: ZoneBookingQueueItem) => {
        const request = targetRequest || selectedRequest;
        if (!request) return;
        setSelectedRequestId(request.id);
        setAllocationSelectedResourceIds([]);
        setAllocationBranchId(
            getRequestFixedBranch(request, allocationBranches, primaryBranch)?.id || primaryBranch?.id || null,
        );
        setShowAllocationSheet(true);
    };

    const openCounterModalForRequest = (targetRequest?: ZoneBookingQueueItem) => {
        const request = targetRequest || selectedRequest;
        if (request) {
            const defaultOption = createDefaultScheduleOption();
            const startMinutes = toClockMinutes(request.preferredTime) ?? toClockMinutes(defaultOption.time) ?? 12 * 60;
            const start = fromClockMinutes(startMinutes);
            const durationHours = Number(request.raw?.durationHours || 0);
            const durationMinutes =
                Number.isFinite(durationHours) && durationHours > 0
                    ? Math.round(durationHours * 60)
                    : Number((request.raw as any)?.durationMinutes || 60) || 60;
            const explicitEndMinutes = toClockMinutes(
                (request.raw as any)?.endTime ||
                (request.raw as any)?.preferredEndTime ||
                (request.raw as any)?.scheduledEndTime,
            );
            setSelectedRequestId(request.id);
            setCounterOptions([{
                date: toDateString(request.preferredDate) || defaultOption.date,
                time: start,
                endTime: fromClockMinutes(explicitEndMinutes ?? startMinutes + durationMinutes),
            }]);
        } else {
            setCounterOptions([createDefaultScheduleOption()]);
        }
        setShowCounterModal(true);
    };

    const handleAllocationSubmit = async () => {
        if (!selectedRequest || !allocationBranchId) return;
        const branch = allocationFixedBranch || allocationBranches.find((item) => item.id === allocationBranchId) || primaryBranch;
        const result = await handleAccept({
            targetRequest: selectedRequest,
            branchId: allocationBranchId,
            branchName: branch?.branchDisplayName || null,
            location: branch?.areaLabel || zone?.primaryBranch?.areaLabel || zone?.venueBrandName || null,
            resourceIds: allocationSelectedResourceIds,
        });
        if (result?.ok) {
            setShowAllocationSheet(false);
            setAllocationSelectedResourceIds([]);
            if (result.matchroomId) {
                router.push(`/matchrooms/${result.matchroomId}` as any);
            } else {
                setSegment("matchrooms");
            }
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
                    { key: "requests", label: "Requests", badge: visibleRequestsQueue.length },
                    { key: "pending", label: "Pending", badge: pendingOffers.length },
                    { key: "matchrooms", label: "Matchrooms", badge: filteredMatchrooms.length },
                    { key: "walkins", label: "Walk-ins", badge: walkInCount },
                    {
                        key: "history",
                        label: "History",
                        badge: historyRows ? (historyRows.length > 99 ? "99+" : historyRows.length) : undefined,
                    },
                ]}
                value={segment}
                onChange={(value) => setSegment(value)}
                style={styles.segmentTabs}
                itemTextStyle={styles.tabTitle}
            />

            {errorText ? (
                <View style={styles.errorBox}>
                    <AppIcon name="error-outline" size="sm" color={COLORS.error} />
                    <Text style={styles.errorText}>{errorText}</Text>
                </View>
            ) : null}

            {segment === "requests" ? (
                <ZoneBookingsRequestsSection
                    loadingQueue={loadingQueue}
                    showFilters={showFilters}
                    onToggleFilters={() => setShowFilters((prev) => !prev)}
                    filterGroups={requestFilterGroups}
                    searchQuery={requestSearchQuery}
                    activeFilterCount={activeRequestFilterCount}
                    onSearchQueryChange={setRequestSearchQuery}
                    onResetFilters={resetRequestFilters}
                    filteredQueue={visibleRequestsQueue}
                    selectedRequestId={selectedRequestId}
                    processingAction={processingAction}
                    onSelectRequest={setSelectedRequestId}
                    onOpenCounterModal={openCounterModalForRequest}
                    onAccept={openAllocationSheet}
                    onReject={handleReject}
                    buildRequestMatchroom={requestToMatchroomCardData}
                />
            ) : null}

            {segment === "pending" ? (
                <ZoneBookingsRequestsSection
                    mode="pending"
                    loadingQueue={zoneOffers === undefined}
                    showFilters={false}
                    onToggleFilters={() => undefined}
                    filterGroups={requestFilterGroups}
                    searchQuery={requestSearchQuery}
                    activeFilterCount={activeRequestFilterCount}
                    onSearchQueryChange={setRequestSearchQuery}
                    onResetFilters={resetRequestFilters}
                    filteredQueue={combinedQueue.filter((item) => pendingRequestIds.has(String(item.id)))}
                    pendingOffers={pendingOffers}
                    selectedRequestId={selectedRequestId}
                    processingAction={processingAction}
                    onSelectRequest={setSelectedRequestId}
                    onOpenCounterModal={openCounterModalForRequest}
                    onAccept={openAllocationSheet}
                    onReject={handleReject}
                    buildRequestMatchroom={requestToMatchroomCardData}
                />
            ) : null}

            {segment === "matchrooms" ? (
                <ZoneBookingsMatchroomsSection
                    loadingMatchrooms={loadingMatchrooms}
                    matchrooms={filteredMatchrooms}
                    showFilters={showFilters}
                    onToggleFilters={() => setShowFilters((prev) => !prev)}
                    filterGroups={matchroomFilterGroups}
                    searchQuery={matchroomSearchQuery}
                    activeFilterCount={activeMatchroomFilterCount}
                    onSearchQueryChange={setMatchroomSearchQuery}
                    onResetFilters={resetMatchroomFilters}
                    focusedMatchroomId={focusedMatchroomId}
                    buildMatchroomCardData={(item) =>
                        toMatchroomCardData(
                            item,
                            zone?.primaryBranch?.areaLabel || zone?.venueBrandName || "Zone Venue",
                        )
                    }
                />
            ) : null}

            {segment === "walkins" ? (
                <ZoneBookingsWalkinsSection
                    walkInRooms={walkInRooms}
                    processingAction={processingAction}
                    onCreateWalkIn={() =>
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
                    buildMatchroomCardData={(item) =>
                        toMatchroomCardData(
                            item,
                            zone?.primaryBranch?.areaLabel || zone?.venueBrandName || "Zone Venue",
                        )
                    }
                />
            ) : null}

            {segment === "history" ? (
                <ZoneBookingsHistorySection
                    loading={historyRows === undefined}
                    rows={(historyRows || []) as any[]}
                />
            ) : null}

            <ZoneBookingsCounterOfferSheets
                showCounterModal={showCounterModal}
                setShowCounterModal={setShowCounterModal}
                processingAction={processingAction}
                counterOptions={counterOptions}
                setCounterOptions={setCounterOptions}
                createDefaultScheduleOption={createDefaultScheduleOption}
                removeCounterOption={removeCounterOption}
                handleCounterOffer={handleCounterOffer}
                showDatePicker={showDatePicker}
                setShowDatePicker={setShowDatePicker}
                showTimePicker={showTimePicker}
                setShowTimePicker={setShowTimePicker}
                editingOptionIndex={editingOptionIndex}
                setEditingOptionIndex={setEditingOptionIndex}
                dateDraft={dateDraft}
                setDateDraft={setDateDraft}
                monthCursor={monthCursor}
                setMonthCursor={setMonthCursor}
                timeDraft={timeDraft}
                setTimeDraft={setTimeDraft}
                updateCounterOption={updateCounterOption}
                minDate={minDate}
                firstWeekday={firstWeekday}
                daysInMonth={daysInMonth}
                monthYearLabel={monthYearLabel}
                parseTimeToDraft={parseTimeToDraft}
                editingTimeField={editingTimeField}
                setEditingTimeField={setEditingTimeField}
                validationMessage={counterValidationMessage}
            />
            <ZoneBookingsAllocationSheet
                visible={showAllocationSheet}
                onClose={() => setShowAllocationSheet(false)}
                processingAction={processingAction}
                request={selectedRequest}
                branches={allocationBranchesForSheet}
                selectedBranchId={allocationBranchId}
                onSelectBranch={() => undefined}
                branchLocked
                loadingResources={loadingAllocationBranches || loadingAllocationResources}
                resources={allocationResourceOptions}
                selectedResourceIds={allocationSelectedResourceIds}
                onToggleResource={toggleAllocationResourceOption}
                selectedCount={allocationSelectedUnitCount}
                requiredCount={getRequiredResourceCount(selectedRequest)}
                selectionSummary={allocationSelectionSummary}
                validationMessage={allocationValidationMessage}
                canSubmit={allocationCanSubmit}
                onSubmit={handleAllocationSubmit}
            />
        </Screen>
    );
}

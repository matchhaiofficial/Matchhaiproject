import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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
    type ZoneBookingAssetType,
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
import { ZoneBookingsAllocationSheet } from "./components/ZoneBookingsAllocationSheet";
import { ZoneBookingsCounterOfferSheets } from "./components/ZoneBookingsCounterOfferSheets";
import { ZoneBookingsMatchroomsSection } from "./components/ZoneBookingsMatchroomsSection";
import { ZoneBookingsRequestsSection } from "./components/ZoneBookingsRequestsSection";
import { ZoneBookingsWalkinsSection } from "./components/ZoneBookingsWalkinsSection";
import { useZoneBookingsActions } from "./hooks/useZoneBookingsActions";
import {
    getRequestMatchroomId,
    toDateString,
    useZoneBookingsViewModel,
} from "./hooks/useZoneBookingsViewModel";
import styles from "./bookings.styles";

type Segment = "requests" | "matchrooms" | "walkins";
type RequestFilter = "all" | "open" | "pending_payment" | "accepted";
type AssetFilter = "all" | ZoneBookingAssetType;

const REQUEST_FILTERS: RequestFilter[] = ["all", "open", "pending_payment", "accepted"];
const ASSET_FILTERS: AssetFilter[] = ["all", "pc", "court", "mixed", "unknown"];

const getRequiredResourceCount = (request?: ZoneBookingQueueItem | null) => {
    if (!request) return 1;
    if (request.assetType === "pc") {
        return Math.max(
            1,
            Number(request.reservedSlots || request.playerCount || request.maxPlayers || 1),
        );
    }
    if (request.assetType === "court") return 1;
    return 1;
};

const getAllocationValidationMessage = (
    request: ZoneBookingQueueItem | null,
    selectedCount: number,
) => {
    if (!request) return "Select a booking request first.";
    const requiredCount = getRequiredResourceCount(request);
    if (request.assetType === "pc") {
        if (selectedCount !== requiredCount) {
            return `PC bookings require exactly ${requiredCount} selected resources.`;
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
    date: value.toISOString().slice(0, 10),
    time: value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
});

const createDefaultScheduleOption = () => {
    const suggested = new Date(Date.now() + 2 * 60 * 60 * 1000);
    return formatDateTime(suggested);
};

const parseTimeToDraft = (value?: string | null) => {
    const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) {
        return { hour: 12, minute: 0, period: "PM" as const };
    }
    return {
        hour: Number(match[1]) || 12,
        minute: Number(match[2]) || 0,
        period: (match[3]?.toUpperCase() === "AM" ? "AM" : "PM") as "AM" | "PM",
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
    const [showFilters, setShowFilters] = useState(true);
    const [requestFilter, setRequestFilter] = useState<RequestFilter>("all");
    const [assetFilter, setAssetFilter] = useState<AssetFilter>("all");
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
        requestFilter,
        assetFilter,
        zoneId: zone?.id,
        userId: user?._id,
    });

    const [rejectReason, setRejectReason] = useState("fully_booked");
    const [rejectNote, setRejectNote] = useState("");
    const [rejectAlternative, setRejectAlternative] = useState("");

    const [counterOptions, setCounterOptions] = useState<Array<{ date: string; time: string }>>([
        createDefaultScheduleOption(),
    ]);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [editingOptionIndex, setEditingOptionIndex] = useState<number | null>(null);
    const [dateDraft, setDateDraft] = useState<Date | null>(new Date());
    const [monthCursor, setMonthCursor] = useState(new Date());
    const [timeDraft, setTimeDraft] = useState(parseTimeToDraft(createDefaultScheduleOption().time));
    const [focusedMatchroomId, setFocusedMatchroomId] = useState<string | null>(null);

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
        requestFilter,
        assetFilter,
        selectedRequestId,
        monthCursor,
    });

    const updateCounterOption = (index: number, patch: Partial<{ date: string; time: string }>) => {
        setCounterOptions((prev) =>
            prev.map((option, optionIndex) =>
                optionIndex === index ? { ...option, ...patch } : option,
            ),
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
                setAllocationBranchId((prev) => {
                    if (prev && rows.some((branch) => branch.id === prev)) return prev;
                    return selectedRequest?.allocatedBranchId || primaryBranch?.id || rows[0]?.id || null;
                });
            },
            () => {
                setLoadingAllocationBranches(false);
                setErrorText("Failed to load branch resources.");
            },
        );

        return () => unsub();
    }, [primaryBranch?.id, selectedRequest?.allocatedBranchId, showAllocationSheet, zone?.id]);

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

    const allocationSelectionSummary = useMemo(() => {
        if (!selectedRequest) return "Select resources";
        const requestedCount = getRequiredResourceCount(selectedRequest);
        const requestedLabel = selectedRequest.assetType === "court" ? "1 court" : `${requestedCount} resource${requestedCount === 1 ? "" : "s"}`;
        return `${requestedLabel} required`;
    }, [selectedRequest]);

    const allocationValidationMessage = useMemo(
        () => getAllocationValidationMessage(selectedRequest, allocationSelectedResourceIds.length),
        [allocationSelectedResourceIds.length, selectedRequest],
    );
    const allocationCanSubmit = useMemo(() => {
        if (!selectedRequest || !allocationBranchId || loadingAllocationBranches || loadingAllocationResources) {
            return false;
        }
        if (selectedRequest.assetType === "pc") {
            return allocationSelectedResourceIds.length === getRequiredResourceCount(selectedRequest);
        }
        if (selectedRequest.assetType === "court") {
            return allocationSelectedResourceIds.length === 1;
        }
        return allocationSelectedResourceIds.length >= 1;
    }, [
        allocationBranchId,
        allocationSelectedResourceIds.length,
        loadingAllocationBranches,
        loadingAllocationResources,
        selectedRequest,
    ]);

    const openAllocationSheet = (targetRequest?: ZoneBookingQueueItem) => {
        const request = targetRequest || selectedRequest;
        if (!request) return;
        setSelectedRequestId(request.id);
        setAllocationSelectedResourceIds([]);
        setAllocationBranchId(request.allocatedBranchId || primaryBranch?.id || null);
        setShowAllocationSheet(true);
    };

    const handleAllocationSubmit = async () => {
        if (!selectedRequest || !allocationBranchId) return;
        const branch = allocationBranches.find((item) => item.id === allocationBranchId) || primaryBranch;
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
                    <AppIcon name="error-outline" size="sm" color={COLORS.error} />
                    <Text style={styles.errorText}>{errorText}</Text>
                </View>
            ) : null}

            {segment === "requests" ? (
                <ZoneBookingsRequestsSection
                    loadingQueue={loadingQueue}
                    showFilters={showFilters}
                    onToggleFilters={() => setShowFilters((prev) => !prev)}
                    requestFilters={REQUEST_FILTERS}
                    assetFilters={ASSET_FILTERS}
                    requestFilter={requestFilter}
                    assetFilter={assetFilter}
                    onSelectRequestFilter={(filter) => setRequestFilter(filter as RequestFilter)}
                    onSelectAssetFilter={(filter) => setAssetFilter(filter as AssetFilter)}
                    filteredQueue={filteredQueue}
                    selectedRequestId={selectedRequestId}
                    processingAction={processingAction}
                    onSelectRequest={setSelectedRequestId}
                    onOpenCounterModal={() => {
                        setCounterOptions([createDefaultScheduleOption()]);
                        setShowCounterModal(true);
                    }}
                    onAccept={openAllocationSheet}
                    onReject={handleReject}
                    buildRequestMatchroom={requestToMatchroomCardData}
                />
            ) : null}

            {segment === "matchrooms" ? (
                <ZoneBookingsMatchroomsSection
                    loadingMatchrooms={loadingMatchrooms}
                    matchrooms={matchrooms}
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
            />
            <ZoneBookingsAllocationSheet
                visible={showAllocationSheet}
                onClose={() => setShowAllocationSheet(false)}
                processingAction={processingAction}
                request={selectedRequest}
                branches={allocationBranches}
                selectedBranchId={allocationBranchId}
                onSelectBranch={setAllocationBranchId}
                loadingResources={loadingAllocationBranches || loadingAllocationResources}
                resources={allocationResources}
                selectedResourceIds={allocationSelectedResourceIds}
                onToggleResource={(resourceId) =>
                    setAllocationSelectedResourceIds((prev) =>
                        prev.includes(resourceId)
                            ? prev.filter((item) => item !== resourceId)
                            : [...prev, resourceId],
                    )
                }
                requiredCount={getRequiredResourceCount(selectedRequest)}
                selectionSummary={allocationSelectionSummary}
                validationMessage={allocationValidationMessage}
                canSubmit={allocationCanSubmit}
                onSubmit={handleAllocationSubmit}
            />
        </Screen>
    );
}

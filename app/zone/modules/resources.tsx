import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppHeader from "../../../src/components/AppHeader";
import { AppIcon, type AppIconName } from "../../../src/components/AppIcon";
import {
    AppDrawer,
    AppModalBody,
    AppModalFooter,
    AppModalHeader,
} from "../../../src/components/AppModalPrimitives";
import { AppButton } from "../../../src/components/AppPrimitives";
import SegmentedTabs from "../../../src/components/SegmentedTabs";
import Screen from "../../../src/components/Screen";
import { useAuth } from "../../../src/context/AuthContext";
import { useToast } from "../../../src/hooks/useToast";
import { useRouteLogger } from "../../../src/hooks/useRouteLogger";
import { useZoneData } from "../../../src/hooks/useZoneData";
import { type ResourceLifecycleStatus } from "../../../src/features/zoneAdmin/types";
import {
    subscribeZoneBookingQueue,
    subscribeZoneMatchrooms,
    type ZoneBookingQueueItem,
    type ZoneMatchroomListItem,
} from "../../../src/services/convex/zoneAdminBookingService";
import {
    allocateResourcesToBookingRequest,
    reassignResourcesForBookingRequest,
    subscribeBranchResources,
    subscribeZoneBranches,
    updateBranchResourceStatus,
    type ZoneBranch,
    type ZoneBranchResource,
} from "../../../src/services/convex/zoneAdminResourceService";
import { COLORS } from "../../../src/theme";
import { getResourceLifecycleLabel } from "../../../src/utils/statusLabels";
import { isZoneMigrationReady } from "../../../src/utils/zoneLifecycle";
import styles from "./resources.styles";

type AssetFilter =
    | "all"
    | "pc"
    | "ps5"
    | "xbox";
type StatusFilter = "all" | ResourceLifecycleStatus;
type ResourcesViewMode = "grid" | "allocation";
type AllocationDateFilter = "all" | "today" | "tomorrow" | "week" | "undated";
type ResourceSection = {
    id: string;
    title: string;
    assetFilter: AssetFilter;
    resources: ZoneBranchResource[];
    rooms?: Array<{
        id: string;
        title: string;
        resources: ZoneBranchResource[];
    }>;
};

const STATUS_FILTERS: StatusFilter[] = ["all", "available", "held", "booked", "maintenance"];
const STATUS_OPTIONS: ResourceLifecycleStatus[] = ["available", "held", "booked", "maintenance"];
const DRAWER_WIDTH = Math.min(420, Math.round(Dimensions.get("window").width * 0.94));
const ALLOCATION_DATE_FILTERS: Array<{ key: AllocationDateFilter; label: string }> = [
    { key: "all", label: "Any date" },
    { key: "today", label: "Today" },
    { key: "tomorrow", label: "Tomorrow" },
    { key: "week", label: "Next 7 days" },
    { key: "undated", label: "No date" },
];
const ASSET_FILTER_LABELS: Record<AssetFilter, string> = {
    all: "All",
    pc: "PCs",
    ps5: "PS5s",
    xbox: "Xbox",
    // Physical sports are temporarily disabled.
    // indoor_cricket: "Indoor cricket",
    // futsal: "Futsal",
    // padel: "Padel",
    // pickleball: "Pickleball",
};
const STATUS_LABELS: Record<StatusFilter, string> = {
    all: "All",
    available: getResourceLifecycleLabel("available"),
    held: getResourceLifecycleLabel("held"),
    booked: getResourceLifecycleLabel("booked"),
    maintenance: getResourceLifecycleLabel("maintenance"),
};

const PC_TIER_ORDER = ["regular", "premium", "elite"] as const;

const titleCase = (value: string) =>
    value
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join(" ");

const formatGameLabel = (value: string) => {
    const normalized = value.toLowerCase();
    if (normalized === "cs2") return "CS2";
    if (normalized === "cs16") return "CS 1.6";
    if (normalized === "fc26") return "FC26";
    if (normalized === "tekken8") return "Tekken 8";
    return titleCase(value);
};

const formatTime12 = (value?: string | null) => {
    if (!value) return "";
    const trimmed = String(value).trim();
    const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
    if (!match24) return trimmed.toUpperCase();
    const hours24 = Number(match24[1]);
    const minutes = Number(match24[2]);
    if (!Number.isFinite(hours24) || !Number.isFinite(minutes)) return trimmed;
    const period = hours24 >= 12 ? "PM" : "AM";
    const hours12 = hours24 % 12 || 12;
    return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
};

const formatMatchroomTimeRange = (room: ZoneMatchroomListItem) => {
    const startLabel = formatTime12(room.scheduledTime);
    if (!startLabel) return "Time TBD";
    const durationMinutes = Number(room.durationMinutes || 0);
    const match = String(room.scheduledTime || "").match(/^(\d{1,2}):(\d{2})$/);
    if (!match || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
        return startLabel;
    }
    const start = new Date();
    start.setHours(Number(match[1]), Number(match[2]), 0, 0);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    return `${startLabel} - ${formatTime12(
        `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`,
    )}`;
};

const assetFilterForResource = (resource: ZoneBranchResource): AssetFilter => {
    if (resource.assetType === "pc") return "pc";
    if (resource.assetType === "console") {
        const tier = String(resource.tier || resource.label || "").toLowerCase();
        return tier.includes("xbox") ? "xbox" : "ps5";
    }
    // Physical sports are temporarily disabled.
    // if (resource.assetType === "indoor_cricket") return "indoor_cricket";
    // if (resource.assetType === "futsal") return "futsal";
    // if (resource.assetType === "padel") return "padel";
    // if (resource.assetType === "pickleball") return "pickleball";
    return "all";
};

const inferPcTier = (resource: ZoneBranchResource) => {
    const source = `${resource.tier || ""} ${resource.label || ""}`.toLowerCase();
    if (source.includes("elite")) return "elite";
    if (source.includes("premium")) return "premium";
    return "regular";
};

const extractNumericSuffix = (value: string) => {
    const match = value.match(/(\d+)(?!.*\d)/);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
};

const sortResources = (resources: ZoneBranchResource[]) =>
    [...resources].sort((a, b) => {
        const numberDelta = extractNumericSuffix(a.label) - extractNumericSuffix(b.label);
        if (numberDelta !== 0) return numberDelta;
        return a.label.localeCompare(b.label);
    });

const dateKey = (date: Date) => date.toISOString().slice(0, 10);

const isUpcomingMatchroom = (room: ZoneMatchroomListItem) => {
    const status = String(room.status || "").toLowerCase();
    if (["completed", "cancelled", "expired"].includes(status)) return false;
    if (!room.scheduledDate) return true;
    return String(room.scheduledDate).slice(0, 10) >= dateKey(new Date());
};

const matchesAllocationDateFilter = (
    room: ZoneMatchroomListItem | undefined,
    filter: AllocationDateFilter,
) => {
    if (filter === "all") return true;
    const roomDate = String(room?.scheduledDate || "").slice(0, 10);
    if (!roomDate) return filter === "undated";
    if (filter === "undated") return false;

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (filter === "today") return roomDate === dateKey(today);
    if (filter === "tomorrow") return roomDate === dateKey(tomorrow);
    if (filter === "week") {
        const weekEnd = new Date(today);
        weekEnd.setDate(today.getDate() + 7);
        return roomDate >= dateKey(today) && roomDate <= dateKey(weekEnd);
    }
    return true;
};

const formatAllocationScheduleLabel = (
    resources: ZoneBranchResource[],
    matchroomByResourceId: Map<string, ZoneMatchroomListItem>,
    branchById: Map<string, ZoneBranch>,
) => {
    const labels = Array.from(
        new Set(
            resources
                .map((resource) => {
                    const room = matchroomByResourceId.get(resource.id);
                    if (!room) return "";
                    const branch = branchById.get(String(room.branchId || resource.branchId || ""));
                    const branchName = branch?.branchDisplayName || "Branch TBD";
                    const date = room.scheduledDate || "Date TBD";
                    const time = formatMatchroomTimeRange(room);
                    return `${branchName} | ${date} | ${time}`;
                })
                .filter(Boolean),
        ),
    );
    if (labels.length === 0) return "";
    if (labels.length === 1) return labels[0];
    return `${labels[0]} +${labels.length - 1} more`;
};

const buildPcRooms = (resources: ZoneBranchResource[], tier: string) => {
    const sorted = sortResources(resources);
    const rooms: Array<{ id: string; title: string; resources: ZoneBranchResource[] }> = [];
    for (let index = 0; index < sorted.length; index += 5) {
        const roomResources = sorted.slice(index, index + 5);
        const roomNumber = Math.floor(index / 5) + 1;
        const roomLabel = roomResources[0]?.roomLabel || `${titleCase(tier)} PCs Room ${roomNumber}`;
        rooms.push({
            id: `${tier}_room_${roomNumber}`,
            title: roomLabel,
            resources: roomResources,
        });
    }
    return rooms;
};

const buildCourtRooms = (resources: ZoneBranchResource[]) => {
    const grouped = new Map<string, ZoneBranchResource[]>();
    sortResources(resources).forEach((resource) => {
        const key = String(resource.surface || "default");
        const current = grouped.get(key) || [];
        current.push(resource);
        grouped.set(key, current);
    });
    return Array.from(grouped.entries()).map(([surface, entries]) => ({
        id: `${entries[0]?.assetType || "court"}_${surface}`,
        title: surface === "default" ? "All Courts" : `${titleCase(surface)} Courts`,
        resources: entries,
    }));
};

export default function ZoneResourcesModule() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{
        branchId?: string | string[];
        requestId?: string | string[];
        matchroomId?: string | string[];
        resourceId?: string | string[];
    }>();
    const { user } = useAuth();
    const { zone } = useZoneData();
    const { showToast } = useToast();
    useRouteLogger("ZoneResourcesModule", {
        zoneId: zone?.id,
        userId: user?._id,
    });

    const [branches, setBranches] = useState<ZoneBranch[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
    const [resources, setResources] = useState<ZoneBranchResource[]>([]);
    const [queue, setQueue] = useState<ZoneBookingQueueItem[]>([]);
    const [matchrooms, setMatchrooms] = useState<ZoneMatchroomListItem[]>([]);
    const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
    const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
    const [assetFilter, setAssetFilter] = useState<AssetFilter>("all");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [showFilters, setShowFilters] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [allocationGameFilter, setAllocationGameFilter] = useState("all");
    const [allocationDateFilter, setAllocationDateFilter] = useState<AllocationDateFilter>("all");
    const [viewMode, setViewMode] = useState<ResourcesViewMode>("grid");
    const [expandedSectionIds, setExpandedSectionIds] = useState<string[]>([]);
    const [expandedRoomIds, setExpandedRoomIds] = useState<string[]>([]);
    const [loadingBranches, setLoadingBranches] = useState(true);
    const [loadingResources, setLoadingResources] = useState(true);
    const [processingResourceId, setProcessingResourceId] = useState<string | null>(null);
    const [processingBulkStatus, setProcessingBulkStatus] = useState<ResourceLifecycleStatus | null>(null);
    const [allocating, setAllocating] = useState(false);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [subcollectionsBlocked, setSubcollectionsBlocked] = useState(false);
    const migrationReady = isZoneMigrationReady(zone);
    const deepBranchId = Array.isArray(params.branchId) ? params.branchId[0] : params.branchId;
    const deepRequestId = Array.isArray(params.requestId) ? params.requestId[0] : params.requestId;
    const deepMatchroomId = Array.isArray(params.matchroomId) ? params.matchroomId[0] : params.matchroomId;
    const deepResourceId = Array.isArray(params.resourceId) ? params.resourceId[0] : params.resourceId;

    const legacyBranches = useMemo(
        () =>
            Array.isArray(zone?.branches)
                ? zone.branches.map((item: any, index: number) => ({
                    id: item?.id || `legacy_${index + 1}`,
                    branchDisplayName: item?.branchDisplayName || `Branch ${index + 1}`,
                    city: item?.city || "",
                    areaLabel: item?.areaLabel || "",
                    addressLine1: item?.addressLine1 || "",
                    source: "legacy",
                }))
                : [],
        [zone?.branches],
    );

    const branchAreas = useMemo(() => {
        if (!branches.length) return [];
        return Array.from(new Set(branches.map((item) => item.areaLabel).filter(Boolean) as string[]));
    }, [branches]);

    const branchById = useMemo(
        () => new Map(branches.map((branch) => [branch.id, branch] as const)),
        [branches],
    );

    useEffect(() => {
        if (!zone?.id) {
            setLoadingBranches(false);
            return;
        }
        if (!migrationReady) {
            setBranches(legacyBranches);
            setSelectedBranchId((prev) => prev || deepBranchId || legacyBranches[0]?.id || null);
            setLoadingBranches(false);
            return;
        }

        if (subcollectionsBlocked) {
            setBranches(legacyBranches);
            setSelectedBranchId((prev) => prev || deepBranchId || legacyBranches[0]?.id || null);
            setLoadingBranches(false);
            return;
        }

        const unsub = subscribeZoneBranches(
            zone.id,
            (rows) => {
                setLoadingBranches(false);
                if (rows.length > 0) {
                    setBranches(rows);
                    setSelectedBranchId((prev) => prev || deepBranchId || rows[0].id);
                    return;
                }

                setBranches(legacyBranches);
                setSelectedBranchId((prev) => prev || deepBranchId || legacyBranches[0]?.id || null);
            },
            (error) => {
                setLoadingBranches(false);
                setBranches(legacyBranches);
                setSelectedBranchId((prev) => prev || deepBranchId || legacyBranches[0]?.id || null);
                if (error?.code === "permission-denied") {
                    setSubcollectionsBlocked(true);
                    setErrorText("Resource details are not available right now.");
                } else {
                    setErrorText("Failed to load branch resources.");
                }
            },
        );

        return () => unsub();
    }, [deepBranchId, legacyBranches, migrationReady, subcollectionsBlocked, zone?.id]);

    useEffect(() => {
        if (subcollectionsBlocked) {
            setResources([]);
            setLoadingResources(false);
            return;
        }
        if (!zone?.id || !selectedBranchId) {
            setLoadingResources(false);
            return;
        }
        setLoadingResources(true);
        const unsub = subscribeBranchResources(
            zone.id,
            selectedBranchId,
            (rows) => {
                setResources(rows);
                setLoadingResources(false);
            },
            (error) => {
                setLoadingResources(false);
                if (error?.code === "permission-denied") {
                    setErrorText("Resource details are not available right now.");
                } else {
                    setErrorText("Failed to load resources.");
                }
            },
        );
        return () => unsub();
    }, [selectedBranchId, subcollectionsBlocked, zone?.id]);

    useEffect(() => {
        setSelectedResourceIds([]);
    }, [selectedBranchId]);

    useEffect(() => {
        if (!zone?.id) return;
        const unsub = subscribeZoneBookingQueue(
            zone.id,
            branchAreas,
            (rows) => {
                const filtered = rows.filter((item) => ["open", "pending_payment", "accepted"].includes(item.status));
                setQueue(filtered);
                setSelectedRequestId((prev) => prev || deepRequestId || filtered[0]?.id || null);
            },
            () => {
                // Resource module still works without queue actions.
            },
        );
        return () => unsub();
    }, [branchAreas, deepRequestId, zone?.id]);

    useEffect(() => {
        if (!zone?.id) {
            setMatchrooms([]);
            return;
        }
        const unsub = subscribeZoneMatchrooms(
            zone.id,
            user?._id,
            (rows) => setMatchrooms(rows),
            () => setMatchrooms([]),
            {
                locationHints: [
                    zone.venueBrandName || "",
                    zone.primaryBranch?.branchDisplayName || "",
                    zone.primaryBranch?.areaLabel || "",
                    ...branchAreas,
                ],
            },
        );
        return () => unsub();
    }, [branchAreas, user?._id, zone?.id, zone?.primaryBranch?.areaLabel, zone?.primaryBranch?.branchDisplayName, zone?.venueBrandName]);

    useEffect(() => {
        setSelectedRequestId((prev) => {
            if (deepRequestId && queue.some((item) => item.id === deepRequestId)) {
                return deepRequestId;
            }
            if (deepMatchroomId) {
                const linkedRequest = queue.find((item) => item.matchroomId === deepMatchroomId);
                if (linkedRequest) return linkedRequest.id;
            }
            if (prev && queue.some((item) => item.id === prev)) return prev;
            return queue[0]?.id || null;
        });
    }, [deepMatchroomId, deepRequestId, queue]);

    useEffect(() => {
        if (!deepResourceId) return;
        setSelectedResourceIds((prev) => (prev.includes(deepResourceId) ? prev : [...prev, deepResourceId]));
    }, [deepResourceId]);

    const upcomingAllocatedMatchrooms = useMemo(
        () =>
            matchrooms.filter(
                (room) =>
                    isUpcomingMatchroom(room) &&
                    Array.isArray(room.resourceIds) &&
                    room.resourceIds.length > 0,
            ),
        [matchrooms],
    );

    const matchroomByResourceId = useMemo(() => {
        const map = new Map<string, ZoneMatchroomListItem>();
        upcomingAllocatedMatchrooms.forEach((room) => {
            (room.resourceIds || []).forEach((resourceId) => {
                if (!map.has(resourceId)) map.set(resourceId, room);
            });
        });
        return map;
    }, [upcomingAllocatedMatchrooms]);

    const allocationGameFilters = useMemo(() => {
        const games = Array.from(
            new Set(
                upcomingAllocatedMatchrooms
                    .map((room) => String(room.game || "").trim().toLowerCase())
                    .filter(Boolean),
            ),
        ).sort();
        return [{ key: "all", label: "All games" }, ...games.map((game) => ({ key: game, label: formatGameLabel(game) }))];
    }, [upcomingAllocatedMatchrooms]);

    const filteredResources = useMemo(
        () =>
            resources.filter((item) => {
                const allocatedMatchroom = matchroomByResourceId.get(item.id);
                if (viewMode === "allocation") {
                    if (!allocatedMatchroom) return false;
                    if (
                        allocationGameFilter !== "all" &&
                        String(allocatedMatchroom.game || "").toLowerCase() !== allocationGameFilter
                    ) {
                        return false;
                    }
                    if (!matchesAllocationDateFilter(allocatedMatchroom, allocationDateFilter)) {
                        return false;
                    }
                }
                const normalizedSearch = searchQuery.trim().toLowerCase();
                const assetOk = assetFilter === "all" ? true : assetFilterForResource(item) === assetFilter;
                const statusOk = statusFilter === "all" ? true : item.lifecycleStatus === statusFilter;
                const searchOk =
                    normalizedSearch.length === 0 ||
                    [
                        item.label,
                        item.roomLabel,
                        item.kind,
                        item.assetType,
                        item.tier,
                        item.surface,
                        item.lifecycleStatus,
                        allocatedMatchroom?.title,
                        allocatedMatchroom?.game,
                        allocatedMatchroom?.scheduledDate,
                        allocatedMatchroom?.scheduledTime,
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase()
                        .includes(normalizedSearch);
                return assetOk && statusOk && searchOk;
            }),
        [
            allocationDateFilter,
            allocationGameFilter,
            assetFilter,
            matchroomByResourceId,
            resources,
            searchQuery,
            statusFilter,
            viewMode,
        ],
    );

    const activeFilterCount = useMemo(
        () =>
            (assetFilter !== "all" ? 1 : 0) +
            (statusFilter !== "all" ? 1 : 0) +
            (viewMode === "allocation" && allocationGameFilter !== "all" ? 1 : 0) +
            (viewMode === "allocation" && allocationDateFilter !== "all" ? 1 : 0),
        [allocationDateFilter, allocationGameFilter, assetFilter, statusFilter, viewMode],
    );

    const availableAssetFilters = useMemo(() => {
        const present = new Set<AssetFilter>(resources.map(assetFilterForResource));
        return (["all", "pc", "ps5", "xbox"] as AssetFilter[]).filter(
            (filter) => filter === "all" || present.has(filter),
        );
    }, [resources]);

    const resourceSections = useMemo<ResourceSection[]>(() => {
        const sections: ResourceSection[] = [];
        const pushSection = (
            id: string,
            title: string,
            sectionAssetFilter: AssetFilter,
            sectionResources: ZoneBranchResource[],
            roomBuilder?: (items: ZoneBranchResource[]) => Array<{ id: string; title: string; resources: ZoneBranchResource[] }>,
        ) => {
            if (!sectionResources.length) return;
            sections.push({
                id,
                title,
                assetFilter: sectionAssetFilter,
                resources: sectionResources,
                rooms: roomBuilder ? roomBuilder(sectionResources) : undefined,
            });
        };

        const pcResources = filteredResources.filter((item) => assetFilterForResource(item) === "pc");
        PC_TIER_ORDER.forEach((tier) => {
            pushSection(
                `pc_${tier}`,
                `${titleCase(tier)} PCs`,
                "pc",
                pcResources.filter((item) => inferPcTier(item) === tier),
                (items) => buildPcRooms(items, tier),
            );
        });

        const ps5Resources = filteredResources.filter((item) => assetFilterForResource(item) === "ps5");
        pushSection("ps5", "PS5", "ps5", ps5Resources, (items) => buildCourtRooms(items));

        const xboxResources = filteredResources.filter((item) => assetFilterForResource(item) === "xbox");
        pushSection("xbox", "Xbox", "xbox", xboxResources, (items) => buildCourtRooms(items));

        // Physical sports are temporarily disabled.
        // (["indoor_cricket", "futsal", "padel", "pickleball"] as AssetFilter[]).forEach((filter) => {
        //     const sectionResources = filteredResources.filter((item) => assetFilterForResource(item) === filter);
        //     pushSection(filter, ASSET_FILTER_LABELS[filter], filter, sectionResources, buildCourtRooms);
        // });

        return sections;
    }, [filteredResources]);

    useEffect(() => {
        const validSectionIds = new Set(resourceSections.map((section) => section.id));
        const validRoomIds = new Set(
            resourceSections.flatMap((section) => section.rooms?.map((room) => room.id) || []),
        );
        setExpandedSectionIds((prev) => prev.filter((id) => validSectionIds.has(id)));
        setExpandedRoomIds((prev) => prev.filter((id) => validRoomIds.has(id)));
    }, [resourceSections]);

    const selectedRequest = useMemo(
        () => queue.find((item) => item.id === selectedRequestId) || null,
        [queue, selectedRequestId],
    );
    const hasExistingAllocation = useMemo(
        () => Boolean(selectedRequest?.allocatedResourceIds && selectedRequest.allocatedResourceIds.length > 0),
        [selectedRequest?.allocatedResourceIds],
    );
    const selectedResources = useMemo(
        () => resources.filter((item) => selectedResourceIds.includes(item.id)),
        [resources, selectedResourceIds],
    );
    const requestedCount = useMemo(() => {
        if (!selectedRequest) return 0;
        const slots = Number(selectedRequest.reservedSlots || selectedRequest.maxPlayers || 0);
        return Number.isFinite(slots) ? Math.max(0, slots) : 0;
    }, [selectedRequest]);
    const allocationGap = requestedCount - selectedResourceIds.length;
    const needsMoreResources = selectedRequest && requestedCount > 0 && allocationGap > 0;
    const isClearSelectionActive = selectedResourceIds.length === 0;
    const isSelectVisibleActive =
        !isClearSelectionActive &&
        filteredResources.length > 0 &&
        selectedResourceIds.length === filteredResources.length;

    const statusSummary = useMemo(() => {
        const summary: Record<ResourceLifecycleStatus, number> = {
            available: 0,
            held: 0,
            booked: 0,
            maintenance: 0,
        };
        resources.forEach((item) => {
            summary[item.lifecycleStatus] += 1;
        });
        return summary;
    }, [resources]);

    const resourceMetrics = useMemo(
        () => [
            {
                key: "available",
                label: "Available",
                value: statusSummary.available,
                icon: "status" as AppIconName,
                color: COLORS.successBright,
            },
            {
                key: "held",
                label: "Held",
                value: statusSummary.held,
                icon: "pending" as AppIconName,
                color: COLORS.warning,
            },
            {
                key: "booked",
                label: "Booked",
                value: statusSummary.booked,
                icon: "event-seat" as AppIconName,
                color: COLORS.accent,
            },
            {
                key: "maintenance",
                label: "Maintenance",
                value: statusSummary.maintenance,
                icon: "resources" as AppIconName,
                color: COLORS.textSecondary,
            },
        ],
        [statusSummary],
    );

    useEffect(() => {
        if (!selectedRequest) {
            setSelectedResourceIds([]);
            return;
        }

        if (selectedRequest.allocatedBranchId && selectedRequest.allocatedBranchId !== selectedBranchId) {
            setSelectedBranchId(selectedRequest.allocatedBranchId);
        }

        if (selectedRequest.allocatedResourceIds?.length) {
            setSelectedResourceIds(selectedRequest.allocatedResourceIds);
            return;
        }

        setSelectedResourceIds([]);
    }, [selectedBranchId, selectedRequest]);

    const toggleResourceSelected = useCallback((resourceId: string) => {
        setSelectedResourceIds((prev) =>
            prev.includes(resourceId)
                ? prev.filter((item) => item !== resourceId)
                : [...prev, resourceId],
        );
    }, []);

    const toggleSectionExpanded = useCallback((sectionId: string) => {
        setExpandedSectionIds((prev) =>
            prev.includes(sectionId) ? prev.filter((item) => item !== sectionId) : [...prev, sectionId],
        );
    }, []);

    const toggleRoomExpanded = useCallback((roomId: string) => {
        setExpandedRoomIds((prev) =>
            prev.includes(roomId) ? prev.filter((item) => item !== roomId) : [...prev, roomId],
        );
    }, []);

    const toggleRoomSelected = useCallback((roomResources: ZoneBranchResource[]) => {
        const roomIds = roomResources.map((resource) => resource.id);
        setSelectedResourceIds((prev) => {
            const allSelected = roomIds.every((id) => prev.includes(id));
            if (allSelected) {
                return prev.filter((id) => !roomIds.includes(id));
            }
            return Array.from(new Set([...prev, ...roomIds]));
        });
    }, []);

    const setResourceStatus = useCallback(async (
        resourceId: string,
        status: ResourceLifecycleStatus,
    ) => {
        if (!zone?.id || !selectedBranchId || !user?._id) return;
        setProcessingResourceId(resourceId);
        const result = await updateBranchResourceStatus({
            zoneId: zone.id,
            branchId: selectedBranchId,
            resourceId,
            status,
            adminUid: user._id,
            holdRequestId: selectedRequestId || undefined,
        });
        setProcessingResourceId(null);
        if (!result.ok) {
            showToast({ type: "error", title: "Update failed", message: result.message });
        }
    }, [selectedBranchId, selectedRequestId, showToast, user?._id, zone?.id]);

    const applyBulkStatus = useCallback(async (status: ResourceLifecycleStatus) => {
        if (!zone?.id || !selectedBranchId || !user?._id) return;
        if (selectedResourceIds.length === 0) {
            showToast({ type: "warning", title: "No selection", message: "Select resources first." });
            return;
        }
        setProcessingBulkStatus(status);
        const results = await Promise.all(
            selectedResourceIds.map((resourceId) =>
                updateBranchResourceStatus({
                    zoneId: zone.id,
                    branchId: selectedBranchId,
                    resourceId,
                    status,
                    adminUid: user._id,
                    holdRequestId: selectedRequestId || undefined,
                }),
            ),
        );
        setProcessingBulkStatus(null);

        const failed = results.filter((result) => !result.ok).length;
        if (failed > 0) {
            showToast({
                type: "warning",
                title: "Partial update",
                message: `${selectedResourceIds.length - failed} updated, ${failed} failed.`,
            });
            return;
        }
        showToast({
            type: "success",
            title: "Updated",
            message: `${selectedResourceIds.length} resource(s) set to ${status}.`,
        });
    }, [selectedBranchId, selectedRequestId, selectedResourceIds, showToast, user?._id, zone?.id]);

    const handleAllocate = useCallback(async () => {
        if (!zone?.id || !selectedBranchId || !user?._id) return;
        if (!selectedRequestId || selectedResourceIds.length === 0) {
            showToast({ type: "warning", title: "Missing selection", message: "Pick a booking request and resources." });
            return;
        }
        const invalidResources = selectedResources.filter((item) => {
            if (["available", "held"].includes(item.lifecycleStatus)) return false;
            return !(item.lifecycleStatus === "booked" && item.bookingRequestId === selectedRequestId);
        });
        if (invalidResources.length > 0) {
            showToast({
                type: "warning",
                title: "Invalid selection",
                message: "Only available, held, or already-linked booked resources can be used here.",
            });
            return;
        }

        setAllocating(true);
        const result = hasExistingAllocation
            ? await reassignResourcesForBookingRequest({
                zoneId: zone.id,
                branchId: selectedBranchId,
                requestId: selectedRequestId,
                newResourceIds: selectedResourceIds,
                adminUid: user._id,
            })
            : await allocateResourcesToBookingRequest({
                zoneId: zone.id,
                branchId: selectedBranchId,
                requestId: selectedRequestId,
                resourceIds: selectedResourceIds,
                adminUid: user._id,
            });
        setAllocating(false);

        if (!result.ok) {
            showToast({
                type: "error",
                title: hasExistingAllocation ? "Reassignment failed" : "Allocation failed",
                message: result.message,
            });
            return;
        }
        showToast({
            type: "success",
            title: hasExistingAllocation ? "Reassigned" : "Allocated",
            message: hasExistingAllocation
                ? "Resources were reassigned and the previous allocation was released."
                : "Resources moved to booked and linked to request.",
        });
    }, [
        hasExistingAllocation,
        selectedBranchId,
        selectedRequestId,
        selectedResourceIds,
        selectedResources,
        showToast,
        user?._id,
        zone?.id,
    ]);

    return (
        <Screen style={styles.screen} scroll={false}>
            <AppHeader
                title="Resources"
                subtitle="Per-branch resource status and allocation actions"
                onBack={() => router.back()}
                inlineTitle
            />

            <SegmentedTabs
                items={[
                    { key: "grid", label: "Resource Grid", badge: filteredResources.length },
                    { key: "allocation", label: "Allocation", badge: filteredResources.length },
                ]}
                value={viewMode}
                onChange={(value) => setViewMode(value)}
                style={styles.segmentTabs}
            />

            {errorText ? (
                <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{errorText}</Text>
                </View>
            ) : null}
            <View style={styles.searchRow}>
                <View style={styles.searchBar}>
                    <AppIcon name="search" size={20} color={COLORS.muted} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder={viewMode === "allocation" ? "Search allocated resources..." : "Search resources..."}
                        placeholderTextColor={COLORS.muted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 ? (
                        <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                            <AppIcon name="close" size={18} color={COLORS.muted} />
                        </Pressable>
                    ) : null}
                </View>
                <Pressable
                    onPress={() => setShowFilters(true)}
                    style={({ pressed }) => [
                        styles.filterButton,
                        pressed && styles.filterButtonPressed,
                    ]}
                >
                    <AppIcon name="filters" size={22} color={COLORS.text} />
                    {activeFilterCount > 0 ? (
                        <View style={styles.filterBadge}>
                            <Text style={styles.filterBadgeText}>
                                {activeFilterCount > 9 ? "9+" : activeFilterCount}
                            </Text>
                        </View>
                    ) : null}
                </Pressable>
            </View>

            <AppDrawer
                visible={showFilters}
                onClose={() => setShowFilters(false)}
                drawerStyle={[styles.filterDrawer, { width: DRAWER_WIDTH }]}
            >
                <View style={[styles.filterDrawerContent, { paddingTop: Math.max(insets.top, 16) }]}>
                    <AppModalHeader title="Filters" subtitle="Resources" onClose={() => setShowFilters(false)} compact />
                    <AppModalBody scroll contentContainerStyle={styles.filtersDrawerBody}>
                        <View style={styles.filtersWrap}>
                            <Text style={styles.filterSectionLabel}>Branch</Text>
                            <View style={styles.filterChipWrap}>
                                {branches.map((branch) => (
                                    <Pressable
                                        key={branch.id}
                                        onPress={() => setSelectedBranchId(branch.id)}
                                        style={[
                                            styles.filterChip,
                                            selectedBranchId === branch.id && styles.filterChipActive,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.filterChipText,
                                                selectedBranchId === branch.id && styles.filterChipTextActive,
                                            ]}
                                        >
                                            {branch.branchDisplayName}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>

                            {viewMode === "allocation" ? (
                                <>
                                    <Text style={styles.filterSectionLabel}>Game</Text>
                                    <View style={styles.filterChipWrap}>
                                        {allocationGameFilters.map((filter) => (
                                            <Pressable
                                                key={filter.key}
                                                onPress={() => setAllocationGameFilter(filter.key)}
                                                style={[styles.filterChip, allocationGameFilter === filter.key && styles.filterChipActive]}
                                            >
                                                <Text style={[styles.filterChipText, allocationGameFilter === filter.key && styles.filterChipTextActive]}>
                                                    {filter.label}
                                                </Text>
                                            </Pressable>
                                        ))}
                                    </View>

                                    <Text style={styles.filterSectionLabel}>Date Range</Text>
                                    <View style={styles.filterChipWrap}>
                                        {ALLOCATION_DATE_FILTERS.map((filter) => (
                                            <Pressable
                                                key={filter.key}
                                                onPress={() => setAllocationDateFilter(filter.key)}
                                                style={[styles.filterChip, allocationDateFilter === filter.key && styles.filterChipActive]}
                                            >
                                                <Text style={[styles.filterChipText, allocationDateFilter === filter.key && styles.filterChipTextActive]}>
                                                    {filter.label}
                                                </Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                </>
                            ) : null}

                            <Text style={styles.filterSectionLabel}>Resource Type</Text>
                            <View style={styles.filterChipWrap}>
                                {availableAssetFilters.map((filter) => (
                                    <Pressable
                                        key={filter}
                                        onPress={() => setAssetFilter(filter)}
                                        style={[styles.filterChip, assetFilter === filter && styles.filterChipActive]}
                                    >
                                        <Text style={[styles.filterChipText, assetFilter === filter && styles.filterChipTextActive]}>
                                            {ASSET_FILTER_LABELS[filter]}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>

                            <Text style={styles.filterSectionLabel}>Resource status</Text>
                            <View style={styles.filterChipWrap}>
                                {STATUS_FILTERS.map((filter) => (
                                    <Pressable
                                        key={filter}
                                        onPress={() => setStatusFilter(filter)}
                                        style={[styles.filterChip, statusFilter === filter && styles.filterChipActive]}
                                    >
                                        <Text style={[styles.filterChipText, statusFilter === filter && styles.filterChipTextActive]}>
                                            {STATUS_LABELS[filter]}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                    </AppModalBody>
                    <AppModalFooter style={styles.filterDrawerFooter}>
                        <AppButton
                            variant="ghost"
                            disabled={activeFilterCount === 0}
                            onPress={() => {
                                setAssetFilter("all");
                                setStatusFilter("all");
                                setAllocationGameFilter("all");
                                setAllocationDateFilter("all");
                            }}
                        >
                            Reset
                        </AppButton>
                        <AppButton onPress={() => setShowFilters(false)}>Done</AppButton>
                    </AppModalFooter>
                </View>
            </AppDrawer>

            {(loadingBranches || loadingResources) ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="small" color={COLORS.accent} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {viewMode === "grid" ? (
                        <>
                            <View style={styles.summaryGrid}>
                                {resourceMetrics.map((metric, index) => (
                                    <View
                                        key={metric.key}
                                        style={[
                                            styles.summaryCard,
                                            index % 2 === 0 && styles.summaryCardLeft,
                                            index < 2 && styles.summaryCardTop,
                                        ]}
                                    >
                                        <View style={[styles.summaryIconWrap, { backgroundColor: `${metric.color}12`, borderColor: `${metric.color}38` }]}>
                                            <AppIcon name={metric.icon} size={16} color={metric.color} />
                                        </View>
                                        <View style={styles.summaryTextWrap}>
                                            <Text style={styles.summaryLabel}>{metric.label}</Text>
                                            <Text style={styles.summaryValue}>{metric.value}</Text>
                                        </View>
                                    </View>
                                ))}
                            </View>

                            <View style={styles.selectionPanel}>
                                <View style={styles.selectionPanelHeader}>
                                    <View>
                                        <Text style={styles.selectionPanelTitle}>Manage selection</Text>
                                        <Text style={styles.selectionPanelMeta}>
                                            {selectedResourceIds.length} selected from {filteredResources.length} visible
                                        </Text>
                                    </View>
                                    <View style={styles.selectionInlineActions}>
                                        <Pressable
                                            style={({ pressed }) => [
                                                styles.selectionMiniAction,
                                                isSelectVisibleActive && styles.selectionMiniActionActive,
                                                pressed && styles.selectionActionPressed,
                                            ]}
                                            onPress={() => setSelectedResourceIds(filteredResources.map((item) => item.id))}
                                        >
                                            <Text
                                                style={[
                                                    styles.selectionMiniActionText,
                                                    isSelectVisibleActive && styles.selectionMiniActionTextActive,
                                                ]}
                                            >
                                                Select visible
                                            </Text>
                                        </Pressable>
                                        <Pressable
                                            style={({ pressed }) => [
                                                styles.selectionMiniAction,
                                                isClearSelectionActive && styles.selectionMiniActionActive,
                                                pressed && styles.selectionActionPressed,
                                            ]}
                                            onPress={() => setSelectedResourceIds([])}
                                        >
                                            <Text
                                                style={[
                                                    styles.selectionMiniActionText,
                                                    isClearSelectionActive && styles.selectionMiniActionTextActive,
                                                ]}
                                            >
                                                Clear
                                            </Text>
                                        </Pressable>
                                    </View>
                                </View>
                                <Text style={styles.selectionPanelSubLabel}>Set selected status</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bulkStatusScroll}>
                                    <View style={styles.bulkStatusRowCompact}>
                                        {STATUS_OPTIONS.map((status) => (
                                            <Pressable
                                                key={`bulk_${status}`}
                                                style={({ pressed }) => [
                                                    styles.bulkStatusButton,
                                                    selectedResourceIds.length === 0 && styles.bulkStatusButtonDisabled,
                                                    pressed && styles.bulkStatusButtonPressed,
                                                ]}
                                                disabled={selectedResourceIds.length === 0 || processingBulkStatus !== null}
                                                onPress={() => applyBulkStatus(status)}
                                            >
                                                {processingBulkStatus === status ? (
                                                    <ActivityIndicator size="small" color="#FFF" />
                                                ) : (
                                                    <Text style={styles.bulkStatusButtonText}>{STATUS_LABELS[status]}</Text>
                                                )}
                                            </Pressable>
                                        ))}
                                    </View>
                                </ScrollView>
                            </View>
                        </>
                    ) : (
                        <View style={styles.allocateCard}>
                            <Text style={styles.allocateTitle}>Upcoming allocations</Text>
                            <Text style={styles.allocateMeta}>
                                Showing resources already allocated to upcoming accepted matchrooms.
                            </Text>
                            <Text style={styles.allocateMeta}>
                                {upcomingAllocatedMatchrooms.length} matchroom(s) • {filteredResources.length} resource(s)
                            </Text>
                        </View>
                    )}

                    {filteredResources.length === 0 ? (
                        <Text style={styles.emptyText}>
                            {viewMode === "allocation"
                                ? "No allocated resources found for upcoming matchrooms."
                                : "No resources found for current filters."}
                        </Text>
                    ) : (
                        <View style={styles.sectionStack}>
                            {resourceSections.map((section) => {
                                const sectionExpanded = expandedSectionIds.includes(section.id);
                                const sectionSelectedCount = section.resources.filter((resource) => selectedResourceIds.includes(resource.id)).length;
                                const sectionSchedule = viewMode === "allocation"
                                    ? formatAllocationScheduleLabel(section.resources, matchroomByResourceId, branchById)
                                    : "";
                                return (
                                    <View key={section.id} style={styles.accordionCard}>
                                        <Pressable
                                            style={styles.accordionHeader}
                                            onPress={() => toggleSectionExpanded(section.id)}
                                        >
                                            <View style={styles.accordionHeaderTextWrap}>
                                                <Text style={styles.accordionTitle}>{section.title}</Text>
                                                <Text style={styles.accordionMeta}>
                                                    {viewMode === "allocation"
                                                        ? `${section.resources.length} booked resources`
                                                        : `${section.resources.length} resources • ${sectionSelectedCount} selected`}
                                                </Text>
                                                {sectionSchedule ? (
                                                    <Text style={styles.accordionSchedule}>{sectionSchedule}</Text>
                                                ) : null}
                                            </View>
                                            <AppIcon
                                                name={sectionExpanded ? "expand-less" : "chevron-right"}
                                                size="md"
                                                tone="muted"
                                            />
                                        </Pressable>

                                        {sectionExpanded ? (
                                            <View style={styles.sectionBody}>
                                            {section.rooms?.length ? (
                                                <View style={styles.roomStack}>
                                                    {section.rooms.map((room) => {
                                                        const roomExpanded = expandedRoomIds.includes(room.id);
                                                        const roomSelected = room.resources.every((resource) => selectedResourceIds.includes(resource.id));
                                                        const roomBusy = room.resources.some((resource) => processingResourceId === resource.id) || processingBulkStatus !== null;
                                                        const roomSchedule = viewMode === "allocation"
                                                            ? formatAllocationScheduleLabel(room.resources, matchroomByResourceId, branchById)
                                                            : "";
                                                        return (
                                                            <View key={room.id} style={styles.roomCard}>
                                                                <Pressable
                                                                    style={styles.roomHeader}
                                                                    onPress={() => toggleRoomExpanded(room.id)}
                                                                >
                                                                    <View style={styles.roomHeaderTextWrap}>
                                                                        <Text style={styles.roomTitle}>{room.title}</Text>
                                                                        <Text style={styles.roomMeta}>
                                                                            {room.resources.length} resources
                                                                        </Text>
                                                                        {roomSchedule ? (
                                                                            <Text style={styles.roomSchedule}>{roomSchedule}</Text>
                                                                        ) : null}
                                                                    </View>
                                                                    <View style={styles.roomHeaderActions}>
                                                                        {viewMode !== "allocation" ? (
                                                                            <Pressable
                                                                                style={[
                                                                                    styles.roomSelectButton,
                                                                                    roomSelected && styles.roomSelectButtonActive,
                                                                                ]}
                                                                                onPress={() => toggleRoomSelected(room.resources)}
                                                                                disabled={roomBusy}
                                                                            >
                                                                                <Text
                                                                                    style={[
                                                                                        styles.roomSelectButtonText,
                                                                                        roomSelected && styles.roomSelectButtonTextActive,
                                                                                    ]}
                                                                                >
                                                                                    {roomSelected ? "Deselect room" : "Select room"}
                                                                                </Text>
                                                                            </Pressable>
                                                                        ) : null}
                                                                        <AppIcon
                                                                            name={roomExpanded ? "expand-less" : "chevron-right"}
                                                                            size="md"
                                                                            tone="muted"
                                                                        />
                                                                    </View>
                                                                </Pressable>

                                                                {roomExpanded ? (
                                                                    <View style={styles.grid}>
                                                                        {room.resources.map((resource) => {
                                                                            const selected = viewMode !== "allocation" && selectedResourceIds.includes(resource.id);
                                                                            const busy = processingResourceId === resource.id || processingBulkStatus !== null;
                                                                            const allocatedMatchroom = matchroomByResourceId.get(resource.id);
                                                                            return (
                                                                                <Pressable
                                                                                    key={resource.id}
                                                                                    style={[styles.resourceCard, selected && styles.resourceCardSelected]}
                                                                                    onPress={viewMode === "allocation" ? undefined : () => toggleResourceSelected(resource.id)}
                                                                                    disabled={viewMode === "allocation"}
                                                                                >
                                                                                    <Text style={styles.resourceLabel} numberOfLines={1}>
                                                                                        {resource.label}
                                                                                    </Text>
                                                                                    <Text style={styles.resourceMeta}>
                                                                                        {titleCase(resource.kind)} | {titleCase(resource.assetType)}
                                                                                        {resource.tier ? ` | ${titleCase(resource.tier)}` : ""}
                                                                                        {resource.surface ? ` | ${titleCase(resource.surface)}` : ""}
                                                                                    </Text>
                                                                                    <Text style={styles.resourceMeta}>
                                                                                        Status: {viewMode === "allocation" ? "Booked" : getResourceLifecycleLabel(resource.lifecycleStatus)}
                                                                                    </Text>
                                                                                    {viewMode === "allocation" && allocatedMatchroom ? (
                                                                                        <Text style={styles.resourceMeta} numberOfLines={2}>
                                                                                            Matchroom: {allocatedMatchroom.title} • {formatMatchroomTimeRange(allocatedMatchroom)}
                                                                                        </Text>
                                                                                    ) : null}
                                                                                    {resource.holdRequestId ? (
                                                                                        <Text style={styles.resourceMeta} numberOfLines={1}>
                                                                                            Hold request: {resource.holdRequestId}
                                                                                        </Text>
                                                                                    ) : null}
                                                                                    {viewMode !== "allocation" ? (
                                                                                    <View style={styles.statusRow}>
                                                                                        {STATUS_OPTIONS.map((status) => (
                                                                                            <Pressable
                                                                                                key={`${resource.id}_${status}`}
                                                                                                onPress={() => setResourceStatus(resource.id, status)}
                                                                                                style={[
                                                                                                    styles.statusAction,
                                                                                                    resource.lifecycleStatus === status && styles.statusActionActive,
                                                                                                ]}
                                                                                                disabled={busy}
                                                                                            >
                                                                                                <Text
                                                                                                    style={[
                                                                                                        styles.statusActionText,
                                                                                                        resource.lifecycleStatus === status && styles.statusActionTextActive,
                                                                                                    ]}
                                                                                                >
                                                                                                    {getResourceLifecycleLabel(status)}
                                                                                                </Text>
                                                                                            </Pressable>
                                                                                        ))}
                                                                                    </View>
                                                                                    ) : null}
                                                                                </Pressable>
                                                                            );
                                                                        })}
                                                                    </View>
                                                                ) : null}
                                                            </View>
                                                        );
                                                    })}
                                                </View>
                                            ) : (
                                                <View style={styles.grid}>
                                                    {section.resources.map((resource) => {
                                                        const selected = viewMode !== "allocation" && selectedResourceIds.includes(resource.id);
                                                        const busy = processingResourceId === resource.id || processingBulkStatus !== null;
                                                        const allocatedMatchroom = matchroomByResourceId.get(resource.id);
                                                        return (
                                                            <Pressable
                                                                key={resource.id}
                                                                style={[styles.resourceCard, selected && styles.resourceCardSelected]}
                                                                onPress={viewMode === "allocation" ? undefined : () => toggleResourceSelected(resource.id)}
                                                                disabled={viewMode === "allocation"}
                                                            >
                                                                <Text style={styles.resourceLabel} numberOfLines={1}>
                                                                    {resource.label}
                                                                </Text>
                                                                <Text style={styles.resourceMeta}>
                                                                    {titleCase(resource.kind)} | {titleCase(resource.assetType)}
                                                                    {resource.surface ? ` | ${titleCase(resource.surface)}` : ""}
                                                                </Text>
                                                                <Text style={styles.resourceMeta}>
                                                                    Status: {viewMode === "allocation" ? "Booked" : getResourceLifecycleLabel(resource.lifecycleStatus)}
                                                                </Text>
                                                                {viewMode === "allocation" && allocatedMatchroom ? (
                                                                    <Text style={styles.resourceMeta} numberOfLines={2}>
                                                                        Matchroom: {allocatedMatchroom.title} • {formatMatchroomTimeRange(allocatedMatchroom)}
                                                                    </Text>
                                                                ) : null}
                                                                {viewMode !== "allocation" ? (
                                                                <View style={styles.statusRow}>
                                                                    {STATUS_OPTIONS.map((status) => (
                                                                        <Pressable
                                                                            key={`${resource.id}_${status}`}
                                                                            onPress={() => setResourceStatus(resource.id, status)}
                                                                            style={[
                                                                                styles.statusAction,
                                                                                resource.lifecycleStatus === status && styles.statusActionActive,
                                                                            ]}
                                                                            disabled={busy}
                                                                        >
                                                                            <Text
                                                                                style={[
                                                                                    styles.statusActionText,
                                                                                    resource.lifecycleStatus === status && styles.statusActionTextActive,
                                                                                ]}
                                                                            >
                                                                                {getResourceLifecycleLabel(status)}
                                                                            </Text>
                                                                        </Pressable>
                                                                    ))}
                                                                </View>
                                                                ) : null}
                                                            </Pressable>
                                                        );
                                                    })}
                                                </View>
                                            )
                                            }</View>
                                        ) : null}
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </ScrollView>
            )}
        </Screen>
    );
}

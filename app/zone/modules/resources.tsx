import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";

import AppHeader from "../../../src/components/AppHeader";
import { AppIcon } from "../../../src/components/AppIcon";
import SegmentedTabs from "../../../src/components/SegmentedTabs";
import Screen from "../../../src/components/Screen";
import { useAuth } from "../../../src/context/AuthContext";
import { useToast } from "../../../src/hooks/useToast";
import { useRouteLogger } from "../../../src/hooks/useRouteLogger";
import { useZoneData } from "../../../src/hooks/useZoneData";
import { type ResourceLifecycleStatus } from "../../../src/features/zoneAdmin/types";
import { subscribeZoneBookingQueue, type ZoneBookingQueueItem } from "../../../src/services/convex/zoneAdminBookingService";
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
import { getZoneMigrationLabel, isZoneMigrationReady } from "../../../src/utils/zoneLifecycle";
import styles from "./resources.styles";

type AssetFilter =
    | "all"
    | "pc"
    | "ps5"
    | "xbox";
type StatusFilter = "all" | ResourceLifecycleStatus;
type ResourcesViewMode = "grid" | "allocation";
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
    const params = useLocalSearchParams<{
        branchId?: string | string[];
        requestId?: string | string[];
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
    const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
    const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
    const [assetFilter, setAssetFilter] = useState<AssetFilter>("all");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [showFilters, setShowFilters] = useState(true);
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
    const migrationNotice = !migrationReady
        ? `This venue is not live on the resource model yet. Current state: ${getZoneMigrationLabel(zone)}. Legacy fallback remains visible until migration succeeds. Open Migration Tools if you need to repair the venue setup.`
        : null;
    const deepBranchId = Array.isArray(params.branchId) ? params.branchId[0] : params.branchId;
    const deepRequestId = Array.isArray(params.requestId) ? params.requestId[0] : params.requestId;
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
                    setErrorText("Branch/resource subcollections are blocked by Firestore rules. Using legacy fallback.");
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
                    setErrorText("Resource grid permission denied.");
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
        setSelectedRequestId((prev) => {
            if (prev && queue.some((item) => item.id === prev)) return prev;
            if (deepRequestId && queue.some((item) => item.id === deepRequestId)) {
                return deepRequestId;
            }
            return queue[0]?.id || null;
        });
    }, [deepRequestId, queue]);

    useEffect(() => {
        if (!deepResourceId) return;
        setSelectedResourceIds((prev) => (prev.includes(deepResourceId) ? prev : [...prev, deepResourceId]));
    }, [deepResourceId]);

    const filteredResources = useMemo(
        () =>
            resources.filter((item) => {
                const assetOk = assetFilter === "all" ? true : assetFilterForResource(item) === assetFilter;
                const statusOk = statusFilter === "all" ? true : item.lifecycleStatus === statusFilter;
                return assetOk && statusOk;
            }),
        [assetFilter, resources, statusFilter],
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
                    { key: "allocation", label: "Allocation", badge: queue.length },
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
            {migrationNotice ? (
                <View style={styles.noticeBox}>
                    <Text style={styles.noticeText}>{migrationNotice}</Text>
                </View>
            ) : null}

            <Pressable
                style={styles.filtersToggle}
                onPress={() => setShowFilters((prev) => !prev)}
            >
                <View style={styles.filtersToggleLeft}>
                    <AppIcon name="tune" size="sm" tone="accent" />
                    <Text style={styles.filtersToggleText}>Filters</Text>
                </View>
                <AppIcon
                    name={showFilters ? "expand-less" : "expand-more"}
                    size={18}
                    tone="muted"
                />
            </Pressable>

            {showFilters ? (
                <View style={styles.filterRow}>
                    <Text style={styles.fieldLabel}>Branch</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {branches.map((branch) => (
                            <Pressable
                                key={branch.id}
                                onPress={() => setSelectedBranchId(branch.id)}
                                style={[
                                    styles.branchChip,
                                    selectedBranchId === branch.id && styles.branchChipActive,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.branchChipText,
                                        selectedBranchId === branch.id && styles.branchChipTextActive,
                                    ]}
                                >
                                    {branch.branchDisplayName}
                                </Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>
            ) : null}

            {(loadingBranches || loadingResources) ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="small" color={COLORS.accent} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {viewMode === "grid" ? (
                        <>
                            <View style={styles.summaryGrid}>
                                <View style={styles.summaryCard}>
                                    <Text style={styles.summaryValue}>{statusSummary.available}</Text>
                                    <Text style={styles.summaryLabel}>Available</Text>
                                </View>
                                <View style={styles.summaryCard}>
                                    <Text style={styles.summaryValue}>{statusSummary.held}</Text>
                                    <Text style={styles.summaryLabel}>Held</Text>
                                </View>
                                <View style={styles.summaryCard}>
                                    <Text style={styles.summaryValue}>{statusSummary.booked}</Text>
                                    <Text style={styles.summaryLabel}>Booked</Text>
                                </View>
                                <View style={styles.summaryCard}>
                                    <Text style={styles.summaryValue}>{statusSummary.maintenance}</Text>
                                    <Text style={styles.summaryLabel}>Maintenance</Text>
                                </View>
                            </View>

                            {showFilters ? (
                                <>
                                    <Text style={styles.fieldLabel}>Resource category</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
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
                                    </ScrollView>

                                    <Text style={styles.fieldLabel}>Resource status</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
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
                                    </ScrollView>
                                    <View style={styles.selectionActionsRow}>
                                        <Pressable
                                            style={({ pressed }) => [
                                                styles.selectionAction,
                                                isSelectVisibleActive && styles.selectionActionActive,
                                                pressed && styles.selectionActionPressed,
                                            ]}
                                            onPress={() => setSelectedResourceIds(filteredResources.map((item) => item.id))}
                                        >
                                            <Text
                                                style={[
                                                    styles.selectionActionText,
                                                    isSelectVisibleActive && styles.selectionActionTextActive,
                                                ]}
                                            >
                                                Select visible
                                            </Text>
                                        </Pressable>
                                        <Pressable
                                            style={({ pressed }) => [
                                                styles.selectionAction,
                                                isClearSelectionActive && styles.selectionActionActive,
                                                pressed && styles.selectionActionPressed,
                                            ]}
                                            onPress={() => setSelectedResourceIds([])}
                                        >
                                            <Text
                                                style={[
                                                    styles.selectionActionText,
                                                    isClearSelectionActive && styles.selectionActionTextActive,
                                                ]}
                                            >
                                                Clear selection
                                            </Text>
                                        </Pressable>
                                    </View>
                                    <View style={styles.bulkStatusWrap}>
                                        <Text style={styles.fieldLabel}>Bulk status update</Text>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bulkStatusScroll}>
                                            <View style={styles.bulkStatusRow}>
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
                            ) : null}
                        </>
                    ) : (
                        <View style={styles.allocateCard}>
                            <Text style={styles.allocateTitle}>Allocation Panel</Text>
                            <Text style={styles.fieldLabel}>Booking request</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {queue.map((request) => (
                                    <Pressable
                                        key={request.id}
                                        onPress={() => setSelectedRequestId(request.id)}
                                        style={[
                                            styles.requestChip,
                                            selectedRequestId === request.id && styles.requestChipActive,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.requestChipText,
                                                selectedRequestId === request.id && styles.requestChipTextActive,
                                            ]}
                                        >
                                            {request.title}
                                        </Text>
                                    </Pressable>
                                ))}
                            </ScrollView>
                            <Text style={styles.allocateMeta}>
                                Selected request: {selectedRequest?.title || "None"}
                            </Text>
                            {hasExistingAllocation ? (
                                <Text style={styles.allocateMeta}>
                                    Current allocation: {selectedRequest?.allocatedResourceIds?.length || 0} resource(s) linked
                                </Text>
                            ) : null}
                            <Text style={styles.allocateMeta}>
                                Requested slots: {requestedCount || "-"}
                            </Text>
                            <Text style={styles.allocateMeta}>
                                Selected resources: {selectedResourceIds.length}
                            </Text>
                            {selectedRequest ? (
                                <Text style={[styles.allocateMeta, needsMoreResources ? styles.allocateMetaWarn : styles.allocateMetaGood]}>
                                    {needsMoreResources
                                        ? `Needs ${allocationGap} more resource(s)`
                                        : allocationGap < 0
                                            ? `${Math.abs(allocationGap)} extra resource(s) selected`
                                            : "Allocation count matched"}
                                </Text>
                            ) : null}
                            <View style={styles.selectionActionsRow}>
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.selectionAction,
                                        isSelectVisibleActive && styles.selectionActionActive,
                                        pressed && styles.selectionActionPressed,
                                    ]}
                                    onPress={() => setSelectedResourceIds(filteredResources.map((item) => item.id))}
                                >
                                    <Text
                                        style={[
                                            styles.selectionActionText,
                                            isSelectVisibleActive && styles.selectionActionTextActive,
                                        ]}
                                    >
                                        Select visible
                                    </Text>
                                </Pressable>
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.selectionAction,
                                        isClearSelectionActive && styles.selectionActionActive,
                                        pressed && styles.selectionActionPressed,
                                    ]}
                                    onPress={() => setSelectedResourceIds([])}
                                >
                                    <Text
                                        style={[
                                            styles.selectionActionText,
                                            isClearSelectionActive && styles.selectionActionTextActive,
                                        ]}
                                    >
                                        Clear selection
                                    </Text>
                                </Pressable>
                            </View>
                            <View style={styles.bulkStatusWrap}>
                                <Text style={styles.fieldLabel}>Bulk status update</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bulkStatusScroll}>
                                    <View style={styles.bulkStatusRow}>
                                    {STATUS_OPTIONS.map((status) => (
                                        <Pressable
                                            key={`alloc_bulk_${status}`}
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
                            <Pressable
                                style={[
                                    styles.allocateButton,
                                    (allocating || !selectedRequestId || selectedResourceIds.length === 0) && styles.allocateButtonDisabled,
                                ]}
                                onPress={handleAllocate}
                                disabled={allocating || !selectedRequestId || selectedResourceIds.length === 0}
                            >
                                {allocating ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <Text style={styles.allocateButtonText}>
                                        {hasExistingAllocation ? "Reassign Selected" : "Allocate Selected"}
                                    </Text>
                                )}
                            </Pressable>
                        </View>
                    )}

                    {filteredResources.length === 0 ? (
                        <Text style={styles.emptyText}>No resources found for current filters.</Text>
                    ) : (
                        <View style={styles.sectionStack}>
                            {resourceSections.map((section) => {
                                const sectionExpanded = expandedSectionIds.includes(section.id);
                                const sectionSelectedCount = section.resources.filter((resource) => selectedResourceIds.includes(resource.id)).length;
                                return (
                                    <View key={section.id} style={styles.accordionCard}>
                                        <Pressable
                                            style={styles.accordionHeader}
                                            onPress={() => toggleSectionExpanded(section.id)}
                                        >
                                            <View style={styles.accordionHeaderTextWrap}>
                                                <Text style={styles.accordionTitle}>{section.title}</Text>
                                                <Text style={styles.accordionMeta}>
                                                    {section.resources.length} resources • {sectionSelectedCount} selected
                                                </Text>
                                            </View>
                                            <AppIcon
                                                name={sectionExpanded ? "expand-less" : "expand-more"}
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
                                                                    </View>
                                                                    <View style={styles.roomHeaderActions}>
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
                                                                        <AppIcon
                                                                            name={roomExpanded ? "expand-less" : "expand-more"}
                                                                            size="md"
                                                                            tone="muted"
                                                                        />
                                                                    </View>
                                                                </Pressable>

                                                                {roomExpanded ? (
                                                                    <View style={styles.grid}>
                                                                        {room.resources.map((resource) => {
                                                                            const selected = selectedResourceIds.includes(resource.id);
                                                                            const busy = processingResourceId === resource.id || processingBulkStatus !== null;
                                                                            return (
                                                                                <Pressable
                                                                                    key={resource.id}
                                                                                    style={[styles.resourceCard, selected && styles.resourceCardSelected]}
                                                                                    onPress={() => toggleResourceSelected(resource.id)}
                                                                                >
                                                                                    <Text style={styles.resourceLabel} numberOfLines={1}>
                                                                                        {resource.label}
                                                                                    </Text>
                                                                                    <Text style={styles.resourceMeta}>
                                                                                        {resource.kind} | {resource.assetType}
                                                                                        {resource.tier ? ` | ${resource.tier}` : ""}
                                                                                        {resource.surface ? ` | ${resource.surface}` : ""}
                                                                                    </Text>
                                                                                    <Text style={styles.resourceMeta}>
                                                                                        Status: {getResourceLifecycleLabel(resource.lifecycleStatus)}
                                                                                    </Text>
                                                                                    {resource.holdRequestId ? (
                                                                                        <Text style={styles.resourceMeta} numberOfLines={1}>
                                                                                            Hold request: {resource.holdRequestId}
                                                                                        </Text>
                                                                                    ) : null}
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
                                                        const selected = selectedResourceIds.includes(resource.id);
                                                        const busy = processingResourceId === resource.id || processingBulkStatus !== null;
                                                        return (
                                                            <Pressable
                                                                key={resource.id}
                                                                style={[styles.resourceCard, selected && styles.resourceCardSelected]}
                                                                onPress={() => toggleResourceSelected(resource.id)}
                                                            >
                                                                <Text style={styles.resourceLabel} numberOfLines={1}>
                                                                    {resource.label}
                                                                </Text>
                                                                <Text style={styles.resourceMeta}>
                                                                    {resource.kind} | {resource.assetType}
                                                                    {resource.surface ? ` | ${resource.surface}` : ""}
                                                                </Text>
                                                                <Text style={styles.resourceMeta}>
                                                                    Status: {getResourceLifecycleLabel(resource.lifecycleStatus)}
                                                                </Text>
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

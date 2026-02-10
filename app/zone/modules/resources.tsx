import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

import AppHeader from "../../../src/components/AppHeader";
import SegmentedTabs from "../../../src/components/SegmentedTabs";
import Screen from "../../../src/components/Screen";
import { useAuth } from "../../../src/context/AuthContext";
import { useZoneData } from "../../../src/hooks/useZoneData";
import { type ResourceLifecycleStatus } from "../../../src/features/zoneAdmin/types";
import { subscribeZoneBookingQueue, type ZoneBookingQueueItem } from "../../../src/services/zoneAdminBookingService";
import {
    allocateResourcesToBookingRequest,
    subscribeBranchResources,
    subscribeZoneBranches,
    updateBranchResourceStatus,
    type ZoneBranch,
    type ZoneBranchResource,
} from "../../../src/services/zoneAdminResourceService";
import { COLORS } from "../../../src/theme";
import styles from "./resources.styles";

type KindFilter = "all" | "seat" | "court";
type StatusFilter = "all" | ResourceLifecycleStatus;
type ResourcesViewMode = "grid" | "allocation";

const STATUS_FILTERS: StatusFilter[] = ["all", "available", "held", "booked", "maintenance"];
const KIND_FILTERS: KindFilter[] = ["all", "seat", "court"];

const STATUS_OPTIONS: ResourceLifecycleStatus[] = ["available", "held", "booked", "maintenance"];
const KIND_LABELS: Record<KindFilter, string> = {
    all: "All",
    seat: "Seats",
    court: "Courts",
};
const STATUS_LABELS: Record<StatusFilter, string> = {
    all: "All",
    available: "Available",
    held: "Held",
    booked: "Booked",
    maintenance: "Maintenance",
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

    const [branches, setBranches] = useState<ZoneBranch[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
    const [resources, setResources] = useState<ZoneBranchResource[]>([]);
    const [queue, setQueue] = useState<ZoneBookingQueueItem[]>([]);
    const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
    const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
    const [kindFilter, setKindFilter] = useState<KindFilter>("all");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [showFilters, setShowFilters] = useState(true);
    const [viewMode, setViewMode] = useState<ResourcesViewMode>("grid");
    const [loadingBranches, setLoadingBranches] = useState(true);
    const [loadingResources, setLoadingResources] = useState(true);
    const [processingResourceId, setProcessingResourceId] = useState<string | null>(null);
    const [processingBulkStatus, setProcessingBulkStatus] = useState<ResourceLifecycleStatus | null>(null);
    const [allocating, setAllocating] = useState(false);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [subcollectionsBlocked, setSubcollectionsBlocked] = useState(false);
    const migrationNotice = !zone?.migration?.perBranchSeatModel
        ? "Branch migration is required for live seat-level resource grid. Showing legacy branch fallback."
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
        if (!zone?.migration?.perBranchSeatModel) {
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
    }, [deepBranchId, legacyBranches, subcollectionsBlocked, zone?.id, zone?.migration?.perBranchSeatModel]);

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
                const kindOk = kindFilter === "all" ? true : item.kind === kindFilter;
                const statusOk = statusFilter === "all" ? true : item.lifecycleStatus === statusFilter;
                return kindOk && statusOk;
            }),
        [kindFilter, resources, statusFilter],
    );

    const selectedRequest = useMemo(
        () => queue.find((item) => item.id === selectedRequestId) || null,
        [queue, selectedRequestId],
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

    const toggleResourceSelected = (resourceId: string) => {
        setSelectedResourceIds((prev) =>
            prev.includes(resourceId)
                ? prev.filter((item) => item !== resourceId)
                : [...prev, resourceId],
        );
    };

    const setResourceStatus = async (
        resourceId: string,
        status: ResourceLifecycleStatus,
    ) => {
        if (!zone?.id || !selectedBranchId || !user?.uid) return;
        setProcessingResourceId(resourceId);
        const result = await updateBranchResourceStatus({
            zoneId: zone.id,
            branchId: selectedBranchId,
            resourceId,
            status,
            adminUid: user.uid,
            holdRequestId: selectedRequestId || undefined,
        });
        setProcessingResourceId(null);
        if (!result.ok) {
            Alert.alert("Update failed", result.message);
        }
    };

    const applyBulkStatus = async (status: ResourceLifecycleStatus) => {
        if (!zone?.id || !selectedBranchId || !user?.uid) return;
        if (selectedResourceIds.length === 0) {
            Alert.alert("No selection", "Select resources first.");
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
                    adminUid: user.uid,
                    holdRequestId: selectedRequestId || undefined,
                }),
            ),
        );
        setProcessingBulkStatus(null);

        const failed = results.filter((result) => !result.ok).length;
        if (failed > 0) {
            Alert.alert("Partial update", `${selectedResourceIds.length - failed} updated, ${failed} failed.`);
            return;
        }
        Alert.alert("Updated", `${selectedResourceIds.length} resource(s) set to ${status}.`);
    };

    const handleAllocate = async () => {
        if (!zone?.id || !selectedBranchId || !user?.uid) return;
        if (!selectedRequestId || selectedResourceIds.length === 0) {
            Alert.alert("Missing selection", "Pick a booking request and resources.");
            return;
        }
        const invalidResources = selectedResources.filter(
            (item) => !["available", "held"].includes(item.lifecycleStatus),
        );
        if (invalidResources.length > 0) {
            Alert.alert(
                "Invalid selection",
                "Only available or held resources can be allocated. Update status first.",
            );
            return;
        }

        setAllocating(true);
        const result = await allocateResourcesToBookingRequest({
            zoneId: zone.id,
            branchId: selectedBranchId,
            requestId: selectedRequestId,
            resourceIds: selectedResourceIds,
            adminUid: user.uid,
        });
        setAllocating(false);

        if (!result.ok) {
            Alert.alert("Allocation failed", result.message);
            return;
        }
        setSelectedResourceIds([]);
        Alert.alert("Allocated", "Resources moved to booked and linked to request.");
    };

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
                                    <Text style={styles.fieldLabel}>Resource type</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                                        {KIND_FILTERS.map((filter) => (
                                            <Pressable
                                                key={filter}
                                                onPress={() => setKindFilter(filter)}
                                                style={[styles.filterChip, kindFilter === filter && styles.filterChipActive]}
                                            >
                                                <Text style={[styles.filterChipText, kindFilter === filter && styles.filterChipTextActive]}>
                                                    {KIND_LABELS[filter]}
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
                                    <Text style={styles.allocateButtonText}>Allocate Selected</Text>
                                )}
                            </Pressable>
                        </View>
                    )}

                    {filteredResources.length === 0 ? (
                        <Text style={styles.emptyText}>No resources found for current filters.</Text>
                    ) : (
                        <View style={styles.grid}>
                            {filteredResources.map((resource) => {
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
                                        </Text>
                                        <Text style={styles.resourceMeta}>
                                            Status: {resource.lifecycleStatus}
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
                                                        {STATUS_LABELS[status]}
                                                    </Text>
                                                </Pressable>
                                            ))}
                                        </View>
                                    </Pressable>
                                );
                            })}
                        </View>
                    )}
                </ScrollView>
            )}
        </Screen>
    );
}

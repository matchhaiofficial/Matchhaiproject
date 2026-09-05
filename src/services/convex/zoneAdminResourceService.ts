// src/services/convex/zoneAdminResourceService.ts
// Convex-based zone admin resource service

import { convex } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
    ResourceKind,
    ResourceLifecycleStatus,
} from "../../features/zoneAdmin/types";
import Logger from "../../utils/logger";
import { recordRateMetric } from "../../utils/perfInstrumentation";
import {
    createSharedPollingState,
    PollingSubscriptionCallback,
    publishPollingRows,
    releasePollingSubscription,
    replayPollingRows,
    SharedPollingState,
} from "./sharedPollingRegistry";

export interface ZoneBranch {
    id: string;
    branchDisplayName: string;
    city?: string;
    areaLabel?: string;
    addressLine1?: string;
    source?: "migrated" | "manual" | string;
}

export interface ZoneBranchResource {
    id: string;
    zoneId: string;
    branchId: string;
    kind: ResourceKind;
    lifecycleStatus: ResourceLifecycleStatus;
    label: string;
    roomLabel?: string | null;
    assetType: string;
    tier?: string | null;
    surface?: string | null;
    isActive: boolean;
    heldUntil?: any;
    holdRequestId?: string | null;
    bookingRequestId?: string | null;
    matchroomId?: string | null;
    bookedAt?: any;
    bookedByUid?: string | null;
    updatedAt?: any;
}

const branchPollingState = new Map<string, SharedPollingState<ZoneBranch>>();
const resourcePollingState = new Map<string, SharedPollingState<ZoneBranchResource>>();

const VALID_RESOURCE_STATUSES: ResourceLifecycleStatus[] = [
    "available",
    "held",
    "booked",
    "maintenance",
];

const normalizeBranch = (data: Record<string, any>): ZoneBranch => ({
    id: String(data.id || ""),
    branchDisplayName: data.branchDisplayName || "Branch",
    city: data.city || "",
    areaLabel: data.areaLabel || "",
    addressLine1: data.addressLine1 || "",
    source: data.source,
});

const normalizeResource = (data: Record<string, any>): ZoneBranchResource => ({
    id: String(data._id || data.id || ""),
    zoneId: String(data.zoneId || ""),
    branchId: data.branchId || "",
    kind: data.kind === "court" ? "court" : "seat",
    lifecycleStatus: VALID_RESOURCE_STATUSES.includes(data.lifecycleStatus)
        ? data.lifecycleStatus
        : "available",
    label: data.name || data.label || data.id || "",
    roomLabel: data.roomLabel || null,
    assetType: data.assetType || "unknown",
    tier: data.tier || null,
    surface: data.surface || null,
    isActive: data.isActive !== false,
    heldUntil: data.heldUntil,
    holdRequestId: data.holdRequestId || null,
    bookingRequestId: data.bookingRequestId ? String(data.bookingRequestId) : null,
    matchroomId: data.matchroomId ? String(data.matchroomId) : null,
    bookedAt: data.bookedAt,
    bookedByUid: data.bookedByUid || null,
    updatedAt: data.updatedAt,
});

/** Subscribe to zone branches through Convex's invalidation-driven watch. */
export function subscribeZoneBranches(
    zoneId: string,
    onData: (branches: ZoneBranch[]) => void,
    onError: (error: any) => void,
) {
    const callbackRef: PollingSubscriptionCallback<ZoneBranch> = { onData, onError };
    let state = branchPollingState.get(zoneId);

    if (!state) {
        state = createSharedPollingState();
        branchPollingState.set(zoneId, state);
    }

    state.callbacks.add(callbackRef);
    replayPollingRows(state, callbackRef);

    if (!state.unsubscribe) {
        try {
            const watch = convex.watchQuery(api.zoneAdminResources.getZoneBranches, {
                zoneId: zoneId as Id<"zones">,
            });
            const publishCurrent = () => {
                try {
                    const branches = watch.localQueryResult();
                    if (branches === undefined) return;

                    const normalized = (branches as any[])
                        .map(normalizeBranch)
                        .sort((a, b) => a.branchDisplayName.localeCompare(b.branchDisplayName));

                    recordRateMetric("zone_admin.branch_rows_received", normalized.length, { zoneId });

                    publishPollingRows(state!, normalized);
                } catch (error: any) {
                    Logger.error("zoneAdminResources", "Branch subscription update failed", error);
                    state!.callbacks.forEach((callback) => callback.onError(error));
                }
            };
            state.unsubscribe = watch.onUpdate(publishCurrent);
            publishCurrent();
        } catch (error: any) {
            Logger.error("zoneAdminResources", "Branch subscription setup failed", error);
            state.callbacks.forEach((callback) => callback.onError(error));
        }
    }

    return () => {
        releasePollingSubscription(branchPollingState, zoneId, callbackRef);
    };
}

/** Subscribe to branch resources through Convex's invalidation-driven watch. */
export function subscribeBranchResources(
    zoneId: string,
    branchId: string,
    onData: (resources: ZoneBranchResource[]) => void,
    onError: (error: any) => void,
) {
    const key = `${zoneId}:${branchId}`;
    const callbackRef: PollingSubscriptionCallback<ZoneBranchResource> = { onData, onError };
    let state = resourcePollingState.get(key);

    if (!state) {
        state = createSharedPollingState();
        resourcePollingState.set(key, state);
    }

    state.callbacks.add(callbackRef);
    replayPollingRows(state, callbackRef);

    if (!state.unsubscribe) {
        try {
            const watch = convex.watchQuery(api.zoneAdminResources.listResourcesByZoneAndBranch, {
                zoneId: zoneId as Id<"zones">,
                branchId,
            });
            const publishCurrent = () => {
                try {
                    const resources = watch.localQueryResult();
                    if (resources === undefined) return;

                    const normalized = (resources as any[])
                        .map(normalizeResource)
                        .sort((a, b) => a.label.localeCompare(b.label));

                    recordRateMetric("zone_admin.resource_rows_received", normalized.length, { zoneId, branchId });

                    publishPollingRows(state!, normalized);
                } catch (error: any) {
                    Logger.error("zoneAdminResources", "Resource subscription update failed", error);
                    state!.callbacks.forEach((callback) => callback.onError(error));
                }
            };
            state.unsubscribe = watch.onUpdate(publishCurrent);
            publishCurrent();
        } catch (error: any) {
            Logger.error("zoneAdminResources", "Resource subscription setup failed", error);
            state.callbacks.forEach((callback) => callback.onError(error));
        }
    }

    return () => {
        releasePollingSubscription(resourcePollingState, key, callbackRef);
    };
}

export async function updateBranchResourceStatus(input: {
    zoneId: string;
    branchId: string;
    resourceId: string;
    status: ResourceLifecycleStatus;
    adminUid: string;
    holdRequestId?: string | null;
    holdMinutes?: number;
}) {
    try {
        await convex.mutation(api.zoneAdminResources.updateResourceLifecycleStatus, {
            resourceId: input.resourceId as Id<"zoneResources">,
            lifecycleStatus: input.status,
            adminUid: input.adminUid,
            holdRequestId: input.holdRequestId || undefined,
            holdMinutes: input.holdMinutes,
        });

        return { ok: true as const };
    } catch (error: any) {
        Logger.error("zoneAdminResources", "Failed to update resource status", error);
        return { ok: false as const, message: error?.message || "Failed to update status." };
    }
}

export async function releaseStaleHeldBranchResources(input: {
    zoneId: string;
    branchId: string;
    currentRequestId?: string | null;
}) {
    try {
        const result = await convex.mutation((api as any).zoneAdminResources.releaseStaleHeldResourcesForBranch, {
            zoneId: input.zoneId as Id<"zones">,
            branchId: input.branchId,
            currentRequestId: input.currentRequestId
                ? input.currentRequestId as Id<"bookingRequests">
                : undefined,
        });
        return { ok: true as const, released: Number(result?.released || 0) };
    } catch (error: any) {
        Logger.warn("zoneAdminResources", "Failed to release stale held resources", error);
        return { ok: false as const, message: error?.message || "Failed to refresh resources." };
    }
}

export async function syncBranchResourcesFromPricing(input: {
    zoneId: string;
    branchId: string;
    pricing: Record<string, any>;
    adminUid: string;
}) {
    try {
        await convex.mutation(api.zoneAdminResources.syncBranchResourcesFromPricing, {
            zoneId: input.zoneId as Id<"zones">,
            branchId: input.branchId,
            pricing: input.pricing,
            adminUid: input.adminUid,
        });
        return { ok: true as const };
    } catch (error: any) {
        Logger.error("zoneAdminResources", "Failed to sync branch resources from pricing", error);
        return { ok: false as const, message: error?.message || "Failed to sync branch resources." };
    }
}

export async function allocateResourcesToBookingRequest(input: {
    zoneId: string;
    branchId: string;
    requestId: string;
    resourceIds: string[];
    adminUid: string;
}) {
    try {
        if (!input.resourceIds.length) {
            return { ok: false as const, message: "Select at least one resource." };
        }

        await convex.mutation(api.zoneAdminResources.allocateResourcesToRequest, {
            zoneId: input.zoneId as Id<"zones">,
            branchId: input.branchId,
            requestId: input.requestId as Id<"bookingRequests">,
            resourceIds: input.resourceIds as Id<"zoneResources">[],
            adminUid: input.adminUid,
        });

        return { ok: true as const };
    } catch (error: any) {
        Logger.error("zoneAdminResources", "Failed to allocate resources", error);
        return { ok: false as const, message: error?.message || "Allocation failed." };
    }
}

export async function reassignResourcesForBookingRequest(input: {
    zoneId: string;
    branchId: string;
    requestId: string;
    newResourceIds: string[];
    adminUid: string;
}) {
    try {
        if (!input.newResourceIds.length) {
            return { ok: false as const, message: "Select at least one resource." };
        }

        await convex.mutation(api.zoneAdminResources.reassignResourcesForRequest, {
            zoneId: input.zoneId as Id<"zones">,
            branchId: input.branchId,
            requestId: input.requestId as Id<"bookingRequests">,
            newResourceIds: input.newResourceIds as Id<"zoneResources">[],
            adminUid: input.adminUid,
        });

        return { ok: true as const };
    } catch (error: any) {
        Logger.error("zoneAdminResources", "Failed to reassign resources", error);
        return { ok: false as const, message: error?.message || "Reassignment failed." };
    }
}

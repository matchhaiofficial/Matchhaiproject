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
    updatedAt?: any;
}

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
    updatedAt: data.updatedAt,
});

/**
 * Subscribe to zone branches using polling.
 * For real-time reactivity, use useQuery(api.zoneAdminResources.getZoneBranches) in components.
 */
export function subscribeZoneBranches(
    zoneId: string,
    onData: (branches: ZoneBranch[]) => void,
    onError: (error: any) => void,
) {
    let active = true;

    const poll = async () => {
        try {
            const branches = await convex.query(api.zoneAdminResources.getZoneBranches, {
                zoneId: zoneId as Id<"zones">,
            });

            if (!active) return;

            const normalized = (branches as any[])
                .map(normalizeBranch)
                .sort((a, b) => a.branchDisplayName.localeCompare(b.branchDisplayName));

            onData(normalized);
        } catch (error: any) {
            if (!active) return;
            Logger.error("zoneAdminResources", "Branch poll failed", error);
            onError(error);
        }
    };

    poll();
    const interval = setInterval(poll, 5000);

    return () => {
        active = false;
        clearInterval(interval);
    };
}

/**
 * Subscribe to branch resources using polling.
 * For real-time reactivity, use useQuery(api.zoneAdminResources.listResourcesByZoneAndBranch) in components.
 */
export function subscribeBranchResources(
    zoneId: string,
    branchId: string,
    onData: (resources: ZoneBranchResource[]) => void,
    onError: (error: any) => void,
) {
    let active = true;

    const poll = async () => {
        try {
            const resources = await convex.query(api.zoneAdminResources.listResourcesByZoneAndBranch, {
                zoneId: zoneId as Id<"zones">,
                branchId,
            });

            if (!active) return;

            const normalized = (resources as any[])
                .map(normalizeResource)
                .sort((a, b) => a.label.localeCompare(b.label));

            onData(normalized);
        } catch (error: any) {
            if (!active) return;
            Logger.error("zoneAdminResources", "Resource poll failed", error);
            onError(error);
        }
    };

    poll();
    const interval = setInterval(poll, 5000);

    return () => {
        active = false;
        clearInterval(interval);
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

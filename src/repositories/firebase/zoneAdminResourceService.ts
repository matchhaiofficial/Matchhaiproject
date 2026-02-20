import {
    addDoc,
    collection,
    doc,
    getDoc,
    onSnapshot,
    query,
    serverTimestamp,
    updateDoc,
    writeBatch,
} from "firebase/firestore";

import { db } from "./firebase";
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

const normalizeBranch = (id: string, data: Record<string, any>): ZoneBranch => ({
    id,
    branchDisplayName: data.branchDisplayName || "Branch",
    city: data.city || "",
    areaLabel: data.areaLabel || "",
    addressLine1: data.addressLine1 || "",
    source: data.source,
});

const normalizeResource = (
    zoneId: string,
    branchId: string,
    id: string,
    data: Record<string, any>,
): ZoneBranchResource => ({
    id,
    zoneId,
    branchId,
    kind: data.kind === "court" ? "court" : "seat",
    lifecycleStatus: VALID_RESOURCE_STATUSES.includes(data.lifecycleStatus)
        ? data.lifecycleStatus
        : "available",
    label: data.label || id,
    roomLabel: data.roomLabel || null,
    assetType: data.assetType || "unknown",
    tier: data.tier || null,
    surface: data.surface || null,
    isActive: data.isActive !== false,
    heldUntil: data.heldUntil,
    holdRequestId: data.holdRequestId || null,
    updatedAt: data.updatedAt,
});

export function subscribeZoneBranches(
    zoneId: string,
    onData: (branches: ZoneBranch[]) => void,
    onError: (error: any) => void,
) {
    const q = query(collection(db, "zones", zoneId, "branches"));
    return onSnapshot(
        q,
        (snapshot: any) => {
            const rows = snapshot.docs
                .map((item: any) => normalizeBranch(item.id, item.data() as Record<string, any>))
                .sort((a: ZoneBranch, b: ZoneBranch) => a.branchDisplayName.localeCompare(b.branchDisplayName));
            onData(rows);
        },
        (error: any) => {
            if (error?.code !== "permission-denied") {
                Logger.error("zoneAdminResources", "Branch listener failed", error);
            }
            onError(error);
        },
    );
}

export function subscribeBranchResources(
    zoneId: string,
    branchId: string,
    onData: (resources: ZoneBranchResource[]) => void,
    onError: (error: any) => void,
) {
    const q = query(collection(db, "zones", zoneId, "branches", branchId, "resources"));
    return onSnapshot(
        q,
        (snapshot: any) => {
            const rows = snapshot.docs
                .map((item: any) =>
                    normalizeResource(
                        zoneId,
                        branchId,
                        item.id,
                        item.data() as Record<string, any>,
                    ),
                )
                .sort((a: ZoneBranchResource, b: ZoneBranchResource) => a.label.localeCompare(b.label));
            onData(rows);
        },
        (error: any) => {
            if (error?.code !== "permission-denied") {
                Logger.error("zoneAdminResources", "Resource listener failed", error);
            }
            onError(error);
        },
    );
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
        const holdMinutes = input.holdMinutes || 10;
        const heldUntil =
            input.status === "held"
                ? new Date(Date.now() + holdMinutes * 60 * 1000)
                : null;

        await updateDoc(
            doc(db, "zones", input.zoneId, "branches", input.branchId, "resources", input.resourceId),
            {
                lifecycleStatus: input.status,
                holdRequestId: input.status === "held" ? input.holdRequestId || null : null,
                heldUntil,
                statusChangedBy: input.adminUid,
                updatedAt: serverTimestamp(),
            },
        );
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

        const batch = writeBatch(db);
        const allocatedAt = serverTimestamp();

        input.resourceIds.forEach((resourceId) => {
            const resourceRef = doc(
                db,
                "zones",
                input.zoneId,
                "branches",
                input.branchId,
                "resources",
                resourceId,
            );

            batch.update(resourceRef, {
                lifecycleStatus: "booked",
                holdRequestId: null,
                heldUntil: null,
                allocation: {
                    requestId: input.requestId,
                    branchId: input.branchId,
                    zoneId: input.zoneId,
                    allocatedBy: input.adminUid,
                    allocatedAt,
                },
                updatedAt: serverTimestamp(),
            });
        });

        const requestRef = doc(db, "booking_requests", input.requestId);
        batch.update(requestRef, {
            status: "accepted",
            lifecycleStatus: "confirmed",
            allocationSnapshot: {
                zoneId: input.zoneId,
                branchId: input.branchId,
                resourceIds: input.resourceIds,
                resourceCount: input.resourceIds.length,
                allocatedBy: input.adminUid,
                allocatedAt,
            },
            updatedAt: serverTimestamp(),
        });

        await batch.commit();

        try {
            const requestSnap = await getDoc(doc(db, "booking_requests", input.requestId));
            const requestOwnerUid = requestSnap.exists() ? requestSnap.data()?.userId : null;
            if (requestOwnerUid) {
                await addDoc(collection(db, "notifications"), {
                    type: "booking_allocation_confirmed",
                    fromUid: input.adminUid,
                    toUid: requestOwnerUid,
                    status: "pending",
                    isRead: false,
                    createdAt: serverTimestamp(),
                    title: "Resources allocated",
                    message: `Your booking has been allocated ${input.resourceIds.length} resource(s).`,
                    meta: {
                        requestId: input.requestId,
                        zoneId: input.zoneId,
                        branchId: input.branchId,
                        resourceIds: input.resourceIds,
                    },
                });
            }
        } catch {
            // best effort
        }

        return { ok: true as const };
    } catch (error: any) {
        Logger.error("zoneAdminResources", "Failed to allocate resources", error);
        return { ok: false as const, message: error?.message || "Allocation failed." };
    }
}

import {
    collection,
    doc,
    getDoc,
    getDocs,
    serverTimestamp,
    writeBatch,
} from "firebase/firestore";

import { db } from "./firebase";
import Logger from "../../utils/logger";
import { ResourceKind, ResourceLifecycleStatus } from "../../features/zoneAdmin/types";

interface LegacyBranch {
    id?: string;
    branchDisplayName?: string;
    city?: string;
    areaLabel?: string;
    addressLine1?: string;
    googleMapsUrl?: string | null;
    contactPhone?: string | null;
    games?: Record<string, boolean>;
    pricing?: Record<string, any>;
    notes?: string | null;
    specs?: string | null;
}

export interface MigratedBranch extends LegacyBranch {
    id: string;
    zoneId: string;
    source: "migrated" | "manual";
    resourceModelVersion: number;
    migratedAt?: any;
}

export interface BranchResource {
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
    createdAt?: any;
    updatedAt?: any;
}

const MAX_BATCH_WRITES = 400;
const RESOURCE_MODEL_VERSION = 1;

const toPositiveInt = (value: unknown) => {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const sanitizeIdToken = (value: string) =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

const ensureId = (value?: string, fallback = "branch") => {
    const normalized = sanitizeIdToken(value || fallback);
    return normalized || fallback;
};

const buildSeatResources = (zoneId: string, branchId: string, branch: LegacyBranch): BranchResource[] => {
    const resources: BranchResource[] = [];
    const pricing = branch.pricing || {};
    const pcPricing = pricing.pc || {};
    const consolePricing = pricing.console || {};

    const pushSeats = (assetType: string, tier: string, count: number, roomLabel: string) => {
        for (let index = 1; index <= count; index += 1) {
            const id = `seat_${sanitizeIdToken(assetType)}_${sanitizeIdToken(tier)}_${String(index).padStart(3, "0")}`;
            resources.push({
                id,
                zoneId,
                branchId,
                kind: "seat",
                lifecycleStatus: "available",
                label: `${roomLabel} ${index}`,
                roomLabel,
                assetType,
                tier,
                isActive: true,
            });
        }
    };

    pushSeats("pc", "regular", toPositiveInt(pcPricing?.regular?.count), "PC Regular");
    pushSeats("pc", "premium", toPositiveInt(pcPricing?.premium?.count), "PC Premium");
    pushSeats("pc", "elite", toPositiveInt(pcPricing?.elite?.count), "PC Elite");

    pushSeats("console", "ps5", toPositiveInt(consolePricing?.ps5?.count), "PS5");
    pushSeats("console", "xbox", toPositiveInt(consolePricing?.xbox?.count), "Xbox");

    return resources;
};

const buildCourtResources = (zoneId: string, branchId: string, branch: LegacyBranch): BranchResource[] => {
    const resources: BranchResource[] = [];
    const pricing = branch.pricing || {};

    const pushCourts = (assetType: string, source: Record<string, any> | undefined) => {
        if (!source) return;
        Object.entries(source).forEach(([surfaceKey, surfaceValue]) => {
            const count = toPositiveInt((surfaceValue as any)?.count);
            for (let index = 1; index <= count; index += 1) {
                const id = `court_${sanitizeIdToken(assetType)}_${sanitizeIdToken(surfaceKey)}_${String(index).padStart(3, "0")}`;
                resources.push({
                    id,
                    zoneId,
                    branchId,
                    kind: "court",
                    lifecycleStatus: "available",
                    label: `${assetType.toUpperCase()} ${surfaceKey} ${index}`,
                    assetType,
                    surface: surfaceKey,
                    isActive: true,
                });
            }
        });
    };

    pushCourts("futsal", pricing.futsal);
    pushCourts("indoor_cricket", pricing.indoorCricket || pricing.indoor_cricket);
    pushCourts("padel", pricing.padel);
    pushCourts("pickleball", pricing.pickleball);

    return resources;
};

const commitInChunks = async (writes: Array<{ ref: any; data: Record<string, any> }>) => {
    for (let index = 0; index < writes.length; index += MAX_BATCH_WRITES) {
        const batch = writeBatch(db);
        const slice = writes.slice(index, index + MAX_BATCH_WRITES);

        slice.forEach((write) => {
            batch.set(write.ref, write.data, { merge: true });
        });

        await batch.commit();
    }
};

export async function getZoneBranchesFromSubcollection(zoneId: string): Promise<MigratedBranch[]> {
    const snapshot = await getDocs(collection(db, "zones", zoneId, "branches"));
    return snapshot.docs.map((branchDoc: any) => ({
        id: branchDoc.id,
        zoneId,
        ...(branchDoc.data() as any),
    })) as MigratedBranch[];
}

export async function migrateZoneBranchesToSubcollection(
    zoneId: string,
    ownerUid: string,
): Promise<{ ok: true; branchCount: number; resourceCount: number } | { ok: false; message: string }> {
    try {
        const zoneRef = doc(db, "zones", zoneId);
        const zoneSnap = await getDoc(zoneRef);

        if (!zoneSnap.exists()) {
            return { ok: false, message: "Zone not found." };
        }

        const zoneData = zoneSnap.data() as any;
        if (zoneData.ownerUid !== ownerUid) {
            return { ok: false, message: "Only the zone owner can run migration." };
        }

        const legacyBranches = Array.isArray(zoneData.branches) ? (zoneData.branches as LegacyBranch[]) : [];
        if (legacyBranches.length === 0) {
            return { ok: false, message: "No embedded branches found to migrate." };
        }

        const writes: Array<{ ref: any; data: Record<string, any> }> = [];
        let resourceCount = 0;

        legacyBranches.forEach((legacyBranch, branchIndex) => {
            const branchId = ensureId(
                legacyBranch.id || legacyBranch.branchDisplayName,
                `branch_${branchIndex + 1}`,
            );
            const nowData = {
                ...legacyBranch,
                zoneId,
                source: "migrated",
                resourceModelVersion: RESOURCE_MODEL_VERSION,
                migratedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            writes.push({
                ref: doc(db, "zones", zoneId, "branches", branchId),
                data: nowData,
            });

            const seatResources = buildSeatResources(zoneId, branchId, legacyBranch);
            const courtResources = buildCourtResources(zoneId, branchId, legacyBranch);
            const resources = [...seatResources, ...courtResources];

            resourceCount += resources.length;
            resources.forEach((resource) => {
                writes.push({
                    ref: doc(db, "zones", zoneId, "branches", branchId, "resources", resource.id),
                    data: {
                        ...resource,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    },
                });
            });
        });

        writes.push({
            ref: zoneRef,
            data: {
                migration: {
                    perBranchSeatModel: true,
                    resourceModelVersion: RESOURCE_MODEL_VERSION,
                    migratedAt: serverTimestamp(),
                    migratedBy: ownerUid,
                },
                updatedAt: serverTimestamp(),
            },
        });

        await commitInChunks(writes);

        Logger.info("zoneBranchMigration", "Branch migration completed", {
            zoneId,
            branchCount: legacyBranches.length,
            resourceCount,
        });

        return {
            ok: true,
            branchCount: legacyBranches.length,
            resourceCount,
        };
    } catch (error) {
        Logger.error("zoneBranchMigration", "Migration failed", error);
        return { ok: false, message: "Failed to migrate branch model." };
    }
}

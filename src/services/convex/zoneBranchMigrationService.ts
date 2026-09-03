// src/services/convex/zoneBranchMigrationService.ts
// Convex-based zone branch migration service

import { convex } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import Logger from "../../utils/logger";
import { ResourceKind, ResourceLifecycleStatus } from "../../features/zoneAdmin/types";
import { getUserFacingErrorMessage } from "../../utils/userFacingErrors";

export interface MigratedBranch {
    id: string;
    zoneId: string;
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

export async function getZoneBranchesFromSubcollection(zoneId: string): Promise<MigratedBranch[]> {
    try {
        const branches = await convex.query(api.zoneBranchMigration.getZoneBranches, {
            zoneId: zoneId as Id<"zones">,
        });

        return (branches as any[]).map((b) => ({
            id: b.id || "",
            zoneId: b.zoneId || zoneId,
            branchDisplayName: b.branchDisplayName,
            city: b.city,
            areaLabel: b.areaLabel,
            addressLine1: b.addressLine1,
            googleMapsUrl: b.googleMapsUrl,
            contactPhone: b.contactPhone,
            games: b.games,
            pricing: b.pricing,
            notes: b.notes,
            specs: b.specs,
            source: b.source || "manual",
            resourceModelVersion: b.resourceModelVersion || 0,
            migratedAt: b.migratedAt,
        }));
    } catch (error: any) {
        Logger.error("zoneBranchMigration", "Failed to get branches", error);
        return [];
    }
}

export async function migrateZoneBranchesToSubcollection(
    zoneId: string,
    ownerUid: string,
): Promise<{ ok: true; branchCount: number; resourceCount: number } | { ok: false; message: string }> {
    try {
        const result = await convex.mutation(api.zoneBranchMigration.migrateZoneBranches, {
            zoneId: zoneId as Id<"zones">,
            ownerUid,
        });

        Logger.info("zoneBranchMigration", "Branch migration completed", {
            zoneId,
            branchCount: result.branchCount,
            resourceCount: result.resourceCount,
        });

        return {
            ok: true,
            branchCount: result.branchCount,
            resourceCount: result.resourceCount,
        };
    } catch (error: any) {
        Logger.error("zoneBranchMigration", "Migration failed", error);
        return { ok: false, message: getUserFacingErrorMessage(error, "Failed to migrate branch model.") };
    }
}

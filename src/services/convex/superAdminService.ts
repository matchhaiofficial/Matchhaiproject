// src/services/convex/superAdminService.ts
// Convex-based super admin service that wraps Convex queries/mutations
// Maintains the same interface as the Firebase super admin service

import { convex } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Zone } from "./zoneService";
import Logger from "../../utils/logger";

/**
 * Fetch all zones that are pending review.
 */
export async function getPendingZones(): Promise<{ ok: true; data: Zone[] } | { ok: false; message: string }> {
    try {
        const zones = await convex.query(api.zones.listPendingReview, {});

        // Map Convex docs to Zone interface, sort by createdAt descending
        const mapped = zones.map((doc: any) => ({
            id: doc._id,
            ...doc,
        })) as Zone[];

        mapped.sort((a: any, b: any) => {
            const aTime = a.createdAt || 0;
            const bTime = b.createdAt || 0;
            return bTime - aTime;
        });

        Logger.info("superAdminService", "Fetched pending zones", { count: mapped.length });
        return { ok: true, data: mapped };
    } catch (error) {
        Logger.error("superAdminService", "Error fetching pending zones", error);
        return { ok: false, message: "Failed to fetch pending zones" };
    }
}

/**
 * Approve a zone registration.
 */
export async function approveZone(zoneId: string): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
        await convex.mutation(api.zones.approve, {
            zoneId: zoneId as Id<"zones">,
        });

        Logger.info("superAdminService", "Approved zone", { zoneId });
        return { ok: true };
    } catch (error) {
        Logger.error("superAdminService", "Error approving zone", error);
        return { ok: false, message: "Failed to approve zone" };
    }
}

/**
 * Reject a zone registration.
 */
export async function rejectZone(
    zoneId: string,
    reason: string
): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
        await convex.mutation(api.zones.reject, {
            zoneId: zoneId as Id<"zones">,
            rejectionReason: reason,
        });

        Logger.info("superAdminService", "Rejected zone", { zoneId, reason });
        return { ok: true };
    } catch (error) {
        Logger.error("superAdminService", "Error rejecting zone", error);
        return { ok: false, message: "Failed to reject zone" };
    }
}

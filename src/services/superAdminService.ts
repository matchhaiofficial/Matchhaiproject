// src/services/superAdminService.ts
import {
    collection,
    doc,
    getDocs,
    query,
    serverTimestamp,
    updateDoc,
    where,
    orderBy
} from "firebase/firestore";
import { db } from "../config/firebaseConfig";
import { Zone } from "./zoneService";
import Logger from "../utils/logger";

/**
 * Fetch all zones that are pending review.
 */
export async function getPendingZones(): Promise<{ ok: true; data: Zone[] } | { ok: false; message: string }> {
    try {
        const q = query(
            collection(db, "zones"),
            where("status", "==", "pending-review")
        );

        const snapshot = await getDocs(q);
        const zones = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as Zone[];

        // Sort in memory by createdAt descending
        zones.sort((a, b) => {
            const aTime = a.createdAt?.seconds || 0;
            const bTime = b.createdAt?.seconds || 0;
            return bTime - aTime;
        });

        Logger.info("superAdminService", "Fetched pending zones", { count: zones.length });
        return { ok: true, data: zones };
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
        const zoneRef = doc(db, "zones", zoneId);
        await updateDoc(zoneRef, {
            status: "active",
            approvedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
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
        const zoneRef = doc(db, "zones", zoneId);
        await updateDoc(zoneRef, {
            status: "rejected",
            rejectionReason: reason,
            rejectedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        Logger.info("superAdminService", "Rejected zone", { zoneId, reason });
        return { ok: true };
    } catch (error) {
        Logger.error("superAdminService", "Error rejecting zone", error);
        return { ok: false, message: "Failed to reject zone" };
    }
}

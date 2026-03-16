// src/services/convex/reportService.ts
// Convex-based report service that wraps Convex queries/mutations
// Maintains the same interface as the Firebase report service

import { convex } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { currentUser } from "./authService";
import Logger from "../../utils/logger";

export interface ComplainData {
    matchroomId: string;
    game: string;
    title: string;
    reason: string;
    description: string;
    reporterUid: string;
    reporterUsername: string;
}

/**
 * Submit a complaint for a matchroom.
 * Saves report metadata to the 'reports' collection for admin review.
 */
export const submitMatchroomComplain = async (data: ComplainData): Promise<{ ok: boolean; message?: string }> => {
    try {
        const user = await currentUser();
        if (!user) throw new Error("Not authenticated");

        await convex.mutation(api.reports.create, {
            reporterUid: data.reporterUid as Id<"users">,
            type: "matchroom_complaint",
            matchroomId: data.matchroomId as Id<"matchrooms">,
            game: data.game,
            reason: data.reason,
            description: data.description,
        });

        return { ok: true, message: "Complaint submitted successfully. Our safety team will review it." };
    } catch (error: any) {
        Logger.error("reportService", "submitMatchroomComplain failed", error);
        return { ok: false, message: error?.message || "Failed to submit complaint." };
    }
};

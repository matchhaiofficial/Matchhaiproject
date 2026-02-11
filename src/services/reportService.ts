import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../config/firebaseConfig";
import Logger from "../utils/logger";

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
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Not authenticated");

        await addDoc(collection(db, "reports"), {
            ...data,
            type: "matchroom_complain",
            status: "pending",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        return { ok: true, message: "Complaint submitted successfully. Our safety team will review it." };
    } catch (error: any) {
        Logger.error("reportService", "submitMatchroomComplain failed", error);
        return { ok: false, message: error?.message || "Failed to submit complaint." };
    }
};

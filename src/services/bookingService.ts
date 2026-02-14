import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    runTransaction,
    serverTimestamp,
    setDoc,
    updateDoc,
    where
} from "firebase/firestore";
import { auth, db } from "../config/firebaseConfig";
import Logger from "../utils/logger";
import { Matchroom } from "./matchService";
import { isRoomExpired, isRoomLocked } from "../utils/matchroomLifecycle";

export interface BookingIntent {
    id?: string;
    matchroomId: string;
    game: string;
    createdByUid: string; // the payer / initiator
    side: 'A' | 'B';
    selectedSlots: string[]; // slotIds
    invitees: Array<{
        uid: string;
        username: string;
        roleForGame: string;
        skillScore?: number;
    }>;
    pricing: {
        perPlayer: number;
        currency: string;
        total: number;
    };
    approvals: {
        captain: {
            required: boolean;
            status: 'pending' | 'approved' | 'rejected';
            decidedBy?: string;
            decidedAt?: any;
        };
        zone: {
            required: boolean;
            status: 'pending' | 'approved' | 'rejected';
            decidedBy?: string;
            decidedAt?: any;
        };
    };
    status: 'draft' | 'pending_approvals' | 'approved_pending_payment' | 'confirmed' | 'expired' | 'rejected' | 'cancelled';
    paymentStatus: 'unpaid' | 'paid';
    expiresAt: any;
    createdAt: any;
    updatedAt: any;
}

export const FAIR_BAND_DELTA_BY_GAME: Record<string, number> = {
    cs2: 10,
    futsal: 10,
    indoor_cricket: 10,
    fc26: 12,
    tekken8: 12,
    padel: 12,
    pickleball: 12,
};

function getExpiresAtMillis(val: any): number {
    if (!val) return 0;
    if (typeof val.toMillis === 'function') return val.toMillis();
    if (typeof val.seconds === 'number') return val.seconds * 1000;
    if (val instanceof Date) return val.getTime();
    if (typeof val === 'number') return val;
    return 0;
}

/**
 * Calculates if a skill score is within the fairness band of a matchroom.
 */
export function isWithinFairnessBand(
    inviteeSkill: number,
    roomAvgSkill: number,
    game: string
): boolean {
    const delta = FAIR_BAND_DELTA_BY_GAME[game] || 10;
    return Math.abs(inviteeSkill - roomAvgSkill) <= delta;
}

/**
 * Helper to hash slot IDs deterministically for intentId deduplication.
 */
export function getSlotIdHash(slotIds: string[]): string {
    if (!slotIds || !Array.isArray(slotIds)) return 'empty';
    return [...slotIds].sort().join('_');
}

/**
 * Generates a deterministic intent ID to avoid duplicates.
 */
export function generateIntentId(matchroomId: string, side: 'A' | 'B', createdByUid: string, slotIds: string[]): string {
    const hash = getSlotIdHash(slotIds);
    return `intent_${matchroomId}_${side}_${createdByUid}_${hash}`;
}

/**
 * Identifies the deterministic Host/Captain UID for approval fallback.
 */
export function getHostCaptainUid(room: Matchroom): string {
    if (room.captainUidA && !room.captainUidB) return room.captainUidA;
    if (room.captainUidB && !room.captainUidA) return room.captainUidB;
    return room.hostUid;
}

/**
 * Creates a new booking intent with initial approval states.
 */
export async function createBookingIntent(
    room: Matchroom,
    side: 'A' | 'B',
    invitees: BookingIntent['invitees'],
    roomAvgSkill: number
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
    try {
        const user = auth.currentUser;
        if (!user) return { ok: false, message: "Not authenticated" };

        const slotIds = invitees.map((_, i) => `${side}_slot_${Date.now()}_${i}`); // Temp IDs or specified? 
        // User spec says: slotIds: string[] (the exact slots being booked)
        // This implies they are selected from the UI.
        // For now, let's assume slotIds are passed in.

        // Wait, the caller should provide slotIds from the Matchroom's slotsA/slotsB.
        return { ok: false, message: "Use createBookingIntentWithSlots instead" };
    } catch (e) {
        return { ok: false, message: "Internal error" };
    }
}

export async function createBookingIntentDetailed({
    matchroom,
    side,
    selectedSlots,
    invitees,
    roomAvgSkill
}: {
    matchroom: Matchroom,
    side: 'A' | 'B',
    selectedSlots: string[],
    invitees: BookingIntent['invitees'],
    roomAvgSkill?: number
}): Promise<{ ok: true; data: string } | { ok: false; message: string }> {
    try {
        const user = auth.currentUser;
        if (!user) return { ok: false, message: "Not authenticated" };

        const room = matchroom; // Alias for convenience
        const slotIds = selectedSlots || [];
        const invs = invitees || [];

        Logger.info("bookingService", "Creating intent", {
            matchroomId: room?.id,
            side,
            uid: user.uid,
            slotCount: slotIds.length,
            inviteeCount: invs.length
        });

        // Guard: Check if room is expired
        if (isRoomExpired(room)) {
            return { ok: false, message: "This matchroom has expired (valid for 48 hours)" };
        }

        // Guard: Check if room is locked or full
        if (isRoomLocked(room)) {
            return { ok: false, message: "Matchroom is full and locked" };
        }


        const intentId = generateIntentId(room?.id || 'unknown', side, user.uid, slotIds);

        // Check for existing unexpired intent
        const existingRef = doc(db, "booking_intents", intentId);
        const existingSnap = await getDoc(existingRef);
        if (existingSnap.exists()) {
            const data = existingSnap.data() as BookingIntent;
            if (data.status !== 'expired' && data.status !== 'rejected') {
                return { ok: true, data: intentId }; // Reuse
            }
        }

        // Logic check: Fairness
        // Fairness Logic: Compare against Matchroom Live Average (fallback to Host Skill)
        const hostSkill = room?.hostSkillScore || 50;
        const effectiveRoomAvg = room?.avgSkillScoreLive ?? hostSkill;

        let captainApprovalRequired = false;
        if (room) {
            for (const invitee of invs) {
                // Rule: Unknown invitee skill defaults to 50 AND requires approval.
                if (invitee.skillScore === undefined || invitee.skillScore === null) {
                    captainApprovalRequired = true;
                    Logger.info("bookingService", "Approval required: Unknown skill score", { uid: invitee.uid });
                    continue; // Already flagged, check next
                }

                const skill = invitee.skillScore;

                // Rule: Compare inviteeSkill vs matchroomAvg
                if (!isWithinFairnessBand(skill, effectiveRoomAvg, room.game)) {
                    captainApprovalRequired = true;
                    Logger.info("bookingService", "Approval required: Out of fairness band", { skill, avg: effectiveRoomAvg, game: room.game });
                }
            }
        }

        // Booker-as-Approver rule
        const targetCaptainUid = side === 'A' ? room.captainUidA : room.captainUidB;
        const approverUid = targetCaptainUid || getHostCaptainUid(room);

        const captainApproved = !captainApprovalRequired || (approverUid === user.uid);
        const zoneApproved = room.locationMode === 'broadcast' || room.isPrivate === true; // Simplified rule

        // User spec: "if they lies in skilltier avg then directly ask them to pay"
        // This implies if !captainApprovalRequired, they go straight to payment.
        const canSkipApproval = !captainApprovalRequired || (approverUid === user.uid);

        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour for approval and payment

        const intentData: Omit<BookingIntent, 'id'> = {
            matchroomId: room?.id || 'unknown',
            game: room?.game || 'unknown',
            createdByUid: user.uid,
            side,
            selectedSlots: slotIds,
            invitees: invs,
            pricing: {
                perPlayer: room?.pricing?.perPlayer || 0,
                currency: room?.pricing?.currency || '₨',
                total: (room?.pricing?.perPlayer || 0) * invs.length
            },
            approvals: {
                captain: {
                    required: captainApprovalRequired,
                    status: captainApproved ? 'approved' : 'pending',
                    ...(captainApproved && approverUid === user.uid ? { decidedBy: user.uid, decidedAt: new Date() } : {})
                },
                zone: {
                    required: !zoneApproved,
                    status: zoneApproved ? 'approved' : 'pending'
                }
            },
            paymentStatus: 'unpaid',
            status: (canSkipApproval && zoneApproved) ? 'approved_pending_payment' : 'pending_approvals',
            expiresAt,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        // Create/Update intent
        await setDoc(doc(db, "booking_intents", intentId), intentData);

        // --- Notifications ---
        const notificationBatch: any[] = [];

        // 1. Notify Captain if approval needed
        if (!captainApproved && approverUid) {
            notificationBatch.push({
                type: 'match_booking_captain_approval',
                toUid: approverUid,
                fromUid: user.uid,
                fromUsername: user.displayName || 'Player',
                status: 'pending',
                isRead: false,
                createdAt: new Date(),
                expiresAt,
                meta: {
                    matchroomId: room.id,
                    intentId,
                    game: room.game,
                    side: side,
                    totalPlayers: invitees.length
                }
            });
        }

        // 2. Notify Zone Admin if approval needed (Simplified for MVP)
        if (!zoneApproved && room.zoneId) {
            // Placeholder: currently zoneApproval follows simplified rule 
        }

        for (const n of notificationBatch) {
            await addDoc(collection(db, "notifications"), n);
        }

        Logger.info("bookingService", "Created/Updated booking intent with notifications", { intentId });
        return { ok: true, data: intentId };
    } catch (error) {
        Logger.error("bookingService", "Error creating booking intent", error);
        return { ok: false, message: "Failed to create booking intent" };
    }
}

/**
 * Atomic transaction to reserve slots after mock payment.
 */
export async function confirmBookingTransaction(
    intentId: string,
    userUid: string,
    paymentMethod: 'wallet' | 'card' = 'wallet',
): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
        const intentRef = doc(db, "booking_intents", intentId);

        const res = await runTransaction(db, async (transaction) => {
            const intentSnap = await transaction.get(intentRef);
            if (!intentSnap.exists()) throw "Intent not found";

            const intent = intentSnap.data() as BookingIntent;
            if (intent.status === 'expired' || intent.status === 'rejected') throw "Intent invalid/expired";
            if (intent.createdByUid !== userUid) throw "Only the booking creator can complete payment.";
            if (paymentMethod !== 'wallet') throw "Card payments are coming soon. Please pay via wallet.";

            const expiresAtMillis = getExpiresAtMillis(intent.expiresAt);
            if (expiresAtMillis < Date.now()) {
                transaction.update(intentRef, { status: 'expired' });
                throw "Intent has expired";
            }

            const roomRef = doc(db, "matchrooms", intent.matchroomId);
            const roomSnap = await transaction.get(roomRef);
            if (!roomSnap.exists()) throw "Matchroom not found";

            const room = roomSnap.data() as Matchroom;
            const slots = (intent.side === 'A' ? room.slotsA : room.slotsB) || [];
            const totalAmount = Number(intent.pricing?.total || 0);
            if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
                throw "Invalid payment amount.";
            }

            // If slots are missing, we can't book specific slot IDs that don't exist
            if (slots.length === 0) {
                throw "This matchroom does not support slot-based booking. Please contact support.";
            }

            // Re-check slot availability
            for (const slotId of intent.selectedSlots) {
                const slot = slots.find(s => s.slotId === slotId);
                if (!slot) throw `Slot ${slotId} not found in room`;
                if (slot.status !== 'open' || slot.uid || slot.reservedForUid) {
                    throw "One or more slots are already taken. Please re-select.";
                }
            }

            // Update slots to reserved
            const updatedSlots = slots.map(slot => {
                if (intent.selectedSlots.includes(slot.slotId)) {
                    const index = intent.selectedSlots.indexOf(slot.slotId);
                    const invitee = intent.invitees[index];
                    return {
                        ...slot,
                        status: 'reserved' as const,
                        reservedForUid: invitee.uid
                    };
                }
                return slot;
            });

            // Prepare matchroom updates
            const roomUpdates: any = {
                [intent.side === 'A' ? 'slotsA' : 'slotsB']: updatedSlots,
                updatedAt: serverTimestamp()
            };

            // Wallet payment (atomic): debit user wallet inside same transaction.
            const userRef = doc(db, "users", userUid);
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists()) throw "Wallet account not found.";
            const walletBalance = Number(userSnap.data()?.walletBalance || 0);
            if (!Number.isFinite(walletBalance) || walletBalance < totalAmount) {
                throw "Insufficient wallet balance. Please add funds and try again.";
            }
            const nextBalance = walletBalance - totalAmount;
            transaction.set(userRef, {
                walletBalance: nextBalance,
                updatedAt: serverTimestamp(),
            }, { merge: true });

            const walletTxRef = doc(collection(db, "users", userUid, "wallet_transactions"));
            transaction.set(walletTxRef, {
                uid: userUid,
                type: "debit",
                amount: totalAmount,
                status: "completed",
                source: "matchroom_booking",
                intentId,
                matchroomId: intent.matchroomId,
                createdAt: serverTimestamp(),
            });

            transaction.update(roomRef, roomUpdates);
            transaction.update(intentRef, {
                status: 'confirmed',
                paymentStatus: 'paid',
                paymentMethod: 'wallet',
                updatedAt: serverTimestamp()
            });

            return { ok: true, intent };
        });

        if (res.ok && res.intent) {
            const intent = res.intent;
            for (const invitee of intent.invitees) {
                if (invitee.uid === userUid) continue; // Skip sender

                await addDoc(collection(db, "notifications"), {
                    type: 'match_seat_invitation',
                    toUid: invitee.uid,
                    fromUid: userUid,
                    fromUsername: auth.currentUser?.displayName || 'Teammate',
                    status: 'pending',
                    isRead: false,
                    createdAt: new Date(),
                    expiresAt: intent.expiresAt,
                    meta: {
                        matchroomId: intent.matchroomId,
                        intentId: intentId,
                        game: intent.game,
                        side: intent.side,
                        role: invitee.roleForGame
                    }
                });
            }
            return { ok: true };
        }
        return { ok: false, message: "Confirmation failed" };
    } catch (error: any) {
        Logger.error("bookingService", "Confirm booking transaction failed", error);
        return { ok: false, message: typeof error === 'string' ? error : "Transaction failed" };
    }
}

/**
 * Atomic transaction for an invitee to claim their reserved seat.
 */
export async function claimSeatTransaction(
    matchroomId: string,
    intentId: string,
    slotId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
        const user = auth.currentUser;
        if (!user) return { ok: false, message: "Not authenticated" };

        const intentRef = doc(db, "booking_intents", intentId);
        const roomRef = doc(db, "matchrooms", matchroomId);

        return await runTransaction(db, async (transaction) => {
            const intentSnap = await transaction.get(intentRef);
            if (!intentSnap.exists()) throw "Intent not found";

            const intent = intentSnap.data() as BookingIntent;
            if (intent.status !== 'confirmed') throw "Booking not confirmed yet";
            if (getExpiresAtMillis(intent.expiresAt) < Date.now()) throw "Booking link expired";

            const roomSnap = await transaction.get(roomRef);
            if (!roomSnap.exists()) throw "Matchroom not found";

            const room = roomSnap.data() as Matchroom;
            const slots = intent.side === 'A' ? room.slotsA : room.slotsB;
            const slot = slots.find(s => s.slotId === slotId);

            if (!slot) throw "Slot not found";
            if (slot.status !== 'reserved' || slot.reservedForUid !== user.uid) {
                throw "This seat is not reserved for you";
            }

            // Update slot to confirmed
            const updatedSlots = slots.map(s => {
                if (s.slotId === slotId) {
                    return {
                        ...s,
                        status: 'confirmed' as const,
                        uid: user.uid,
                        reservedForUid: undefined // remove reservation
                    };
                }
                return s;
            });

            // Update player list in room for backward compat / easy lookup
            const userInPlayers = room.players.some(p => p.uid === user.uid);
            let updatedPlayers = room.players;
            let updatedUids = room.playerUids || [];

            if (!userInPlayers) {
                // Find role from intent
                const inviteeData = intent.invitees.find(i => i.uid === user.uid);
                updatedPlayers = [...room.players, {
                    uid: user.uid,
                    username: user.displayName || "Unknown",
                    joinedAt: new Date(),
                    role: inviteeData?.roleForGame
                }];
                updatedUids = [...updatedUids, user.uid];
            }

            transaction.update(roomRef, {
                [intent.side === 'A' ? 'slotsA' : 'slotsB']: updatedSlots,
                players: updatedPlayers,
                playerUids: updatedUids,
                currentPlayers: updatedPlayers.length,
                updatedAt: serverTimestamp()
            });

            // Live Fairness Calc: Update avg if user has skill
            // We need to fetch the invitee's skill from the intent to invoke this
            const inviteeData = intent.invitees.find(i => i.uid === user.uid);
            const userSkill = inviteeData?.skillScore;

            if (userSkill !== undefined && userSkill !== null) {
                // Initialize if missing (Host is the first rated player)
                const currentSum = room.totalSkillSum ?? (room.hostSkillScore || 50);
                const currentCount = room.ratedPlayerCount ?? 1; // Host count

                const newSum = currentSum + userSkill;
                const newCount = currentCount + 1;
                const newAvg = newSum / newCount;

                transaction.update(roomRef, {
                    totalSkillSum: newSum,
                    ratedPlayerCount: newCount,
                    avgSkillScoreLive: newAvg
                });
            }

            return { ok: true };
        });
    } catch (error: any) {
        Logger.error("bookingService", "Claim seat transaction failed", error);
        return { ok: false, message: typeof error === 'string' ? error : "Claim failed" };
    }
}

/**
 * Best-effort client-side cleanup for expired intents.
 */
export async function cleanupExpiredIntents(matchroomId: string) {
    try {
        const q = query(
            collection(db, "booking_intents"),
            where("matchroomId", "==", matchroomId),
            where("status", "in", ["draft", "pending_approvals", "approved_pending_payment"])
        );

        const snaps = await getDocs(q);
        const now = Date.now();

        for (const d of snaps.docs) {
            const data = d.data() as BookingIntent;
            if (getExpiresAtMillis(data.expiresAt) < now) {
                await updateDoc(d.ref, { status: "expired", updatedAt: serverTimestamp() });
            }
        }
    } catch (e) {
        Logger.error("bookingService", "Cleanup expired intents failed", e);
    }
}

/**
 * Fetches a single booking intent by ID.
 */
export async function getBookingIntent(intentId: string): Promise<{ ok: true; data: BookingIntent } | { ok: false; message: string }> {
    try {
        const docRef = doc(db, "booking_intents", intentId);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
            return { ok: true, data: { id: snap.id, ...snap.data() } as BookingIntent };
        }
        return { ok: false, message: "Intent not found" };
    } catch (error) {
        Logger.error("bookingService", "Error fetching booking intent", error);
        return { ok: false, message: "Failed to fetch booking intent" };
    }
}

/**
 * Updates the status of a booking intent.
 */
export async function updateBookingIntentStatus(intentId: string, status: BookingIntent['status']): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
        const docRef = doc(db, "booking_intents", intentId);
        await updateDoc(docRef, {
            status,
            updatedAt: serverTimestamp()
        });
        return { ok: true };
    } catch (error) {
        Logger.error("bookingService", "Error updating booking intent status", error);
        return { ok: false, message: "Failed to update status" };
    }
}

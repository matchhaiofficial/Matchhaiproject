import {
    addDoc,
    arrayRemove,
    arrayUnion,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    writeBatch
} from "firebase/firestore";
import { auth, db } from "../config/firebaseConfig";
import Logger from "../utils/logger";
import { ONE_DAY_MS } from "../utils/matchroomLifecycle";
import { isRoomExpired, isRoomLocked } from "../utils/matchroomLifecycle";
import { doWindowsOverlap, formatTimeRange, getMatchroomWindow } from "../utils/matchroomTime";

export interface Slot {
    slotId: string;
    uid?: string; // occupied by
    user?: {
        uid: string;
        username: string;
        photoURL?: string;
        skillTier?: 'Beginner' | 'Intermediate' | 'Advanced' | 'Pro' | 'Elite';
    }; // snapshot of occupant
    status: 'open' | 'reserved' | 'confirmed';
    reservedFor?: {
        uid: string;
        username: string;
        photoURL?: string;
    }; // reserved during booking intent confirmed stage
    reservedForUid?: string; // KEEP for backward compatibility queries
    role?: string; // The specific role of this slot (if applicable)
}

export interface Matchroom {
    id?: string;
    hostUid: string;
    hostName: string;
    game: string;
    title: string;
    description: string;
    status: 'open' | 'in-progress' | 'completed' | 'locked' | 'expired';
    maxPlayers: number;
    currentPlayers: number;
    players: Array<{
        uid: string;
        username: string;
        joinedAt: any;
        role?: string; // Role the player filled
        skillTier?: 'Beginner' | 'Intermediate' | 'Advanced' | 'Pro' | 'Elite';
    }>;
    playerUids?: string[]; // For efficient querying
    createdAt: any;
    completedAt?: any; // When status became 'completed'

    // Location fields
    location?: string;
    coordinates?: {
        latitude: number;
        longitude: number;
    };
    locationMode?: 'zone' | 'broadcast'; // Phase 1: zone only, Phase 3: broadcast
    broadcastAreas?: string[]; // Phase 3
    zoneId?: string; // If linked to a specific venue
    zoneOwnerUid?: string;

    // Timing & Pricing
    startTime?: any;
    scheduledDate?: string;
    scheduledTime?: string;
    durationMinutes?: number; // Explicit duration
    pricing: {
        perPlayer: number;
        currency: string;
    };
    matchCode?: string;
    flexibility?: string; // "Exact time" | "Within 2hrs" etc (Phase 3)
    bookingSource?: string;
    skipBookingRequest?: boolean;

    // Game-Specific Dynamic Fields (Phase 1)
    format?: string; // e.g., "5v5", "FT5", "6-a-side"
    seriesType?: string | null;
    durationHours?: number | null;
    selectedMaps?: string[]; // CS2
    skillLevel?: string; // "Any" | "FACEIT 1-3" etc
    hostSkillScore?: number | null; // 0-100 normalized score
    hostSkillTier?: 'Beginner' | 'Intermediate' | 'Advanced' | 'Pro' | 'Any';
    hostRole?: string;
    hostSkillContext?: {
        gameKey: string;
        answers: Record<string, any>;
    };

    // Live Fairness Stats (Phase 1.5)
    avgSkillScoreLive?: number; // Maintained transactionally
    totalSkillSum?: number; // Sum of confirmed known skills
    ratedPlayerCount?: number; // Count of confirmed players with known skills

    playstyle?: string | null; // FC25/26
    rankRequirement?: string | null; // Tekken
    overs?: number | null; // Indoor Cricket
    sidePreference?: string | null; // Padel
    composition?: string | null; // Indoor Cricket
    battingOrder?: string | null; // Indoor Cricket
    battingStyle?: string | null; // Indoor Cricket
    bowlingStyle?: string | null; // Indoor Cricket
    bowlingOrder?: string | null; // Indoor Cricket
    ruleset?: Record<string, any>; // Extensible for future game-specific rules

    // Slot-based System
    slotsA: Slot[];
    slotsB: Slot[];
    captainUidA?: string;
    captainUidB?: string;

    // Team fields (Phase 2)
    teamMode?: 'team' | 'solo';
    teamId?: string | null;
    teamName?: string | null;
    reservedSlots?: number;
    teamPaymentMode?: 'captain_pays_all' | 'captain_pays_self';
    assignedTeamMembers?: Array<{
        uid: string;
        username: string;
        role: string;
    }>;

    isPrivate?: boolean; // Invite-only
    isLocked?: boolean; // Explicitly locked
    lockedAt?: any; // When the room was locked
    zoneAdminApproved?: boolean;

    // Payment placeholder (production)
    paymentStatus?: 'paid' | 'unpaid';
    paymentAmount?: number;
    paymentReservedSlots?: number;
    paymentCurrency?: string;
    resultVerification?: {
        status: 'pending' | 'participant_vote' | 'admin_review' | 'resolved';

        // Captains (optional, used by result/vote flows)
        team1Captain?: string;
        team2Captain?: string;

        // Captain reports (optional)
        captainReports?: {
            team1Captain?: { result: 'team1' | 'team2'; timestamp?: any };
            team2Captain?: { result: 'team1' | 'team2'; timestamp?: any };
        };

        // Participant voting (optional)
        participantVotes?: Record<string, 'team1' | 'team2' | 'unknown'>;
        deadline?: any;

        // Legacy
        votes?: Record<string, string>;
    };
}

const COLLECTION_NAME = "matchrooms";

const stripUndefinedDeep = (value: any): any => {
    if (Array.isArray(value)) {
        return value.map((item) => stripUndefinedDeep(item));
    }
    if (value && typeof value === "object") {
        const result: Record<string, any> = {};
        Object.entries(value).forEach(([key, nested]) => {
            if (nested === undefined) return;
            result[key] = stripUndefinedDeep(nested);
        });
        return result;
    }
    return value;
};

function parseFormatExtras(format?: string) {
    if (!format) return null;
    const match = format.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (!match) return null;

    const baseFormat = match[1].trim();
    const extraRaw = match[2].trim();
    const extra = extraRaw.toLowerCase();

    let seriesType: string | null = null;
    let durationHours: number | null = null;
    let overs: number | null = null;

    const boMatch = extra.match(/(?:bo|best of)\s*(\d+)/);
    if (boMatch) seriesType = `BO${boMatch[1]}`;

    const hoursMatch = extra.match(/(\d+(?:\.\d+)?)\s*h/);
    if (hoursMatch) durationHours = Number(hoursMatch[1]);

    const oversMatch = extra.match(/(\d+)\s*overs?/);
    if (oversMatch) overs = Number(oversMatch[1]);

    return { baseFormat, seriesType, durationHours, overs };
}

async function backfillStructuredFormat(room: Matchroom) {
    if (!room?.id || !room.format) return room;
    if (room.seriesType || room.durationHours != null || room.overs != null) return room;

    const parsed = parseFormatExtras(room.format);
    if (!parsed) return room;

    const hasStructured = !!parsed.seriesType || parsed.durationHours != null || parsed.overs != null;
    if (!hasStructured) return room;

    const updates: any = {};
    if (parsed.baseFormat && parsed.baseFormat !== room.format) {
        updates.format = parsed.baseFormat;
        room.format = parsed.baseFormat;
    }
    if (parsed.seriesType) {
        updates.seriesType = parsed.seriesType;
        room.seriesType = parsed.seriesType;
    }
    if (parsed.durationHours != null) {
        updates.durationHours = parsed.durationHours;
        room.durationHours = parsed.durationHours;
    }
    if (parsed.overs != null) {
        updates.overs = parsed.overs;
        room.overs = parsed.overs;
    }

    if (Object.keys(updates).length > 0) {
        try {
            // Only attempt DB update if the current user is the host (likely has permission)
            const isHost = auth.currentUser?.uid === room.hostUid;
            if (isHost) {
                await updateDoc(doc(db, COLLECTION_NAME, room.id), updates);
            }
        } catch (error: any) {
            // Only log if it's NOT a permission error (which we expect for non-hosts)
            if (error?.code !== 'permission-denied') {
                Logger.warn("matchService", "Failed to backfill structured format", { roomId: room.id, error });
            }
        }
    }
    return room;
}

export async function createMatchroom(roomData: Matchroom): Promise<{ ok: true; id: string; message?: string } | { ok: false; message: string }> {
    try {
        const parseScheduledStartAt = () => {
            const date = String((roomData as any).scheduledDate || "").trim();
            const time = String((roomData as any).scheduledTime || "").trim();
            if (!date || !time) return null;
            const dt = new Date(`${date}T${time}`);
            return Number.isNaN(dt.getTime()) ? null : dt;
        };

        // Enforce lead time constraints (client-only app, so keep the check here too).
        // Walk-ins are the only exception.
        if (roomData.bookingSource !== "walkin") {
            const scheduledStartAt = parseScheduledStartAt();
            if (!scheduledStartAt) {
                return { ok: false as const, message: "Scheduled date/time is required." };
            }

            const now = Date.now();
            const isAdminFlow = roomData.zoneAdminApproved === true;
            const playerFlowLeadMs =
                roomData.teamMode === "team"
                    ? 2 * ONE_DAY_MS
                    : roomData.teamMode === "solo"
                        ? 3 * ONE_DAY_MS
                        : ONE_DAY_MS;
            const minLeadMs = isAdminFlow ? ONE_DAY_MS : playerFlowLeadMs;

            if (scheduledStartAt.getTime() - now < minLeadMs) {
                const hours = Math.round(minLeadMs / (60 * 60 * 1000));
                return { ok: false as const, message: `Match must be scheduled at least ${hours} hours in advance.` };
            }
        }

        const assignedMembers = Array.isArray(roomData.assignedTeamMembers) ? roomData.assignedTeamMembers : [];
        const uniqueAssigned = assignedMembers.filter((member, index, list) => {
            const uid = String(member?.uid || "");
            return uid && list.findIndex((item) => String(item?.uid || "") === uid) === index;
        });
        const reservedCount = Math.max(1, Number(roomData.reservedSlots || 1));
        const shouldPrefillTeammates =
            roomData.teamMode === "team" &&
            roomData.teamPaymentMode === "captain_pays_all" &&
            roomData.paymentStatus === "paid";
        const prefilledTeam = (shouldPrefillTeammates ? uniqueAssigned : []).slice(0, reservedCount);
        const hostMissing = !prefilledTeam.some((member) => member.uid === roomData.hostUid);
        if (hostMissing) {
            prefilledTeam.unshift({
                uid: roomData.hostUid,
                username: roomData.hostName,
                role: roomData.hostRole || "Captain",
            });
        }
        const prefilledPlayers = prefilledTeam
            .slice(0, reservedCount)
            .map((member: any) => ({
                uid: member.uid,
                username: member.username || "Player",
                joinedAt: new Date(),
                role: member.role || "Player",
            }));

        // Handle Walk-in Roster (Validation & Player Array Population)
        const walkInRoster = (roomData as any).walkIn?.roster || [];
        const isWalkIn = (roomData as any).bookingSource === 'walkin' && walkInRoster.length > 0;

        let players = roomData.players || [];

        if (players.length === 0) {
            if (prefilledPlayers.length > 0) {
                players = prefilledPlayers;
            } else if (isWalkIn) {
                // For walk-in, convert roster to players
                players = walkInRoster.map((p: any, idx: number) => ({
                    uid: p.uid || `walkin_${Date.now()}_${idx}`, // Fallback if no UID
                    username: p.name || `Player ${idx + 1}`,
                    joinedAt: new Date(),
                    role: 'Player',
                    skillTier: p.skillTier,
                    // Persist extra fields for display
                    character: p.character,
                    favouriteClub: p.favouriteClub,
                    formation: p.formation
                }));
            } else {
                // Default host-only
                players = [{
                    uid: roomData.hostUid,
                    username: roomData.hostName,
                    joinedAt: new Date(),
                    role: 'Host'
                }];
            }
        }

        const playerUids = roomData.playerUids || players.map((player) => player.uid);

        // Initialize 5v5 Slots if it's a 10 player room (or generic even split)
        let slotsA = roomData.slotsA || [];
        let slotsB = roomData.slotsB || [];
        let captainUidA = roomData.captainUidA || roomData.hostUid;

        // Walk-in Captain Logic
        if (isWalkIn && (roomData as any).walkIn?.captainSeatNumber) {
            const capSeat = (roomData as any).walkIn.captainSeatNumber; // 1-based
            // If captain is in Team A (1-5)
            if (capSeat <= 5) {
                captainUidA = players[capSeat - 1]?.uid;
            }
            // If captain is in Team B (6-10), we might need a B captain? 
            // For now, let's just ensure A is set if possible.
        }

        // Generic Slot Initialization
        if ((!slotsA.length || !slotsB.length) && roomData.maxPlayers && roomData.maxPlayers % 2 === 0) {
            const teamSize = roomData.maxPlayers / 2;

            // Create slots for Team A
            slotsA = Array.from({ length: teamSize }, (_, i) => {
                const seatNum = i + 1;
                // Try to find player for this seat
                const p = isWalkIn ? players[i] : null; // Players 0 to teamSize-1
                return {
                    slotId: `A${seatNum}`,
                    status: p ? 'confirmed' : 'open',
                    role: p ? (p.uid === captainUidA ? 'Captain' : 'Player') : 'Player',
                    uid: p?.uid,
                    user: p ? { uid: p.uid, username: p.username, skillTier: p.skillTier } : undefined
                } as Slot;
            });

            // Create slots for Team B
            slotsB = Array.from({ length: teamSize }, (_, i) => {
                const seatNum = i + 1;
                // Try to find player for this seat (offset by teamSize)
                const p = isWalkIn ? players[i + teamSize] : null;
                return {
                    slotId: `B${seatNum}`,
                    status: p ? 'confirmed' : 'open',
                    role: 'Player',
                    uid: p?.uid,
                    user: p ? { uid: p.uid, username: p.username, skillTier: p.skillTier } : undefined
                } as Slot;
            });

            // If NOT walk-in, perform standard prefill for reserved members
            if (!isWalkIn) {
                players.slice(0, teamSize).forEach((player, index) => {
                    if (index < slotsA.length) {
                        slotsA[index] = {
                            ...slotsA[index],
                            uid: player.uid,
                            user: {
                                uid: player.uid,
                                username: player.username,
                            },
                            status: 'confirmed',
                            role: player.role || (index === 0 ? (roomData.hostRole || 'Captain') : 'Player'),
                        };
                    }
                });
            }
        }

        // Resolve zone owner (for chat participants)
        let zoneOwnerUid: string | null = null;
        if (roomData.zoneId) {
            try {
                const zoneSnap = await getDoc(doc(db, 'zones', roomData.zoneId));
                if (zoneSnap.exists()) {
                    zoneOwnerUid = zoneSnap.data()?.ownerUid || null;
                }
            } catch (e) {
                Logger.warn("matchService", "Failed to resolve zone owner", e);
            }
        }

        const scheduledStartAt = roomData.bookingSource !== "walkin"
            ? (() => {
                const date = String((roomData as any).scheduledDate || "").trim();
                const time = String((roomData as any).scheduledTime || "").trim();
                if (!date || !time) return null;
                const dt = new Date(`${date}T${time}`);
                return Number.isNaN(dt.getTime()) ? null : dt;
            })()
            : null;
        const lockAt = scheduledStartAt ? new Date(scheduledStartAt.getTime() - ONE_DAY_MS) : null;

        const payload = stripUndefinedDeep({
            ...roomData,
            players,
            slotsA,
            slotsB,
            captainUidA,
            currentPlayers: players.length,
            playerUids,
            zoneOwnerUid: zoneOwnerUid || null,
            scheduledStartAt: scheduledStartAt || null,
            lockAt: lockAt || null,
            expiresAt: lockAt || null,
            createdAt: serverTimestamp(),
        });
        const docRef = await addDoc(collection(db, COLLECTION_NAME), payload);
        Logger.info("matchService", "Matchroom created", { id: docRef.id });

        // Create chatroom for this matchroom (participants: host + current players + zone owner)
        try {
            const participantUids = Array.from(new Set([
                roomData.hostUid,
                ...playerUids,
                ...(zoneOwnerUid ? [zoneOwnerUid] : []),
            ]));
            const rolesByUid: Record<string, string> = {};
            participantUids.forEach((uid) => {
                if (uid === roomData.hostUid) rolesByUid[uid] = 'host';
                else if (uid === zoneOwnerUid) rolesByUid[uid] = 'venue_owner';
                else if (uid === captainUidA) rolesByUid[uid] = 'captain';
                else rolesByUid[uid] = 'player';
            });
            await setDoc(doc(db, 'chatrooms', docRef.id), {
                matchroomId: docRef.id,
                zoneId: roomData.zoneId || null,
                participantUids,
                rolesByUid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                lastMessage: null,
                lastReadBy: {},
            }, { merge: true });
        } catch (e) {
            Logger.warn("matchService", "Failed to create chatroom", e);
        }

        if (zoneOwnerUid && zoneOwnerUid !== roomData.hostUid) {
            try {
                await addDoc(collection(db, "notifications"), {
                    type: "admin_matchroom_created",
                    fromUid: roomData.hostUid,
                    fromUsername: roomData.hostName,
                    toUid: zoneOwnerUid,
                    status: "pending",
                    isRead: false,
                    createdAt: serverTimestamp(),
                    title: "New direct zone booking",
                    message: `${roomData.hostName} created ${roomData.title || roomData.game} at your venue.`,
                    meta: {
                        matchroomId: docRef.id,
                        zoneId: roomData.zoneId || null,
                        game: roomData.game,
                        scheduledDate: roomData.scheduledDate || null,
                        scheduledTime: roomData.scheduledTime || null,
                    },
                });
            } catch (error) {
                Logger.warn("matchService", "Failed to create admin matchroom notification", error);
            }
        }

        return { ok: true, id: docRef.id };
    } catch (error) {
        Logger.error("matchService", "Error creating matchroom", error);
        return { ok: false, message: "Failed to create matchroom" };
    }
}

export async function getMatchrooms(limitCount = 20): Promise<{ ok: true; data: Matchroom[]; message?: string } | { ok: false; message: string }> {
    try {
        if (!auth.currentUser) {
            return { ok: false, message: "Not authenticated" };
        }
        const q = query(
            collection(db, COLLECTION_NAME),
            orderBy("createdAt", "desc"),
            limit(limitCount)
        );
        const snapshot = await getDocs(q);
        const rooms = snapshot.docs
            .map((doc: any) => ({ id: doc.id, ...doc.data() } as Matchroom))
            .filter((room: Matchroom) => !isRoomExpired(room));
        await Promise.allSettled(rooms.map((room: Matchroom) => backfillStructuredFormat(room)));
        return { ok: true, data: rooms };
    } catch (error) {
        Logger.error("matchService", "Error fetching matchrooms", error);
        return { ok: false, message: "Failed to fetch matchrooms" };
    }
}

export async function getMatchroom(id: string): Promise<{ ok: true; data: Matchroom; message?: string } | { ok: false; message: string }> {
    try {
        if (!auth.currentUser) {
            return { ok: false, message: "Not authenticated" };
        }
        const docRef = doc(db, COLLECTION_NAME, id);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
            const room = { id: snapshot.id, ...snapshot.data() } as Matchroom;
            await backfillStructuredFormat(room);
            return { ok: true, data: room };
        }
        return { ok: false, message: "Matchroom not found" };
    } catch (error) {
        Logger.error("matchService", "Error fetching matchroom details", error);
        return { ok: false, message: "Failed to load matchroom" };
    }
}

// Backwards compatible alias (used by older result/vote screens)
export async function getMatchroomById(id: string) {
    return getMatchroom(id);
}

export async function submitCaptainReport(
    matchroomId: string,
    captainUid: string,
    winner: 'team1' | 'team2'
): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
    try {
        if (!auth.currentUser) return { ok: false, message: "Not authenticated" };

        const roomRef = doc(db, COLLECTION_NAME, matchroomId);

        await runTransaction(db, async (tx: any) => {
            const snap = await tx.get(roomRef);
            if (!snap.exists()) throw new Error("Matchroom not found");
            const room = snap.data() as Matchroom;

            const rv = room.resultVerification || { status: 'pending' as const };
            const team1Captain = rv.team1Captain || room.hostUid;

            // best-effort fallback: pick the first uid not equal to team1Captain
            const fallbackTeam2Captain =
                (room.players || []).map(p => p.uid).find(uid => uid && uid !== team1Captain) || '';
            const team2Captain = rv.team2Captain || fallbackTeam2Captain;

            const captainKey =
                captainUid === team1Captain ? 'team1Captain'
                    : captainUid === team2Captain ? 'team2Captain'
                        : null;

            if (!captainKey) throw new Error("Only captains can submit a report");

            const reportPath = `resultVerification.captainReports.${captainKey}`;

            tx.update(roomRef, {
                "resultVerification.status": rv.status || 'pending',
                "resultVerification.team1Captain": team1Captain,
                "resultVerification.team2Captain": team2Captain,
                [reportPath]: { result: winner, timestamp: serverTimestamp() },
                updatedAt: serverTimestamp(),
            } as any);
        });

        return { ok: true };
    } catch (e: any) {
        Logger.error("matchService", "submitCaptainReport error", e);
        return { ok: false, message: e?.message || "Failed to submit report" };
    }
}

export async function submitParticipantVote(
    matchroomId: string,
    participantUid: string,
    vote: 'team1' | 'team2' | 'unknown'
): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
    try {
        if (!auth.currentUser) return { ok: false, message: "Not authenticated" };

        const roomRef = doc(db, COLLECTION_NAME, matchroomId);
        await updateDoc(roomRef, {
            [`resultVerification.participantVotes.${participantUid}`]: vote,
            "resultVerification.status": "participant_vote",
            updatedAt: serverTimestamp(),
        } as any);

        return { ok: true };
    } catch (e: any) {
        Logger.error("matchService", "submitParticipantVote error", e);
        return { ok: false, message: e?.message || "Failed to submit vote" };
    }
}

export async function leaveMatchroom(roomId: string, userUid: string): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
    try {
        const roomRef = doc(db, COLLECTION_NAME, roomId);

        await runTransaction(db, async (transaction: any) => {
            const snap = await transaction.get(roomRef);
            if (!snap.exists()) throw "Matchroom not found";

            const room = snap.data() as Matchroom;
            const slotsA = room.slotsA || [];
            const slotsB = room.slotsB || [];

            // Lock Rule: Cannot leave if 10/10 confirmed
            const confirmedCount = [...slotsA, ...slotsB].filter(s => s?.status === 'confirmed').length;
            if (confirmedCount >= 10) {
                throw "Matchroom is locked (10/10 players confirmed). You cannot leave.";
            }

            // Remove from players array
            const updatedPlayers = room.players.filter(p => p.uid !== userUid);
            const updatedUids = (room.playerUids || []).filter(uid => uid !== userUid);

            // Release slots
            const releaseSlot = (slots: Slot[]) => slots.map(s => {
                const isOccupant = s.uid === userUid || s.reservedFor?.uid === userUid || s.reservedForUid === userUid;
                if (isOccupant) {
                    return {
                        slotId: s.slotId,
                        status: 'open' as const,
                        role: s.role // Keep the role designation of the slot if it's structural
                    };
                }
                return s;
            });

            const updatedSlotsA = releaseSlot(slotsA);
            const updatedSlotsB = releaseSlot(slotsB);

            // Update stats if they were a rated player
            // This is a bit complex as we don't know their skill here without a fetch, 
            // but we can check if the count changed in a previous step or just accept the slight drift for now.
            // For now, let's just update the core fields.

            // Perform update
            transaction.update(roomRef, {
                players: updatedPlayers,
                playerUids: updatedUids,
                currentPlayers: updatedPlayers.length,
                slotsA: updatedSlotsA,
                slotsB: updatedSlotsB,
                updatedAt: serverTimestamp()
            });

            Logger.info("matchService", "User left matchroom", { roomId, userUid, remainingUids: updatedUids.length });

            return { ok: true };
        });

        // Remove from chatroom participants (best-effort)
        try {
            await updateDoc(doc(db, 'chatrooms', roomId), {
                participantUids: arrayRemove(userUid),
                updatedAt: serverTimestamp(),
            });
        } catch (e) {
            Logger.warn("matchService", "Failed to remove chat participant", e);
        }

        return { ok: true };
    } catch (error: any) {
        Logger.error("matchService", "Error in leaveMatchroom", error);
        return { ok: false, message: typeof error === 'string' ? error : "Failed to leave matchroom" };
    }
}

/**
 * Checks if a user is currently in any active (not completed/expired) matchroom.
 */
export async function findUserTimeConflict(
    uid: string,
    targetRoom: Matchroom,
    excludeRoomId?: string
): Promise<{ conflict: true; room: Matchroom; message: string } | { conflict: false }> {
    try {
        const targetWindow = getMatchroomWindow(targetRoom);
        if (!targetWindow) return { conflict: false };

        const q = query(
            collection(db, COLLECTION_NAME),
            where("playerUids", "array-contains", uid),
            where("status", "in", ["open", "locked", "in-progress"])
        );

        // Use getDocs but we'll manually verify expiry and membership
        const snap = await getDocs(q);

        for (const docSnap of snap.docs) {
            if (excludeRoomId && docSnap.id === excludeRoomId) continue;
            const room = { id: docSnap.id, ...docSnap.data() } as Matchroom;
            const window = getMatchroomWindow(room);
            if (!window) continue;
            if (doWindowsOverlap(targetWindow, window)) {
                return {
                    conflict: true,
                    room,
                    message: `You already have a matchroom scheduled ${formatTimeRange(window)}.`
                };
            }
        }

        return { conflict: false };
    } catch (error) {
        Logger.error("matchService", "Error checking time conflicts", error);
        return { conflict: false };
    }
}

export async function isUserInActiveMatchroom(
    uid: string,
    targetRoom?: Matchroom
): Promise<{ inRoom: boolean; roomId?: string; message?: string }> {
    if (!targetRoom) return { inRoom: false };
    const conflict = await findUserTimeConflict(uid, targetRoom, targetRoom.id);
    if (conflict.conflict) {
        return { inRoom: true, roomId: conflict.room.id, message: conflict.message };
    }
    return { inRoom: false };
}

/**
 * Creates a join request notification for the matchroom host.
 */
export async function requestJoinMatchroom(
    room: Matchroom,
    user: { uid: string; username: string },
    role?: string,
    targetTeam?: string,
    slotId?: string // NEW: Optional slot targeting
): Promise<{ ok: true; id: string; message?: string } | { ok: false; message: string }> {
    try {
        const roomId = room.id;
        if (!roomId) throw "Matchroom ID missing";

        const conflict = await findUserTimeConflict(user.uid, room, roomId);
        if (conflict.conflict) {
            return { ok: false, message: conflict.message };
        }

        // Idempotency: Use deterministic ID to prevent duplicate pending requests
        // If slot-specific, maybe uniqueness changes? For now, keep one request per user per room to avoid spam.
        const requestId = `match_join_request_${roomId}_${user.uid}`;
        const notifRef = doc(db, 'notifications', requestId);

        const existingSnap = await getDoc(notifRef);
        if (existingSnap.exists() && existingSnap.data().status === 'pending') {
            return { ok: false, message: "Request already pending for this room." };
        }

        const now = serverTimestamp();
        await setDoc(notifRef, {
            type: 'match_join_request',
            toUid: room.hostUid,
            fromUid: user.uid,
            fromUsername: user.username,
            status: 'pending',
            isRead: false,
            createdAt: now,
            updatedAt: now,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            meta: {
                matchroomId: roomId,
                matchroomTitle: room.title,
                game: room.game,
                role: role || 'Flex',
                targetTeam: targetTeam || (role && role.startsWith('Team') ? role : 'Any'),
                slotId: slotId || null // NEW
            }
        });

        Logger.info("matchService", "Join request sent", { roomId, uid: user.uid, slotId });
        return { ok: true, id: requestId };
    } catch (error) {
        Logger.error("matchService", "Error requesting to join", error);
        return { ok: false, message: "Failed to send request." };
    }
}

/**
 * Responds to a join request (Accept/Reject).
 * Handles auto-rejection of other candidates if the room becomes full.
 */
export async function respondToMatchJoinRequest(
    requestId: string,
    decision: 'accept' | 'reject',
    adminUid: string
): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
    try {
        const notifRef = doc(db, 'notifications', requestId);

        const result = await runTransaction(db, async (transaction: any) => {
            const notifSnap = await transaction.get(notifRef);
            if (!notifSnap.exists()) throw "Request not found";
            const notif = notifSnap.data();

            if (notif.status !== 'pending') throw "Request already handled";

            const roomId = notif.meta.matchroomId;
            const roomRef = doc(db, 'matchrooms', roomId);
            const roomSnap = await transaction.get(roomRef);
            if (!roomSnap.exists()) throw "Matchroom not found";
            const room = roomSnap.data() as Matchroom;

            // Authorization
            // Allow Host OR Zone Owner (if linked)
            if (room.hostUid !== adminUid && room.zoneOwnerUid !== adminUid) {
                throw "Unauthorized";
            }

            if (decision === 'reject') {
                transaction.update(notifRef, { status: 'rejected' });
                return { ok: true, message: "Request rejected" };
            }

            // JOIN LOGIC
            if (isRoomLocked(room)) throw "Room is locked/full";
            if (isRoomExpired(room)) throw "Room returned expired";

            const newPlayerCount = (room.currentPlayers || 0) + 1;
            const willBeFull = newPlayerCount >= (room.maxPlayers || 10);
            const playerUid = notif.fromUid;

            // Check if already joined
            if ((room.playerUids || []).includes(playerUid)) {
                transaction.update(notifRef, { status: 'accepted', message: 'Already joined' });
                return { ok: true, message: "User is already in the room" };
            }

            // Update Room
            const updateData: any = {
                currentPlayers: newPlayerCount,
                players: arrayUnion({
                    uid: playerUid,
                    username: notif.fromUsername || 'Player',
                    joinedAt: new Date(),
                    role: notif.meta.role || 'Flex'
                }),
                playerUids: arrayUnion(playerUid)
            };

            if (willBeFull) {
                updateData.status = "locked";
                updateData.isLocked = true;
                updateData.lockedAt = serverTimestamp();
            }

            transaction.update(roomRef, updateData);
            transaction.update(notifRef, { status: 'accepted' });

            return { ok: true, message: "Request accepted", willBeFull, roomId };
        });

        if (result.ok && (result as any).willBeFull) {
            // Auto-reject other pending requests for this room
            try {
                const q = query(
                    collection(db, 'notifications'),
                    where('meta.matchroomId', '==', (result as any).roomId),
                    where('type', '==', 'match_join_request'),
                    where('status', '==', 'pending')
                );
                const snaps = await getDocs(q);
                const batch = writeBatch(db);
                let count = 0;
                snaps.forEach((doc: any) => {
                    if (doc.id !== requestId) {
                        batch.update(doc.ref, { status: 'rejected', reason: 'Room Full' });
                        count++;
                    }
                });
                if (count > 0) await batch.commit();
            } catch (cleanupErr) {
                Logger.warn("matchService", "Failed to auto-reject others", cleanupErr);
            }
        }

        return result;

    } catch (error: any) {
        Logger.error("matchService", "respondToMatchJoinRequest error", error);
        return { ok: false, message: typeof error === 'string' ? error : "Failed to process request" };
    }
}

/**
 * Deletes a join request notification.
 */
export async function cancelMatchJoinRequest(roomId: string, userId: string): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
    try {
        const requestId = `match_join_request_${roomId}_${userId}`;
        await deleteDoc(doc(db, 'notifications', requestId));
        Logger.info("matchService", "Join request cancelled", { roomId, uid: userId });
        return { ok: true };
    } catch (error) {
        Logger.error("matchService", "Error cancelling join request", error);
        return { ok: false, message: "Failed to cancel request." };
    }
}

export async function joinMatchroom(roomId: string, user: { uid: string; username: string }, role?: string, joinCode?: string): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
    try {
        const roomRef = doc(db, COLLECTION_NAME, roomId);

        // Fetch room first to check expiry/lock status
        const roomSnap = await getDoc(roomRef);
        if (!roomSnap.exists()) {
            return { ok: false, message: "Matchroom not found" };
        }
        const room = roomSnap.data() as Matchroom;

        // BUSY CHECK
        const busyCheck = await isUserInActiveMatchroom(user.uid, { id: roomId, ...room } as Matchroom);
        if (busyCheck.inRoom && busyCheck.roomId !== roomId) {
            return { ok: false, message: busyCheck.message || "You are already in another active matchroom." };
        }

        // Guard: Check if room is expired
        if (isRoomExpired(room)) {
            return { ok: false, message: "This matchroom has expired (not filled before the lock time)." };
        }

        // Guard: Check if room is locked or full
        if (isRoomLocked(room)) {
            return { ok: false, message: "This matchroom is locked (no new players allowed)." };
        }

        // Calculate if this join will fill the room
        const newPlayerCount = (room.currentPlayers || 0) + 1;
        const willBeFull = newPlayerCount >= (room.maxPlayers || 10);

        const updateData: any = {
            currentPlayers: newPlayerCount,
            players: arrayUnion({
                uid: user.uid,
                username: user.username,
                joinedAt: new Date(),
                role: role || 'Flex'
            }),
            playerUids: arrayUnion(user.uid)
        };

        // As soon as room is full, lock it immediately.
        if (willBeFull) {
            updateData.status = "locked";
            updateData.isLocked = true;
            updateData.lockedAt = serverTimestamp();
        }

        await updateDoc(roomRef, updateData);

        // If the lobby becomes full, create (or upsert) a booking request for venue admin immediately.
        // Deterministic ID keeps it idempotent across clients.
        if (willBeFull && room.bookingSource !== "walkin" && room.locationMode === "zone" && room.zoneId) {
            try {
                const requestId = `matchroom_request_${roomId}`;
                await setDoc(doc(db, "booking_requests", requestId), {
                    userId: room.hostUid,
                    userName: room.hostName || "Player",
                    gameKey: room.game || "unknown",
                    title: room.title || "Matchroom Booking",
                    description: "Lobby filled. Awaiting venue admin confirmation.",
                    maxPlayers: Number(room.maxPlayers || 0),
                    reservedSlots: Number(room.maxPlayers || 0),
                    teamMode: room.teamMode || "solo",
                    teamId: room.teamId || null,
                    preferredDate: (room as any).scheduledDate || null,
                    preferredTime: (room as any).scheduledTime || null,
                    flexibilityWindow: (room as any).flexibility || "Exact time",
                    preferredAreas: room.location ? [room.location] : [],
                    budgetPerPlayer: Number(room.pricing?.perPlayer || 0),
                    currency: room.pricing?.currency || "PKR",
                    locationMode: "zone",
                    zoneId: room.zoneId,
                    status: "open",
                    paymentStatus: room.paymentStatus || "unpaid",
                    lifecycleStatus: "matchroom_full_admin_pending",
                    matchroomId: roomId,
                    updatedAt: serverTimestamp(),
                }, { merge: true });
            } catch (e) {
                Logger.warn("matchService", "Failed to create booking request on fill", e);
            }
        }

        // Add to chatroom participants (best-effort)
        try {
            await updateDoc(doc(db, 'chatrooms', roomId), {
                participantUids: arrayUnion(user.uid),
                updatedAt: serverTimestamp(),
            });
        } catch (e) {
            Logger.warn("matchService", "Failed to add chat participant", e);
        }

        return { ok: true };
    } catch (error) {
        Logger.error("matchService", "Error joining matchroom", error);
        return { ok: false, message: "Failed to join matchroom" };
    }
}

export async function deleteMatchroom(roomId: string): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
    try {
        Logger.info("matchService", "Deleting matchroom", { roomId });
        await deleteDoc(doc(db, COLLECTION_NAME, roomId));
        return { ok: true };
    } catch (error) {
        Logger.error("matchService", "Error deleting matchroom", error);
        return { ok: false, message: "Failed to delete matchroom" };
    }
}

export async function startMatch(
    roomId: string,
    ratings: Record<string, number>,
    hostUid: string,
    team2Captain?: string
): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
    try {
        const roomRef = doc(db, COLLECTION_NAME, roomId);

        await updateDoc(roomRef, {
            status: 'in-progress',
            startTime: serverTimestamp(),
            initialRatings: ratings,
            captainUidA: hostUid,
            captainUidB: team2Captain || null
        });

        Logger.info("matchService", "Match started", { roomId });
        return { ok: true };
    } catch (error) {
        Logger.error("matchService", "Error starting match", error);
        return { ok: false, message: "Failed to start match" };
    }
}

export async function getUserMatchrooms(uid: string): Promise<{ ok: true; data: { hosted: Matchroom[]; joined: Matchroom[] }; message?: string } | { ok: false; message: string }> {
    try {
        const hostedQuery = query(
            collection(db, COLLECTION_NAME),
            where("hostUid", "==", uid)
        );
        const joinedQuery = query(
            collection(db, COLLECTION_NAME),
            where("playerUids", "array-contains", uid)
        );

        const [hostedSnap, joinedSnap] = await Promise.all([
            getDocs(hostedQuery),
            getDocs(joinedQuery)
        ]);

        const toMillis = (value: any) => {
            if (!value) return 0;
            if (typeof value?.toMillis === "function") return value.toMillis();
            if (typeof value?.seconds === "number") return value.seconds * 1000;
            if (value instanceof Date) return value.getTime();
            if (typeof value === "number") return value;
            return 0;
        };

        const sortByCreatedAtDesc = (rooms: Matchroom[]) =>
            [...rooms].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

        const hosted = sortByCreatedAtDesc(
            hostedSnap.docs
                .map((doc: any) => ({ id: doc.id, ...doc.data() } as Matchroom))
                .filter((room: Matchroom) => !isRoomExpired(room)),
        );
        const joined = joinedSnap.docs
            .map((doc: any) => ({ id: doc.id, ...doc.data() } as Matchroom))
            .filter((room: Matchroom) => !isRoomExpired(room))
            .filter((room: Matchroom) => room.hostUid !== uid); // Only non-hosted

        return { ok: true, data: { hosted, joined: sortByCreatedAtDesc(joined) } };
    } catch (error) {
        Logger.error("matchService", "Error fetching user matchrooms", error);
        return { ok: false, message: "Failed to fetch your matchrooms" };
    }
}

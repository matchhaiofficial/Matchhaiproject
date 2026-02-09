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
    where
} from "firebase/firestore";
import { auth, db } from "../config/firebaseConfig";
import Logger from "../utils/logger";
import { isRoomExpired, isRoomLocked } from "../utils/matchroomLifecycle";
import { doWindowsOverlap, formatTimeRange, getMatchroomWindow } from "../utils/matchroomTime";

export interface Slot {
    slotId: string;
    uid?: string; // occupied by
    user?: {
        uid: string;
        username: string;
        photoURL?: string;
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
    }>;
    playerUids?: string[]; // For efficient querying
    createdAt: any;

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

export async function createMatchroom(roomData: Matchroom): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
    try {
        const players = roomData.players || [{
            uid: roomData.hostUid,
            username: roomData.hostName,
            joinedAt: new Date(),
            role: 'Host'
        }];

        // Initialize 5v5 Slots if it's a 10 player room
        let slotsA = roomData.slotsA || [];
        let slotsB = roomData.slotsB || [];
        let captainUidA = roomData.captainUidA || roomData.hostUid;

        // Generic Slot Initialization for ANY even-numbered team game
        if ((!slotsA.length || !slotsB.length) && roomData.maxPlayers && roomData.maxPlayers % 2 === 0) {
            const teamSize = roomData.maxPlayers / 2;

            // Create slots for Team A
            slotsA = Array.from({ length: teamSize }, (_, i) => ({
                slotId: `A${i + 1}`,
                status: 'open' as const,
                role: 'Player'
            }));
            // Create slots for Team B
            slotsB = Array.from({ length: teamSize }, (_, i) => ({
                slotId: `B${i + 1}`,
                status: 'open' as const,
                role: 'Player'
            }));

            // Assign Host to first slot of Team A
            slotsA[0] = {
                slotId: 'A1',
                uid: roomData.hostUid,
                user: {
                    uid: roomData.hostUid,
                    username: roomData.hostName,
                },
                status: 'confirmed' as const,
                role: roomData.hostRole || 'Captain'
            };
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

        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...roomData,
            players,
            slotsA,
            slotsB,
            captainUidA,
            currentPlayers: players.length,
            playerUids: roomData.playerUids || [roomData.hostUid],
            zoneOwnerUid: zoneOwnerUid || undefined,
            createdAt: serverTimestamp(),
        });
        Logger.info("matchService", "Matchroom created", { id: docRef.id });

        // Create chatroom for this matchroom (participants: host + current players + zone owner)
        try {
            const participantUids = Array.from(new Set([
                roomData.hostUid,
                ...(roomData.playerUids || [roomData.hostUid]),
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

export async function getMatchrooms(limitCount = 20): Promise<{ ok: true; data: Matchroom[] } | { ok: false; message: string }> {
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
        const rooms = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Matchroom));
        await Promise.allSettled(rooms.map((room: Matchroom) => backfillStructuredFormat(room)));
        return { ok: true, data: rooms };
    } catch (error) {
        Logger.error("matchService", "Error fetching matchrooms", error);
        return { ok: false, message: "Failed to fetch matchrooms" };
    }
}

export async function getMatchroom(id: string): Promise<{ ok: true; data: Matchroom } | { ok: false; message: string }> {
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
): Promise<{ ok: true } | { ok: false; message: string }> {
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
): Promise<{ ok: true } | { ok: false; message: string }> {
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

export async function leaveMatchroom(roomId: string, userUid: string): Promise<{ ok: true } | { ok: false; message: string }> {
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
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
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
 * Deletes a join request notification.
 */
export async function cancelMatchJoinRequest(roomId: string, userId: string): Promise<{ ok: true } | { ok: false; message: string }> {
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

export async function joinMatchroom(roomId: string, user: { uid: string; username: string }, role?: string, joinCode?: string): Promise<{ ok: true } | { ok: false; message: string }> {
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
            return { ok: false, message: "This matchroom has expired (valid for 48 hours)" };
        }

        // Guard: Check if room is locked or full
        if (isRoomLocked(room)) {
            return { ok: false, message: "Matchroom is full and locked" };
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

        // Auto-lock when full
        if (willBeFull) {
            updateData.status = 'locked';
            updateData.isLocked = true;
            updateData.lockedAt = serverTimestamp();
        }

        await updateDoc(roomRef, updateData);

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

export async function deleteMatchroom(roomId: string): Promise<{ ok: true } | { ok: false; message: string }> {
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
): Promise<{ ok: true } | { ok: false; message: string }> {
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

export async function getUserMatchrooms(uid: string): Promise<{ ok: true; data: { hosted: Matchroom[]; joined: Matchroom[] } } | { ok: false; message: string }> {
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

        const hosted = sortByCreatedAtDesc(hostedSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Matchroom)));
        const joined = joinedSnap.docs
            .map((doc: any) => ({ id: doc.id, ...doc.data() } as Matchroom))
            .filter((room: Matchroom) => room.hostUid !== uid); // Only non-hosted

        return { ok: true, data: { hosted, joined: sortByCreatedAtDesc(joined) } };
    } catch (error) {
        Logger.error("matchService", "Error fetching user matchrooms", error);
        return { ok: false, message: "Failed to fetch your matchrooms" };
    }
}

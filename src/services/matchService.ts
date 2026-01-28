import {
    addDoc,
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
import { db } from "../config/firebaseConfig";
import Logger from "../utils/logger";
import { isRoomExpired, isRoomLocked } from "../utils/matchroomLifecycle";

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

    // Timing & Pricing
    startTime?: any;
    scheduledDate?: string;
    scheduledTime?: string;
    durationMinutes?: number; // Explicit duration
    pricing: {
        perPlayer: number;
        currency: string;
    };
    flexibility?: string; // "Exact time" | "Within 2hrs" etc (Phase 3)

    // Game-Specific Dynamic Fields (Phase 1)
    format?: string; // e.g., "5v5", "FT5", "6-a-side"
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
    resultVerification?: {
        status: 'pending' | 'participant_vote' | 'admin_review' | 'resolved';
        votes?: Record<string, string>;
    };
}

const COLLECTION_NAME = "matchrooms";

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

        if (roomData.maxPlayers === 10 && (!slotsA.length || !slotsB.length)) {
            // Create 5 slots for Team A
            slotsA = Array.from({ length: 5 }, (_, i) => ({
                slotId: `A${i + 1}`,
                status: 'open' as const,
                role: 'Player'
            }));
            // Create 5 slots for Team B
            slotsB = Array.from({ length: 5 }, (_, i) => ({
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

        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...roomData,
            players,
            slotsA,
            slotsB,
            captainUidA,
            currentPlayers: players.length,
            playerUids: roomData.playerUids || [roomData.hostUid],
            createdAt: serverTimestamp(),
        });
        Logger.info("matchService", "Matchroom created", { id: docRef.id });
        return { ok: true, id: docRef.id };
    } catch (error) {
        Logger.error("matchService", "Error creating matchroom", error);
        return { ok: false, message: "Failed to create matchroom" };
    }
}

export async function getMatchrooms(limitCount = 20): Promise<{ ok: true; data: Matchroom[] } | { ok: false; message: string }> {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            orderBy("createdAt", "desc"),
            limit(limitCount)
        );
        const snapshot = await getDocs(q);
        const rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Matchroom));
        return { ok: true, data: rooms };
    } catch (error) {
        Logger.error("matchService", "Error fetching matchrooms", error);
        return { ok: false, message: "Failed to fetch matchrooms" };
    }
}

export async function getMatchroom(id: string): Promise<{ ok: true; data: Matchroom } | { ok: false; message: string }> {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
            return { ok: true, data: { id: snapshot.id, ...snapshot.data() } as Matchroom };
        }
        return { ok: false, message: "Matchroom not found" };
    } catch (error) {
        Logger.error("matchService", "Error fetching matchroom details", error);
        return { ok: false, message: "Failed to load matchroom" };
    }
}

export async function leaveMatchroom(roomId: string, userUid: string): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
        const roomRef = doc(db, COLLECTION_NAME, roomId);

        return await runTransaction(db, async (transaction) => {
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

            transaction.update(roomRef, {
                players: updatedPlayers,
                playerUids: updatedUids,
                currentPlayers: updatedPlayers.length,
                slotsA: updatedSlotsA,
                slotsB: updatedSlotsB,
                updatedAt: serverTimestamp()
            });

            return { ok: true };
        });
    } catch (error: any) {
        Logger.error("matchService", "Error in leaveMatchroom", error);
        return { ok: false, message: typeof error === 'string' ? error : "Failed to leave matchroom" };
    }
}

/**
 * Checks if a user is currently in any active (not completed/expired) matchroom.
 */
export async function isUserInActiveMatchroom(uid: string): Promise<{ inRoom: boolean; roomId?: string; message?: string }> {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            where("playerUids", "array-contains", uid),
            where("status", "in", ["open", "locked", "in-progress"])
        );
        const snap = await getDocs(q);

        if (!snap.empty) {
            const room = snap.docs[0].data() as Matchroom;
            return {
                inRoom: true,
                roomId: snap.docs[0].id,
                message: `User is already in an active matchroom: ${room.title}`
            };
        }
        return { inRoom: false };
    } catch (error) {
        Logger.error("matchService", "Error checking active matchrooms", error);
        return { inRoom: false };
    }
}

/**
 * Creates a join request notification for the matchroom host.
 */
export async function requestJoinMatchroom(
    room: Matchroom,
    user: { uid: string; username: string },
    role?: string,
    targetTeam?: string
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
    try {
        const roomId = room.id;
        if (!roomId) throw "Matchroom ID missing";

        // Idempotency: Use deterministic ID to prevent duplicate pending requests
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
                targetTeam: targetTeam || (role && role.startsWith('Team') ? role : 'Any')
            }
        });

        Logger.info("matchService", "Join request sent", { roomId, uid: user.uid });
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
        const busyCheck = await isUserInActiveMatchroom(user.uid);
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
            where("hostUid", "==", uid),
            orderBy("createdAt", "desc")
        );
        const joinedQuery = query(
            collection(db, COLLECTION_NAME),
            where("playerUids", "array-contains", uid),
            orderBy("createdAt", "desc")
        );

        const [hostedSnap, joinedSnap] = await Promise.all([
            getDocs(hostedQuery),
            getDocs(joinedQuery)
        ]);

        const hosted = hostedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Matchroom));
        const joined = joinedSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Matchroom))
            .filter(room => room.hostUid !== uid); // Only non-hosted

        return { ok: true, data: { hosted, joined } };
    } catch (error) {
        Logger.error("matchService", "Error fetching user matchrooms", error);
        return { ok: false, message: "Failed to fetch your matchrooms" };
    }
}

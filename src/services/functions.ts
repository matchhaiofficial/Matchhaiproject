import {
    addDoc,
    arrayRemove,
    arrayUnion,
    collection,
    doc,
    getDoc,
    getDocs,
    increment,
    query,
    runTransaction,
    serverTimestamp,
    setDoc,
    Timestamp,
    where,
    writeBatch
} from 'firebase/firestore';
import { auth, db } from '../config/firebaseConfig';
import { GAME_FORMATS } from '../constants/gameRules';
import Logger from '../utils/logger';

// ----------------------------------------------------------------------------
// Social Functions (Client-Side Implementation)
// ----------------------------------------------------------------------------

export interface SendFriendRequestData {
    toUid: string;
}

export interface ServerResponse {
    ok: boolean;
    message?: string;
    [key: string]: any;
}

export const sendFriendRequest = async (data: SendFriendRequestData): Promise<ServerResponse> => {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Not authenticated");
        if (currentUser.uid === data.toUid) throw new Error("Cannot add self");

        // 1. Check if already friends
        const friendRef = doc(db, "users", currentUser.uid, "friends", data.toUid);
        const friendSnap = await getDoc(friendRef);
        if (friendSnap.exists()) {
            return { ok: false, message: "Already friends." };
        }

        // 2. Check for existing pending request
        const q = query(
            collection(db, "notifications"),
            where("fromUid", "==", currentUser.uid),
            where("toUid", "==", data.toUid),
            where("type", "==", "friend_request"),
            where("status", "==", "pending")
        );
        const existing = await getDocs(q);
        if (!existing.empty) {
            return { ok: false, message: "Request already pending." };
        }

        // 3. Create Notification
        await addDoc(collection(db, "notifications"), {
            type: "friend_request",
            fromUid: currentUser.uid,
            fromUsername: currentUser.displayName || "Unknown",
            toUid: data.toUid,
            status: "pending",
            createdAt: serverTimestamp(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        });

        return { ok: true, message: "Request sent." };

    } catch (error: any) {
        Logger.error('functions', 'sendFriendRequest error', error);
        return { ok: false, message: error.message || 'Failed to send request.' };
    }
};

export interface RespondFriendRequestData {
    notificationId: string;
    decision: 'accept' | 'decline';
}

export const respondFriendRequest = async (data: RespondFriendRequestData): Promise<ServerResponse> => {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Not authenticated");

        await runTransaction(db, async (transaction) => {
            const notifRef = doc(db, "notifications", data.notificationId);
            const notifSnap = await transaction.get(notifRef);

            if (!notifSnap.exists()) throw new Error("Request not found");
            const notifData = notifSnap.data();

            if (notifData.toUid !== currentUser.uid) throw new Error("Not authorized");
            if (notifData.status !== 'pending') throw new Error("Request already handled");

            // Update notification status
            transaction.update(notifRef, { status: data.decision === 'accept' ? 'accepted' : 'declined' });

            if (data.decision === 'accept') {
                const friendUid = notifData.fromUid;
                const friendUsername = notifData.fromUsername;

                // Add to My Friends
                const myFriendRef = doc(db, "users", currentUser.uid, "friends", friendUid);
                transaction.set(myFriendRef, {
                    uid: friendUid,
                    username: friendUsername,
                    since: serverTimestamp()
                });

                // Add to Their Friends
                const theirFriendRef = doc(db, "users", friendUid, "friends", currentUser.uid);
                transaction.set(theirFriendRef, {
                    uid: currentUser.uid,
                    username: currentUser.displayName || "Unknown",
                    since: serverTimestamp()
                });
            }
        });

        return { ok: true };
    } catch (error: any) {
        Logger.error('functions', 'respondFriendRequest error', error);
        return { ok: false, message: error.message || 'Failed to respond.' };
    }
};

export interface RemoveFriendData {
    friendUid: string;
}

export const removeFriend = async (data: RemoveFriendData): Promise<ServerResponse> => {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Not authenticated");

        const batch = writeBatch(db);

        const myRef = doc(db, "users", currentUser.uid, "friends", data.friendUid);
        batch.delete(myRef);

        const theirRef = doc(db, "users", data.friendUid, "friends", currentUser.uid);
        batch.delete(theirRef);

        await batch.commit();
        return { ok: true };
    } catch (error: any) {
        Logger.error('functions', 'removeFriend error', error);
        return { ok: false, message: error.message || 'Failed to remove friend.' };
    }
};

// ----------------------------------------------------------------------------
// Team Functions (Client-Side Implementation)
// ----------------------------------------------------------------------------

const ROSTER_CAPS: Record<string, number> = {
    cs2: 5,
    fc25: 2,
    fc26: 2,
    tekken8: 2,
    padel: 2,
    pickleball: 2,
    futsal: 7,
    indoor_cricket: 8
};

const getRequesterSnapshot = async (uid: string, gameKey: string) => {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) return null;
    const data = userDoc.data()!;

    // Extract role for the specific game
    let roleForGame;
    switch (gameKey) {
        case 'cs2':
            roleForGame = data.cs2Role;
            break;
        case 'futsal':
            roleForGame = data.futsalPosition;
            break;
        case 'indoor_cricket':
            roleForGame = data.indoorCricketRole;
            break;
        case 'padel':
            roleForGame = data.padelRole;
            break;
        case 'pickleball':
            roleForGame = data.pickleballRole;
            break;
        case 'fc25':
        case 'fc26':
            roleForGame = data.fcTeam; // Could be a team/formation combo
            break;
        case 'tekken8':
            roleForGame = data.tekkenFavorites?.join(', '); // Characters
            break;
        default:
            roleForGame = null;
    }

    return {
        uid,
        username: data.username || 'Unknown',
        city: data.city || null,
        preferredAreas: data.preferredAreas || [],
        gamesPlayed: data.gamesPlayed || [],
        roleForGame: roleForGame || null, // Add game-specific role
        skillTier: data.skillScores ? Object.keys(data.skillScores).reduce((acc: any, key) => {
            acc[key] = data.skillScores[key].tier;
            return acc;
        }, {}) : {},
        linked: {
            steam: !!data.steamId,
            faceit: !!data.faceitId,
            psn: !!data.psnId,
            xbox: !!data.xboxId
        },
        stats: {
            faceitLevel: data.faceitSkillLevel || null
        }
    };
};

export interface CreateTeamData {
    name: string;
    game: string;
    description?: string;
    visibility?: 'public' | 'private';
    maxMembers?: number; // Optional: Uses default from GAME_FORMATS if not provided
}

const checkUserTeamLimit = async (uid: string, game: string): Promise<void> => {
    // Check if user is already in a team for this game
    // Optimization: Query ONLY by memberUids (no composite index needed) and filter by game in memory.
    // This avoids the "Missing Index" error for users and is performant since a user won't be in hundreds of teams.
    const q = query(
        collection(db, 'teams'),
        where('memberUids', 'array-contains', uid)
    );

    try {
        const snapshot = await getDocs(q);
        const teamInGame = snapshot.docs.find(doc => doc.data().game === game);

        if (teamInGame) {
            throw new Error(`You are already in a ${game} team (${teamInGame.data().name}). You must leave it to create or join a new one.`);
        }
    } catch (error: any) {
        if (error.message.includes('already in a')) throw error;
        Logger.error('functions', 'checkUserTeamLimit error', error);
        throw error;
    }
};

export const createTeam = async (data: CreateTeamData): Promise<ServerResponse> => {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Not authenticated");

        const { name, game, description, visibility = 'public', maxMembers: inputMaxMembers } = data;

        // Determine and validate maxMembers
        const formats = GAME_FORMATS[game];
        if (!formats || formats.length === 0) throw new Error("Unsupported game type");

        let cap = inputMaxMembers;
        if (cap) {
            // Validate against allowed sizes
            const validSizes = formats.map(f => f.size);
            if (!validSizes.includes(cap)) {
                throw new Error(`Invalid team size. Allowed sizes for ${game}: ${validSizes.join(', ')}`);
            }
        } else {
            // Default to first format size
            cap = formats[0].size;
        }

        // 0. Enforce One Team Per Game
        await checkUserTeamLimit(currentUser.uid, game);

        // 1. Check for name uniqueness (case-insensitive)
        const nameQuery = query(
            collection(db, 'teams'),
            where('nameLower', '==', name.toLowerCase())
        );
        const nameSnap = await getDocs(nameQuery);
        if (!nameSnap.empty) {
            return { ok: false, message: "A team with this name already exists." };
        }

        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        const username = userSnap.data()?.username || 'Captain';

        const teamId = doc(collection(db, 'teams')).id;
        const teamRef = doc(db, 'teams', teamId);
        const memberRef = doc(db, 'teams', teamId, 'members', currentUser.uid);

        const batch = writeBatch(db);
        const now = serverTimestamp();

        batch.set(teamRef, {
            teamId,
            name,
            nameLower: name.toLowerCase(),
            game,
            description: description || '',
            visibility,
            captainUid: currentUser.uid,
            captainUsername: username,
            maxMembers: cap,
            memberCount: 1,
            memberUids: [currentUser.uid],
            createdAt: now,
            updatedAt: now,
            stats: { matchesPlayed: 0, wins: 0, losses: 0, draw: 0 }
        });

        batch.set(memberRef, {
            uid: currentUser.uid,
            username,
            role: 'captain',
            joinedAt: now
        });

        await batch.commit();
        return { ok: true, teamId };
    } catch (error: any) {
        if (error.message?.includes('already in a')) {
            return { ok: false, message: error.message };
        }
        Logger.error('functions', 'createTeam error', error);
        return { ok: false, message: error.message || 'Failed to create team.' };
    }
};

export const requestToJoinTeam = async (data: { teamId: string }): Promise<ServerResponse> => {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Not authenticated");

        const { teamId } = data;

        // 1. Verify User isn't in another team for this game
        const teamDoc = await getDoc(doc(db, 'teams', teamId));
        if (!teamDoc.exists()) throw new Error("Team not found");
        const teamData = teamDoc.data();

        await checkUserTeamLimit(currentUser.uid, teamData.game);

        // Deterministic ID for deduplication
        const notificationId = `team_join_request_${teamId}_${currentUser.uid}`;
        const notifRef = doc(db, 'notifications', notificationId);

        const res = await runTransaction(db, async (transaction) => {
            const teamRef = doc(db, 'teams', teamId);
            const teamSnap = await transaction.get(teamRef);
            if (!teamSnap.exists()) throw new Error("Team not found");
            const teamData = teamSnap.data();

            if (teamData.memberCount >= teamData.maxMembers) throw new Error("Team is full");

            // Idempotency: Check membership via subcollection
            const memberRef = doc(db, 'teams', teamId, 'members', currentUser.uid);
            const memberSnap = await transaction.get(memberRef);
            if (memberSnap.exists()) throw new Error("Already a member");

            // Re-request Logic: Check existing notification state
            const notifSnap = await transaction.get(notifRef);
            if (notifSnap.exists()) {
                const notifData = notifSnap.data();
                if (notifData.status === 'pending') {
                    // Check expiration
                    const expiresAt = notifData.expiresAt instanceof Timestamp ? notifData.expiresAt.toMillis() : notifData.expiresAt;
                    if (Date.now() < expiresAt) {
                        throw new Error("Request already pending");
                    }
                }
                // If denied/expired, we overwrite/reset it
            }

            const snapshot = await getRequesterSnapshot(currentUser.uid, teamData.game);
            const now = serverTimestamp();

            transaction.set(notifRef, {
                type: 'team_join_request',
                toUid: teamData.captainUid, // Notify CURRENT captain
                fromUid: currentUser.uid,
                fromUsername: snapshot?.username || 'Unknown',
                status: 'pending',
                createdAt: now,
                updatedAt: now,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                entityKey: notificationId,
                meta: {
                    teamId,
                    teamName: teamData.name,
                    game: teamData.game,
                    requesterSnapshot: snapshot
                }
            });

            return { ok: true, message: "Request sent to captain." };
        });

        return res;
    } catch (error: any) {
        if (error.message?.includes('already in a')) {
            return { ok: false, message: error.message };
        }
        Logger.error('functions', 'requestToJoinTeam error', error);
        return { ok: false, message: error.message || 'Failed to send request.' };
    }
};

export const respondToJoinRequest = async (data: { notificationId: string; decision: 'accept' | 'reject' }): Promise<ServerResponse> => {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Not authenticated");

        const { notificationId, decision } = data;
        const notifRef = doc(db, 'notifications', notificationId);

        const res = await runTransaction(db, async (transaction) => {
            const notifSnap = await transaction.get(notifRef);
            if (!notifSnap.exists()) throw new Error("Request not found");
            const notifData = notifSnap.data();

            if (notifData.status !== 'pending') throw new Error("Already handled");

            const teamRef = doc(db, 'teams', notifData.meta.teamId);
            const teamSnap = await transaction.get(teamRef);
            if (!teamSnap.exists()) throw new Error("Team not found");
            const teamData = teamSnap.data();

            // Strict Ownership Check: Ensure currentUser is the CURRENT captain
            if (teamData.captainUid !== currentUser.uid) throw new Error("Only the current captain can respond");

            if (decision === 'reject') {
                transaction.update(notifRef, { status: 'rejected' });
                return { ok: true };
            }

            // Accept Flow
            const requesterUid = notifData.fromUid;

            // Enforce One Team Per Game (for the requester)
            // Note: We await this non-transactional check inside the function block.
            await checkUserTeamLimit(requesterUid, teamData.game);

            // 1. Capacity Check
            if (teamData.memberCount >= teamData.maxMembers) {
                // Auto-reject if full
                transaction.update(notifRef, { status: 'rejected', reason: 'team_full' });
                throw new Error("Team is full");
            }

            // 2. Idempotency Check (Subcollection + Array)
            // requesterUid is already defined above
            const memberRef = doc(db, 'teams', teamData.teamId, 'members', requesterUid);
            const memberSnap = await transaction.get(memberRef);

            const isInMemberUids = (teamData.memberUids || []).includes(requesterUid);
            const isMemberDocExists = memberSnap.exists();

            if (isInMemberUids && isMemberDocExists) {
                transaction.update(notifRef, { status: 'accepted' });
                return { ok: true, message: "User is already a member." };
            }

            const now = serverTimestamp();
            const updates: any = { updatedAt: now };

            // 3. Add Member (Conditional)
            if (!isMemberDocExists) {
                // Extract role for this game from requester snapshot
                const roleForGame = notifData.meta?.requesterSnapshot?.roleForGame || 'Not set';

                transaction.set(memberRef, {
                    uid: requesterUid,
                    username: notifData.fromUsername,
                    role: 'member',
                    roleForGame, // Persist game-specific role
                    joinedAt: now
                });
            }

            if (!isInMemberUids) {
                // Only increment if truly adding new uid
                updates.memberUids = arrayUnion(requesterUid);
                updates.memberCount = increment(1);
            }

            transaction.update(teamRef, updates);
            transaction.update(notifRef, { status: 'accepted' });

            // Notification to requester
            const decisionNotifRef = doc(collection(db, 'notifications'));
            transaction.set(decisionNotifRef, {
                type: 'team_join_decision',
                toUid: requesterUid,
                fromUid: currentUser.uid,
                fromUsername: teamData.captainUsername,
                status: 'accepted',
                createdAt: now,
                meta: {
                    teamId: teamData.teamId,
                    teamName: teamData.name,
                    game: teamData.game
                }
            });

            return { ok: true };
        });

        return res;
    } catch (error: any) {
        if (error.message?.includes('already in a')) {
            return { ok: false, message: error.message };
        }
        Logger.error('functions', 'respondToJoinRequest error', error);
        return { ok: false, message: error.message || 'Failed to respond.' };
    }
};

export const transferCaptain = async (data: { teamId: string; newCaptainUid: string }): Promise<ServerResponse> => {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Not authenticated");

        const { teamId, newCaptainUid } = data;
        const teamRef = doc(db, 'teams', teamId);

        const res = await runTransaction(db, async (transaction) => {
            const teamSnap = await transaction.get(teamRef);
            if (!teamSnap.exists()) throw new Error("Team not found");
            const teamData = teamSnap.data();

            if (teamData.captainUid !== currentUser.uid) throw new Error("Only captain can transfer");

            const newMemberSnap = await transaction.get(doc(db, 'teams', teamId, 'members', newCaptainUid));
            if (!newMemberSnap.exists()) throw new Error("Target is not a member");

            const now = serverTimestamp();
            const newCaptainName = newMemberSnap.data()?.username || 'Captain';

            transaction.update(teamRef, {
                captainUid: newCaptainUid,
                captainUsername: newCaptainName,
                updatedAt: now
            });

            transaction.update(doc(db, 'teams', teamId, 'members', currentUser.uid), { role: 'member' });
            transaction.update(doc(db, 'teams', teamId, 'members', newCaptainUid), { role: 'captain' });

            return { ok: true };
        });

        return res;
    } catch (error: any) {
        Logger.error('functions', 'transferCaptain error', error);
        return { ok: false, message: error.message || 'Failed to transfer.' };
    }
};

export const removeMember = async (data: { teamId: string; memberUid: string }): Promise<ServerResponse> => {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Not authenticated");

        const { teamId, memberUid } = data;
        if (currentUser.uid === memberUid) throw new Error("Cannot remove yourself");

        const teamRef = doc(db, 'teams', teamId);

        const res = await runTransaction(db, async (transaction) => {
            const teamSnap = await transaction.get(teamRef);
            if (!teamSnap.exists()) throw new Error("Team not found");
            if (teamSnap.data()?.captainUid !== currentUser.uid) throw new Error("Only captain can remove");

            const memberRef = doc(db, 'teams', teamId, 'members', memberUid);
            const memberSnap = await transaction.get(memberRef);
            if (!memberSnap.exists()) throw new Error("Member not found");

            transaction.delete(memberRef);
            transaction.update(teamRef, {
                memberCount: increment(-1),
                memberUids: arrayRemove(memberUid),
                updatedAt: serverTimestamp()
            });

            // Cleanup: Delete any related notifications (invites/requests) for this user & team
            // We can't query in a transaction easily without an index, so we might need a separate operations or use deterministic IDs.
            // Deterministic IDs: `team_invite__${teamId}__${memberUid}` and `team_join_request_${teamId}_${memberUid}`
            const inviteId = `team_invite__${teamId}__${memberUid}`;
            const requestId = `team_join_request_${teamId}_${memberUid}`;

            // Transactional delete (if they exist)
            transaction.delete(doc(db, 'notifications', inviteId));
            transaction.delete(doc(db, 'notifications', requestId));

            return { ok: true };
        });

        return res;
    } catch (error: any) {
        Logger.error('functions', 'removeMember error', error);
        return { ok: false, message: error.message || 'Failed to remove member.' };
    }
};

export const inviteToTeam = async (data: { teamId: string; toUid: string }): Promise<ServerResponse> => {
    try {
        Logger.info('functions', 'inviteToTeam: Starting', { data });
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Not authenticated");

        const { teamId, toUid } = data;

        // 1. Verify current user is captain
        Logger.info('functions', 'inviteToTeam: Verifying captain permissions', { teamId, uid: currentUser.uid });
        const teamRef = doc(db, 'teams', teamId);

        let teamSnap;
        try {
            teamSnap = await getDoc(teamRef);
        } catch (err: any) {
            Logger.error('functions', 'inviteToTeam: Failed to fetch team', err);
            throw new Error(`Failed to fetch team: ${err.message}`);
        }

        if (!teamSnap.exists()) throw new Error("Team not found");
        const teamData = teamSnap.data();
        if (teamData.captainUid !== currentUser.uid) throw new Error("Only captain can invite members");
        Logger.info('functions', 'inviteToTeam: Captain verified');

        // 2. Verify target is a friend (Friends-only rule)
        Logger.info('functions', 'inviteToTeam: Verifying friend status', { friendUid: toUid });
        const friendRef = doc(db, 'users', currentUser.uid, 'friends', toUid);

        let friendSnap;
        try {
            friendSnap = await getDoc(friendRef);
        } catch (err: any) {
            Logger.error('functions', 'inviteToTeam: Failed to check friend status', err);
            throw new Error(`Failed to check friend status: ${err.message}`);
        }

        if (!friendSnap.exists()) throw new Error("Can only invite friends");
        Logger.info('functions', 'inviteToTeam: Friend Verified');

        // 3. Verify target is not already a member
        Logger.info('functions', 'inviteToTeam: Checking existing membership', { teamId, toUid });
        const memberRef = doc(db, 'teams', teamId, 'members', toUid);
        try {
            const memberSnap = await getDoc(memberRef);
            if (memberSnap.exists()) throw new Error("User is already a member");
        } catch (err: any) {
            // If getDoc failed (permission?), we need to know. 
            // IF the error was "User is already a member", rethrow.
            // If it was a permission error on checking membership, log it.
            if (err.message === "User is already a member") throw err;
            Logger.error('functions', 'inviteToTeam: Failed to check existing membership', err);
            throw new Error(`Failed to check membership: ${err.message}`);
        }
        Logger.info('functions', 'inviteToTeam: Membership check passed');

        // 4. Prevent duplicate pending invites (Deterministic ID + Expiration check)
        const notificationId = `team_invite__${teamId}__${toUid}`;
        Logger.info('functions', 'inviteToTeam: Checking existing notifications', { notificationId });
        const notifRef = doc(db, 'notifications', notificationId);

        let existingSnap;
        try {
            existingSnap = await getDoc(notifRef);
        } catch (err: any) {
            Logger.warn('functions', 'inviteToTeam: Failed to read existing invite (likely permission issue or corrupt data). Proceeding to overwrite.', err);
            existingSnap = null;
        }

        if (existingSnap && existingSnap.exists()) {
            const existingData = existingSnap.data();
            Logger.info('functions', 'inviteToTeam: Found existing invite', { status: existingData.status });

            // Handle Re-invite logic: allow if expired or already handled (accepted/declined/rejected)
            if (existingData.status === 'pending') {
                const expiresAt = existingData.expiresAt;
                const isExpired = expiresAt && (expiresAt instanceof Timestamp ? expiresAt.toMillis() : expiresAt) < Date.now();
                if (!isExpired) {
                    throw new Error("Invitation already pending");
                }
                Logger.info('functions', 'inviteToTeam: Existing invite expired, overwriting');
            }
        } else {
            Logger.info('functions', 'inviteToTeam: No existing invite found');
        }

        // 5. Create/Overwrite Notification
        Logger.info('functions', 'inviteToTeam: Creating notification', { notificationId });
        const payload = {
            type: 'team_invite',
            toUid,
            fromUid: currentUser.uid,
            fromUsername: teamData.captainUsername || 'Captain',
            status: 'pending',
            createdAt: serverTimestamp(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            meta: {
                teamId,
                teamName: teamData.name,
                game: teamData.game
            }
        };

        try {
            await setDoc(notifRef, payload);
        } catch (err: any) {
            Logger.error('functions', 'inviteToTeam: Failed to create notification', err);
            throw new Error(`Failed to create invite notification: ${err.message}`);
        }

        Logger.info('functions', 'inviteToTeam: Success');
        return { ok: true, message: "Invitation sent to friend." };
    } catch (error: any) {
        Logger.error('functions', 'inviteToTeam error', error);
        return { ok: false, message: error.message || 'Failed to invite.' };
    }
};

export const respondToTeamInvite = async (data: { notificationId: string; decision: 'accept' | 'decline' }): Promise<ServerResponse> => {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Not authenticated");

        const { notificationId, decision } = data;
        const notifRef = doc(db, 'notifications', notificationId);

        const res = await runTransaction(db, async (transaction) => {
            const notifSnap = await transaction.get(notifRef);
            if (!notifSnap.exists()) throw new Error("Invite not found");
            const notifData = notifSnap.data();

            if (notifData.type !== 'team_invite') throw new Error("Invalid notification type");
            if (notifData.toUid !== currentUser.uid) throw new Error("Not authorized");

            // Expiration Check (using Timestamp.now() for comparison)
            const expiresAt = notifData.expiresAt;
            const isExpired = expiresAt && (expiresAt instanceof Timestamp ? expiresAt.toMillis() : expiresAt) < Date.now();
            if (isExpired && notifData.status === 'pending') {
                throw new Error("Invitation has expired");
            }

            if (notifData.status !== 'pending') throw new Error("Invite already processed");

            if (decision === 'decline') {
                transaction.update(notifRef, { status: 'declined' });
                return { ok: true, message: "Invite declined." };
            }

            // Accept Logic
            const teamId = notifData.meta.teamId;
            const teamRef = doc(db, 'teams', teamId);
            const teamSnap = await transaction.get(teamRef);
            if (!teamSnap.exists()) throw new Error("Team no longer exists");
            const teamData = teamSnap.data();

            // Enforce One Team Per Game
            await checkUserTeamLimit(currentUser.uid, teamData.game);

            // Check if Member doc exists OR if user is in memberUids (Idempotency Check)
            const memberRef = doc(db, 'teams', teamId, 'members', currentUser.uid);
            const memberSnap = await transaction.get(memberRef);
            const isAlreadyInArray = (teamData.memberUids || []).includes(currentUser.uid);
            const documentExists = memberSnap.exists();

            if (isAlreadyInArray || documentExists) {
                // Self-heal: ensure both are consistent
                if (!documentExists) {
                    transaction.set(memberRef, {
                        uid: currentUser.uid,
                        username: currentUser.displayName || 'Member',
                        role: 'member',
                        joinedAt: serverTimestamp()
                    });
                }
                if (!isAlreadyInArray) {
                    transaction.update(teamRef, {
                        memberUids: arrayUnion(currentUser.uid)
                    });
                }
                transaction.update(notifRef, { status: 'accepted' });
                return { ok: true, message: "Already a member." };
            }

            // Check Capacity
            if (teamData.memberCount >= teamData.maxMembers) {
                transaction.update(notifRef, { status: 'rejected', reason: 'team_full' });
                throw new Error("Team is full");
            }

            const now = serverTimestamp();
            const username = currentUser.displayName || (await transaction.get(doc(db, 'users', currentUser.uid))).data()?.username || 'Member';

            // 1. Add Member Doc
            transaction.set(memberRef, {
                uid: currentUser.uid,
                username,
                role: 'member',
                joinedAt: now
            });

            // 2. Update Team Doc
            transaction.update(teamRef, {
                memberCount: increment(1),
                memberUids: arrayUnion(currentUser.uid),
                updatedAt: now
            });

            // 3. Close Notification
            transaction.update(notifRef, { status: 'accepted' });

            return { ok: true, message: "Joined team successfully!" };
        });

        return res;
    } catch (error: any) {
        if (error.message?.includes('already in a')) {
            return { ok: false, message: error.message };
        }
        Logger.error('functions', 'respondToTeamInvite error', error);
        return { ok: false, message: error.message || 'Failed to respond to invite.' };
    }
};

export const deleteTeam = async (data: { teamId: string }): Promise<ServerResponse> => {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Not authenticated");

        const { teamId } = data;
        Logger.info('functions', 'deleteTeam: Starting', { teamId });

        // 1. Verify Captaincy
        const teamRef = doc(db, 'teams', teamId);
        const teamSnap = await getDoc(teamRef);
        if (!teamSnap.exists()) throw new Error("Team not found");
        const teamData = teamSnap.data();
        if (teamData.captainUid !== currentUser.uid) throw new Error("Only captain can delete team");

        // 2. Fetch all members to notify/delete
        const membersCollection = collection(db, 'teams', teamId, 'members');
        const membersSnap = await getDocs(membersCollection);
        const memberUids = membersSnap.docs.map(doc => doc.id);

        Logger.info('functions', 'deleteTeam: Found members', { count: memberUids.length });

        // 3. Find and Delete ALL notifications related to this team (invites & join requests)
        const notifQuery = query(
            collection(db, 'notifications'),
            where('meta.teamId', '==', teamId)
        );

        let notifDocs: any[] = [];
        try {
            const notifSnap = await getDocs(notifQuery);
            notifDocs = notifSnap.docs;
            Logger.info('functions', 'deleteTeam: Found notifications to cleanup', { count: notifDocs.length });
        } catch (err: any) {
            Logger.warn('functions', 'deleteTeam: Failed to query notifications (index missing?), skipping cleanup', err);
        }

        const batch = writeBatch(db);

        // A. Delete Notification Docs
        notifDocs.forEach(docSnap => {
            batch.delete(docSnap.ref);
        });

        // B. Send "Team Deleted" Notifications to Ex-Members (excluding captain)
        const now = serverTimestamp();
        membersSnap.docs.forEach(memberDoc => {
            const memberUid = memberDoc.id;
            if (memberUid !== currentUser.uid) {
                const notifRef = doc(collection(db, 'notifications'));
                batch.set(notifRef, {
                    type: 'team_deleted',
                    toUid: memberUid,
                    fromUid: currentUser.uid,
                    content: `Team "${teamData.name}" has been disbanded by the captain.`,
                    status: 'unread',
                    createdAt: now,
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                });
            }
            // C. Delete Member Doc
            batch.delete(memberDoc.ref);
        });

        // D. Delete Team Doc
        batch.delete(teamRef);

        await batch.commit();
        Logger.info('functions', 'deleteTeam: Success');

        return { ok: true, message: "Team deleted successfully." };

    } catch (error: any) {
        Logger.error('functions', 'deleteTeam error', error);
        return { ok: false, message: error.message || 'Failed to delete team.' };
    }
};

export const leaveTeam = async (data: { teamId: string }): Promise<ServerResponse> => {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Not authenticated");

        const { teamId } = data;
        Logger.info('functions', 'leaveTeam: Starting', { teamId, uid: currentUser.uid });

        const teamRef = doc(db, 'teams', teamId);

        const res = await runTransaction(db, async (transaction) => {
            const teamSnap = await transaction.get(teamRef);
            if (!teamSnap.exists()) throw new Error("Team not found");
            const teamData = teamSnap.data();

            if (teamData.captainUid === currentUser.uid) {
                throw new Error("Captains cannot leave. Delete the team instead.");
            }

            const memberRef = doc(db, 'teams', teamId, 'members', currentUser.uid);
            const memberSnap = await transaction.get(memberRef);
            if (!memberSnap.exists()) throw new Error("You are not a member of this team");

            // Delete Member Doc
            transaction.delete(memberRef);

            // Update Team Doc
            transaction.update(teamRef, {
                memberCount: increment(-1),
                memberUids: arrayRemove(currentUser.uid),
                updatedAt: serverTimestamp()
            });

            return { ok: true };
        });

        // Cleanup: Notification
        const inviteId = `team_invite__${teamId}__${currentUser.uid}`;
        const requestId = `team_join_request_${teamId}_${currentUser.uid}`;

        try {
            const batch = writeBatch(db);
            batch.delete(doc(db, 'notifications', inviteId));
            batch.delete(doc(db, 'notifications', requestId));
            await batch.commit();
        } catch (cleanupErr) {
            Logger.warn('functions', 'leaveTeam: Cleanup failed', cleanupErr);
        }

        Logger.info('functions', 'leaveTeam: Success');
        return { ok: true, message: "Left team successfully." };

    } catch (error: any) {
        Logger.error('functions', 'leaveTeam error', error);
        return { ok: false, message: error.message || 'Failed to leave team.' };
    }
};

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

const db = admin.firestore();

// ----------------------------------------------------------------------------
// Constants & Types
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

type GameKey = keyof typeof ROSTER_CAPS;

interface CreateTeamData {
    name: string;
    game: GameKey;
    description?: string;
    visibility?: 'public' | 'private';
}

interface RequestJoinData {
    teamId: string;
}

interface RespondJoinData {
    notificationId: string;
    decision: 'accept' | 'reject';
}

interface TransferCaptainData {
    teamId: string;
    newCaptainUid: string;
}

interface RemoveMemberData {
    teamId: string;
    memberUid: string;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

const getRequesterSnapshot = async (uid: string) => {
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) return null;
    const data = userDoc.data()!;

    // Whitelist safe fields only
    return {
        uid,
        username: data.username || 'Unknown',
        city: data.city || null,
        preferredAreas: data.preferredAreas || [],
        gamesPlayed: data.gamesPlayed || [],
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
            cs2SteamHours: data.cs2Stats?.playtime_forever || 0,
            fcSteamHours: data.fcStats?.playtime_forever || 0,
            faceitLevel: data.faceitStats?.skill_level || 0
        }
    };
};

// ----------------------------------------------------------------------------
// 1. Create Team
// ----------------------------------------------------------------------------
export const createTeam = functions.https.onCall(async (data: CreateTeamData, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required.');

    const uid = context.auth.uid;
    const { name, game, description, visibility = 'public' } = data;

    if (!name || name.length < 3) throw new functions.https.HttpsError('invalid-argument', 'Name too short.');
    if (!ROSTER_CAPS[game]) throw new functions.https.HttpsError('invalid-argument', 'Unsupported game.');

    const userSnap = await db.collection('users').doc(uid).get();
    const username = userSnap.data()?.username || 'Captain';

    const now = admin.firestore.Timestamp.now();
    const teamRef = db.collection('teams').doc();

    const batch = db.batch();
    batch.set(teamRef, {
        teamId: teamRef.id,
        name,
        nameLower: name.toLowerCase(),
        game,
        description: description || '',
        visibility,
        captainUid: uid,
        captainUsername: username,
        maxMembers: ROSTER_CAPS[game],
        memberCount: 1,
        createdAt: now,
        updatedAt: now,
        stats: { matchesPlayed: 0, wins: 0, losses: 0, draw: 0 }
    });

    batch.set(teamRef.collection('members').doc(uid), {
        uid,
        username,
        role: 'captain',
        joinedAt: now
    });

    await batch.commit();
    return { ok: true, teamId: teamRef.id };
});

// ----------------------------------------------------------------------------
// 2. Request to Join Team
// ----------------------------------------------------------------------------
export const requestToJoinTeam = functions.https.onCall(async (data: RequestJoinData, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required.');

    const fromUid = context.auth.uid;
    const { teamId } = data;

    const teamRef = db.collection('teams').doc(teamId);
    const teamSnap = await teamRef.get();
    if (!teamSnap.exists) throw new functions.https.HttpsError('not-found', 'Team not found.');
    const teamData = teamSnap.data()!;

    // 1. Validation
    if (teamData.memberCount >= teamData.maxMembers) throw new functions.https.HttpsError('failed-precondition', 'Team is full.');

    const memberSnap = await teamRef.collection('members').doc(fromUid).get();
    if (memberSnap.exists) throw new functions.https.HttpsError('already-exists', 'Already a member.');

    // Duplicate check
    const entityKey = `join_request:${teamId}:${fromUid}`;
    const existing = await db.collection('notifications')
        .where('entityKey', '==', entityKey)
        .where('status', '==', 'pending')
        .limit(1)
        .get();
    if (!existing.empty) throw new functions.https.HttpsError('already-exists', 'Request already pending.');

    // Block check (simplistic for MVP)
    const blockSnap = await db.collection('users').doc(teamData.captainUid).collection('blocks').doc(fromUid).get();
    if (blockSnap.exists) throw new functions.https.HttpsError('permission-denied', 'Cannot request.');

    // 2. Snapshot
    const requesterSnapshot = await getRequesterSnapshot(fromUid);
    const now = admin.firestore.Timestamp.now();

    await db.collection('notifications').add({
        type: 'team_join_request',
        toUid: teamData.captainUid,
        fromUid,
        fromUsername: requesterSnapshot?.username || 'Unknown',
        status: 'pending',
        createdAt: now,
        expiresAt: admin.firestore.Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000),
        entityKey,
        meta: {
            teamId,
            teamName: teamData.name,
            game: teamData.game,
            requesterSnapshot
        }
    });

    return { ok: true, message: 'Request sent to captain.' };
});

// ----------------------------------------------------------------------------
// 3. Respond to Join Request
// ----------------------------------------------------------------------------
export const respondToJoinRequest = functions.https.onCall(async (data: RespondJoinData, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required.');

    const captainUid = context.auth.uid;
    const { notificationId, decision } = data;

    const notifRef = db.collection('notifications').doc(notificationId);

    await db.runTransaction(async (t) => {
        const notifSnap = await t.get(notifRef);
        if (!notifSnap.exists) throw new functions.https.HttpsError('not-found', 'Request not found.');
        const notifData = notifSnap.data()!;

        if (notifData.status !== 'pending') throw new functions.https.HttpsError('failed-precondition', 'Already handled.');

        const teamId = notifData.meta.teamId;
        const teamRef = db.collection('teams').doc(teamId);
        const teamSnap = await t.get(teamRef);

        if (!teamSnap.exists) throw new functions.https.HttpsError('not-found', 'Team not found.');
        const teamData = teamSnap.data()!;

        // Authority check
        if (teamData.captainUid !== captainUid) throw new functions.https.HttpsError('permission-denied', 'Only captain can respond.');

        if (decision === 'reject') {
            t.update(notifRef, { status: 'rejected' });
            return;
        }

        // Accept Flow
        if (teamData.memberCount >= teamData.maxMembers) {
            t.update(notifRef, { status: 'rejected', reason: 'team_full' });
            return;
        }

        const requesterUid = notifData.fromUid;
        const now = admin.firestore.Timestamp.now();

        t.set(teamRef.collection('members').doc(requesterUid), {
            uid: requesterUid,
            username: notifData.fromUsername,
            role: 'member',
            joinedAt: now
        });

        t.update(teamRef, {
            memberCount: admin.firestore.FieldValue.increment(1),
            updatedAt: now
        });

        t.update(notifRef, { status: 'accepted' });

        // Optional notification to requester
        t.set(db.collection('notifications').doc(), {
            type: 'team_join_decision',
            toUid: requesterUid,
            fromUid: captainUid,
            fromUsername: teamData.captainUsername,
            status: 'accepted',
            createdAt: now,
            meta: {
                teamId,
                teamName: teamData.name,
                game: teamData.game
            }
        });
    });

    return { ok: true };
});

// ----------------------------------------------------------------------------
// 4. Transfer Captain
// ----------------------------------------------------------------------------
export const transferCaptain = functions.https.onCall(async (data: TransferCaptainData, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required.');

    const currentCaptainUid = context.auth.uid;
    const { teamId, newCaptainUid } = data;

    const teamRef = db.collection('teams').doc(teamId);

    await db.runTransaction(async (t) => {
        const teamSnap = await t.get(teamRef);
        if (!teamSnap.exists) throw new functions.https.HttpsError('not-found', 'Team not found.');
        const teamData = teamSnap.data()!;

        if (teamData.captainUid !== currentCaptainUid) throw new functions.https.HttpsError('permission-denied', 'Only captain can transfer.');

        const newMemberSnap = await t.get(teamRef.collection('members').doc(newCaptainUid));
        if (!newMemberSnap.exists) throw new functions.https.HttpsError('failed-precondition', 'Target is not a member.');

        const now = admin.firestore.Timestamp.now();

        // Update Team Doc
        t.update(teamRef, {
            captainUid: newCaptainUid,
            captainUsername: newMemberSnap.data()?.username || 'Captain',
            updatedAt: now
        });

        // Update roles
        t.update(teamRef.collection('members').doc(currentCaptainUid), { role: 'member' });
        t.update(teamRef.collection('members').doc(newCaptainUid), { role: 'captain' });
    });

    return { ok: true };
});

// ----------------------------------------------------------------------------
// 5. Remove Member
// ----------------------------------------------------------------------------
export const removeMember = functions.https.onCall(async (data: RemoveMemberData, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required.');

    const captainUid = context.auth.uid;
    const { teamId, memberUid } = data;

    if (captainUid === memberUid) throw new functions.https.HttpsError('invalid-argument', 'Cannot remove yourself. Use transfer first.');

    const teamRef = db.collection('teams').doc(teamId);

    await db.runTransaction(async (t) => {
        const teamSnap = await t.get(teamRef);
        if (!teamSnap.exists) throw new functions.https.HttpsError('not-found', 'Team not found.');
        if (teamSnap.data()?.captainUid !== captainUid) throw new functions.https.HttpsError('permission-denied', 'Only captain can remove.');

        const memberRef = teamRef.collection('members').doc(memberUid);
        const memberSnap = await t.get(memberRef);
        if (!memberSnap.exists) throw new functions.https.HttpsError('not-found', 'Member not found.');

        t.delete(memberRef);
        t.update(teamRef, {
            memberCount: admin.firestore.FieldValue.increment(-1),
            updatedAt: admin.firestore.Timestamp.now()
        });
    });

    return { ok: true };
});

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

const db = admin.firestore();

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface SendFriendRequestData {
    toUid: string;
}

interface RespondFriendRequestData {
    notificationId: string;
    decision: 'accept' | 'decline';
}

interface RemoveFriendData {
    friendUid: string;
}

interface BlockUserData {
    blockedUid: string;
}

// ----------------------------------------------------------------------------
// 1. Send Friend Request
// ----------------------------------------------------------------------------
export const sendFriendRequest = functions.https.onCall(async (data: SendFriendRequestData, context) => {
    // 1. Auth Check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    const fromUid = context.auth.uid;
    const { toUid } = data;

    if (!toUid || typeof toUid !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid target user.');
    }
    if (fromUid === toUid) {
        throw new functions.https.HttpsError('invalid-argument', 'Cannot send request to self.');
    }

    // 2. Fetch User Profiles & Check Blocks
    const fromRef = db.collection('users').doc(fromUid);
    const toRef = db.collection('users').doc(toUid);

    const [fromSnap, toSnap] = await Promise.all([fromRef.get(), toRef.get()]);

    if (!fromSnap.exists || !toSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'User not found.');
    }

    const fromData = fromSnap.data();
    // Check if I blocked them
    const myBlockSnap = await fromRef.collection('blocks').doc(toUid).get();
    if (myBlockSnap.exists) {
        throw new functions.https.HttpsError('permission-denied', 'You have blocked this user.');
    }

    // Check if they blocked me (simulate privacy by just saying 'Failed' or generic)
    const theirBlockSnap = await toRef.collection('blocks').doc(fromUid).get();
    if (theirBlockSnap.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Cannot send request.');
    }

    // 3. Check Existing Friendship
    const existingFriend = await fromRef.collection('friends').doc(toUid).get();
    if (existingFriend.exists) {
        throw new functions.https.HttpsError('already-exists', 'You are already friends.');
    }

    // 4. Check Dedupe (Existing Active Notification)
    // Key format: "friend_request:SENDER_UID:RECEIVER_UID"
    const entityKey = `friend_request:${fromUid}:${toUid}`;

    const existingNotifQuery = await db.collection('notifications')
        .where('entityKey', '==', entityKey)
        .where('status', '==', 'pending')
        .limit(1)
        .get();

    if (!existingNotifQuery.empty) {
        throw new functions.https.HttpsError('already-exists', 'Friend request already pending.');
    }

    // 5. Rate Limit (Optional MVP: Skip complex counter, relying on Firestore rules or client courtesy, 
    // or simple collection valid logic. Implementing simple counter check if needed, but for MVP skipping.)

    // 6. Create Notification
    const now = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.collection('notifications').add({
        type: 'friend_request',
        fromUid: fromUid,
        fromUsername: fromData?.username || 'Unknown',
        toUid: toUid,
        status: 'pending',
        createdAt: now,
        expiresAt: expiresAt,
        entityKey: entityKey
    });

    return { ok: true, message: 'Friend request sent.' };
});

// ----------------------------------------------------------------------------
// 2. Respond to Friend Request
// ----------------------------------------------------------------------------
export const respondFriendRequest = functions.https.onCall(async (data: RespondFriendRequestData, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required.');

    const { notificationId, decision } = data;
    const uid = context.auth.uid;

    if (!['accept', 'decline'].includes(decision)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid decision.');
    }

    const notifRef = db.collection('notifications').doc(notificationId);

    await db.runTransaction(async (t) => {
        const doc = await t.get(notifRef);
        if (!doc.exists) throw new functions.https.HttpsError('not-found', 'Notification not found.');

        const notif = doc.data()!;
        if (notif.toUid !== uid) throw new functions.https.HttpsError('permission-denied', 'Not your notification.');
        if (notif.status !== 'pending') throw new functions.https.HttpsError('failed-precondition', 'Already responded.');

        if (decision === 'accept') {
            // Create bi-directional friendship
            const fromUid = notif.fromUid;
            const toUid = notif.toUid; // me

            // Get usernames for snapshot
            // Optimisation: use what's in notif for sender, mine for receiver
            const [meSnap, senderSnap] = await Promise.all([
                t.get(db.collection('users').doc(toUid)),
                t.get(db.collection('users').doc(fromUid))
            ]);

            const meUsername = meSnap.data()?.username || 'Unknown';
            const senderUsername = senderSnap.data()?.username || notif.fromUsername || 'Unknown';
            const now = admin.firestore.Timestamp.now();

            // Add A->B
            t.set(db.collection('users').doc(toUid).collection('friends').doc(fromUid), {
                uid: fromUid,
                username: senderUsername,
                createdAt: now
            });
            // Add B->A
            t.set(db.collection('users').doc(fromUid).collection('friends').doc(toUid), {
                uid: toUid,
                username: meUsername,
                createdAt: now
            });

            // Mark accepted
            t.update(notifRef, { status: 'accepted' });
        } else {
            // Mark declined
            t.update(notifRef, { status: 'declined' });
        }
    });

    return { ok: true };
});

// ----------------------------------------------------------------------------
// 3. Remove Friend
// ----------------------------------------------------------------------------
export const removeFriend = functions.https.onCall(async (data: RemoveFriendData, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required.');

    const myUid = context.auth.uid;
    const { friendUid } = data;

    // Use Batch
    const batch = db.batch();

    // Delete My -> Them
    const myRef = db.collection('users').doc(myUid).collection('friends').doc(friendUid);
    batch.delete(myRef);

    // Delete Them -> Me
    const theirRef = db.collection('users').doc(friendUid).collection('friends').doc(myUid);
    batch.delete(theirRef);

    await batch.commit();

    return { ok: true };
});

// ----------------------------------------------------------------------------
// 4. Block User
// ----------------------------------------------------------------------------
export const blockUser = functions.https.onCall(async (data: BlockUserData, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required.');

    const myUid = context.auth.uid;
    const { blockedUid } = data;

    // 1. Add to Blocks
    await db.collection('users').doc(myUid).collection('blocks').doc(blockedUid).set({
        uid: blockedUid,
        createdAt: admin.firestore.Timestamp.now()
    });

    // 2. Remove Friendship if exists (call internal helper or copy logic)
    const batch = db.batch();

    // Remove friends links
    batch.delete(db.collection('users').doc(myUid).collection('friends').doc(blockedUid));
    batch.delete(db.collection('users').doc(blockedUid).collection('friends').doc(myUid));

    // 3. Cancel any pending notifications from them to me
    // (This is expensive to search, so usually we just filter on read-side, but let's try)
    const pendingFromThem = await db.collection('notifications')
        .where('fromUid', '==', blockedUid)
        .where('toUid', '==', myUid)
        .where('status', '==', 'pending')
        .get();

    pendingFromThem.forEach(doc => {
        batch.update(doc.ref, { status: 'declined' }); // or 'blocked'
    });

    await batch.commit();
    return { ok: true };
});

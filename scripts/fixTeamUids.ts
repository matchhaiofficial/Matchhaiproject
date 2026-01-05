import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../src/config/firebaseConfig';

/**
 * Script to fix existing teams that are missing the 'memberUids' array.
 * This will iterate through all teams, fetch their members, and populate 'memberUids'.
 */
async function fixTeamUids() {
    console.log('Starting team memberUids fix...');
    const teamsRef = collection(db, 'teams');
    const teamsSnap = await getDocs(teamsRef);

    for (const teamDoc of teamsSnap.docs) {
        const teamId = teamDoc.id;
        const teamData = teamDoc.data();

        if (!teamData.memberUids) {
            console.log(`Fixing team: ${teamData.name} (${teamId})`);

            // Fetch members subcollection
            const membersRef = collection(db, 'teams', teamId, 'members');
            const membersSnap = await getDocs(membersRef);
            const uids = membersSnap.docs.map(m => m.id);

            if (uids.length > 0) {
                await updateDoc(doc(db, 'teams', teamId), {
                    memberUids: uids
                });
                console.log(`Successfully added ${uids.length} UIDs to ${teamData.name}`);
            } else {
                // Fallback to captainUid if members subcollection is empty for some reason
                if (teamData.captainUid) {
                    await updateDoc(doc(db, 'teams', teamId), {
                        memberUids: [teamData.captainUid]
                    });
                    console.log(`Fallback: Added captain UID to ${teamData.name}`);
                }
            }
        }
    }
    console.log('Fix completed!');
}

// To run this, you can temporarily call fixTeamUids() in your App.js or a screen.
export default fixTeamUids;

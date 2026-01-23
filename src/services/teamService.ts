import {
    addDoc,
    arrayRemove,
    arrayUnion,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    updateDoc,
    where
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../config/firebaseConfig";
import Logger from "../utils/logger";
import { requestToJoinTeam as functionRequestToJoinTeam, deleteTeam as functionDeleteTeam } from "./functions";

export interface TeamMember {
    uid: string;
    username: string;
    role: 'captain' | 'member';
    joinedAt: any;
}

export interface Team {
    id?: string;
    name: string;
    description?: string;
    game: string; // e.g., 'cs2', 'futsal'
    logoUrl?: string;
    captainUid: string;
    captainUsername?: string;
    members?: TeamMember[];
    memberUids: string[]; // For efficient querying
    memberCount: number;
    maxMembers: number;
    visibility?: 'public' | 'private';
    createdAt: any;
    updatedAt?: any;
    stats: {
        matchesPlayed: number;
        wins: number;
        losses: number;
    };
}

const TEAMS_COLLECTION = 'teams';

export const createTeam = async (data: Omit<Team, 'id' | 'createdAt' | 'stats' | 'memberUids'>): Promise<{ ok: boolean; id?: string; message?: string }> => {
    try {
        const teamData = {
            ...data,
            memberUids: (data.members || []).map(m => m.uid),
            createdAt: serverTimestamp(),
            stats: {
                matchesPlayed: 0,
                wins: 0,
                losses: 0
            }
        };

        const docRef = await addDoc(collection(db, TEAMS_COLLECTION), teamData);
        Logger.info('teamService', 'Team created', { id: docRef.id });
        return { ok: true, id: docRef.id };
    } catch (error) {
        Logger.error('teamService', 'Error creating team', error);
        return { ok: false, message: 'Failed to create team' };
    }
};

export const getTeamById = async (id: string): Promise<{ ok: boolean; data?: Team; message?: string }> => {
    try {
        const docRef = doc(db, TEAMS_COLLECTION, id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const teamData = { id: docSnap.id, ...docSnap.data() } as Team;

            // If members array exists in main doc, use it, otherwise fetch subcollection
            if (!teamData.members || teamData.members.length === 0) {
                const membersSnap = await getDocs(collection(db, TEAMS_COLLECTION, id, 'members'));
                teamData.members = membersSnap.docs.map(d => ({ ...d.data() } as TeamMember));
            }

            return { ok: true, data: teamData };
        } else {
            return { ok: false, message: 'Team not found' };
        }
    } catch (error) {
        Logger.error('teamService', 'Error fetching team', error);
        return { ok: false, message: 'Failed to fetch team' };
    }
};

export const getUserTeams = async (uid: string): Promise<{ ok: boolean; data?: Team[]; message?: string }> => {
    try {
        const q = query(collection(db, TEAMS_COLLECTION), where('memberUids', 'array-contains', uid));
        const querySnapshot = await getDocs(q);
        const teams = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
        return { ok: true, data: teams };
    } catch (error) {
        Logger.error('teamService', 'Error fetching user teams', error);
        return { ok: false, message: 'Failed to fetch teams' };
    }
};

export const joinTeam = async (teamId: string, user: { uid: string; username: string }): Promise<{ ok: boolean; message?: string }> => {
    try {
        const teamRef = doc(db, TEAMS_COLLECTION, teamId);
        const newMember: TeamMember = {
            uid: user.uid,
            username: user.username,
            role: 'member',
            joinedAt: new Date()
        };

        await updateDoc(teamRef, {
            members: arrayUnion(newMember),
            memberUids: arrayUnion(user.uid)
        });

        return { ok: true, message: 'Joined team' };
    } catch (error) {
        Logger.error('teamService', 'Error joining team', error);
        return { ok: false, message: 'Failed to join team' };
    }
};

export const leaveTeam = async (teamId: string, uid: string): Promise<{ ok: boolean; message?: string }> => {
    try {
        const teamRef = doc(db, TEAMS_COLLECTION, teamId);
        const teamSnap = await getDoc(teamRef);

        if (!teamSnap.exists()) return { ok: false, message: 'Team not found' };

        const teamData = teamSnap.data() as Team;
        const memberToRemove = (teamData.members || []).find(m => m.uid === uid);

        if (!memberToRemove) return { ok: false, message: 'Not a member' };

        if (memberToRemove.role === 'captain') {
            return { ok: false, message: 'Captain cannot leave. Delete team or transfer ownership.' };
        }

        await updateDoc(teamRef, {
            members: arrayRemove(memberToRemove),
            memberUids: arrayRemove(uid)
        });

        return { ok: true, message: 'Left team' };
    } catch (error) {
        Logger.error('teamService', 'Error leaving team', error);
        return { ok: false, message: 'Failed to leave team' };
    }
};
// Add missing function
export const getUserTeamsForGame = async (uid: string, gameKey: string): Promise<{ ok: boolean; data?: Team[]; message?: string }> => {
    try {
        const q = query(
            collection(db, TEAMS_COLLECTION),
            where('memberUids', 'array-contains', uid),
            where('game', '==', gameKey)
        );
        const querySnapshot = await getDocs(q);
        const teams = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
        return { ok: true, data: teams };
    } catch (error) {
        Logger.error('teamService', 'Error fetching user teams for game', error);
        return { ok: false, message: 'Failed to fetch teams' };
    }
};

export interface GetPublicTeamsOptions {
    game?: string;
    searchQuery?: string;
    lastDoc?: any;
    limitCount?: number;
}

export const getPublicTeams = async (options: GetPublicTeamsOptions = {}): Promise<{ ok: boolean; data?: Team[]; lastVisible?: any; message?: string }> => {
    try {
        const { game, searchQuery, lastDoc, limitCount = 10 } = options;
        const constraints = [
            where('visibility', '==', 'public'),
        ];

        if (game && game !== 'all') {
            constraints.push(where('game', '==', game));
        }

        // Search is tricky with Firestore, but we have nameLower
        if (searchQuery) {
            const searchLower = searchQuery.toLowerCase();
            constraints.push(where('nameLower', '>=', searchLower));
            constraints.push(where('nameLower', '<=', searchLower + '\uf8ff'));
        }

        // query logic
        const { limit, orderBy, startAfter } = require('firebase/firestore');
        let q = query(
            collection(db, TEAMS_COLLECTION),
            ...constraints,
            orderBy('nameLower'),
            limit(limitCount)
        );

        if (lastDoc) {
            q = query(q, startAfter(lastDoc));
        }

        const snapshot = await getDocs(q);
        const teams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
        const lastVisible = snapshot.docs[snapshot.docs.length - 1];

        return { ok: true, data: teams, lastVisible };
    } catch (error) {
        Logger.error('teamService', 'getPublicTeams error', error);
        return { ok: false, message: 'Failed to find teams' };
    }
};

export const requestToJoinTeam = async (teamId: string) => {
    return functionRequestToJoinTeam({ teamId });
};

export const deleteTeam = async (teamId: string): Promise<{ ok: boolean; message?: string }> => {
    return functionDeleteTeam({ teamId });
};

export const updateTeamName = async (teamId: string, newName: string): Promise<{ ok: boolean; message?: string }> => {
    try {
        const nameLower = newName.trim().toLowerCase();

        // 1. Uniqueness check
        const q = query(
            collection(db, TEAMS_COLLECTION),
            where('nameLower', '==', nameLower)
        );
        const snap = await getDocs(q);

        // If name exists and it's not the current team (though usually you wouldn't rename to your own name, but good to check)
        if (!snap.empty && snap.docs[0].id !== teamId) {
            return { ok: false, message: "A team with this name already exists." };
        }

        // 2. Update doc
        const teamRef = doc(db, TEAMS_COLLECTION, teamId);
        await updateDoc(teamRef, {
            name: newName.trim(),
            nameLower,
            updatedAt: serverTimestamp()
        });

        Logger.info('teamService', 'Team name updated', { teamId, newName });
        return { ok: true };
    } catch (error: any) {
        Logger.error('teamService', 'Error updating team name', error);
        return { ok: false, message: 'Failed to update team name.' };
    }
};

export const uploadTeamLogo = async (teamId: string, imageUri: string): Promise<{ ok: boolean; url?: string; message?: string }> => {
    try {
        Logger.info('teamService', 'Starting logo upload...', { teamId });

        // 1. Fetch the blob from URI
        const response = await fetch(imageUri);
        const blob = await response.blob();

        // 2. Create storage ref
        const fileRef = ref(storage, `teams/${teamId}/logo_${Date.now()}.jpg`);

        // 3. Upload
        await uploadBytes(fileRef, blob);

        // 4. Get download URL
        const downloadUrl = await getDownloadURL(fileRef);

        // 5. Update Firestore
        const teamRef = doc(db, TEAMS_COLLECTION, teamId);
        await updateDoc(teamRef, {
            logoUrl: downloadUrl,
            updatedAt: serverTimestamp()
        });

        Logger.info('teamService', 'Logo upload complete', { teamId, downloadUrl });
        return { ok: true, url: downloadUrl };
    } catch (error: any) {
        Logger.error('teamService', 'Error uploading logo', error);
        return { ok: false, message: 'Failed to upload logo.' };
    }
};

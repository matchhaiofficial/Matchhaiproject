import { collection, deleteDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../config/firebaseConfig";
import Logger from "./logger";

export const cleanupDemoData = async (): Promise<{ ok: boolean; message: string }> => {
    try {
        let deletedUsers = 0;
        let deletedTeams = 0;

        // Delete all teams from Firestore
        const teamsSnapshot = await getDocs(collection(db, 'teams'));
        for (const doc of teamsSnapshot.docs) {
            await deleteDoc(doc.ref);
            deletedTeams++;
            Logger.info('cleanupSeeder', `Deleted team: ${doc.data().name}`);
        }

        // Delete all demo users (users with @matchhai.pk emails)
        const usersSnapshot = await getDocs(
            query(collection(db, 'users'), where('email', '>=', '@matchhai.pk'))
        );

        for (const doc of usersSnapshot.docs) {
            const email = doc.data().email;
            if (email && email.endsWith('@matchhai.pk')) {
                // Delete from Firestore
                await deleteDoc(doc.ref);
                deletedUsers++;
                Logger.info('cleanupSeeder', `Deleted user: ${email}`);
            }
        }

        return {
            ok: true,
            message: `Cleanup complete! Deleted ${deletedUsers} users and ${deletedTeams} teams.`
        };
    } catch (error) {
        Logger.error('cleanupSeeder', 'Error cleaning up data', error);
        return { ok: false, message: 'Failed to cleanup data. Check console for details.' };
    }
};

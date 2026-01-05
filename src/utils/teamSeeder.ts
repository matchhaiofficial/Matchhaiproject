import { collection, getDocs } from "firebase/firestore";
import { db } from "../config/firebaseConfig";
import { createTeam } from "../services/teamService";
import Logger from "./logger";

// Team sizes per sport
const TEAM_SIZES: Record<string, number> = {
    cs2: 5,
    fc25: 2,
    fc26: 2,
    tekken8: 2,
    futsal: 7,
    indoor_cricket: 8,
    padel: 2,
    pickleball: 2
};

// Team names per sport
const TEAM_NAMES: Record<string, string[]> = {
    cs2: ['Karachi Kings', 'DHA Dragons', 'Clifton Crushers'],
    fc25: ['Lahore Lions FC', 'Peshawar Panthers'],
    fc26: ['Islamabad United FC', 'Quetta Gladiators FC'],
    tekken8: ['Tekken Masters KHI', 'Fight Club Karachi'],
    futsal: ['Street Kings Futsal', 'Nazimabad Knights', 'Gulshan Giants'],
    indoor_cricket: ['Karachi Strikers', 'DHA Daredevils'],
    padel: ['Padel Pro Karachi', 'Clifton Smashers'],
    pickleball: ['Pickleball Pioneers', 'KHI Picklers']
};

interface UserProfile {
    uid: string;
    username: string;
    primaryGames?: string[];
}

export const seedDemoTeams = async (): Promise<{ ok: boolean; message: string }> => {
    try {
        Logger.info('teamSeeder', 'Starting team seeding...');
        // Fetch all users
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const allUsers: UserProfile[] = usersSnapshot.docs.map(doc => ({
            uid: doc.id,
            username: doc.data().username || 'Player',
            primaryGames: doc.data().primaryGames || []
        }));

        if (allUsers.length === 0) {
            Logger.warn('teamSeeder', 'No users found in Firestore');
            return { ok: false, message: 'No users found. Please seed users first.' };
        }

        Logger.info('teamSeeder', `Found ${allUsers.length} users. Starting team creation loop...`);

        let teamsCreated = 0;

        // Create 2-3 teams per sport
        for (const [game, teamNames] of Object.entries(TEAM_NAMES)) {
            Logger.info('teamSeeder', `Processing game: ${game}`);
            const teamSize = TEAM_SIZES[game];

            for (const teamName of teamNames.slice(0, 2)) { // 2 teams per sport
                // Find users who play this game
                const gamePlayers = allUsers.filter(u =>
                    u.primaryGames?.includes(game)
                );

                if (gamePlayers.length === 0) {
                    Logger.warn('teamSeeder', `No players found for ${game}`);
                    continue;
                }

                // Select captain
                const captain = gamePlayers[Math.floor(Math.random() * gamePlayers.length)];

                // Select remaining members (leave some slots open for testing)
                const slotsToFill = Math.min(
                    teamSize - 1, // -1 for captain
                    Math.floor(teamSize * 0.7), // Fill only 70% for testing
                    gamePlayers.length - 1
                );

                const members = [
                    {
                        uid: captain.uid,
                        username: captain.username,
                        role: 'captain' as const,
                        joinedAt: new Date()
                    }
                ];

                // Add other members
                const otherPlayers = gamePlayers.filter(p => p.uid !== captain.uid);
                for (let i = 0; i < slotsToFill && i < otherPlayers.length; i++) {
                    members.push({
                        uid: otherPlayers[i].uid,
                        username: otherPlayers[i].username,
                        role: 'member',
                        joinedAt: new Date()
                    } as any);
                }

                // Create team
                const result = await createTeam({
                    name: teamName,
                    description: `Competitive ${game} team based in Karachi`,
                    game,
                    captainUid: captain.uid,
                    members
                });

                if (result.ok) {
                    teamsCreated++;
                    Logger.info('teamSeeder', `Created team: ${teamName} (${members.length}/${teamSize} slots filled)`);
                }
            }
        }

        return { ok: true, message: `Demo teams seeded! Created ${teamsCreated} teams.` };
    } catch (error) {
        Logger.error('teamSeeder', 'Error seeding teams', error);
        return { ok: false, message: 'Failed to seed teams' };
    }
};

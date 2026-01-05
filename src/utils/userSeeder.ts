import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../config/firebaseConfig";
import { fetchFaceitProfileFromUrl } from "../services/faceitApi";
import Logger from "./logger";

// Realistic Pakistani usernames
const USERNAMES = [
    "AhmedCS", "FatimaGG", "UmarPro", "AyeshaPlays", "AliGaming",
    "ZainRush", "SaraStriker", "HassanAce", "MairaTop", "BilalFury",
    "HiraSquad", "UsmanKing", "NoorGamer", "FarhanElite", "NidaChamp",
    "IbrahimMVP", "ZoyaTactical", "AdnanX", "RouhiStar", "KamranBeast"
];

const GAMES = ['cs2', 'fc25', 'fc26', 'tekken8', 'futsal', 'indoor_cricket', 'padel', 'pickleball'];
const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Pro'];
const KARACHI_AREAS = ['Gulshan', 'DHA', 'Clifton', 'Saddar', 'Nazimabad', 'North Karachi', 'Malir'];

// Role options for different games
const ROLES = {
    cs2: ['Entry Fragger', 'AWPer', 'Support', 'Lurker', 'IGL'],
    futsal: ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'],
    indoor_cricket: ['Batsman', 'Bowler', 'All-rounder', 'Wicket Keeper'],
    padel: ['Aggressive / Front', 'Defensive / Back', 'Both'],
    pickleball: ['Aggressive / Front', 'Defensive / Back', 'Both']
};

interface UserSeed {
    username: string;
    email: string;
    password: string;
    primaryGames: string[];
    skillLevel: string;
    areasPreferred: string[];
    roles: Record<string, string>;
    faceitUrl?: string;
}

const SPECIFIC_USERS = [
    { username: "Junaid Zain", faceitUrl: "https://www.faceit.com/en/players/El_Shaw", cs2Role: "AWPer" },
    { username: "Saad Shayk", faceitUrl: "https://www.faceit.com/en/players/-Camavinga", cs2Role: "Entry Fragger" },
    { username: "Mubeen Ahmed", faceitUrl: "https://www.faceit.com/en/players/-Lygophle", cs2Role: "Support" },
    { username: "Atiq ur Rehman", faceitUrl: "https://www.faceit.com/en/players/Atiqvenom", cs2Role: "IGL" },
    { username: "Ehteshan Younus", faceitUrl: "https://www.faceit.com/en/players/EY_Mega", cs2Role: "Lurker" }
];

const generateUsers = (): UserSeed[] => {
    // Generate specific users first
    const specificUsers = SPECIFIC_USERS.map(user => {
        const primaryGames = ['cs2', 'fc25', 'padel']; // Ensure they play CS2
        const roles: Record<string, string> = {
            cs2Role: user.cs2Role
        };

        // Add random roles for other games
        primaryGames.forEach(game => {
            if (game !== 'cs2' && ROLES[game as keyof typeof ROLES]) {
                const gameRoles = ROLES[game as keyof typeof ROLES];
                roles[`${game}Role`] = gameRoles[Math.floor(Math.random() * gameRoles.length)];
            }
        });

        return {
            username: user.username,
            email: `${user.username.replace(/\s+/g, '').toLowerCase()}@matchhai.pk`,
            password: 'Test@123',
            primaryGames,
            skillLevel: 'Pro', // Assuming high skill for Faceit players
            areasPreferred: [KARACHI_AREAS[Math.floor(Math.random() * KARACHI_AREAS.length)]],
            roles,
            faceitUrl: user.faceitUrl
        };
    });

    // Generate random users to fill up the list (optional, keeping some randoms)
    const randomUsers = USERNAMES.slice(0, 10).map((username) => {
        const numGames = Math.floor(Math.random() * 3) + 2;
        const primaryGames = [...GAMES]
            .sort(() => 0.5 - Math.random())
            .slice(0, numGames);

        const roles: Record<string, string> = {};
        primaryGames.forEach(game => {
            if (ROLES[game as keyof typeof ROLES]) {
                const gameRoles = ROLES[game as keyof typeof ROLES];
                roles[`${game}Role`] = gameRoles[Math.floor(Math.random() * gameRoles.length)];
            }
        });

        const userSeed: any = {
            username,
            email: `${username.toLowerCase()}@matchhai.pk`,
            password: 'Test@123',
            primaryGames,
            skillLevel: SKILL_LEVELS[Math.floor(Math.random() * SKILL_LEVELS.length)],
            areasPreferred: [KARACHI_AREAS[Math.floor(Math.random() * KARACHI_AREAS.length)]],
            roles
        };

        return userSeed;
    });

    return [...specificUsers, ...randomUsers];
};

export const seedDemoUsers = async (): Promise<{ ok: boolean; message: string }> => {
    try {
        const users = generateUsers();
        let created = 0;

        for (const user of users) {
            try {
                // Fetch Faceit profile if user has faceitUrl
                let faceitElo: number | undefined;
                if (user.faceitUrl) {
                    Logger.info('userSeeder', `Fetching Faceit profile for ${user.username}...`);
                    const faceitResult = await fetchFaceitProfileFromUrl(user.faceitUrl, 'cs2');
                    if (faceitResult.ok && faceitResult.data.elo) {
                        faceitElo = faceitResult.data.elo;
                        Logger.info('userSeeder', `Fetched Faceit ELO ${faceitElo} for ${user.username}`);
                    } else {
                        Logger.warn('userSeeder', `Could not fetch Faceit ELO for ${user.username}: ${faceitResult.ok ? 'No ELO data' : faceitResult.message}`);
                    }
                }

                // Create auth user
                const userCredential = await createUserWithEmailAndPassword(
                    auth,
                    user.email,
                    user.password
                );

                // Create Firestore profile
                await setDoc(doc(db, 'users', userCredential.user.uid), {
                    username: user.username,
                    email: user.email,
                    primaryGames: user.primaryGames,
                    skillLevel: user.skillLevel,
                    areasPreferred: user.areasPreferred,
                    city: 'Karachi',
                    accountType: 'player',
                    isOnline: false,
                    createdAt: serverTimestamp(),
                    ...user.roles,
                    ...(user.faceitUrl ? { faceitProfileUrl: user.faceitUrl } : {}),
                    ...(faceitElo ? { faceitElo } : {})
                });

                created++;
                Logger.info('userSeeder', `Created user: ${user.username}`);
            } catch (error: any) {
                if (error.code === 'auth/email-already-in-use') {
                    Logger.warn('userSeeder', `User already exists: ${user.email}. Ensuring Firestore profile exists...`);

                    // Fetch Faceit profile if user has faceitUrl
                    let faceitElo: number | undefined;
                    if (user.faceitUrl) {
                        Logger.info('userSeeder', `Fetching Faceit profile for ${user.username}...`);
                        const faceitResult = await fetchFaceitProfileFromUrl(user.faceitUrl, 'cs2');
                        if (faceitResult.ok && faceitResult.data.elo) {
                            faceitElo = faceitResult.data.elo;
                            Logger.info('userSeeder', `Fetched Faceit ELO ${faceitElo} for ${user.username}`);
                        } else {
                            Logger.warn('userSeeder', `Could not fetch Faceit ELO for ${user.username}: ${faceitResult.ok ? 'No ELO data' : faceitResult.message}`);
                        }
                    }

                    try {
                        const { signInWithEmailAndPassword } = require("firebase/auth");
                        const userCredential = await signInWithEmailAndPassword(auth, user.email, user.password);

                        // Now update/set the profile
                        await setDoc(doc(db, 'users', userCredential.user.uid), {
                            username: user.username,
                            email: user.email,
                            primaryGames: user.primaryGames,
                            skillLevel: user.skillLevel,
                            areasPreferred: user.areasPreferred,
                            city: 'Karachi',
                            accountType: 'player',
                            isOnline: false,
                            createdAt: serverTimestamp(),
                            ...user.roles,
                            ...(user.faceitUrl ? { faceitProfileUrl: user.faceitUrl } : {}),
                            ...(faceitElo ? { faceitElo } : {})
                        }, { merge: true });

                        Logger.info('userSeeder', `Updated existing user profile: ${user.username}`);
                        created++; // Count as processed
                    } catch (signInError) {
                        Logger.error('userSeeder', `Could not sign in existing user ${user.email} to update profile`, signInError);
                    }

                } else {
                    Logger.error('userSeeder', `Error creating user ${user.username}`, error);
                }
            }
        }

        return {
            ok: true,
            message: `Demo users seeded! Created/Updated ${created}/${users.length} users.`
        };
    } catch (error) {
        Logger.error('userSeeder', 'Error seeding users', error);
        return {
            ok: false,
            message: 'An error occurred while seeding demo users.'
        };
    }
};

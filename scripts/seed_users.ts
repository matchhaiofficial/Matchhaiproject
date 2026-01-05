import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../src/config/firebaseConfig.js";

// Mock Logger to avoid import issues
const Logger = {
    info: (tag: string, msg: string) => console.log(`[INFO] [${tag}] ${msg}`),
    warn: (tag: string, msg: string) => console.warn(`[WARN] [${tag}] ${msg}`),
    error: (tag: string, msg: string, err?: any) => console.error(`[ERROR] [${tag}] ${msg}`, err),
};

const USERNAMES = [
    "AhmedCS", "FatimaGG", "UmarPro", "AyeshaPlays", "AliGaming",
    "ZainRush", "SaraStriker", "HassanAce", "MairaTop", "BilalFury",
    "HiraSquad", "UsmanKing", "NoorGamer", "FarhanElite", "NidaChamp",
    "IbrahimMVP", "ZoyaTactical", "AdnanX", "RouhiStar", "KamranBeast"
];

const GAMES = ['cs2', 'fc25', 'fc26', 'tekken8', 'futsal', 'indoor_cricket', 'padel', 'pickleball'];
const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Pro'];
const KARACHI_AREAS = ['Gulshan', 'DHA', 'Clifton', 'Saddar', 'Nazimabad', 'North Karachi', 'Malir'];

const ROLES = {
    cs2: ['Entry Fragger', 'AWPer', 'Support', 'Lurker', 'IGL'],
    futsal: ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'],
    indoor_cricket: ['Batsman', 'Bowler', 'All-rounder', 'Wicket Keeper'],
    padel: ['Aggressive / Front', 'Defensive / Back', 'Both'],
    pickleball: ['Aggressive / Front', 'Defensive / Back', 'Both']
};

const SPECIFIC_USERS = [
    { username: "Junaid Zain", faceitUrl: "https://www.faceit.com/en/players/El_Shaw", faceitElo: 2450, cs2Role: "AWPer" },
    { username: "Saad Shayk", faceitUrl: "https://www.faceit.com/en/players/-Camavinga", faceitElo: 2100, cs2Role: "Entry Fragger" },
    { username: "Mubeen Ahmed", faceitUrl: "https://www.faceit.com/en/players/-Lygophle", faceitElo: 1850, cs2Role: "Support" },
    { username: "Atiq ur Rehman", faceitUrl: "https://www.faceit.com/en/players/Atiqvenom", faceitElo: 1600, cs2Role: "IGL" },
    { username: "Ehteshan Younus", faceitUrl: "https://www.faceit.com/en/players/EY_Mega", faceitElo: 2800, cs2Role: "Lurker" }
];

interface UserSeed {
    username: string;
    email: string;
    password: string;
    primaryGames: string[];
    skillLevel: string;
    areasPreferred: string[];
    roles: Record<string, string>;
    faceitElo?: number;
    faceitUrl?: string;
}

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
            skillLevel: 'Pro',
            areasPreferred: [KARACHI_AREAS[Math.floor(Math.random() * KARACHI_AREAS.length)]],
            roles,
            faceitElo: user.faceitElo,
            faceitUrl: user.faceitUrl
        };
    });

    // Generate random users
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

        if (primaryGames.includes('cs2')) {
            userSeed.faceitElo = Math.floor(Math.random() * (3000 - 800) + 800);
            userSeed.faceitUrl = `https://www.faceit.com/en/players/${username}`;
        }

        return userSeed;
    });

    return [...specificUsers, ...randomUsers];
};

const seedDemoUsers = async () => {
    console.log('🌱 Starting demo data seeding...');
    try {
        const users = generateUsers();
        let created = 0;

        for (const user of users) {
            try {
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
                    ...(user.faceitElo ? { faceitElo: user.faceitElo } : {}),
                    ...(user.faceitUrl ? { faceitUrl: user.faceitUrl } : {})
                });

                created++;
                Logger.info('userSeeder', `Created user: ${user.username}`);
            } catch (error: any) {
                if (error.code === 'auth/email-already-in-use') {
                    Logger.warn('userSeeder', `User already exists: ${user.email}. Updating Firestore profile...`);
                    try {
                        const userCredential = await signInWithEmailAndPassword(auth, user.email, user.password);
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
                            ...(user.faceitElo ? { faceitElo: user.faceitElo } : {}),
                            ...(user.faceitUrl ? { faceitUrl: user.faceitUrl } : {})
                        }, { merge: true });
                        Logger.info('userSeeder', `Updated existing user profile: ${user.username}`);
                        created++;
                    } catch (signInError) {
                        Logger.error('userSeeder', `Could not sign in existing user ${user.email}`, signInError);
                    }
                } else {
                    Logger.error('userSeeder', `Error creating user ${user.username}`, error);
                }
            }
        }

        console.log(`✅ Demo users seeded! Created/Updated ${created}/${users.length} users.`);
    } catch (error) {
        console.error('❌ Error seeding users', error);
    }
};

seedDemoUsers();

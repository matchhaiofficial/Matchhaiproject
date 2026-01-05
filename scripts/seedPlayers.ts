// scripts/seedPlayers.ts
// Run with: npx ts-node scripts/seedPlayers.ts

import { initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { doc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyB57bgQdpSOk91_HjL-AJq94_n23OXvgnY",
    authDomain: "matchhai-official.firebaseapp.com",
    projectId: "matchhai-official",
    storageBucket: "matchhai-official.firebasestorage.app",
    messagingSenderId: "1015520088969",
    appId: "1:1015520088969:web:818fa68f4812ff54a60758"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const demoPlayers = [
    {
        fullName: "Mega Ahmed",
        username: "EY_Mega",
        email: "mega@matchhai.demo",
        phone: "923111111111",
        password: "Demo@123",
        areasPreferred: ["DHA Karachi", "Clifton"],
        playsCs2: true,
        cs2Role: "Entry Fragger",
        playsFc: false,
        playsTekken: false,
        faceitProfileUrl: "https://www.faceit.com/en/players/EY_Mega",
        faceitNickname: "EY_Mega",
        faceitElo: 1650,
        faceitSkillLevel: 6,
    },
    {
        fullName: "Shaw Ali",
        username: "El_Shaw",
        email: "shaw@matchhai.demo",
        phone: "923111111112",
        password: "Demo@123",
        areasPreferred: ["Gulshan-e-Iqbal", "Federal B Area"],
        playsCs2: true,
        cs2Role: "AWPer",
        playsFc: false,
        playsTekken: false,
        faceitProfileUrl: "https://www.faceit.com/en/players/El_Shaw",
        faceitNickname: "El_Shaw",
        faceitElo: 1890,
        faceitSkillLevel: 8,
    },
    {
        fullName: "Hamza Khan",
        username: "hamzzz0013",
        email: "hamzzz@matchhai.demo",
        phone: "923111111113",
        password: "Demo@123",
        areasPreferred: ["PECHS", "Bahadurabad"],
        playsCs2: true,
        cs2Role: "Support",
        playsFc: false,
        playsTekken: false,
        faceitProfileUrl: "https://www.faceit.com/en/players/hamzzz0013",
        faceitNickname: "hamzzz0013",
        faceitElo: 1420,
        faceitSkillLevel: 5,
    },
    {
        fullName: "Xanta Rious",
        username: "XantaRiousss",
        email: "xanta@matchhai.demo",
        phone: "923111111114",
        password: "Demo@123",
        areasPreferred: ["Clifton", "DHA Karachi"],
        playsCs2: true,
        cs2Role: "In-Game Leader (IGL)",
        playsFc: false,
        playsTekken: false,
        faceitProfileUrl: "https://www.faceit.com/en/players/XantaRiousss",
        faceitNickname: "XantaRiousss",
        faceitElo: 2150,
        faceitSkillLevel: 10,
    },
    {
        fullName: "Ebood Ahmed",
        username: "3b00d0",
        email: "ebood@matchhai.demo",
        phone: "923111111115",
        password: "Demo@123",
        areasPreferred: ["Gulshan-e-Iqbal", "PECHS"],
        playsCs2: true,
        cs2Role: "Entry Fragger",
        playsFc: false,
        playsTekken: false,
        faceitProfileUrl: "https://www.faceit.com/en/players/3b00d0",
        faceitNickname: "3b00d0",
        faceitElo: 1180,
        faceitSkillLevel: 3,
    },
    {
        fullName: "Faisal Khan",
        username: "FuperMan786",
        email: "fuperman@matchhai.demo",
        phone: "923111111116",
        password: "Demo@123",
        areasPreferred: ["Federal B Area", "North Nazimabad"],
        playsCs2: true,
        cs2Role: "Lurker",
        playsFc: false,
        playsTekken: false,
        faceitProfileUrl: "https://www.faceit.com/en/players/FuperMan786",
        faceitNickname: "FuperMan786",
        faceitElo: 1750,
        faceitSkillLevel: 7,
    },
    {
        fullName: "Sephiroth Ali",
        username: "Sephiroth_47",
        email: "sephiroth@matchhai.demo",
        phone: "923111111117",
        password: "Demo@123",
        areasPreferred: ["Clifton", "Gulshan-e-Iqbal"],
        playsCs2: true,
        cs2Role: "Support",
        playsFc: false,
        playsTekken: false,
        faceitProfileUrl: "https://www.faceit.com/en/players/Sephiroth_47",
        faceitNickname: "Sephiroth_47",
        faceitElo: 1580,
        faceitSkillLevel: 5,
    },
    {
        fullName: "Waseem Malik",
        username: "waseem_m321",
        email: "waseem@matchhai.demo",
        phone: "923111111118",
        password: "Demo@123",
        areasPreferred: ["PECHS", "DHA Karachi"],
        playsCs2: true,
        cs2Role: "AWPer",
        playsFc: false,
        playsTekken: false,
        faceitProfileUrl: "https://www.faceit.com/en/players/waseem_m321",
        faceitNickname: "waseem_m321",
        faceitElo: 950,
        faceitSkillLevel: 2,
    },
    {
        fullName: "Meysam Khan",
        username: "Meysamvkh",
        email: "meysam@matchhai.demo",
        phone: "923111111119",
        password: "Demo@123",
        areasPreferred: ["Bahadurabad", "Federal B Area"],
        playsCs2: true,
        cs2Role: "Entry Fragger",
        playsFc: false,
        playsTekken: false,
        faceitProfileUrl: "https://www.faceit.com/en/players/Meysamvkh",
        faceitNickname: "Meysamvkh",
        faceitElo: 1320,
        faceitSkillLevel: 4,
    },
    {
        fullName: "Damon Lee",
        username: "DamonL1",
        email: "damon@matchhai.demo",
        phone: "923111111120",
        password: "Demo@123",
        areasPreferred: ["Clifton", "PECHS"],
        playsCs2: true,
        cs2Role: "In-Game Leader (IGL)",
        playsFc: false,
        playsTekken: false,
        faceitProfileUrl: "https://www.faceit.com/en/players/DamonL1",
        faceitNickname: "DamonL1",
        faceitElo: 1850,
        faceitSkillLevel: 8,
    },
];

async function createPlayerAccount(player: typeof demoPlayers[0]) {
    try {
        // Create Firebase Auth account
        const userCredential = await createUserWithEmailAndPassword(auth, player.email, player.password);
        const uid = userCredential.user.uid;

        // Create user document in Firestore
        const userRef = doc(db, 'users', uid);
        await setDoc(userRef, {
            uid,
            email: player.email,
            fullName: player.fullName,
            username: player.username,
            usernameLower: player.username.toLowerCase(),
            phone: player.phone,
            role: 'player',

            // Onboarding Step 2: Location & Game Preferences
            areasPreferred: player.areasPreferred,
            playsCs2: player.playsCs2,
            cs2Role: player.cs2Role,
            playsFc: player.playsFc,
            fcTeam: null,
            fcFormation: null,
            playsTekken: player.playsTekken,
            tekkenFavorites: [],

            // Onboarding Step 3: Platform Links & FACEIT Data
            faceitProfileUrl: player.faceitProfileUrl,
            faceitId: uid, // Mock FACEIT ID (use UID)
            faceitNickname: player.faceitNickname,
            faceitGame: 'cs2',
            faceitElo: player.faceitElo,
            faceitSkillLevel: player.faceitSkillLevel,

            steamProfileUrl: null,
            steamId: null,
            steamPersonaName: null,
            steamCs2Hours: null,

            eaProfileUrl: null,
            xboxGamertag: null,
            psnOnlineId: null,

            onboardingStep: 3,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        console.log(`  ✅ Created player: ${player.username} (${player.fullName}) - FACEIT Level ${player.faceitSkillLevel}`);
        return uid;
    } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
            console.log(`  ⚠️  Account already exists: ${player.email}, skipping...`);
            return `existing-${player.username}`;
        }
        throw error;
    }
}

async function seedPlayers() {
    console.log('🎮 Starting to seed demo player accounts...\n');

    for (const player of demoPlayers) {
        try {
            console.log(`\n👤 Processing: ${player.username}`);
            await createPlayerAccount(player);

            // Small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error(`  ❌ Error processing ${player.username}:`, error);
        }
    }

    console.log('\n🎉 Player seeding complete!');
    console.log('\n📋 Player Login Credentials:');
    console.log('Password for all accounts: Demo@123\n');
    demoPlayers.forEach(player => {
        console.log(`${player.username} (FACEIT Lvl ${player.faceitSkillLevel}): ${player.email}`);
    });

    process.exit(0);
}

seedPlayers().catch(console.error);

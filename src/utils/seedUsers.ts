import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../config/firebaseConfig";

const USERS_TO_SEED = [
    {
        fullName: "Junaid Zain",
        username: "El_Shaw",
        email: "junaid@test.com",
        phone: "03001234567",
        faceitUrl: "https://www.faceit.com/en/players/El_Shaw",
        faceitNickname: "El_Shaw",
        faceitId: "el_shaw_id_1",
        faceitElo: 2100,
        faceitLevel: 10,
        city: "Karachi",
        cs2Role: "Rifler",
        // Multi-game fields
        playsFc: true,
        fcTeam: "Real Madrid",
        fcFormation: "4-3-3",
        playsTekken: false,
        playsFutsal: true,
        futsalPosition: "Striker",
    },
    {
        fullName: "Saad Shayk",
        username: "Camavinga",
        email: "saad@test.com",
        phone: "03001234568",
        faceitUrl: "https://www.faceit.com/en/players/-Camavinga",
        faceitNickname: "-Camavinga",
        faceitId: "camavinga_id_2",
        faceitElo: 1850,
        faceitLevel: 9,
        city: "Lahore",
        cs2Role: "AW Per",
        // Multi-game fields
        playsFc: false,
        playsTekken: true,
        tekkenFavorites: ["Jin", "Kazuya"],
        playsIndoorCricket: true,
        indoorCricketRole: "All Rounder",
    },
    {
        fullName: "Mubeen Ahmed",
        username: "Lygophle",
        email: "mubeen@test.com",
        phone: "03001234569",
        faceitUrl: "https://www.faceit.com/en/players/-Lygophle",
        faceitNickname: "-Lygophle",
        faceitId: "lygophle_id_3",
        faceitElo: 1500,
        faceitLevel: 6,
        city: "Islamabad",
        cs2Role: "Entry Fragger",
        // Multi-game fields
        playsFc: true,
        fcTeam: "Man City",
        fcFormation: "4-4-2",
        playsPadel: true,
        padelRole: "Left Side",
    },
    {
        fullName: "Atiq ur Rehman",
        username: "Atiqvenom",
        email: "atiq@test.com",
        phone: "03001234570",
        faceitUrl: "https://www.faceit.com/en/players/Atiqvenom",
        faceitNickname: "Atiqvenom",
        faceitId: "atiqvenom_id_4",
        faceitElo: 1200,
        faceitLevel: 4,
        city: "Karachi",
        cs2Role: "Support",
        // Multi-game fields
        playsIndoorCricket: true,
        indoorCricketRole: "Bowler",
        indoorCricketBowlingStyle: "Fast",
    },
    {
        fullName: "Ehtesham Younus",
        username: "EY_Mega",
        email: "ehtesham@test.com",
        phone: "03001234571",
        faceitUrl: "https://www.faceit.com/en/players/EY_Mega",
        faceitNickname: "EY_Mega",
        faceitId: "ey_mega_id_5",
        faceitElo: 2400,
        faceitLevel: 10,
        city: "Karachi",
        cs2Role: "IGL",
        // Multi-game fields
        playsTekken: true,
        tekkenFavorites: ["King", "Paul"],
        playsFutsal: true,
        futsalPosition: "Goalkeeper",
    },
];

export const seedUsers = async () => {
    console.log("🌱 Starting expanded seed process...");
    let successCount = 0;

    for (const user of USERS_TO_SEED) {
        try {
            console.log(`Processing ${user.username}...`);

            // 1. Create Auth User (or sign in if exists to update profile)
            let userCredential;
            try {
                userCredential = await createUserWithEmailAndPassword(auth, user.email, "Password123!");
                console.log(`  Created auth account for ${user.email}`);
            } catch (error: any) {
                if (error.code === 'auth/email-already-in-use') {
                    console.log(`  User ${user.email} already exists, signing in...`);
                    userCredential = await signInWithEmailAndPassword(auth, user.email, "Password123!");
                } else {
                    throw error;
                }
            }

            const { uid } = userCredential.user;

            // 2. Update Auth Profile
            await updateProfile(userCredential.user, {
                displayName: user.fullName,
            });

            // 3. Create/Overwrite Firestore Doc
            const userDocRef = doc(db, "users", uid);

            const userData: any = {
                fullName: user.fullName,
                username: user.username,
                usernameLower: user.username.toLowerCase(),
                email: user.email,
                phone: user.phone,
                city: user.city,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                accountType: "player",

                // Construct primaryGames array
                primaryGames: [
                    user.cs2Role ? 'cs2' : null,
                    user.playsFc ? 'fc25' : null,
                    user.playsTekken ? 'tekken8' : null,
                    user.playsFutsal ? 'futsal' : null,
                    user.playsIndoorCricket ? 'indoor_cricket' : null,
                    user.playsPadel ? 'padel' : null,
                ].filter(Boolean),

                // Onboarding Step 2 Defaults
                areasPreferred: [],
                playsCs2: true,
                cs2Role: user.cs2Role,

                // Multi-game expansion
                playsFc: !!user.playsFc,
                fcTeam: user.fcTeam || null,
                fcFormation: user.fcFormation || null,

                playsTekken: !!user.playsTekken,
                tekkenFavorites: user.tekkenFavorites || [],

                playsFutsal: !!user.playsFutsal,
                futsalPosition: user.futsalPosition || null,

                playsIndoorCricket: !!user.playsIndoorCricket,
                indoorCricketRole: user.indoorCricketRole || null,
                indoorCricketBowlingStyle: user.indoorCricketBowlingStyle || null,

                playsPadel: !!user.playsPadel,
                padelRole: user.padelRole || null,

                // Onboarding Step 3 (Faceit Verified)
                faceitProfileUrl: user.faceitUrl,
                faceitId: user.faceitId,
                faceitNickname: user.faceitNickname,
                faceitElo: user.faceitElo,
                faceitSkillLevel: user.faceitLevel,
                faceitGame: "cs2",

                onboardingStep: 4, // Completed
            };

            await setDoc(userDocRef, userData, { merge: true });
            console.log(`  ✅ Successfully seeded ${user.username}`);
            successCount++;

            // Sign out to prepare for next user
            await signOut(auth);

        } catch (error) {
            console.error(`  ❌ Failed to seed ${user.username}:`, error);
        }
    }

    console.log(`🌱 Seed process finished. ${successCount}/${USERS_TO_SEED.length} users seeded.`);
    alert(`Seeding complete! ${successCount} users updated with multi-game profiles.`);
};

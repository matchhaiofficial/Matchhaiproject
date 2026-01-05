import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from "firebase/auth";
import { auth } from "../config/firebaseConfig";
import { saveZoneRegistration, ZoneRegistrationSteps } from "../services/zoneService";
import { BranchData } from "../store/zoneOnboardingStore";

// Helper to create a branch object
const createBranch = (
    id: string,
    name: string,
    city: string,
    area: string,
    type: 'gaming' | 'sports' | 'hybrid',
    details: Partial<BranchData>
): BranchData => {
    const base: BranchData = {
        id,
        branchDisplayName: name,
        city,
        areaLabel: area,
        addressLine1: `${name}, ${area}, ${city}`,
        googleMapsUrl: "https://maps.google.com",
        contactPhone: "03001234567",

        supportsCs2: false,
        supportsFc25: false,
        supportsTekken8: false,
        supportsFutsal: false,
        supportsIndoorCricket: false,
        supportsPadel: false,
        supportsPickleball: false,

        pricing: {
            pc: undefined,
            console: undefined,
            futsal: undefined,
            indoor_cricket: undefined,
            padel: undefined,
            pickleball: undefined,
        },
        notes: "Seeded branch",
        ...details
    };
    return base;
};

const ZONES_TO_SEED = [
    // --- 5 GAMING ZONES ---
    {
        ownerName: "Ali Khan",
        brandName: "O2 Esports",
        email: "o2owner@test.com",
        phone: "03001111111",
        type: "gaming",
        branches: [
            createBranch("b1", "O2 Clifton", "Karachi", "Clifton", "gaming", {
                supportsCs2: true, supportsFc25: true, supportsTekken8: true,
                pricing: {
                    pc: {
                        premium: { count: "20", price: "300" },
                        elite: { count: "10", price: "500" }
                    },
                    console: {
                        ps5: { count: "5", price1v1: "400", price2v2: "600" }
                    }
                }
            }),
            createBranch("b2", "O2 Gulshan", "Karachi", "Gulshan-e-Iqbal", "gaming", {
                supportsCs2: true,
                pricing: {
                    pc: { regular: { count: "30", price: "200" } }
                }
            })
        ]
    },
    {
        ownerName: "Bilal Ahmed",
        brandName: "Portal Gaming",
        email: "portal@test.com",
        phone: "03002222222",
        type: "gaming",
        branches: [
            createBranch("b3", "Portal DHA", "Karachi", "DHA Phase 6", "gaming", {
                supportsCs2: true, supportsFc25: true,
                pricing: {
                    pc: { elite: { count: "40", price: "400" } },
                    console: { ps5: { count: "10", price1v1: "500", price2v2: "800" } }
                }
            }),
            createBranch("b4", "Portal North", "Karachi", "North Nazimabad", "gaming", {
                supportsCs2: true,
                pricing: { pc: { regular: { count: "20", price: "150" } } }
            })
        ]
    },
    {
        ownerName: "Charlie Davis",
        brandName: "Glitch Arena",
        email: "glitch@test.com",
        phone: "03003333333",
        type: "gaming",
        branches: [
            createBranch("b5", "Glitch Johar", "Karachi", "Gulistan-e-Johar", "gaming", {
                supportsFc25: true, supportsTekken8: true,
                pricing: {
                    console: { ps5: { count: "15", price1v1: "300", price2v2: "500" } }
                }
            })
        ]
    },
    {
        ownerName: "Danish Taimoor",
        brandName: "Velocity Esports",
        email: "velocity@test.com",
        phone: "03004444444",
        type: "gaming",
        branches: [
            createBranch("b6", "Velocity Malir", "Karachi", "Malir Cantt", "gaming", {
                supportsCs2: true, supportsFc25: true,
                pricing: {
                    pc: { regular: { count: "15", price: "100" } },
                    console: { ps5: { count: "4", price1v1: "250", price2v2: "400" } }
                }
            })
        ]
    },
    {
        ownerName: "Ehab Khan",
        brandName: "Titan Gaming",
        email: "titan@test.com",
        phone: "03005555555",
        type: "gaming",
        branches: [
            createBranch("b7", "Titan Bahria", "Karachi", "Bahria Town", "gaming", {
                supportsCs2: true, supportsTekken8: true,
                pricing: {
                    pc: { elite: { count: "50", price: "600" } },
                    console: { ps5: { count: "8", price1v1: "600", price2v2: "900" } }
                }
            })
        ]
    },

    // --- 5 SPORTS COURTS ---
    {
        ownerName: "Fahad Mustafa",
        brandName: "Total Football",
        email: "tf@test.com",
        phone: "03006666666",
        type: "sports",
        branches: [
            createBranch("b8", "TF Ayub Park", "Islamabad", "Ayub Park", "sports", {
                supportsFutsal: true,
                pricing: { futsal: { "Standard": { count: "3", price: "4000" } } }
            }),
            createBranch("b9", "TF DHA", "Islamabad", "DHA Phase 2", "sports", {
                supportsFutsal: true,
                pricing: { futsal: { "Turf A": { count: "2", price: "5000" } } }
            })
        ]
    },
    {
        ownerName: "Gohar Rasheed",
        brandName: "Smash Padel",
        email: "smash@test.com",
        phone: "03007777777",
        type: "sports",
        branches: [
            createBranch("b10", "Smash Zamzama", "Karachi", "Zamzama", "sports", {
                supportsPadel: true,
                pricing: { padel: { "Blue Court": { count: "2", price: "6000" } } }
            })
        ]
    },
    {
        ownerName: "Hamza Ali",
        brandName: "Legends Arena",
        email: "legends@test.com",
        phone: "03008888888",
        type: "sports",
        branches: [
            createBranch("b11", "Legends KDA", "Karachi", "KDA Scheme 1", "sports", {
                supportsFutsal: true, supportsIndoorCricket: true, supportsPadel: true,
                pricing: {
                    futsal: { "5v5": { count: "2", price: "3500" } },
                    indoor_cricket: { "Net A": { count: "3", price: "2000" } },
                    padel: { "Standard": { count: "1", price: "5000" } }
                }
            })
        ]
    },
    {
        ownerName: "Imran Abbas",
        brandName: "Strike Zone",
        email: "strike@test.com",
        phone: "03009999999",
        type: "sports",
        branches: [
            createBranch("b12", "Strike Gulshan", "Karachi", "Gulshan-e-Iqbal", "sports", {
                supportsIndoorCricket: true,
                pricing: { indoor_cricket: { "Pro Pitch": { count: "4", price: "2500" } } }
            })
        ]
    },
    {
        ownerName: "Javed Sheikh",
        brandName: "The Cage",
        email: "cage@test.com",
        phone: "03000000010",
        type: "sports",
        branches: [
            createBranch("b13", "Cage Askari", "Karachi", "Askari 4", "sports", {
                supportsFutsal: true, supportsIndoorCricket: true,
                pricing: {
                    futsal: { "Cage": { count: "1", price: "3000" } },
                    indoor_cricket: { "Concrete": { count: "1", price: "1500" } }
                }
            })
        ]
    }
];

export const seedZones = async () => {
    console.log("🌱 Starting Zone & Court seed process...");
    let successCount = 0;

    for (const zone of ZONES_TO_SEED) {
        try {
            console.log(`Processing Zone: ${zone.brandName}...`);

            // 1. Create/Auth User
            let userCredential;
            try {
                userCredential = await createUserWithEmailAndPassword(auth, zone.email, "Password123!");
                console.log(`  Created admin account for ${zone.email}`);
            } catch (error: any) {
                if (error.code === 'auth/email-already-in-use') {
                    console.log(`  User ${zone.email} already exists, signing in...`);
                    userCredential = await signInWithEmailAndPassword(auth, zone.email, "Password123!");
                } else {
                    throw error;
                }
            }

            // 2. Update Profile
            await updateProfile(userCredential.user, { displayName: zone.ownerName });

            // 3. Construct Data Packet
            const registrationData: ZoneRegistrationSteps = {
                step1: {
                    ownerFullName: zone.ownerName,
                    venueBrandName: zone.brandName,
                    contactEmail: zone.email,
                    contactPhone: zone.phone,
                    password: "Password123!",
                    type: zone.type as any,
                },
                branches: zone.branches,
            };

            // 4. Save to Firestore via Service
            const result = await saveZoneRegistration(registrationData);

            if (result.ok) {
                console.log(`  ✅ Successfully seeded ${zone.brandName}`);
                successCount++;
            } else {
                console.error(`  ❌ Failed logic for ${zone.brandName}: ${result.message}`);
            }

            // Sign out
            await signOut(auth);

        } catch (error) {
            console.error(`  ❌ Failed to seed ${zone.brandName}:`, error);
        }
    }

    console.log(`🌱 Seed process finished. ${successCount}/${ZONES_TO_SEED.length} zones seeded.`);
    alert(`Seeding complete! ${successCount} zones/courts created.`);
    return { successCount };
};

// scripts/seedZones.ts
// Run with: npx ts-node scripts/seedZones.ts

import { initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { addDoc, collection, doc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';

// Firebase config (use your actual config)
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

const demoZones = [
  {
    venueBrandName: "Gaming Nexus",
    ownerFullName: "Ahmed Khan",
    contactEmail: "gamingnexus@matchhai.demo",
    contactPhone: "923001234567",
    password: "Demo@123",
    city: "Karachi",
    areaLabel: "Gulshan-e-Iqbal",
    addressLine1: "PLOT G-P-C, next to MAK coaching, Block 1",
    googleMapsUrl: "https://maps.google.com",
    supportsCs2: true,
    supportsFc25: true,
    supportsTekken8: true,
    pcSeats: "20",
    consoleSeats: "10",
    consolePlatform: "PS5",
    hourlyRate: 150,
  },
  {
    venueBrandName: "DEVILIAN'Z PRIME HUB",
    ownerFullName: "Hassan Ali",
    contactEmail: "devilianzhub@matchhai.demo",
    contactPhone: "923001234568",
    password: "Demo@123",
    city: "Karachi",
    areaLabel: "North Nazimabad",
    addressLine1: "plot sc12, al hafiz paride, Five star, main food steet, Block L",
    googleMapsUrl: "https://maps.google.com",
    supportsCs2: true,
    supportsFc25: true,
    supportsTekken8: true,
    pcSeats: "25",
    consoleSeats: "8",
    consolePlatform: "PS5",
    hourlyRate: 120,
  },
  {
    venueBrandName: "Battle Hub",
    ownerFullName: "Fahad Sheikh",
    contactEmail: "battlehub@matchhai.demo",
    contactPhone: "923001234569",
    password: "Demo@123",
    city: "Karachi",
    areaLabel: "DHA Karachi",
    addressLine1: "21 e South Park Avenue, Phase II Extension Phase 2 Commercial Area",
    googleMapsUrl: "https://maps.google.com",
    supportsCs2: true,
    supportsFc25: true,
    supportsTekken8: true,
    pcSeats: "30",
    consoleSeats: "12",
    consolePlatform: "PS5",
    hourlyRate: 200,
  },
  {
    venueBrandName: "ROG",
    ownerFullName: "Imran Malik",
    contactEmail: "rog@matchhai.demo",
    contactPhone: "923001234570",
    password: "Demo@123",
    city: "Karachi",
    areaLabel: "Bahadurabad",
    addressLine1: "2nd Floor, Jan Centre, Main",
    googleMapsUrl: "https://maps.google.com",
    supportsCs2: true,
    supportsFc25: true,
    supportsTekken8: true,
    pcSeats: "18",
    consoleSeats: "6",
    consolePlatform: "PS5",
    hourlyRate: 180,
  },
  {
    venueBrandName: "Cyber Xtreme Gaming Arena",
    ownerFullName: "Zain Abbas",
    contactEmail: "cyberxtreme@matchhai.demo",
    contactPhone: "923001234571",
    password: "Demo@123",
    city: "Karachi",
    areaLabel: "PECHS",
    addressLine1: "106/K Khalid Bin Walid Rd, Block 2",
    googleMapsUrl: "https://maps.google.com",
    supportsCs2: true,
    supportsFc25: true,
    supportsTekken8: true,
    pcSeats: "22",
    consoleSeats: "10",
    consolePlatform: "PS5",
    hourlyRate: 100,
  },
  {
    venueBrandName: "Arcadium",
    ownerFullName: "Bilal Hussain",
    contactEmail: "arcadium@matchhai.demo",
    contactPhone: "923001234572",
    password: "Demo@123",
    city: "Karachi",
    areaLabel: "Gulshan-e-Iqbal",
    addressLine1: "Office # M-1, Farhan Tower, Block 10-A Block 10 A",
    googleMapsUrl: "https://maps.google.com",
    supportsCs2: true,
    supportsFc25: true,
    supportsTekken8: true,
    pcSeats: "28",
    consoleSeats: "8",
    consolePlatform: "PS5",
    hourlyRate: 140,
  },
  {
    venueBrandName: "O2 Esports",
    ownerFullName: "Usman Ahmad",
    contactEmail: "o2esports@matchhai.demo",
    contactPhone: "923001234573",
    password: "Demo@123",
    city: "Karachi",
    areaLabel: "Federal B Area",
    addressLine1: "Plot BS, 17, Dastagir Block 7 Gulberg Town",
    googleMapsUrl: "https://maps.google.com",
    supportsCs2: true,
    supportsFc25: true,
    supportsTekken8: true,
    pcSeats: "24",
    consoleSeats: "10",
    consolePlatform: "PS5",
    hourlyRate: 110,
  },
  {
    venueBrandName: "Elite eSports & Gaming Lounge",
    ownerFullName: "Saad Raza",
    contactEmail: "eliteesports@matchhai.demo",
    contactPhone: "923001234574",
    password: "Demo@123",
    city: "Karachi",
    areaLabel: "Clifton",
    addressLine1: "2nd Floor, Near Bounce, Ocean Towers, Block 9",
    googleMapsUrl: "https://maps.google.com",
    supportsCs2: true,
    supportsFc25: true,
    supportsTekken8: true,
    pcSeats: "26",
    consoleSeats: "12",
    consolePlatform: "PS5",
    hourlyRate: 250,
  },
  {
    venueBrandName: "Headshot",
    ownerFullName: "Omer Farooq",
    contactEmail: "headshot@matchhai.demo",
    contactPhone: "923001234575",
    password: "Demo@123",
    city: "Karachi",
    areaLabel: "PECHS",
    addressLine1: "W4Q3+42H, Abul Hasan Isphahani Rd, Block 4 Commissioner Society",
    googleMapsUrl: "https://maps.google.com",
    supportsCs2: true,
    supportsFc25: true,
    supportsTekken8: true,
    pcSeats: "20",
    consoleSeats: "8",
    consolePlatform: "PS5",
    hourlyRate: 130,
  },
  {
    venueBrandName: "Nuke Town",
    ownerFullName: "Hamza Siddiqui",
    contactEmail: "nuketown@matchhai.demo",
    contactPhone: "923001234576",
    password: "Demo@123",
    city: "Karachi",
    areaLabel: "PECHS",
    addressLine1: "V3C5+WWH, Dupatta Gali, Block 2",
    googleMapsUrl: "https://maps.google.com",
    supportsCs2: true,
    supportsFc25: true,
    supportsTekken8: true,
    pcSeats: "32",
    consoleSeats: "14",
    consolePlatform: "PS5",
    hourlyRate: 150,
  },
];

function toIntOrNull(value: string): number | null {
  if (!value) return null;
  const n = parseInt(value.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

async function createAdminAccount(email: string, password: string, fullName: string, phone: string) {
  try {
    // Create Firebase Auth account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    // Create user document in Firestore
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
      uid,
      email,
      fullName,
      username: email.split('@')[0],
      usernameLower: email.split('@')[0].toLowerCase(),
      phone,
      role: 'zone-admin',
      onboardingStep: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    console.log(`  👤 Created admin account: ${email} (${fullName})`);
    return uid;
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      console.log(`  ⚠️  Account already exists: ${email}, skipping...`);
      // Try to get existing UID - for demo purposes, we'll generate a consistent one
      return `existing-${email.split('@')[0]}`;
    }
    throw error;
  }
}

async function seedZones() {
  console.log('🎮 Starting to seed demo zones with real admin accounts...\n');

  for (const zone of demoZones) {
    try {
      console.log(`\n📍 Processing: ${zone.venueBrandName}`);

      // Step 1: Create admin account
      const adminUid = await createAdminAccount(
        zone.contactEmail,
        zone.password,
        zone.ownerFullName,
        zone.contactPhone
      );

      // Step 2: Create zone document
      const zonesRef = collection(db, 'zones');
      const docBody = {
        ownerUid: adminUid,
        ownerFullName: zone.ownerFullName,
        venueBrandName: zone.venueBrandName,
        contactEmail: zone.contactEmail,
        contactPhone: zone.contactPhone,

        status: 'active' as const,
        onboardingStep: 4,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),

        primaryBranch: {
          branchDisplayName: zone.venueBrandName,
          city: zone.city,
          areaLabel: zone.areaLabel,
          addressLine1: zone.addressLine1,
          googleMapsUrl: zone.googleMapsUrl,
        },

        games: {
          supportsCs2: zone.supportsCs2 || false,
          supportsFc25: zone.supportsFc25 || false,
          supportsTekken8: zone.supportsTekken8 || false,
          supportsFutsal: false,
          supportsIndoorCricket: false,
          supportsPadel: false,
          supportsPickleball: false,
        },

        capacity: {
          pcSeats: toIntOrNull(zone.pcSeats),
          consoleSeats: toIntOrNull(zone.consoleSeats),
          consolePlatform: zone.consolePlatform || null,
          futsalCourts: null,
          futsalCourtType: null,
          indoorCricketNets: null,
          indoorCricketSurface: null,
          padelCourts: null,
          padelCourtSurface: null,
          pickleballCourts: null,
          pickleballSurface: null,
        },

        hourlyRate: zone.hourlyRate, // Added hourly rate

        notes: '24/7 gaming zone - Demo data for testing',
      };

      const docRef = await addDoc(zonesRef, docBody);
      console.log(`  ✅ Zone created: ${zone.venueBrandName} (${zone.areaLabel}) - ID: ${docRef.id}`);

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`  ❌ Error processing ${zone.venueBrandName}:`, error);
    }
  }

  console.log('\n🎉 Zone seeding complete!');
  console.log('\n📋 Admin Login Credentials:');
  console.log('Password for all accounts: Demo@123\n');
  demoZones.forEach(zone => {
    console.log(`${zone.venueBrandName}: ${zone.contactEmail}`);
  });

  process.exit(0);
}

seedZones().catch(console.error);

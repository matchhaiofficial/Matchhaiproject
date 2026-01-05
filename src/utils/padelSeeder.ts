// src/utils/padelSeeder.ts
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

const KARACHI_AREAS = [
    'DHA Phase 6',
    'Clifton Block 2',
    'Gulistan-e-Jauhar Block 15',
    'Bahria Town Karachi',
    'PECHS Block 6',
    'Defence View',
    'Malir Cantt',
    'North Nazimabad Block H',
    'Gulshan-e-Iqbal Block 13',
    'Scheme 33',
];

const VENUE_NAMES = [
    'Ace Padel Club',
    'Court Kings Padel',
    'Karachi Padel Academy',
    'Premier Padel Arena',
    'Smash Zone Padel',
    'Elite Padel Courts',
    'Victory Padel Sports',
    'Champions Padel Club',
    'Dynamic Padel Arena',
    'ProPadel Karachi',
];

const SURFACES = ['blue-turf', 'red-turf', 'green-turf', 'indoor'];

interface PadelZone {
    ownerFullName: string;
    venueBrandName: string;
    contactEmail: string;
    contactPhone: string;
    status: 'active';
    onboardingStep: number;
    primaryBranch: {
        branchDisplayName: string | null;
        city: string;
        areaLabel: string;
        addressLine1: string;
        googleMapsUrl: string | null;
    };
    games: {
        supportsCs2: boolean;
        supportsFc25: boolean;
        supportsTekken8: boolean;
        supportsFutsal: boolean;
        supportsIndoorCricket: boolean;
        supportsPadel: boolean;
        supportsPickleball: boolean;
    };
    capacity: {
        pcSeats: number | null;
        consoleSeats: number | null;
        consolePlatform: string | null;
        futsalCourts: number | null;
        futsalCourtType: string | null;
        indoorCricketNets: number | null;
        indoorCricketSurface: string | null;
        padelCourts: number;
        padelCourtSurface: string;
        pickleballCourts: number | null;
        pickleballSurface: string | null;
    };
    hourlyRate: number;
    notes: string | null;
    createdAt: any;
    updatedAt: any;
}

export async function seedPadelZones(): Promise<{ ok: boolean; message: string }> {
    try {
        console.log('[padelSeeder] Starting to seed padel zones');

        const zonesRef = collection(db, 'zones');
        const zonesToCreate: PadelZone[] = [];

        // Create 10 padel zones, each in a different Karachi area
        for (let i = 0; i < 10; i++) {
            const area = KARACHI_AREAS[i];
            const venueName = VENUE_NAMES[i];
            const surface = SURFACES[i % SURFACES.length];
            const courts = 2 + (i % 3); // 2, 3, or 4 courts per venue
            const hourlyRate = 3000 + (i % 3) * 500; // 3000, 3500, or 4000

            const zone: PadelZone = {
                ownerFullName: `${venueName} Admin`,
                venueBrandName: venueName,
                contactEmail: `admin@${venueName.toLowerCase().replace(/\s+/g, '')}.com`,
                contactPhone: `+92300${String(2000000 + i).padStart(7, '0')}`,
                status: 'active',
                onboardingStep: 4,
                primaryBranch: {
                    branchDisplayName: `${venueName} - ${area}`,
                    city: 'Karachi',
                    areaLabel: area,
                    addressLine1: `${venueName}, ${area}, Karachi`,
                    googleMapsUrl: null,
                },
                games: {
                    supportsCs2: false,
                    supportsFc25: false,
                    supportsTekken8: false,
                    supportsFutsal: false,
                    supportsIndoorCricket: false,
                    supportsPadel: true,
                    supportsPickleball: false,
                },
                capacity: {
                    pcSeats: null,
                    consoleSeats: null,
                    consolePlatform: null,
                    futsalCourts: null,
                    futsalCourtType: null,
                    indoorCricketNets: null,
                    indoorCricketSurface: null,
                    padelCourts: courts,
                    padelCourtSurface: surface,
                    pickleballCourts: null,
                    pickleballSurface: null,
                },
                hourlyRate: hourlyRate,
                notes: `Padel facility with ${courts} courts on ${surface} surface`,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            zonesToCreate.push(zone);
        }

        // Add all zones to Firestore
        for (const zone of zonesToCreate) {
            await addDoc(zonesRef, zone);
            console.log(`[padelSeeder] Created zone: ${zone.venueBrandName} in ${zone.primaryBranch.areaLabel}`);
        }

        console.log(`[padelSeeder] Successfully seeded ${zonesToCreate.length} padel zones`);
        return { ok: true, message: `Successfully seeded ${zonesToCreate.length} padel zones` };
    } catch (error) {
        console.error('[padelSeeder] Error seeding padel zones', error);
        return { ok: false, message: 'Failed to seed padel zones: ' + (error as any).message };
    }
}

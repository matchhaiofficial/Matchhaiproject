// src/utils/pickleballSeeder.ts
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

const KARACHI_AREAS = [
    'DHA Phase 6',
    'Clifton Block 4',
    'Gulshan-e-Iqbal Block 13-D',
    'North Nazimabad Block H',
    'PECHS Block 2',
    'Gulistan-e-Jauhar Block 15',
    'Malir Cantt',
    'KDA Scheme 1',
    'DHA Phase 8',
    'Bahadurabad',
];

const VENUE_NAMES = [
    'Pickleball Paradise',
    'Smash Point Pickleball',
    'Karachi Pickleball Club',
    'Elite Pickleball Arena',
    'Dink & Drive Sports',
    'Victory Pickleball Courts',
    'Pro Pickleball Center',
    'Urban Pickleball Zone',
    'Legends Pickleball',
    'Ace Pickleball Academy',
];

const SURFACES = [
    'acrylic-hard',
    'concrete-acrylic',
    'asphalt-acrylic',
    'indoor-wood',
    'multi-sport'
];

interface PickleballZone {
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
        padelCourts: number | null;
        padelCourtSurface: string | null;
        pickleballCourts: number;
        pickleballSurface: string;
    };
    hourlyRate: number;
    notes: string | null;
    createdAt: any;
    updatedAt: any;
}

export async function seedPickleballZones(): Promise<{ ok: boolean; message: string }> {
    try {
        console.log('[pickleballSeeder] Starting to seed pickleball zones');

        const zonesRef = collection(db, 'zones');
        const zonesToCreate: PickleballZone[] = [];

        // Create 10 pickleball zones, each in a different Karachi area
        for (let i = 0; i < 10; i++) {
            const area = KARACHI_AREAS[i];
            const venueName = VENUE_NAMES[i];
            const surface = SURFACES[i % SURFACES.length];
            const courts = 2 + (i % 4); // 2, 3, 4, or 5 courts per venue
            const hourlyRate = 2000 + (i % 3) * 500; // 2000, 2500, or 3000

            const zone: PickleballZone = {
                ownerFullName: `${venueName} Admin`,
                venueBrandName: venueName,
                contactEmail: `admin@${venueName.toLowerCase().replace(/\s+/g, '')}.com`,
                contactPhone: `+92300${String(3000000 + i).padStart(7, '0')}`,
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
                    supportsPadel: false,
                    supportsPickleball: true,
                },
                capacity: {
                    pcSeats: null,
                    consoleSeats: null,
                    consolePlatform: null,
                    futsalCourts: null,
                    futsalCourtType: null,
                    indoorCricketNets: null,
                    indoorCricketSurface: null,
                    padelCourts: null,
                    padelCourtSurface: null,
                    pickleballCourts: courts,
                    pickleballSurface: surface,
                },
                hourlyRate: hourlyRate,
                notes: `Pickleball facility with ${courts} courts on ${surface} surface`,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            zonesToCreate.push(zone);
        }

        // Add all zones to Firestore
        for (const zone of zonesToCreate) {
            await addDoc(zonesRef, zone);
            console.log(`[pickleballSeeder] Created zone: ${zone.venueBrandName} in ${zone.primaryBranch.areaLabel}`);
        }

        console.log(`[pickleballSeeder] Successfully seeded ${zonesToCreate.length} pickleball zones`);
        return { ok: true, message: `Successfully seeded ${zonesToCreate.length} pickleball zones` };
    } catch (error) {
        console.error('[pickleballSeeder] Error seeding pickleball zones', error);
        return { ok: false, message: 'Failed to seed pickleball zones: ' + (error as any).message };
    }
}

// src/utils/indoorCricketSeeder.ts
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

const KARACHI_AREAS = [
    'DHA Phase 2',
    'Clifton',
    'Gulshan-e-Iqbal',
    'North Nazimabad',
    'Korangi',
    'Malir',
    'Bahria Town',
    'Gulistan-e-Jauhar',
    'PECHS',
    'Saddar',
];

const VENUE_NAMES = [
    'Strike Zone Cricket Academy',
    'Power Play Indoor Arena',
    'Boundary Masters Cricket',
    'Wicket Warriors Academy',
    'Century Sports Complex',
    'Thunder Cricket Arena',
    'Karachi Cricket Hub',
    'Elite Indoor Cricket',
    'Champions Cricket Academy',
    'Victory Indoor Nets',
];

const SURFACES = ['belgian-turf', 'blue-multipurpose'];

interface IndoorCricketZone {
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
        indoorCricketNets: number;
        indoorCricketSurface: string;
        padelCourts: number | null;
        padelCourtSurface: string | null;
        pickleballCourts: number | null;
        pickleballSurface: string | null;
    };
    hourlyRate: number;
    notes: string | null;
    createdAt: any;
    updatedAt: any;
}

export async function seedIndoorCricketZones(): Promise<{ ok: boolean; message: string }> {
    try {
        console.log('[indoorCricketSeeder] Starting to seed indoor cricket zones');

        const zonesRef = collection(db, 'zones');
        const zonesToCreate: IndoorCricketZone[] = [];

        // Create 10 indoor cricket zones, each in a different Karachi area
        for (let i = 0; i < 10; i++) {
            const area = KARACHI_AREAS[i];
            const venueName = VENUE_NAMES[i];
            const surface = SURFACES[i % SURFACES.length];
            const nets = 2 + (i % 3); // 2, 3, or 4 nets per venue
            const hourlyRate = 4000 + (i % 2) * 1000; // 4000 or 5000

            const zone: IndoorCricketZone = {
                ownerFullName: `${venueName} Admin`,
                venueBrandName: venueName,
                contactEmail: `admin@${venueName.toLowerCase().replace(/\s+/g, '')}.com`,
                contactPhone: `+92300${String(1000000 + i).padStart(7, '0')}`,
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
                    supportsIndoorCricket: true,
                    supportsPadel: false,
                    supportsPickleball: false,
                },
                capacity: {
                    pcSeats: null,
                    consoleSeats: null,
                    consolePlatform: null,
                    futsalCourts: null,
                    futsalCourtType: null,
                    indoorCricketNets: nets,
                    indoorCricketSurface: surface,
                    padelCourts: null,
                    padelCourtSurface: null,
                    pickleballCourts: null,
                    pickleballSurface: null,
                },
                hourlyRate: hourlyRate,
                notes: `Indoor cricket facility with ${nets} nets on ${surface} surface`,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            zonesToCreate.push(zone);
        }

        // Add all zones to Firestore
        for (const zone of zonesToCreate) {
            await addDoc(zonesRef, zone);
            console.log(`[indoorCricketSeeder] Created zone: ${zone.venueBrandName} in ${zone.primaryBranch.areaLabel}`);
        }

        console.log(`[indoorCricketSeeder] Successfully seeded ${zonesToCreate.length} indoor cricket zones`);
        return { ok: true, message: `Successfully seeded ${zonesToCreate.length} indoor cricket zones` };
    } catch (error) {
        console.error('[indoorCricketSeeder] Error seeding indoor cricket zones', error);
        return { ok: false, message: 'Failed to seed indoor cricket zones: ' + (error as any).message };
    }
}

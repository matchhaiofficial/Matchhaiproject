// src/utils/multiSportSeeder.ts
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

const KARACHI_AREAS = [
    'DHA Phase 8',
    'Clifton Block 4',
    'Gulistan-e-Jauhar Block 7',
    'Bahria Town Sports Complex',
    'PECHS Block 2',
];

const VENUE_NAMES = [
    'Ultimate Sports Arena',
    'Premier Multi-Sport Complex',
    'Champions Sports Hub',
    'Elite All-Sports Zone',
    'Victory Sports Complex',
];

interface MultiSportZone {
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
        futsalCourts: number;
        futsalCourtType: string;
        indoorCricketNets: number;
        indoorCricketSurface: string;
        padelCourts: number;
        padelCourtSurface: string;
        pickleballCourts: number;
        pickleballSurface: string;
    };
    hourlyRate: number;
    notes: string | null;
    createdAt: any;
    updatedAt: any;
}

export async function seedMultiSportZones(): Promise<{ ok: boolean; message: string }> {
    try {
        console.log('[multiSportSeeder] Starting to seed multi-sport zones');

        const zonesRef = collection(db, 'zones');
        const zonesToCreate: MultiSportZone[] = [];

        // Create 5 multi-sport zones with all 4 court types
        for (let i = 0; i < 5; i++) {
            const area = KARACHI_AREAS[i];
            const venueName = VENUE_NAMES[i];
            const hourlyRate = 5000 + (i % 2) * 1000; // 5000 or 6000

            const zone: MultiSportZone = {
                ownerFullName: `${venueName} Admin`,
                venueBrandName: venueName,
                contactEmail: `admin@${venueName.toLowerCase().replace(/\s+/g, '')}.com`,
                contactPhone: `+92300${String(4000000 + i).padStart(7, '0')}`,
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
                    supportsFutsal: true,
                    supportsIndoorCricket: true,
                    supportsPadel: true,
                    supportsPickleball: true,
                },
                capacity: {
                    pcSeats: null,
                    consoleSeats: null,
                    consolePlatform: null,
                    futsalCourts: 1 + (i % 2), // 1 or 2 futsal courts
                    futsalCourtType: i % 2 === 0 ? 'belgian-turf' : 'rubber-turf',
                    indoorCricketNets: 2 + (i % 2), // 2 or 3 nets
                    indoorCricketSurface: i % 2 === 0 ? 'belgian-turf' : 'blue-multipurpose',
                    padelCourts: 2 + (i % 2), // 2 or 3 courts
                    padelCourtSurface: i % 2 === 0 ? 'blue-turf' : 'green-turf',
                    pickleballCourts: 2 + (i % 3), // 2, 3, or 4 courts
                    pickleballSurface: i % 2 === 0 ? 'acrylic-hard' : 'multi-sport',
                },
                hourlyRate: hourlyRate,
                notes: `Multi-sport complex offering Futsal, Indoor Cricket, Padel, and Pickleball`,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            zonesToCreate.push(zone);
        }

        // Add all zones to Firestore
        for (const zone of zonesToCreate) {
            await addDoc(zonesRef, zone);
            console.log(`[multiSportSeeder] Created zone: ${zone.venueBrandName} in ${zone.primaryBranch.areaLabel}`);
        }

        console.log(`[multiSportSeeder] Successfully seeded ${zonesToCreate.length} multi-sport zones`);
        return { ok: true, message: `Successfully seeded ${zonesToCreate.length} multi-sport zones` };
    } catch (error) {
        console.error('[multiSportSeeder] Error seeding multi-sport zones', error);
        return { ok: false, message: 'Failed to seed multi-sport zones: ' + (error as any).message };
    }
}

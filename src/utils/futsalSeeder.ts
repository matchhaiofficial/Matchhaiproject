import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import Logger from './logger';

const FUTSAL_ZONES = [
    {
        venueBrandName: 'Karachi Futsal Arena',
        primaryBranch: {
            branchDisplayName: 'DHA Phase 6 Branch',
            city: 'Karachi',
            areaLabel: 'DHA Karachi',
            addressLine1: 'Khayaban-e-Ittehad, DHA Phase 6',
            googleMapsUrl: 'https://maps.google.com',
        },
        capacity: {
            futsalCourts: 2,
            futsalCourtType: 'belgian-turf',
        },
        hourlyRate: 4000,
    },
    {
        venueBrandName: 'Clifton Sports Hub',
        primaryBranch: {
            branchDisplayName: 'Clifton Block 4',
            city: 'Karachi',
            areaLabel: 'Clifton',
            addressLine1: 'Block 4, Clifton',
            googleMapsUrl: 'https://maps.google.com',
        },
        capacity: {
            futsalCourts: 2,
            futsalCourtType: 'rubber-turf',
        },
        hourlyRate: 3500,
    },
    {
        venueBrandName: 'Gulshan Futsal Club',
        primaryBranch: {
            branchDisplayName: 'Gulshan Block 13-D',
            city: 'Karachi',
            areaLabel: 'Gulshan-e-Iqbal',
            addressLine1: 'Block 13-D, Gulshan-e-Iqbal',
            googleMapsUrl: 'https://maps.google.com',
        },
        capacity: {
            futsalCourts: 1,
            futsalCourtType: 'hard-court',
        },
        hourlyRate: 3000,
    },
    {
        venueBrandName: 'Johar Sports Complex',
        primaryBranch: {
            branchDisplayName: 'Johar Block 15',
            city: 'Karachi',
            areaLabel: 'Gulistan-e-Johar',
            addressLine1: 'Block 15, Gulistan-e-Johar',
            googleMapsUrl: 'https://maps.google.com',
        },
        capacity: {
            futsalCourts: 3,
            futsalCourtType: 'belgian-turf',
        },
        hourlyRate: 3200,
    },
    {
        venueBrandName: 'Bahadurabad United',
        primaryBranch: {
            branchDisplayName: 'Bahadurabad Main',
            city: 'Karachi',
            areaLabel: 'Bahadurabad',
            addressLine1: 'Main Bahadurabad Roundabout',
            googleMapsUrl: 'https://maps.google.com',
        },
        capacity: {
            futsalCourts: 1,
            futsalCourtType: 'rubber-turf',
        },
        hourlyRate: 3800,
    },
    {
        venueBrandName: 'PECHS Football Ground',
        primaryBranch: {
            branchDisplayName: 'PECHS Block 2',
            city: 'Karachi',
            areaLabel: 'PECHS',
            addressLine1: 'Block 2, PECHS',
            googleMapsUrl: 'https://maps.google.com',
        },
        capacity: {
            futsalCourts: 2,
            futsalCourtType: 'belgian-turf',
        },
        hourlyRate: 4200,
    },
    {
        venueBrandName: 'North Nazimabad Arena',
        primaryBranch: {
            branchDisplayName: 'Block H',
            city: 'Karachi',
            areaLabel: 'North Nazimabad',
            addressLine1: 'Block H, North Nazimabad',
            googleMapsUrl: 'https://maps.google.com',
        },
        capacity: {
            futsalCourts: 2,
            futsalCourtType: 'hard-court',
        },
        hourlyRate: 2500,
    },
    {
        venueBrandName: 'Malir Cantt Sports',
        primaryBranch: {
            branchDisplayName: 'Malir Cantt',
            city: 'Karachi',
            areaLabel: 'Malir',
            addressLine1: 'Malir Cantt Main Road',
            googleMapsUrl: 'https://maps.google.com',
        },
        capacity: {
            futsalCourts: 3,
            futsalCourtType: 'belgian-turf',
        },
        hourlyRate: 3000,
    },
    {
        venueBrandName: 'Saddar Futsal Point',
        primaryBranch: {
            branchDisplayName: 'Saddar',
            city: 'Karachi',
            areaLabel: 'Saddar',
            addressLine1: 'Near Empress Market',
            googleMapsUrl: 'https://maps.google.com',
        },
        capacity: {
            futsalCourts: 1,
            futsalCourtType: 'rubber-turf',
        },
        hourlyRate: 2800,
    },
    {
        venueBrandName: 'Defence View Club',
        primaryBranch: {
            branchDisplayName: 'Defence View Phase 2',
            city: 'Karachi',
            areaLabel: 'Defence View',
            addressLine1: 'Phase 2, Defence View',
            googleMapsUrl: 'https://maps.google.com',
        },
        capacity: {
            futsalCourts: 2,
            futsalCourtType: 'belgian-turf',
        },
        hourlyRate: 3500,
    },
];

export async function seedFutsalZones() {
    Logger.info('Seeder', 'Starting Futsal Zone Seeding (Karachi Only)...');
    const zonesRef = collection(db, 'zones');

    for (const zone of FUTSAL_ZONES) {
        try {
            const docBody = {
                ownerUid: 'SEEDED_USER',
                ownerFullName: 'Seeded Owner',
                venueBrandName: zone.venueBrandName,
                contactEmail: `seed_${zone.venueBrandName.replace(/\s+/g, '').toLowerCase()}@example.com`,
                contactPhone: '+923000000000',
                status: 'active',
                onboardingStep: 4,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                primaryBranch: zone.primaryBranch,
                games: {
                    supportsCs2: false,
                    supportsFc25: false,
                    supportsTekken8: false,
                    supportsFutsal: true,
                    supportsIndoorCricket: false,
                    supportsPadel: false,
                    supportsPickleball: false,
                },
                capacity: {
                    pcSeats: null,
                    consoleSeats: null,
                    consolePlatform: null,
                    futsalCourts: zone.capacity.futsalCourts,
                    futsalCourtType: zone.capacity.futsalCourtType,
                    indoorCricketNets: null,
                    indoorCricketSurface: null,
                    padelCourts: null,
                    padelCourtSurface: null,
                    pickleballCourts: null,
                    pickleballSurface: null,
                },
                notes: 'Seeded futsal zone (Karachi)',
                hourlyRate: zone.hourlyRate,
            };

            await addDoc(zonesRef, docBody);
            Logger.info('Seeder', `Added zone: ${zone.venueBrandName}`);
        } catch (error) {
            Logger.error('Seeder', `Failed to add zone: ${zone.venueBrandName}`, error);
        }
    }
    Logger.info('Seeder', 'Futsal Zone Seeding Completed!');
}

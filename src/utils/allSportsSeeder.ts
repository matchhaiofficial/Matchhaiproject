// src/utils/allSportsSeeder.ts
import { seedIndoorCricketZones } from './indoorCricketSeeder';
import { seedMultiSportZones } from './multiSportSeeder';
import { seedPadelZones } from './padelSeeder';
import { seedPickleballZones } from './pickleballSeeder';

export async function seedAllSportsZones(): Promise<{ ok: boolean; message: string }> {
    try {
        console.log('[allSportsSeeder] Starting to seed all sports zones');

        const results = [];

        // Seed Indoor Cricket zones (10)
        const indoorCricketResult = await seedIndoorCricketZones();
        results.push(indoorCricketResult);
        if (!indoorCricketResult.ok) {
            console.error('[allSportsSeeder] Failed to seed Indoor Cricket zones');
        }

        // Seed Padel zones (10)
        const padelResult = await seedPadelZones();
        results.push(padelResult);
        if (!padelResult.ok) {
            console.error('[allSportsSeeder] Failed to seed Padel zones');
        }

        // Seed Pickleball zones (10)
        const pickleballResult = await seedPickleballZones();
        results.push(pickleballResult);
        if (!pickleballResult.ok) {
            console.error('[allSportsSeeder] Failed to seed Pickleball zones');
        }

        // Seed Multi-Sport zones (5)
        const multiSportResult = await seedMultiSportZones();
        results.push(multiSportResult);
        if (!multiSportResult.ok) {
            console.error('[allSportsSeeder] Failed to seed Multi-Sport zones');
        }

        const allSuccessful = results.every(r => r.ok);
        const successCount = results.filter(r => r.ok).length;
        const totalZones = 10 + 10 + 10 + 5; // 35 total zones

        if (allSuccessful) {
            console.log(`[allSportsSeeder] Successfully seeded all ${totalZones} sports zones`);
            return {
                ok: true,
                message: `Successfully seeded all zones:\n- 10 Indoor Cricket zones\n- 10 Padel zones\n- 10 Pickleball zones\n- 5 Multi-Sport zones\n\nTotal: ${totalZones} zones`
            };
        } else {
            console.warn(`[allSportsSeeder] Seeded ${successCount} out of 4 zone types`);
            return {
                ok: false,
                message: `Partially seeded zones. ${successCount}/4 successful. Check console for details.`
            };
        }
    } catch (error) {
        console.error('[allSportsSeeder] Error seeding all sports zones', error);
        return { ok: false, message: 'Failed to seed all sports zones: ' + (error as any).message };
    }
}

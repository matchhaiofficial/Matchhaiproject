// scripts/clearAndReseedZones.ts
/**
 * This script clears all existing zones and reseeds them with the updated data
 * including capacity and PS5 hourly rates
 */

import { collection, deleteDoc, getDocs } from "firebase/firestore";
import { db } from "../src/config/firebaseConfig";
import Logger from "../src/utils/logger";
import { seedZones } from "../src/utils/seedZones";

async function clearAllZones() {
    Logger.info("ClearZones", "Starting to clear all zones...");
    try {
        const zonesSnapshot = await getDocs(collection(db, "zones"));

        let count = 0;
        for (const docSnapshot of zonesSnapshot.docs) {
            await deleteDoc(docSnapshot.ref);
            count++;
            Logger.info("ClearZones", `Deleted zone: ${docSnapshot.id}`);
        }

        Logger.info("ClearZones", `Cleared ${count} zones`);
        return { ok: true, count };
    } catch (error: any) {
        Logger.error("ClearZones", "Failed to clear zones", error);
        return { ok: false, message: error.message };
    }
}

async function main() {
    console.log("=== Clear and Reseed Zones ===\n");

    // Step 1: Clear existing zones
    console.log("Step 1: Clearing existing zones...");
    const clearResult = await clearAllZones();

    if (!clearResult.ok) {
        console.error("❌ Failed to clear zones:", clearResult.message);
        process.exit(1);
    }

    console.log(`✅ Cleared ${clearResult.count} zones\n`);

    // Step 2: Reseed with new data
    console.log("Step 2: Reseeding zones with updated data...");
    const seedResult = await seedZones();

    if (!seedResult.ok) {
        console.error("❌ Failed to seed zones:", seedResult.message);
        process.exit(1);
    }

    console.log("✅ Zone reseeding completed successfully!\n");
    console.log("🎮 Zones now include:");
    console.log("  - PC + Console support for CS2 and FC25/26");
    console.log("  - PS5 hourly rates for console games");
    console.log("  - Coverage for Clifton, Garden, and Gulshan-e-Iqbal areas");

    process.exit(0);
}

main().catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
});

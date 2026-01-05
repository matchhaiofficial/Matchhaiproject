// scripts/runSeed.ts
import { seedZones } from '../src/utils/seedZones';

async function main() {
    console.log('Starting zone seeding...');
    const result = await seedZones();

    if (result.ok) {
        console.log('✓ Zone seeding completed successfully!');
        process.exit(0);
    } else {
        console.error('✗ Zone seeding failed:', result.message);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
});

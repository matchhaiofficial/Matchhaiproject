// Simple script to seed demo data
// Run with: node scripts/seedDemoData.js

const { seedDemoUsers } = require('../src/utils/userSeeder');
const { seedDemoTeams } = require('../src/utils/teamSeeder');

async function runSeeding() {
    console.log('🌱 Starting demo data seeding...\n');

    try {
        // Step 1: Seed users
        console.log('📝 Seeding users...');
        const userResult = await seedDemoUsers();

        if (!userResult.ok) {
            console.error('❌ User seeding failed:', userResult.message);
            process.exit(1);
        }

        console.log('✅', userResult.message);
        console.log('\n⏳ Waiting 2 seconds before seeding teams...\n');

        // Wait a bit for Firebase to sync
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 2: Seed teams
        console.log('🏆 Seeding teams...');
        const teamResult = await seedDemoTeams();

        if (!teamResult.ok) {
            console.error('❌ Team seeding failed:', teamResult.message);
            process.exit(1);
        }

        console.log('✅', teamResult.message);

        console.log('\n🎉 All done! Demo data seeded successfully!');
        console.log('\n📧 You can login with any of these demo accounts:');
        console.log('   - ahmedcs@matchhai.pk');
        console.log('   - fatimagg@matchhai.pk');
        console.log('   - umarpro@matchhai.pk');
        console.log('   - (and 17 more...)');
        console.log('\n🔑 Password for all: Test@123\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding error:', error);
        process.exit(1);
    }
}

runSeeding();

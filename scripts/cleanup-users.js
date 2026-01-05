// scripts/cleanup-users.js
// WARNING: This script will DELETE ALL users from Authentication and Firestore!
// Run with: node scripts/cleanup-users.js

const admin = require('firebase-admin');
const readline = require('readline');

// Initialize Firebase Admin SDK
// Make sure you have your service account key file
const serviceAccount = require('../matchhai-backend/matchhai-firebase-adminsdk.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const auth = admin.auth();
const db = admin.firestore();

// Create readline interface for confirmation
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

async function deleteAllUsers() {
    console.log('\n🔥 Starting user deletion process...\n');

    try {
        // List all users
        const listUsersResult = await auth.listUsers();
        const users = listUsersResult.users;

        if (users.length === 0) {
            console.log('✅ No users found in Authentication.');
            return;
        }

        console.log(`Found ${users.length} user(s) in Authentication.`);

        // Delete each user from Authentication
        for (const user of users) {
            try {
                await auth.deleteUser(user.uid);
                console.log(`✅ Deleted user from Auth: ${user.email || user.uid}`);
            } catch (error) {
                console.error(`❌ Failed to delete user ${user.uid}:`, error.message);
            }
        }

        console.log('\n✅ All users deleted from Authentication!');
    } catch (error) {
        console.error('❌ Error deleting users from Authentication:', error);
    }
}

async function deleteAllFirestoreUsers() {
    console.log('\n🔥 Starting Firestore documents deletion...\n');

    try {
        const usersCollection = db.collection('users');
        const snapshot = await usersCollection.get();

        if (snapshot.empty) {
            console.log('✅ No documents found in users collection.');
            return;
        }

        console.log(`Found ${snapshot.size} document(s) in users collection.`);

        // Delete all documents
        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
            console.log(`📝 Queued for deletion: ${doc.id}`);
        });

        await batch.commit();
        console.log('\n✅ All documents deleted from users collection!');
    } catch (error) {
        console.error('❌ Error deleting Firestore documents:', error);
    }
}

async function main() {
    console.log('\n⚠️  WARNING: This will DELETE ALL users from:');
    console.log('   1. Firebase Authentication');
    console.log('   2. Firestore "users" collection');
    console.log('\n   This action CANNOT be undone!\n');

    rl.question('Are you sure you want to continue? (yes/no): ', async (answer) => {
        if (answer.toLowerCase() === 'yes') {
            await deleteAllUsers();
            await deleteAllFirestoreUsers();
            console.log('\n✨ Cleanup complete!\n');
        } else {
            console.log('\n❌ Cleanup cancelled.');
        }

        rl.close();
        process.exit(0);
    });
}

main();

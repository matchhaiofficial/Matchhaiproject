// scripts/createSuperAdmin.mjs
import { initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { doc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyB57bgQdpSOk91_HjL-AJq94_n23OXvgnY",
    authDomain: "matchhai-official.firebaseapp.com",
    projectId: "matchhai-official",
    storageBucket: "matchhai-official.firebasestorage.app",
    messagingSenderId: "1015520088969",
    appId: "1:1015520088969:web:818fa68f4812ff54a60758"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function createSuperAdmin() {
    const email = "admin@matchhai.com";
    const password = "SuperAdmin@123";
    const fullName = "Super Admin";

    console.log('🚀 Creating Super Admin account...');

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        const userRef = doc(db, 'users', uid);
        await setDoc(userRef, {
            uid,
            email: email.toLowerCase(),
            fullName,
            username: 'superadmin',
            usernameLower: 'superadmin',
            role: 'super-admin',
            accountType: 'player',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        console.log(`✅ Super Admin created successfully!`);
        console.log(`📧 Email: ${email}`);
        console.log(`🔑 Password: ${password}`);
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            console.log(`⚠️ Account already exists: ${email}`);
        } else {
            console.error('❌ Error creating Super Admin:', error);
        }
    }
    process.exit(0);
}

createSuperAdmin().catch(console.error);

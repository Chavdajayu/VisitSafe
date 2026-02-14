import { initAdmin, db } from '../server-lib/firebaseAdmin.js';
import dotenv from 'dotenv';
dotenv.config();

// Debug: Print raw env to check loading
console.log('--- DEBUG ENV ---');
console.log('PROJECT_ID (Raw):', process.env.FIREBASE_PROJECT_ID);

// Force set if missing (Hardcoded to what user provided)
if (!process.env.FIREBASE_PROJECT_ID) {
    console.log('⚠️  Env missing, using fallback...');
    process.env.FIREBASE_PROJECT_ID = "visitsafe-3b609";
}

async function testDB() {
    console.log('--- Database Connectivity Test ---');
    console.log('Project ID:', process.env.FIREBASE_PROJECT_ID);

    try {
        initAdmin();
        const firestore = db();

        // 1. Write Test
        const testRef = firestore.collection('system_diagnostics').doc('connection_test');
        await testRef.set({
            timestamp: new Date().toISOString(),
            status: 'connected',
            agent: 'Antigravity'
        });
        console.log('✅ Write Success: Created diagnosis doc.');

        // 2. Read Test
        const docSnap = await testRef.get();
        if (docSnap.exists) {
            console.log('✅ Read Success: Retrieved diagnosis doc.');
            console.log('   Data:', docSnap.data());
        } else {
            console.error('❌ Read Fail: Doc not found after write.');
        }

        // 3. Collection Count
        const resSnap = await firestore.collection('residencies').get();
        console.log(`ℹ️  Residencies found: ${resSnap.size}`);

        if (resSnap.size === 0) {
            console.log('   (Database is empty, which explains why dropdown is empty)');
        } else {
            resSnap.forEach(d => console.log(`   - ${d.id} (${d.data().name})`));
        }

    } catch (e) {
        console.error('❌ CONNECTION FAILED:', e);
    }
}

testDB();

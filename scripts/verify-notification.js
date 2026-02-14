import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/send-notification';

// Mock Data
const payload = {
    residencyId: 'TEST_RESIDENCY_ID', // Replace with a valid ID from your DB if needed, or mock
    title: 'Test Notification',
    body: 'This is a verification message from VisitSafe repair.',
    targetType: 'residents', // Broadcast
    data: {
        tag: 'verification_test'
    }
};

async function testNotification() {
    console.log('Testing Notification API...');
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(data, null, 2));

        if (data.success || data.message === 'No residents found with valid FCM tokens') {
            console.log('✅ API accessible and logic executed.');
        } else {
            console.error('❌ API Error:', data.error);
        }

    } catch (error) {
        console.error('❌ Request Failed:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('⚠️  Make sure the server is running on port 3000!');
        }
    }
}

testNotification();

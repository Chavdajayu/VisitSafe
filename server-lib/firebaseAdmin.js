import admin from "firebase-admin";

export function initAdmin() {
    if (admin.apps.length) return;

    try {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY
            ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
            : undefined;

        if (!projectId || !clientEmail || !privateKey) {
            console.error("Missing required Firebase Admin environment variables: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY");
            // throw new Error("Firebase Admin initialization failed due to missing credentials"); // Optional: Fail hard in production
            return;
        }

        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey,
            }),
        });
        console.log("Firebase Admin initialized successfully.");

    } catch (e) {
        console.error("Firebase Admin Init Error:", e);
    }
}

export const db = admin.firestore;

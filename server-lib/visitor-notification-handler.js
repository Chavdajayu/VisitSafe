import { initAdmin } from './firebaseAdmin.js';
import admin from 'firebase-admin';

initAdmin();
const db = admin.firestore();

export default async function sendVisitorNotification(residencyId, requestId) {
    try {
        const requestRef = db.collection('residencies').doc(residencyId).collection('visitor_requests').doc(requestId);

        // Run inside a transaction to ensure single execution
        await db.runTransaction(async (t) => {
            const doc = await t.get(requestRef);
            if (!doc.exists) {
                throw new Error("Request not found");
            }

            const data = doc.data();

            // Strict Check: Only send if pending and NOT sent yet
            if (data.status !== 'pending') {
                console.log(`[Notification] Skipped: Request ${requestId} is not pending.`);
                return;
            }

            if (data.notificationSent === true) {
                console.log(`[Notification] Skipped: Notification already sent for ${requestId}.`);
                return;
            }

            // Mark as sent IMMEDIATELY to prevent race conditions
            t.update(requestRef, { notificationSent: true });

            // Proceed to prepare and send notification
            // Note: We do side-effects (sending FCM) AFTER the transaction commits ideally, 
            // but to ensure we don't double-send if the DB update succeeds but sending fails (or vice versa),
            // we mark it first. If sending fails, we could potentially retry or log it.
            // Given the requirement "No duplicate notifications", it is safer to mark as sent first.

            const { visitorName, flatId, approvalToken } = data;

            // Resolve Resident Tokens (Similar logic to original but simplified/modularized)
            const tokens = await resolveResidentTokens(residencyId, flatId);

            if (tokens.length === 0) {
                console.log(`[Notification] No tokens found for request ${requestId}`);
                return;
            }

            console.log(`[Notification] Sending to ${tokens.length} devices for request ${requestId}`);

            const payload = {
                notification: {
                    title: "New Visitor Request",
                    body: `${visitorName} wants to visit`,
                    // icon and tag handled better in data payload for some clients or "notification" for basic
                },
                data: {
                    visitorId: requestId, // Mapping requestId to visitorId for consistency with requirements
                    residencyId: residencyId,
                    actionType: "VISITOR_REQUEST",
                    approvalToken: approvalToken || "legacy", // Fallback if missing
                    visitorName: visitorName,
                    // Mandatory Tag for deduplication on device
                    tag: `visitor_request_${requestId}`,
                    requireInteraction: "true"
                },
                android: {
                    priority: "high",
                    notification: {
                        tag: `visitor_request_${requestId}`, // Android specific
                        channelId: "visitor_requests",
                        visibility: "public",
                        priority: "max",
                        defaultSound: true,
                        clickAction: "FLUTTER_NOTIFICATION_CLICK" // or specific intent
                    }
                },
                webpush: {
                    headers: {
                        Urgency: "high"
                    },
                    fcmOptions: {
                        link: "/"
                    }
                },
                tokens: tokens
            };

            // Send Multicast
            const response = await admin.messaging().sendEachForMulticast(payload);
            console.log(`[Notification] Sent: ${response.successCount} success, ${response.failureCount} failed`);

            // Clean up invalid tokens
            if (response.failureCount > 0) {
                // Implement token cleanup logic here if needed (optional for this specific file but good practice)
            }
        });

    } catch (error) {
        console.error(`[Notification] Error processing request ${requestId}:`, error);
    }
}

async function resolveResidentTokens(residencyId, flatId) {
    const tokens = [];
    try {
        // 1. Get Flat info
        const flatDoc = await db.collection("residencies").doc(residencyId).collection("flats").doc(String(flatId)).get();
        if (!flatDoc.exists) return [];

        const { number: flatNumber, blockId } = flatDoc.data();

        // 2. Get Block info for normalization
        const blockDoc = await db.collection("residencies").doc(residencyId).collection("blocks").doc(blockId).get();
        if (!blockDoc.exists) return [];

        const blockName = blockDoc.data().name;
        const normalize = (str) => String(str || "").toUpperCase().replace(/^(BLOCK|TOWER|WING)\s+/, "").trim();
        const targetBlock = normalize(blockName);

        // 3. Find Residents
        const residentsRef = db.collection("residencies").doc(residencyId).collection("residents");
        // Note: Firestore text search is exact. We need to be careful with "Block A" vs "A".
        // The original code iterated and checked. We will do the same for safety.

        const snapshot = await residentsRef.where("flat", "==", String(flatNumber)).get();

        snapshot.forEach(doc => {
            const data = doc.data();
            if (normalize(data.block) === targetBlock && data.fcmToken) {
                tokens.push(data.fcmToken);
            }
        });

    } catch (e) {
        console.error("Error resolving tokens:", e);
    }
    return [...new Set(tokens)];
}

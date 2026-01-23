import { initAdmin } from './firebaseAdmin.js';
import admin from "firebase-admin";
import crypto from 'crypto';
import sendVisitorNotification from './visitor-notification-handler.js';

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  initAdmin();
  if (!admin.apps.length) {
    return res.status(500).json({ error: "Server configuration missing (Firebase Admin)" });
  }

  const db = admin.firestore();

  try {
    const { residencyId, visitorName, visitorPhone, flatId, purpose, vehicleNumber } = req.body;

    if (!residencyId || !visitorName || !flatId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 1. Create Request in Firestore
    const requestData = {
      visitorName,
      visitorPhone,
      flatId: String(flatId),
      purpose,
      vehicleNumber: vehicleNumber || null,
      residencyId,
      residencyId,
      status: 'pending',
      approvalToken: crypto.randomUUID(),
      notificationSent: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const requestRef = await db.collection("residencies").doc(residencyId).collection("visitor_requests").add(requestData);
    const requestId = requestRef.id;

    // 2. Trigger Notification (Delegated to dedicated handler)
    // We will implement the actual sending in a separate step/file to ensure single source of truth
    // and prevent duplicates. For now, we returns success. The client or a background process 
    // should ideally trigger the notification, but per requirements "Backend must send...".
    // So we will import and call the sender here effectively.

    // For now, I will just remove the inline logic. I will add the import and call in the next step
    // once I create the handler file.
    // 2. Trigger Notification
    // We delegate to a dedicated handler that ensures single-execution via Firestore logic
    // We do NOT await this to keep the API fast, but in Serverless environment, we might need strict await
    // or context.waitUntil. Assuming standard Node/Express or Vercel Serverless optimization:
    // Ideally we should await to ensure it fires before process freezes.
    await sendVisitorNotification(residencyId, requestId);
    console.log(`[SubmitRequest] Notification trigger called for: ${requestId}`);

    return res.status(200).json({ success: true, requestId });

  } catch (error) {
    console.error("[SubmitRequest] Error:", error);
    return res.status(500).json({ error: error.message });
  }
}

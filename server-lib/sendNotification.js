import { initAdmin, db } from './firebaseAdmin.js';
import admin from 'firebase-admin';

// Initialize Admin SDK
initAdmin();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { residencyId, title, body, data = {}, targetType = 'residents', targetId } = req.body;

  if (!residencyId || !title || !body) {
    return res.status(400).json({ error: 'Missing required fields: residencyId, title, body' });
  }

  try {
    console.log(`Sending notification: ${title} to ${targetType} in residency ${residencyId}`);
    let tokens = [];
    const tokenToDocId = {};

    if (targetType === 'residents') {
      // Send to all residents (admin broadcast)
      const residentsRef = db().collection('residencies').doc(residencyId).collection('residents');
      const snapshot = await residentsRef.where('fcmToken', '!=', null).get();

      snapshot.forEach(doc => {
        const docData = doc.data();
        if (docData.fcmToken) {
          tokens.push(docData.fcmToken);
          tokenToDocId[docData.fcmToken] = doc.id;
        }
      });
    } else if (targetType === 'specific_flat' && targetId) {
      // Send to specific flat residents (visitor request)
      const residentsRef = db().collection('residencies').doc(residencyId).collection('residents');
      const residentsMap = new Map();

      // Strategy 1: Find by flatId
      const snapshotById = await residentsRef.where('flatId', '==', targetId).get();
      snapshotById.forEach(doc => residentsMap.set(doc.id, doc));

      // Strategy 2: Find by Block + Flat (legacy)
      try {
        const flatDoc = await db().collection('residencies').doc(residencyId).collection('flats').doc(targetId).get();

        if (flatDoc.exists) {
          const flatData = flatDoc.data();
          const flatNumber = String(flatData.number);
          const blockId = flatData.blockId;

          if (blockId) {
            const blockDoc = await db().collection('residencies').doc(residencyId).collection('blocks').doc(blockId).get();

            if (blockDoc.exists) {
              const blockData = blockDoc.data();
              const blockName = blockData.name;
              const normalizedBlock = blockName.toUpperCase().includes('BLOCK') ? blockName : `BLOCK ${blockName}`;

              const [snap1, snap2] = await Promise.all([
                residentsRef.where('flat', '==', flatNumber).where('block', '==', normalizedBlock).get(),
                residentsRef.where('flat', '==', flatNumber).where('block', '==', blockName).get()
              ]);

              snap1.forEach(doc => residentsMap.set(doc.id, doc));
              snap2.forEach(doc => residentsMap.set(doc.id, doc));
            }
          }
        }
      } catch (lookupError) {
        console.error("Error looking up flat/block details:", lookupError);
      }

      // Collect tokens from found residents
      for (const doc of residentsMap.values()) {
        const docData = doc.data();
        if (docData.fcmToken) {
          tokens.push(docData.fcmToken);
          tokenToDocId[docData.fcmToken] = doc.id;
        }
      }

    }

    // Remove duplicates and filter invalid
    tokens = [...new Set(tokens)].filter(t => t && t.length > 10);

    if (tokens.length === 0) {
      return res.status(200).json({
        success: true,
        sentCount: 0,
        message: 'No residents found with valid FCM tokens'
      });
    }

    // Professional Payload Design
    const baseNotification = {
      title: title,
      body: body,
      // Icon: Small icon for notification bar (android)
      // We rely on 'default' if not set, or a specific asset
      // Note: 'icon' in notification payload is the LARGE icon on right/left
      // 'badge' is the small icon in status bar
      // However, for consistency we use a standard relative path if available
    };

    // Timestamp for deduplication/tagging
    const timestamp = Date.now().toString();
    const tag = data.tag || data.visitorId || `msg_${timestamp}`;

    const payload = {
      notification: baseNotification,
      data: {
        ...data,
        click_action: '/',
        timestamp: timestamp,
        tag: tag, // Redundant but helpful in data
      },
      // Android specific config for better UX
      android: {
        priority: 'high',
        notification: {
          icon: 'stock_ticker_update', // standard resource name or remove to use default
          color: '#000000', // Brand color
          tag: tag, // CRITICAL for de-duplication
          clickAction: 'FLUTTER_NOTIFICATION_CLICK' // or standard web intent
        }
      },
      webpush: {
        headers: {
          Urgency: 'high'
        },
        notification: {
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png', // Small monochrome
          tag: tag, // Replaces previous with same tag
          renotify: true, // Vibrate again
          requireInteraction: data.requireInteraction === 'true',
        },
        fcmOptions: {
          link: '/'
        }
      },
      tokens: tokens,
    };

    // For visitor requests, send individual notifications with approval URLs
    if (data.actionType === 'VISITOR_REQUEST' && targetType === 'specific_flat') {
      const individualNotifications = [];

      for (const [token, residentId] of Object.entries(tokenToDocId)) {
        // Tag logic for visitor request - unique per request ID to allow updates but prevent dupes
        const visitorTag = `visitor_${data.visitorId}`;

        const individualPayload = {
          notification: {
            title: title,
            body: body,
          },
          data: {
            visitorId: data.visitorId,
            actionType: 'VISITOR_REQUEST',
            approvalToken: data.approvalToken,
            actionUrlApprove: data.approveUrl,
            actionUrlReject: data.rejectUrl,
            visitorName: data.visitorName || 'Unknown',
            blockName: data.blockName || 'Unknown',
            flatNumber: data.flatNumber || 'Unknown',
            purpose: data.purpose || 'Visit',
            click_action: '/',
            timestamp: Date.now().toString(),
            tag: visitorTag
          },
          android: {
            priority: 'high',
            notification: {
              tag: visitorTag,
              clickAction: 'FLUTTER_NOTIFICATION_CLICK',
              icon: 'stock_ticker_update',
              color: '#000000'
            }
          },
          webpush: {
            headers: {
              Urgency: 'high'
            },
            notification: {
              icon: '/icons/icon-192.png',
              badge: '/icons/icon-192.png',
              tag: visitorTag,
              renotify: true,
              requireInteraction: true,
              actions: [
                { action: 'approve', title: '✅ Approve' },
                { action: 'reject', title: '❌ Reject' }
              ]
            },
            fcmOptions: {
              link: '/'
            }
          },
          token: token,
        };

        individualNotifications.push(admin.messaging().send(individualPayload));
      }

      // Send all individual notifications
      const results = await Promise.allSettled(individualNotifications);
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;

      console.log(`Visitor notifications sent: ${successCount} success, ${failureCount} failed`);

      return res.status(200).json({
        success: true,
        sentCount: successCount,
        failureCount: failureCount
      });
    }

    // Send notification
    const response = await admin.messaging().sendEachForMulticast(payload);

    console.log(`Notification sent: ${response.successCount} success, ${response.failureCount} failed`);

    // Cleanup invalid tokens
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
        }
      });

      if (failedTokens.length > 0) {
        console.log(`Removing ${failedTokens.length} invalid tokens...`);

        const batch = db().batch();
        let batchCount = 0;

        failedTokens.forEach(token => {
          const docId = tokenToDocId[token];
          if (docId) {
            const docRef = db().collection('residencies').doc(residencyId).collection('residents').doc(docId);
            batch.update(docRef, {
              fcmToken: admin.firestore.FieldValue.delete()
            });
            batchCount++;
          }
        });

        if (batchCount > 0) {
          await batch.commit();
          console.log('Invalid tokens removed');
        }
      }
    }

    return res.status(200).json({
      success: true,
      sentCount: response.successCount,
      failureCount: response.failureCount
    });

  } catch (error) {
    console.error('Error in sendNotification:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
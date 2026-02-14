// firebase-messaging-sw.js
// VERSION: 2.0.0 (VisitSafe Stabilized)

const CACHE_NAME = 'visitsafe-v2';
// We just cache the basics to ensure the SW install doesn't fail on network jitter
// Do NOT cache the API responses or heavily cache app shell here to avoid complexity with Vite's own caching.
const STATIC_ASSETS = [
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// === 1. IMPORTS ===
// Using standard Firebase Compat libraries for Service Worker
// Updated to a consistent version (Compat 9.23.0 is stable and widely used)
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// === 2. INITIALIZATION ===
const params = new URLSearchParams(self.location.search);
const firebaseConfig = {
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  storageBucket: params.get('storageBucket'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
};

if (firebaseConfig.apiKey) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  // === 3. BACKGROUND MESSAGE HANDLER ===
  // This handles messages received when the app is NOT in the foreground.
  // We override the default display to add ACTION BUTTONS.
  messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background Message:', payload);

    const { title, body, icon } = payload.notification || {};
    const data = payload.data || {};

    // Tag is CRITICAL for de-duplication
    const tag = data.tag || data.visitorId || `msg_${Date.now()}`;
    const visitorId = data.visitorId;
    const approvalToken = data.approvalToken;

    const notificationOptions = {
      body: body,
      icon: icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: tag, // Replaces any existing notification with same tag
      renotify: true, // Vibrate/Sound again even if replacing
      requireInteraction: data.requireInteraction === 'true',
      data: data, // Persist data for click handler

      // Android / Chrome Actions
      actions: []
    };

    if (data.actionType === 'VISITOR_REQUEST') {
      notificationOptions.actions = [
        {
          action: 'approve', // Lowercase matches logic below
          title: '✅ Approve',
          type: 'button'
        },
        {
          action: 'reject',
          title: '❌ Reject',
          type: 'button'
        }
      ];
    }

    // Show the notification
    return self.registration.showNotification(title || 'VisitSafe', notificationOptions);
  });
}

// === 4. NOTIFICATION CLICK HANDLER ===
// This covers both Action Buttons AND Body Clicks
self.addEventListener('notificationclick', function (event) {
  console.log('[SW] Notification Click:', event.action);

  const action = event.action; // 'approve', 'reject', or '' (body click)
  const notification = event.notification;
  const data = notification.data || {};

  // Close the notification immediately to feel responsive
  notification.close();

  if (action === 'approve' || action === 'reject') {
    // === HANDLE ACTION BUTTON ===
    const promiseChain = handleVisitorAction(action, data)
      .then((result) => {
        if (result && result.success) {
          console.log('[SW] Action success');
        }
      });

    event.waitUntil(promiseChain);

  } else {
    // === HANDLE BODY CLICK (OPEN APP) ===
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((windowClients) => {
          // Check if app is already open
          for (let i = 0; i < windowClients.length; i++) {
            const client = windowClients[i];
            // Fix: Ensure we focus correctly on existing window
            if ('focus' in client) {
              return client.focus();
            }
          }
          // If not open, open it
          if (clients.openWindow) {
            return clients.openWindow('/');
          }
        })
    );
  }
});

// === 5. ACTION LOGIC ===
async function handleVisitorAction(action, data) {
  const baseUrl = self.location.origin;
  const { residencyId, visitorId, approvalToken } = data;

  if (!residencyId || !visitorId) {
    console.error('[SW] Missing data for action');
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/api/visitor-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: action, // 'approve' or 'reject'
        residencyId: residencyId,
        requestId: visitorId,
        token: approvalToken, // Secure token
        username: 'Notification Action'
      })
    });

    const result = await response.json();
    console.log('[SW] Action Result:', result);

    // Notify any open windows so UI updates
    notifyClientsOfAction(action, visitorId, result.success);

    return result;
  } catch (e) {
    console.error('[SW] Action Fetch Error:', e);
    // Notify failure so UI can potentially react if open
    notifyClientsOfAction(action, visitorId, false);
  }
}

function notifyClientsOfAction(action, visitorId, success) {
  clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(windowClients => {
      windowClients.forEach(client => {
        client.postMessage({
          type: 'VISITOR_ACTION_PROCESSED',
          action,
          visitorId,
          success
        });
      });
    });
}

// === 6. LIFECYCLE ===
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Take over immediately
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim()); // Control clients immediately
});

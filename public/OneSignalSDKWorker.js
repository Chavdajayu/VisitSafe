importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

self.addEventListener('notificationclick', function(event) {
  event.notification?.close?.();
  const data = event?.notification?.data || {};
  const action = event?.action;

  // If no action button pressed, optionally open the app
  if (!action) {
    event.waitUntil(clients.openWindow('/'));
    return;
  }

  const decision = action === 'approve' ? 'approved' : 'rejected';
  const visitorId = data.visitorId || data.requestId;
  const residencyId = data.residencyId || null;

  if (!visitorId) {
    return;
  }

  event.waitUntil(
    fetch('/api/visitorDecision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId: visitorId,
        residencyId: residencyId,
        decision: decision
      })
    })
  );
});

importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

self.addEventListener("notificationclick", function(event) {
  const action = event?.action;
  const data = event?.notification?.data || {};
  const visitorId = data.visitorId || data.requestId;
  const residencyId = data.residencyId || null;

  let decision = null;
  if (action === "approve") decision = "approved";
  if (action === "reject") decision = "rejected";

  if (!action) {
    event.waitUntil(clients.openWindow("/"));
    return;
  }

  if (decision && visitorId) {
    event.waitUntil(
      fetch("/api/visitorDecision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId, residencyId, decision })
      })
    );
  }
  event.notification?.close?.();
});

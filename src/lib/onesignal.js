export async function requestPushAfterLogin(userId) {
  if (!window.OneSignal) return;
  const permission = await OneSignal.Notifications.permission;
  if (permission === "default") {
    await OneSignal.Notifications.requestPermission();
  }
  await OneSignal.login(userId);
}
export async function testNotification(userId) {
  await fetch("/api/send-notification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      externalId: userId,
      title: "Test Notification",
      message: "Your OneSignal integration works!"
    })
  });
}

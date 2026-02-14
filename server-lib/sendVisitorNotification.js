export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const { residentUsername, visitorName, requestId } = req.body || {};
    if (!residentUsername || !visitorName || !requestId) {
      return res.status(400).json({ error: "Missing residentUsername, visitorName or requestId" });
    }
    const apiKey = process.env.ONESIGNAL_REST_API_KEY || process.env.ONESIGNAL_API_KEY;
    const appId = process.env.ONESIGNAL_APP_ID || "7304d154-c777-4f86-b61a-5a6e88976cd9";
    if (!apiKey) {
      return res.status(500).json({ error: "Missing OneSignal API Key" });
    }
    if (!appId) {
      return res.status(500).json({ error: "Missing OneSignal App ID" });
    }
    console.log("Sending to external_id:", residentUsername);
    console.log("OneSignal env:", { hasApiKey: Boolean(apiKey), hasAppId: Boolean(appId) });
    const payload = {
      app_id: appId,
      include_external_user_ids: [residentUsername],
      target_channel: "push",
      headings: { en: "New Visitor Request" },
      contents: { en: `Visitor ${visitorName} is waiting at the gate.` },
      data: { requestId },
      buttons: [
        { id: "approve", text: "Approve" },
        { id: "reject", text: "Reject" }
      ]
    };
    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${apiKey}`,
        "User-Agent": "VisitSafe-Server/1.0"
      },
      body: JSON.stringify(payload)
    });
    const status = response.status;
    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      result = { raw: text };
    }
    console.log("OneSignal status:", status);
    console.log("OneSignal response:", result);
    if (!response.ok) {
      return res.status(status).json({ success: false, error: result?.errors || result });
    }
    return res.status(200).json({ success: true, result });
  } catch (err) {
    console.error("OneSignal send error:", err);
    return res.status(500).json({ error: err.message });
  }
}

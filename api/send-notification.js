export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { externalId, title, message } = req.body || {};
  const response = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Key ${process.env.ONESIGNAL_REST_API_KEY}`
    },
    body: JSON.stringify({
      app_id: "7304d154-c777-4f86-b61a-5a6e88976cd9",
      include_external_user_ids: [externalId],
      headings: { en: title },
      contents: { en: message }
    })
  });
  const data = await response.json();
  return res.status(200).json(data);
}

import updateRequestStatus from './update-request-status.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { visitorId, residencyId, decision } = req.body || {};
    if (!visitorId || !decision) {
      return res.status(400).json({ error: 'Missing visitorId or decision' });
    }
    const status = decision === 'approved' ? 'approved' : 'rejected';
    req.body = {
      residencyId: residencyId || null,
      requestId: visitorId,
      status,
      username: 'notification_action'
    };
    return await updateRequestStatus(req, res);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

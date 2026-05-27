// Verifies a resident's identity before allowing them to view/edit a saved submission.
// Accepts only the Unique ID.

import { getSubmission } from '../../lib/googleSheets';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { unit, value } = req.body;
  if (!unit || !value) return res.status(400).json({ error: 'unit and value required' });

  try {
    const sub = await getSubmission(unit.trim());
    if (!sub.found) return res.json({ verified: false });

    // ── Check Unique ID only ─────────────────────────────────────────
    const uid     = String(sub.unique_id || '').trim();
    const entered = String(value).trim();
    if (uid && uid.replace(/[\s\-]/g, '').toUpperCase() === entered.replace(/[\s\-]/g, '').toUpperCase()) {
      return res.json({ verified: true });
    }

    return res.json({ verified: false });
  } catch (err) {
    console.error('Verify identity error:', err);
    res.status(500).json({ error: 'Verification error. Please try again.' });
  }
}

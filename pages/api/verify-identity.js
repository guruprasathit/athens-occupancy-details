// Verifies a resident's identity before allowing them to view/edit a saved submission.
// Accepts either the Unique ID or the registered primary mobile number.

import { getSubmission } from '../../lib/googleSheets';
import { decrypt } from '../../lib/crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { unit, value } = req.body;
  if (!unit || !value) return res.status(400).json({ error: 'unit and value required' });

  try {
    const sub = await getSubmission(unit.trim());
    if (!sub.found) return res.json({ verified: false });

    // Normalise entered value — strip spaces, dashes, + for phone comparison
    const entered = String(value).trim().replace(/[\s\-\+()]/g, '');

    // ── Check Unique ID ──────────────────────────────────────────────
    const uid = String(sub.unique_id || '').trim();
    if (uid && uid.replace(/[\s\-]/g, '').toUpperCase() === entered.toUpperCase()) {
      return res.json({ verified: true });
    }

    // ── Check primary mobile (decrypt first if encrypted) ────────────
    // Sheet key is "primary_contact" (from "Primary Contact" header)
    const rawPhone = String(sub.primary_contact || sub.contact || '');
    const storedPhone = decrypt(rawPhone).replace(/[\s\-\+()]/g, '');
    if (storedPhone && storedPhone === entered) {
      return res.json({ verified: true });
    }

    return res.json({ verified: false });
  } catch (err) {
    console.error('Verify identity error:', err);
    res.status(500).json({ error: 'Verification error. Please try again.' });
  }
}

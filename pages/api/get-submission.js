import { getSubmission } from '../../lib/googleSheets';
import { decryptFields, SENSITIVE_FIELDS } from '../../lib/crypto';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { unit } = req.query;
  if (!unit || !unit.trim()) return res.status(400).json({ error: 'unit is required' });

  try {
    const raw  = await getSubmission(unit.trim());
    // Decrypt PII fields so the form can pre-fill correctly
    const data = raw.found ? decryptFields(raw, SENSITIVE_FIELDS) : raw;
    res.json(data);
  } catch (err) {
    console.error('Get submission error:', err);
    res.status(500).json({ error: 'Failed to fetch submission.' });
  }
}

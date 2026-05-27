import { saveSubmission } from '../../lib/googleSheets';
import { encryptFields, SENSITIVE_FIELDS } from '../../lib/crypto';

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    // Encrypt PII fields before storing in Google Sheets
    const payload = encryptFields(req.body, SENSITIVE_FIELDS);
    const result  = await saveSubmission(payload);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ error: 'Failed to save. Please try again.' });
  }
}

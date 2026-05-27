import { saveSubmission } from '../../lib/googleSheets';

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const result = await saveSubmission(req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ error: 'Failed to save. Please try again.' });
  }
}

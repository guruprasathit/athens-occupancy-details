import { getSubmission } from '../../lib/googleSheets';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { unit } = req.query;
  if (!unit || !unit.trim()) return res.status(400).json({ error: 'unit is required' });

  try {
    const data = await getSubmission(unit.trim());
    res.json(data);
  } catch (err) {
    console.error('Get submission error:', err);
    res.status(500).json({ error: 'Failed to fetch submission.' });
  }
}

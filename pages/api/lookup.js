import { lookupUnit } from '../../lib/googleSheets';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { unit } = req.query;
  if (!unit || !unit.trim()) return res.status(400).json({ error: 'unit is required' });

  try {
    const data = await lookupUnit(unit.trim());
    res.json(data);
  } catch (err) {
    console.error('Lookup error:', err);
    res.status(500).json({ error: 'Failed to look up unit. Check server configuration.' });
  }
}

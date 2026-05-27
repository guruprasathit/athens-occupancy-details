import { deleteSubmission } from '../../../lib/googleSheets';

function isAuthorised(req) {
  const auth  = (req.headers.authorization || '').replace('Bearer ', '');
  const valid = Buffer.from(process.env.ADMIN_PASSWORD || '').toString('base64');
  return auth === valid && auth !== '';
}

export default async function handler(req, res) {
  if (!isAuthorised(req)) return res.status(401).json({ error: 'Unauthorised' });
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const { unit } = req.query;
  if (!unit || !unit.trim()) return res.status(400).json({ error: 'unit is required' });

  try {
    const result = await deleteSubmission(unit.trim());
    if (!result.success) return res.status(404).json({ error: result.error || 'Not found' });
    res.json({ success: true, deleted: unit.trim() });
  } catch (err) {
    console.error('Delete submission error:', err);
    res.status(500).json({ error: 'Failed to delete submission.' });
  }
}

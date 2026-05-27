import { getAllSubmissions } from '../../../lib/googleSheets';

function isAuthorised(req) {
  const auth  = (req.headers.authorization || '').replace('Bearer ', '');
  const valid = Buffer.from(process.env.ADMIN_PASSWORD || '').toString('base64');
  return auth === valid && auth !== '';
}

export default async function handler(req, res) {
  if (!isAuthorised(req)) return res.status(401).json({ error: 'Unauthorised' });
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const data = await getAllSubmissions();
    res.json(data);
  } catch (err) {
    console.error('Admin submissions error:', err);
    res.status(500).json({ error: 'Failed to load submissions' });
  }
}

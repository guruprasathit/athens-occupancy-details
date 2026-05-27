import { getAllSubmissions } from '../../../lib/googleSheets';
import { decryptFields, SENSITIVE_FIELDS } from '../../../lib/crypto';

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
    // Decrypt PII fields for admin display
    const decrypted = {
      ...data,
      submissions: (data.submissions || []).map(s => decryptFields(s, SENSITIVE_FIELDS)),
    };
    res.json(decrypted);
  } catch (err) {
    console.error('Admin submissions error:', err);
    res.status(500).json({ error: 'Failed to load submissions' });
  }
}

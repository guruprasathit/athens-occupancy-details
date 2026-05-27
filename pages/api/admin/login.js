export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { password } = req.body || {};
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) return res.status(500).json({ error: 'ADMIN_PASSWORD not configured on server' });
  if (!password || password !== adminPassword) return res.status(401).json({ error: 'Invalid password' });

  // Token = base64 of password — validated by admin routes on every request
  const token = Buffer.from(adminPassword).toString('base64');
  res.json({ token });
}

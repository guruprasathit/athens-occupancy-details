// Receives a single file (base64) and uploads it to Google Drive via Apps Script.
// Called once per file as soon as the user selects it.

const SCRIPT_URL = (process.env.GOOGLE_SCRIPT_URL || '')
  .replace(/^﻿/, '')
  .replace(/\r\n|\r|\n/g, '')
  .trim();

export const config = { api: { bodyParser: { sizeLimit: '15mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { filename, mimeType, base64, unitNumber, docType } = req.body;

  if (!filename || !mimeType || !base64) {
    return res.status(400).json({ error: 'filename, mimeType and base64 are required' });
  }
  if (!SCRIPT_URL) {
    return res.status(500).json({ error: 'GOOGLE_SCRIPT_URL not configured' });
  }

  try {
    const response = await fetch(SCRIPT_URL, {
      method:   'POST',
      redirect: 'follow',
      headers:  { 'Content-Type': 'text/plain' },
      body:     JSON.stringify({ action: 'uploadfile', filename, mimeType, base64, unitNumber, docType: docType || 'sale_deed' }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Apps Script error ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Upload failed');

    res.json({ success: true, url: data.url, name: data.name, fileId: data.fileId });
  } catch (err) {
    console.error('Upload deed error:', err);
    res.status(500).json({ error: err.message });
  }
}

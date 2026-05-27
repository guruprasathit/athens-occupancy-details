import { saveSubmission } from '../../lib/googleSheets';
import { encryptFields, SENSITIVE_FIELDS } from '../../lib/crypto';
import { generateFormPdf } from '../../lib/pdfGenerator';

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const formData = req.body;

  try {
    // Encrypt PII fields before storing in Google Sheets
    const encrypted = encryptFields(formData, SENSITIVE_FIELDS);

    // Kick off sheet save (non-fatal) and PDF generation in parallel
    const [pdfBuffer] = await Promise.all([
      generateFormPdf(formData),
      saveSubmission(encrypted).catch(err => {
        console.error('Sheet save failed (non-fatal):', err.message);
      }),
    ]);

    const unit = (formData.unit_number || 'UNIT').replace(/[\s/\\]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Athens_Occupancy_${unit}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Submit-and-download error:', err);
    res.status(500).json({ error: 'Failed to generate form: ' + err.message });
  }
}

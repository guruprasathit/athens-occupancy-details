import { generateFormDocx } from '../../lib/docxGenerator';
import { saveSubmission } from '../../lib/googleSheets';

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const formData = req.body;

  try {
    // Generate DOCX and save to Sheets in parallel
    const [buffer] = await Promise.all([
      generateFormDocx(formData),
      saveSubmission(formData).catch(err => {
        console.error('Sheet save failed (non-fatal):', err.message);
      }),
    ]);

    const unit = (formData.unit_number || 'UNIT').replace(/[\s/\\]/g, '_');
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', `attachment; filename="Athens_Occupancy_${unit}.docx"`);
    res.send(buffer);
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ error: 'Failed to generate form: ' + err.message });
  }
}

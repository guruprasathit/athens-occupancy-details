import * as XLSX from 'xlsx';
import { getAllSubmissions } from '../../../lib/googleSheets';

function isAuthorised(req) {
  const auth  = (req.headers.authorization || '').replace('Bearer ', '');
  const valid = Buffer.from(process.env.ADMIN_PASSWORD || '').toString('base64');
  return auth === valid && auth !== '';
}

// Columns to include in the export (in order)
const COLUMNS = [
  { key: 'submitted_at',         label: 'Submitted At' },
  { key: 'unit_number',          label: 'Unit Number' },
  { key: 'unique_id',            label: 'Unique ID' },
  { key: 'block',                label: 'Block' },
  { key: 'floor',                label: 'Floor' },
  { key: 'unit_type',            label: 'Unit Type' },
  { key: 'car_park',             label: 'Car Park' },
  { key: 'occupied_since',       label: 'Occupied Since' },
  { key: 'owner_name',           label: 'Owner Name' },
  { key: 'contact',              label: 'Contact' },
  { key: 'whatsapp',             label: 'WhatsApp' },
  { key: 'email',                label: 'Email' },
  { key: 'permanent_address',    label: 'Permanent Address' },
  { key: 'occupancy_type',       label: 'Occupancy Type' },
  { key: 'total_occupants',      label: 'Total Occupants' },
  // Members 1-10
  ...Array.from({ length: 10 }, (_, i) => [
    { key: `member_${i+1}_name`,     label: `Member ${i+1} Name` },
    { key: `member_${i+1}_age`,      label: `Member ${i+1} Age` },
    { key: `member_${i+1}_relation`, label: `Member ${i+1} Relation` },
  ]).flat(),
  { key: 'tenant_name',          label: 'Tenant Name' },
  { key: 'tenant_contact',       label: 'Tenant Contact' },
  { key: 'tenant_email',         label: 'Tenant Email' },
  { key: 'agreement_period',     label: 'Agreement Period' },
  { key: 'police_verification',  label: 'Police Verification' },
  { key: 'agreement_registered', label: 'Agreement Registered' },
  // Vehicles 1-5
  ...Array.from({ length: 5 }, (_, i) => [
    { key: `vehicle_${i+1}_type`,   label: `Vehicle ${i+1} Type` },
    { key: `vehicle_${i+1}_make`,   label: `Vehicle ${i+1} Make` },
    { key: `vehicle_${i+1}_reg`,    label: `Vehicle ${i+1} Reg` },
    { key: `vehicle_${i+1}_colour`, label: `Vehicle ${i+1} Colour` },
    { key: `vehicle_${i+1}_fuel`,   label: `Vehicle ${i+1} Fuel` },
    { key: `vehicle_${i+1}_park`,   label: `Vehicle ${i+1} Park` },
  ]).flat(),
  { key: 'has_pets',                 label: 'Has Pets' },
  { key: 'membership_completed',     label: 'Membership Completed' },
  { key: 'membership_id',            label: 'Membership ID' },
  { key: 'maintenance_paid_up_to',   label: 'Maintenance Paid Up To' },
];

export default async function handler(req, res) {
  if (!isAuthorised(req)) return res.status(401).json({ error: 'Unauthorised' });
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const data = await getAllSubmissions();
    const submissions = data.submissions || [];

    // Header row
    const header = COLUMNS.map(c => c.label);

    // Data rows
    const rows = submissions.map(s =>
      COLUMNS.map(c => s[c.key] ?? '')
    );

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);

    // ── Column widths ──────────────────────────────────────────────
    ws['!cols'] = COLUMNS.map(c => {
      if (c.key === 'submitted_at' || c.key === 'permanent_address') return { wch: 22 };
      if (c.key === 'owner_name' || c.key.endsWith('_name')) return { wch: 20 };
      if (c.key === 'email' || c.key.endsWith('_email')) return { wch: 24 };
      return { wch: 14 };
    });

    // ── Freeze top row ─────────────────────────────────────────────
    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' };

    // ── Style header row blue ──────────────────────────────────────
    header.forEach((_, ci) => {
      const ref = XLSX.utils.encode_cell({ r: 0, c: ci });
      if (!ws[ref]) return;
      ws[ref].s = {
        font:      { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
        fill:      { fgColor: { rgb: '1B3A6B' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
      };
    });

    // ── Alternating row shading ────────────────────────────────────
    rows.forEach((row, ri) => {
      row.forEach((_, ci) => {
        const ref = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
        if (!ws[ref]) return;
        ws[ref].s = {
          fill: { fgColor: { rgb: ri % 2 === 0 ? 'FFFFFF' : 'F0F4F8' } },
          alignment: { vertical: 'center' },
        };
      });
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Submissions');

    // ── Summary sheet ──────────────────────────────────────────────
    const total   = submissions.length;
    const owners  = submissions.filter(s => s.occupancy_type === 'owner').length;
    const tenants = submissions.filter(s => s.occupancy_type === 'tenant').length;
    const vacant  = submissions.filter(s => s.occupancy_type === 'vacant').length;
    const other   = total - owners - tenants - vacant;

    const summaryData = [
      ['Athens Occupancy Form — Export Summary'],
      [],
      ['Exported On', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })],
      [],
      ['Metric', 'Count'],
      ['Total Submissions', total],
      ['Owner Occupied',    owners],
      ['Tenant Occupied',   tenants],
      ['Vacant',            vacant],
      ['Other / Not Set',   other],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(summaryData);
    ws2['!cols'] = [{ wch: 24 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    const date   = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Athens_Submissions_${date}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    console.error('Excel export error:', err);
    res.status(500).json({ error: 'Failed to export: ' + err.message });
  }
}

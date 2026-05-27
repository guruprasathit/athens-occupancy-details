import * as XLSX from 'xlsx';
import { saveSubmission } from '../../lib/googleSheets';

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

// Build a flat array of [ label, value ] rows for the Excel sheet
function buildRows(d) {
  const rows = [];

  const add = (label, value) => rows.push([label, value ?? '']);
  const section = (title) => {
    rows.push([]);            // blank spacer
    rows.push([title]);       // section heading (single cell)
  };

  // ── 01 Unit Information ──────────────────────────────────────────────────────
  section('UNIT INFORMATION');
  add('Block / Tower',     d.block);
  add('Floor',             d.floor);
  add('Unit Number',       d.unit_number);
  add('Unit Type',         d.unit_type);
  add('Unique ID',         d.unique_id);
  add('Car Park Slot(s)',  d.car_park);
  add('Occupied Since',    d.occupied_since);

  // ── 02 Owner Details ─────────────────────────────────────────────────────────
  section('OWNER DETAILS');
  add('Owner Name',        d.owner_name);
  add('Contact',           d.contact);
  add('WhatsApp',          d.whatsapp);
  add('Email',             d.email);
  add('Permanent Address', d.perm_address);

  // ── 03 Occupancy ─────────────────────────────────────────────────────────────
  section('OCCUPANCY DETAILS');
  add('Occupancy Type',    d.occupancy_type);
  add('Total Occupants',   d.total_occupants);

  // ── 04 Members ───────────────────────────────────────────────────────────────
  section('FAMILY / OCCUPANT MEMBERS');
  rows.push(['#', 'Name', 'Age Group', 'Relation']);
  for (let i = 1; i <= 10; i++) {
    const name     = d[`member_${i}_name`]     || '';
    const age      = d[`member_${i}_age`]      || '';
    const relation = d[`member_${i}_relation`] || '';
    if (name || age || relation) rows.push([i, name, age, relation]);
  }

  // ── 05 Tenant Details ────────────────────────────────────────────────────────
  if (d.tenant_name || d.tenant_contact) {
    section('TENANT DETAILS');
    add('Tenant Name',            d.tenant_name);
    add('Tenant Contact',         d.tenant_contact);
    add('Tenant Email',           d.tenant_email);
    add('Agreement Period',       d.agreement_period);
    add('Police Verification',    d.police_verification);
    add('Agreement Registered',   d.agreement_registered);
  }

  // ── 06 Vehicles ──────────────────────────────────────────────────────────────
  const hasVehicle = [1,2,3,4,5].some(i => d[`vehicle_${i}_type`]);
  if (hasVehicle) {
    section('VEHICLES');
    rows.push(['#', 'Type', 'Make/Model', 'Reg. No.', 'Colour', 'Fuel', 'Car Park']);
    for (let i = 1; i <= 5; i++) {
      const type   = d[`vehicle_${i}_type`]   || '';
      const make   = d[`vehicle_${i}_make`]   || '';
      const reg    = d[`vehicle_${i}_reg`]    || '';
      const colour = d[`vehicle_${i}_colour`] || '';
      const fuel   = d[`vehicle_${i}_fuel`]   || '';
      const park   = d[`vehicle_${i}_park`]   || '';
      if (type || make || reg) rows.push([i, type, make, reg, colour, fuel, park]);
    }
  }

  // ── 07 Miscellaneous ─────────────────────────────────────────────────────────
  section('MISCELLANEOUS');
  add('Pets',                   d.has_pets);
  add('Membership Completed',   d.membership_completed);
  add('Membership ID',          d.membership_id);
  add('Maintenance Paid Up To', d.maintenance_paid_up_to);

  return rows;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const formData = req.body;

  try {
    // Save to Google Sheets in parallel with Excel generation
    const [wb] = await Promise.all([
      (async () => {
        const rows = buildRows(formData);
        const ws = XLSX.utils.aoa_to_sheet(rows);

        // ── Column widths ────────────────────────────────────────────────────
        ws['!cols'] = [{ wch: 28 }, { wch: 40 }, { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 10 }, { wch: 16 }];

        // ── Style section headings (bold, blue bg) ───────────────────────────
        rows.forEach((row, ri) => {
          if (row.length === 1 && row[0]) {
            const cellRef = XLSX.utils.encode_cell({ r: ri, c: 0 });
            if (!ws[cellRef]) return;
            ws[cellRef].s = {
              font:    { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
              fill:    { fgColor: { rgb: '1B3A6B' } },
              alignment: { horizontal: 'left', vertical: 'center' },
            };
          }
          // Style sub-header rows (rows with multiple cols that are all strings and start with '#')
          if (row.length > 1 && row[0] === '#') {
            row.forEach((_, ci) => {
              const ref = XLSX.utils.encode_cell({ r: ri, c: ci });
              if (!ws[ref]) return;
              ws[ref].s = {
                font: { bold: true, color: { rgb: 'FFFFFF' } },
                fill: { fgColor: { rgb: '3A5080' } },
              };
            });
          }
          // Style label cells (column A) with light blue bg
          if (row.length === 2) {
            const ref = XLSX.utils.encode_cell({ r: ri, c: 0 });
            if (!ws[ref]) return;
            ws[ref].s = {
              font: { bold: true, color: { rgb: '1B3A6B' } },
              fill: { fgColor: { rgb: 'DCE8F5' } },
            };
          }
        });

        const workbook = XLSX.utils.book_new();
        const unit = (formData.unit_number || 'Unit').replace(/[\s/\\]/g, '_');
        XLSX.utils.book_append_sheet(workbook, ws, `Unit ${unit}`);

        // Metadata sheet
        const meta = XLSX.utils.aoa_to_sheet([
          ['Athens Occupancy Form'],
          ['Generated', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })],
          ['Unit', formData.unit_number || ''],
          ['Unique ID', formData.unique_id || ''],
        ]);
        XLSX.utils.book_append_sheet(workbook, meta, 'Info');

        return workbook;
      })(),
      saveSubmission(formData).catch(err => {
        console.error('Sheet save failed (non-fatal):', err.message);
      }),
    ]);

    const unit = (formData.unit_number || 'UNIT').replace(/[\s/\\]/g, '_');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Athens_Occupancy_${unit}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    console.error('Excel generate error:', err);
    res.status(500).json({ error: 'Failed to generate Excel: ' + err.message });
  }
}

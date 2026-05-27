import * as XLSX from 'xlsx';
import { saveSubmission } from '../../lib/googleSheets';

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

function val(v) { return v ?? ''; }

function buildSheet(d) {
  const rows = [];

  const section = (title) => {
    rows.push([]);
    rows.push([title]);
  };
  const field = (label, value) => rows.push([label, val(value)]);

  section('UNIT INFORMATION');
  field('Unit Number',       d.unit_number);
  field('Unique ID',         d.unique_id);
  field('Block / Tower',     d.block);
  field('Floor',             d.floor);
  field('Unit Type',         d.unit_type);
  field('Car Park Slot(s)',  d.car_park);
  field('Occupied Since',    d.occupied_since);

  section('OWNER DETAILS');
  field('Owner Name',        d.owner_name);
  field('Contact',           d.contact);
  field('WhatsApp',          d.whatsapp);
  field('Email',             d.email);
  field('Permanent Address', d.perm_address);

  section('OCCUPANCY DETAILS');
  field('Occupancy Type',    d.occupancy_type);
  field('Total Occupants',   d.total_occupants);

  section('FAMILY / OCCUPANT MEMBERS');
  rows.push(['#', 'Name', 'Age Group', 'Relation']);
  for (let i = 1; i <= 10; i++) {
    const name = val(d[`member_${i}_name`]);
    const age  = val(d[`member_${i}_age`]);
    const rel  = val(d[`member_${i}_relation`]);
    if (name || age || rel) rows.push([i, name, age, rel]);
  }

  const hasTenant = d.tenant_name || d.tenant_contact;
  if (hasTenant) {
    section('TENANT DETAILS');
    field('Tenant Name',           d.tenant_name);
    field('Tenant Contact',        d.tenant_contact);
    field('Tenant Email',          d.tenant_email);
    field('Agreement Period',      d.agreement_period);
    field('Police Verification',   d.police_verification);
    field('Agreement Registered',  d.agreement_registered);
  }

  const hasVehicle = [1,2,3,4,5].some(i => d[`vehicle_${i}_type`]);
  if (hasVehicle) {
    section('VEHICLES');
    rows.push(['#', 'Type', 'Make/Model', 'Reg. No.', 'Colour', 'Fuel', 'Car Park']);
    for (let i = 1; i <= 5; i++) {
      const type = val(d[`vehicle_${i}_type`]);
      const make = val(d[`vehicle_${i}_make`]);
      const reg  = val(d[`vehicle_${i}_reg`]);
      if (type || make || reg)
        rows.push([i, type, make, reg, val(d[`vehicle_${i}_colour`]), val(d[`vehicle_${i}_fuel`]), val(d[`vehicle_${i}_park`])]);
    }
  }

  section('MISCELLANEOUS');
  field('Has Pets',                  d.has_pets);
  field('Membership Completed',      d.membership_completed);
  field('Membership ID',             d.membership_id);
  field('Maintenance Paid Up To',    d.maintenance_paid_up_to);

  field('Submitted At', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 28 }, { wch: 40 }, { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 16 }];

  // Style section heading rows (single cell, non-empty)
  rows.forEach((row, ri) => {
    if (row.length === 1 && row[0]) {
      const ref = XLSX.utils.encode_cell({ r: ri, c: 0 });
      if (ws[ref]) ws[ref].s = {
        font:      { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
        fill:      { fgColor: { rgb: '1B3A6B' } },
        alignment: { horizontal: 'left', vertical: 'center' },
      };
    }
    // Sub-header rows (start with '#')
    if (row.length > 1 && row[0] === '#') {
      row.forEach((_, ci) => {
        const ref = XLSX.utils.encode_cell({ r: ri, c: ci });
        if (ws[ref]) ws[ref].s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '3A5080' } },
        };
      });
    }
    // Label cells (col A, 2-col rows)
    if (row.length === 2) {
      const ref = XLSX.utils.encode_cell({ r: ri, c: 0 });
      if (ws[ref]) ws[ref].s = {
        font: { bold: true, color: { rgb: '1B3A6B' } },
        fill: { fgColor: { rgb: 'DCE8F5' } },
      };
    }
  });

  return ws;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const d = req.body;

  try {
    // Save to Google Sheets (non-fatal if it fails)
    await saveSubmission(d).catch(err =>
      console.error('Sheet save failed (non-fatal):', err.message)
    );

    // Build Excel
    const ws = buildSheet(d);
    const wb = XLSX.utils.book_new();
    const unit = (d.unit_number || 'Unit').replace(/[\s/\\]/g, '_');
    XLSX.utils.book_append_sheet(wb, ws, `Unit ${unit}`);

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Athens_Occupancy_${unit}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    console.error('Submit Excel error:', err);
    res.status(500).json({ error: 'Failed to submit: ' + err.message });
  }
}

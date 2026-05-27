import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY env variable not set');
  const credentials = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function getSheets() {
  const auth = await getAuth();
  return google.sheets({ version: 'v4', auth });
}

// ── Lookup ────────────────────────────────────────────────────────────────────

export async function lookupUnit(unitNumber) {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Units!A2:K',
  });

  const rows = res.data.values || [];
  const key = unitNumber.replace(/[\s-]/g, '').toUpperCase();

  for (const row of rows) {
    const rowKey = (row[0] || '').replace(/[\s-]/g, '').toUpperCase();
    if (rowKey === key) {
      return {
        unit_number: row[0] || '',
        block: row[1] || '',
        floor: row[2] || '',
        unit_type: row[3] || '',
        car_park: row[4] || '',
        owner_name: row[5] || '',
        contact: row[6] || '',
        whatsapp: row[7] || '',
        email: row[8] || '',
        occupancy_type: row[9] || '',
        found: true,
      };
    }
  }

  // Not found — derive block & floor from unit code
  const m = key.match(/^([A-Z]+)(\d+)$/);
  const block = m ? m[1] : '';
  const digits = m ? m[2] : '';
  const floor = digits.length <= 3 ? digits[0] : digits.slice(0, -2);

  return { unit_number: key, block, floor, found: false };
}

// ── Save submission ───────────────────────────────────────────────────────────

export async function saveSubmission(formData) {
  const sheets = await getSheets();
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const memberFields = Array.from({ length: 10 }, (_, i) => [
    formData[`member_${i + 1}_name`] || '',
    formData[`member_${i + 1}_age`] || '',
    formData[`member_${i + 1}_relation`] || '',
  ]).flat();

  const vehicleFields = Array.from({ length: 5 }, (_, i) => [
    formData[`vehicle_${i + 1}_type`] || '',
    formData[`vehicle_${i + 1}_make`] || '',
    formData[`vehicle_${i + 1}_reg`] || '',
    formData[`vehicle_${i + 1}_colour`] || '',
    formData[`vehicle_${i + 1}_fuel`] || '',
    formData[`vehicle_${i + 1}_park`] || '',
  ]).flat();

  const row = [
    now,
    formData.unit_number || '',
    formData.block || '',
    formData.floor || '',
    formData.unit_type || '',
    formData.car_park || '',
    formData.occupied_since || '',
    formData.owner_name || '',
    formData.contact || '',
    formData.whatsapp || '',
    formData.email || '',
    formData.perm_address || '',
    formData.occupancy_type || '',
    formData.total_occupants || '',
    ...memberFields,
    formData.tenant_name || '',
    formData.tenant_contact || '',
    formData.tenant_email || '',
    formData.agreement_period || '',
    formData.police_verification || '',
    formData.agreement_registered || '',
    ...vehicleFields,
    formData.has_pets || '',
    formData.membership_completed || '',
    formData.membership_id || '',
    formData.maintenance_paid_up_to || '',
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Submissions!A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

// ── Setup: initialise sheet headers ──────────────────────────────────────────

export async function setupSheet() {
  const sheets = await getSheets();

  // Check if sheets already exist
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const existingNames = meta.data.sheets.map(s => s.properties.title);

  const requests = [];

  if (!existingNames.includes('Units')) {
    requests.push({ addSheet: { properties: { title: 'Units' } } });
  }
  if (!existingNames.includes('Submissions')) {
    requests.push({ addSheet: { properties: { title: 'Submissions' } } });
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests },
    });
  }

  // Units header
  const unitsHeader = [
    'Unit Number', 'Block', 'Floor', 'Unit Type', 'Car Park Slot',
    'Owner Name', 'Contact', 'WhatsApp', 'Email', 'Occupancy Type', 'Notes',
  ];

  // Submissions header
  const memberHeaders = Array.from({ length: 10 }, (_, i) => [
    `Member ${i + 1} Name`, `Member ${i + 1} Age`, `Member ${i + 1} Relation`,
  ]).flat();
  const vehicleHeaders = Array.from({ length: 5 }, (_, i) => [
    `Vehicle ${i + 1} Type`, `Vehicle ${i + 1} Make`, `Vehicle ${i + 1} Reg`,
    `Vehicle ${i + 1} Colour`, `Vehicle ${i + 1} Fuel`, `Vehicle ${i + 1} Park`,
  ]).flat();

  const submissionsHeader = [
    'Submitted At', 'Unit Number', 'Block', 'Floor', 'Unit Type', 'Car Park',
    'Occupied Since', 'Owner Name', 'Contact', 'WhatsApp', 'Email',
    'Permanent Address', 'Occupancy Type', 'Total Occupants',
    ...memberHeaders,
    'Tenant Name', 'Tenant Contact', 'Tenant Email', 'Agreement Period',
    'Police Verification', 'Agreement Registered',
    ...vehicleHeaders,
    'Has Pets', 'Membership Completed', 'Membership ID', 'Maintenance Paid Up To',
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: 'Units!A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [unitsHeader] },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: 'Submissions!A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [submissionsHeader] },
  });

  return { unitsColumns: unitsHeader.length, submissionsColumns: submissionsHeader.length };
}

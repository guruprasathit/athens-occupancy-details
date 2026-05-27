// ═══════════════════════════════════════════════════════════════
//  Athens Occupancy Form — Google Apps Script
//  Paste this entire file into your Google Sheet's Apps Script editor:
//  Extensions → Apps Script → replace Code.gs → Save → Deploy
// ═══════════════════════════════════════════════════════════════

// ── GET handler: lookup & setup ──────────────────────────────────

function doGet(e) {
  const action = (e.parameter.action || '').toLowerCase();

  if (action === 'lookup') {
    return lookup(e.parameter.unit || '');
  }
  if (action === 'setup') {
    return json(setupSheets());
  }

  return json({ error: 'Unknown action. Use ?action=lookup&unit=E103 or ?action=setup' });
}

// ── POST handler: save submission ────────────────────────────────

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action === 'submit') {
      return json(saveSubmission(body.data));
    }
    return json({ error: 'Unknown action' });
  } catch (err) {
    return json({ error: err.message });
  }
}

// ── Lookup unit from the Units sheet ─────────────────────────────

function lookup(unitNumber) {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Units');

  if (!sheet) return json({ error: 'Units sheet not found — run ?action=setup first' });

  const rows = sheet.getDataRange().getValues();
  const key  = unitNumber.replace(/[\s\-]/g, '').toUpperCase();

  for (var i = 1; i < rows.length; i++) {
    var row     = rows[i];
    var rowUnit = String(row[0]).replace(/[\s\-]/g, '').toUpperCase();

    if (rowUnit === key) {
      return json({
        unit_number:    String(row[0] || ''),
        block:          String(row[1] || ''),
        floor:          String(row[2] || ''),
        unit_type:      String(row[3] || ''),
        car_park:       String(row[4] || ''),
        owner_name:     String(row[5] || ''),
        contact:        String(row[6] || ''),
        whatsapp:       String(row[7] || ''),
        email:          String(row[8] || ''),
        occupancy_type: String(row[9] || ''),
        found: true
      });
    }
  }

  // Not in sheet — derive block/floor from the unit code itself
  var m     = key.match(/^([A-Z]+)(\d+)$/);
  var block  = m ? m[1] : '';
  var digits = m ? m[2] : '';
  var floor  = digits.length <= 3 ? digits.charAt(0) : digits.slice(0, -2);

  return json({ unit_number: key, block: block, floor: floor, found: false });
}

// ── Save a form submission to the Submissions sheet ──────────────

function saveSubmission(d) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Submissions');

  if (!sheet) {
    sheet = ss.insertSheet('Submissions');
    sheet.appendRow(buildSubmissionHeaders());
  }

  var now = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd/MM/yyyy HH:mm:ss');

  var memberFields = [];
  for (var i = 1; i <= 10; i++) {
    memberFields.push(d['member_' + i + '_name']     || '');
    memberFields.push(d['member_' + i + '_age']      || '');
    memberFields.push(d['member_' + i + '_relation'] || '');
  }

  var vehicleFields = [];
  for (var j = 1; j <= 5; j++) {
    vehicleFields.push(d['vehicle_' + j + '_type']   || '');
    vehicleFields.push(d['vehicle_' + j + '_make']   || '');
    vehicleFields.push(d['vehicle_' + j + '_reg']    || '');
    vehicleFields.push(d['vehicle_' + j + '_colour'] || '');
    vehicleFields.push(d['vehicle_' + j + '_fuel']   || '');
    vehicleFields.push(d['vehicle_' + j + '_park']   || '');
  }

  var row = [
    now,
    d.unit_number    || '',
    d.block          || '',
    d.floor          || '',
    d.unit_type      || '',
    d.car_park       || '',
    d.occupied_since || '',
    d.owner_name     || '',
    d.contact        || '',
    d.whatsapp       || '',
    d.email          || '',
    d.perm_address   || '',
    d.occupancy_type || '',
    d.total_occupants|| ''
  ].concat(memberFields).concat([
    d.tenant_name          || '',
    d.tenant_contact       || '',
    d.tenant_email         || '',
    d.agreement_period     || '',
    d.police_verification  || '',
    d.agreement_registered || ''
  ]).concat(vehicleFields).concat([
    d.has_pets                || '',
    d.membership_completed    || '',
    d.membership_id           || '',
    d.maintenance_paid_up_to  || ''
  ]);

  sheet.appendRow(row);
  return { success: true };
}

// ── Create sheet headers (run once via ?action=setup) ────────────

function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Units sheet
  var units = ss.getSheetByName('Units');
  if (!units) units = ss.insertSheet('Units');
  if (units.getLastRow() === 0) {
    units.appendRow([
      'Unit Number', 'Block', 'Floor', 'Unit Type', 'Car Park',
      'Owner Name', 'Contact', 'WhatsApp', 'Email', 'Occupancy Type', 'Notes'
    ]);
    // Format header row
    units.getRange(1, 1, 1, 11).setFontWeight('bold').setBackground('#1B3A6B').setFontColor('#FFFFFF');
    units.setFrozenRows(1);
  }

  // Submissions sheet
  var subs = ss.getSheetByName('Submissions');
  if (!subs) {
    subs = ss.insertSheet('Submissions');
    subs.appendRow(buildSubmissionHeaders());
    subs.getRange(1, 1, 1, subs.getLastColumn()).setFontWeight('bold').setBackground('#1B3A6B').setFontColor('#FFFFFF');
    subs.setFrozenRows(1);
  }

  return { success: true, message: 'Units and Submissions sheets are ready.' };
}

function buildSubmissionHeaders() {
  var headers = [
    'Submitted At', 'Unit Number', 'Block', 'Floor', 'Unit Type', 'Car Park',
    'Occupied Since', 'Owner Name', 'Contact', 'WhatsApp', 'Email',
    'Permanent Address', 'Occupancy Type', 'Total Occupants'
  ];
  for (var i = 1; i <= 10; i++) {
    headers.push('Member ' + i + ' Name', 'Member ' + i + ' Age', 'Member ' + i + ' Relation');
  }
  headers.push('Tenant Name', 'Tenant Contact', 'Tenant Email',
               'Agreement Period', 'Police Verification', 'Agreement Registered');
  for (var j = 1; j <= 5; j++) {
    headers.push('Vehicle ' + j + ' Type', 'Vehicle ' + j + ' Make', 'Vehicle ' + j + ' Reg',
                 'Vehicle ' + j + ' Colour', 'Vehicle ' + j + ' Fuel', 'Vehicle ' + j + ' Park');
  }
  headers.push('Has Pets', 'Membership Completed', 'Membership ID', 'Maintenance Paid Up To');
  return headers;
}

// ── Helper ───────────────────────────────────────────────────────

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

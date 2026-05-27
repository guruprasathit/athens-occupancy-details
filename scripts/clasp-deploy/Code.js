// ═══════════════════════════════════════════════════════════════
//  Athens Occupancy Form — Google Apps Script
//  Deployed as a standalone script via clasp.
// ═══════════════════════════════════════════════════════════════

// ── Spreadsheet binding ──────────────────────────────────────────
// Standalone scripts have no container sheet, so we open by ID.
var SPREADSHEET_ID = '1PbZ_ZK_NuNFcMPBHz4JeForCASTnnidHFSeNP-PXvwM';

function getSS() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

// ── GET handler ──────────────────────────────────────────────────

function doGet(e) {
  const action = (e.parameter.action || '').toLowerCase();

  if (action === 'lookup')           return lookup(e.parameter.unit || '');
  if (action === 'getsubmission')    return getSubmission(e.parameter.unit || '');
  if (action === 'getallsubmissions')return getAllSubmissions();
  if (action === 'setup')            return json(setupSheets());
  if (action === 'migrate')          return json(migrateUnitsSheet());

  return json({ error: 'Unknown action. Use ?action=lookup&unit=E103 | getsubmission | getallsubmissions | setup | migrate' });
}

// ── POST handler: save submission / batch import ─────────────────

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action === 'submit') {
      return json(saveSubmission(body.data));
    }
    if (body.action === 'batchimport') {
      return json(batchImport(body.units || []));
    }
    if (body.action === 'uploadfile') {
      return json(uploadFileToDrive(body));
    }
    return json({ error: 'Unknown action' });
  } catch (err) {
    return json({ error: err.message });
  }
}

// ── Lookup unit from the Units sheet ─────────────────────────────
// Uses header names (not fixed column positions) so it works even if
// columns were added/reordered before the Unique ID column was added.

function lookup(unitNumber) {
  var ss    = getSS();
  var sheet = ss.getSheetByName('Units');
  if (!sheet) return json({ error: 'Units sheet not found — run ?action=setup first' });

  var allRows = sheet.getDataRange().getValues();
  var headers = allRows[0];

  // Map each header name -> column index
  function col(name) {
    for (var h = 0; h < headers.length; h++) {
      if (String(headers[h]).trim() === name) return h;
    }
    return -1;
  }

  var iUnit   = col('Unit Number');   if (iUnit  < 0) iUnit  = 0;
  var iBlock  = col('Block');
  var iFloor  = col('Floor');
  var iType   = col('Unit Type');
  var iPark   = col('Car Park');
  var iOwner  = col('Owner Name');
  var iCont   = col('Contact');
  var iWA     = col('WhatsApp');
  var iEmail  = col('Email');
  var iOcc    = col('Occupancy Type');
  var iUID    = col('Unique ID');     // -1 if column not present yet

  var key = unitNumber.replace(/[\s\-]/g, '').toUpperCase();

  for (var i = 1; i < allRows.length; i++) {
    var row     = allRows[i];
    var rowUnit = String(row[iUnit]).replace(/[\s\-]/g, '').toUpperCase();

    if (rowUnit === key) {
      return json({
        unit_number:    String(row[iUnit]            || ''),
        block:          String(iBlock  >= 0 ? row[iBlock]  : '' || ''),
        floor:          String(iFloor  >= 0 ? row[iFloor]  : '' || ''),
        unit_type:      String(iType   >= 0 ? row[iType]   : '' || ''),
        car_park:       String(iPark   >= 0 ? row[iPark]   : '' || ''),
        owner_name:     String(iOwner  >= 0 ? row[iOwner]  : '' || ''),
        contact:        String(iCont   >= 0 ? row[iCont]   : '' || ''),
        whatsapp:       String(iWA     >= 0 ? row[iWA]     : '' || ''),
        email:          String(iEmail  >= 0 ? row[iEmail]  : '' || ''),
        occupancy_type: String(iOcc    >= 0 ? row[iOcc]    : '' || ''),
        unique_id:      String(iUID    >= 0 ? row[iUID]    : '' || ''),
        found: true
      });
    }
  }

  // Not in sheet — derive block/floor from unit code
  var m      = key.match(/^([A-Z]+)(\d+)$/);
  var block  = m ? m[1] : '';
  var digits = m ? m[2] : '';
  var floor  = digits.length <= 3 ? digits.charAt(0) : digits.slice(0, -2);
  return json({ unit_number: key, block: block, floor: floor, found: false });
}

// ── Fetch saved submission for a unit (primary key = unit number) ─

function getSubmission(unitNumber) {
  var ss    = getSS();
  var sheet = ss.getSheetByName('Submissions');
  if (!sheet) return json({ found: false });

  var rows    = sheet.getDataRange().getValues();
  var headers = rows[0];
  var key     = String(unitNumber).replace(/[\s\-]/g, '').toUpperCase();

  for (var i = 1; i < rows.length; i++) {
    var rowUnit = String(rows[i][1]).replace(/[\s\-]/g, '').toUpperCase(); // col B = Unit Number
    if (rowUnit === key) {
      var obj = { found: true };
      for (var c = 0; c < headers.length; c++) {
        // Convert header "Owner Name" → "owner_name" as the key
        var fieldKey = headers[c].toString().toLowerCase().replace(/\s+/g, '_');
        obj[fieldKey] = rows[i][c] !== undefined ? String(rows[i][c]) : '';
      }
      return json(obj);
    }
  }

  return json({ found: false });
}

// ── Save/update a submission (upsert: unit number is the primary key) ─

function saveSubmission(d) {
  var ss    = getSS();
  var sheet = ss.getSheetByName('Submissions');

  if (!sheet) {
    sheet = ss.insertSheet('Submissions');
    sheet.appendRow(buildSubmissionHeaders());
    sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold').setBackground('#1B3A6B').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }

  var now = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd/MM/yyyy HH:mm:ss');
  var key = String(d.unit_number || '').replace(/[\s\-]/g, '').toUpperCase();

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
    d.unique_id      || '',
    d.occupied_since || '',
    d.owner_name     || '',
    d.contact        || '',
    d.whatsapp       || '',
    d.email          || '',
    d.contact2       || '',
    d.whatsapp2      || '',
    d.email2         || '',
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
    d.maintenance_paid_up_to  || '',
    d.sale_deed_urls          || ''
  ]);

  // Upsert: find existing row for this unit and overwrite, otherwise append
  var rows = sheet.getDataRange().getValues();
  for (var r = 1; r < rows.length; r++) {
    var existingUnit = String(rows[r][1]).replace(/[\s\-]/g, '').toUpperCase();
    if (existingUnit === key) {
      sheet.getRange(r + 1, 1, 1, row.length).setValues([row]);
      return { success: true, action: 'updated', row: r + 1 };
    }
  }

  sheet.appendRow(row);
  return { success: true, action: 'inserted' };
}

// ── Auto-migrate Units sheet (fix headers + add Unique ID col) ───

function migrateUnitsSheet() {
  var ss    = getSS();
  var sheet = ss.getSheetByName('Units');
  var log   = [];

  if (!sheet) {
    setupSheets();
    log.push('Units sheet did not exist — created fresh with all headers.');
    return { success: true, actions: log };
  }

  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, Math.max(lastCol, 1)).getValues()[0];

  // Check if "Unique ID" already exists
  var uidIdx = -1;
  for (var h = 0; h < headers.length; h++) {
    if (String(headers[h]).trim() === 'Unique ID') { uidIdx = h; break; }
  }

  if (uidIdx >= 0) {
    log.push('Unique ID column already exists at col ' + (uidIdx + 1) + '. No changes needed.');
    return { success: true, actions: log };
  }

  // Find where "Occupancy Type" is so we insert Unique ID right after it
  var occIdx = -1;
  for (var h = 0; h < headers.length; h++) {
    if (String(headers[h]).trim() === 'Occupancy Type') { occIdx = h; break; }
  }

  var insertAt; // 1-based column number to insert at
  if (occIdx >= 0) {
    insertAt = occIdx + 2; // one column after Occupancy Type
    log.push('Found "Occupancy Type" at col ' + (occIdx + 1) + '. Inserting "Unique ID" at col ' + insertAt + '.');
  } else {
    insertAt = lastCol + 1; // append at end
    log.push('"Occupancy Type" not found. Appending "Unique ID" at col ' + insertAt + '.');
  }

  // Insert blank column and set header
  sheet.insertColumnBefore(insertAt);
  var cell = sheet.getRange(1, insertAt);
  cell.setValue('Unique ID').setFontWeight('bold').setBackground('#1B3A6B').setFontColor('#FFFFFF');
  log.push('Done. Column "Unique ID" added at col ' + insertAt + '.');
  log.push('Now run: python scripts/import_ids.py  (or use VLOOKUP) to populate the IDs.');

  return { success: true, actions: log };
}

// ── Batch-import Flat No → Unique ID mapping into Units sheet ────

function batchImport(units) {
  var ss    = getSS();
  var sheet = ss.getSheetByName('Units');

  if (!sheet) {
    sheet = ss.insertSheet('Units');
    sheet.appendRow([
      'Unit Number', 'Block', 'Floor', 'Unit Type', 'Car Park',
      'Owner Name', 'Contact', 'WhatsApp', 'Email', 'Occupancy Type', 'Unique ID', 'Notes'
    ]);
    sheet.getRange(1, 1, 1, 12).setFontWeight('bold').setBackground('#1B3A6B').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }

  // Auto-migrate if "Unique ID" column is missing
  var migrateResult = migrateUnitsSheet();

  // Find "Unique ID" column index (1-based) dynamically
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var uidCol  = 11; // fallback: col K
  for (var h = 0; h < headers.length; h++) {
    if (String(headers[h]).trim() === 'Unique ID') { uidCol = h + 1; break; }
  }
  var unitCol = 1; // Unit Number always col A

  // Build map: normalised unit → sheet row number (1-based)
  var rows   = sheet.getDataRange().getValues();
  var rowMap = {};
  for (var i = 1; i < rows.length; i++) {
    var k = String(rows[i][0]).replace(/[\s\-]/g, '').toUpperCase();
    if (k) rowMap[k] = i + 1;
  }

  var updated = 0, inserted = 0;

  for (var u = 0; u < units.length; u++) {
    var flatNo   = String(units[u].flat_no   || '').replace(/[\s\-]/g, '').toUpperCase();
    var uniqueId = String(units[u].unique_id || '');
    if (!flatNo || !uniqueId) continue;

    if (rowMap[flatNo]) {
      // Update the Unique ID cell for this unit's row
      sheet.getRange(rowMap[flatNo], uidCol).setValue(uniqueId);
      updated++;
    } else {
      // Derive block/floor and append new row
      var m      = flatNo.match(/^([A-Z]+)(\d+)$/);
      var block  = m ? m[1] : '';
      var digits = m ? m[2] : '';
      var floor  = digits.length <= 3 ? digits.charAt(0) : digits.slice(0, -2);
      var newRow = ['', '', '', '', '', '', '', '', '', '', ''];
      while (newRow.length < uidCol) newRow.push('');
      newRow[0]         = flatNo;
      newRow[1]         = block;
      newRow[2]         = floor;
      newRow[uidCol - 1] = uniqueId;
      sheet.appendRow(newRow);
      inserted++;
    }
  }

  return { success: true, updated: updated, inserted: inserted };
}

// ── Return all submissions (for admin dashboard) ─────────────────

function getAllSubmissions() {
  var ss    = getSS();
  var sheet = ss.getSheetByName('Submissions');
  if (!sheet || sheet.getLastRow() <= 1) return json({ submissions: [] });

  var rows    = sheet.getDataRange().getValues();
  var headers = rows[0];
  var submissions = [];

  for (var i = 1; i < rows.length; i++) {
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      var key = headers[c].toString().toLowerCase().replace(/\s+/g, '_');
      obj[key] = rows[i][c] !== undefined ? String(rows[i][c]) : '';
    }
    submissions.push(obj);
  }

  return json({ submissions: submissions });
}

// ── Create sheet headers (run once via ?action=setup) ────────────

function setupSheets() {
  var ss = getSS();

  // Units sheet
  var units = ss.getSheetByName('Units');
  if (!units) units = ss.insertSheet('Units');
  if (units.getLastRow() === 0) {
    units.appendRow([
      'Unit Number', 'Block', 'Floor', 'Unit Type', 'Car Park',
      'Owner Name', 'Contact', 'WhatsApp', 'Email', 'Occupancy Type', 'Unique ID', 'Notes'
    ]);
    units.getRange(1, 1, 1, 12).setFontWeight('bold').setBackground('#1B3A6B').setFontColor('#FFFFFF');
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
    'Unique ID', 'Occupied Since', 'Owner Name',
    'Primary Contact', 'Primary WhatsApp', 'Primary Email',
    'Secondary Contact', 'Secondary WhatsApp', 'Secondary Email',
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
  headers.push('Has Pets', 'Membership Completed', 'Membership ID', 'Maintenance Paid Up To', 'Sale Deed URLs');
  return headers;
}

// ── One-time Drive authorization helper (run this once from the editor) ─────
// Select this function in the Apps Script editor and click Run.
// It will trigger the Google Drive permission dialog.

function authoriseDriveAccess() {
  var folderName = 'Athens Occupancy - Sale Deeds';
  var root       = DriveApp.getRootFolder();
  var folders    = root.getFoldersByName(folderName);
  var folder     = folders.hasNext() ? folders.next() : root.createFolder(folderName);
  Logger.log('Drive authorised. Folder: ' + folder.getName() + ' (' + folder.getId() + ')');
  return { success: true, folder: folder.getName() };
}

// ── Upload file to Google Drive ──────────────────────────────────
// Called via doPost {action:'uploadfile', filename, mimeType, base64, unitNumber}

function uploadFileToDrive(data) {
  var folderName = 'Athens Occupancy - Sale Deeds';
  var root       = DriveApp.getRootFolder();
  var folders    = root.getFoldersByName(folderName);
  var folder     = folders.hasNext() ? folders.next() : root.createFolder(folderName);

  // Sub-folder per unit (keeps things tidy)
  var unit        = (data.unitNumber || 'Unknown').toString().replace(/[\/\\:*?"<>|]/g, '_');
  var unitFolders = folder.getFoldersByName(unit);
  var unitFolder  = unitFolders.hasNext() ? unitFolders.next() : folder.createFolder(unit);

  var bytes = Utilities.base64Decode(data.base64);
  var blob  = Utilities.newBlob(bytes, data.mimeType, data.filename);
  var file  = unitFolder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    success:  true,
    fileId:   file.getId(),
    url:      'https://drive.google.com/file/d/' + file.getId() + '/view',
    name:     file.getName(),
    size:     file.getSize()
  };
}

// ── Helper ───────────────────────────────────────────────────────

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

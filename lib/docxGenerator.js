import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  BorderStyle, WidthType, ShadingType, AlignmentType, VerticalAlign,
} from 'docx';

// ── Constants ─────────────────────────────────────────────────────────────────
const W = 10800; // content width DXA (8.5" - 0.5" margins each side)

const C = {
  DARK:  '1B3A6B',
  MED:   '3A5080',
  LIGHT: 'DCE8F5',
  LINE:  'B8C9E0',
  WHITE: 'FFFFFF',
  GREY:  'F0F4F8',
  TEXT:  '1A1A1A',
  DIM:   '888888',
};

const AGE_RANGES = ['0-7', '8-14', '15-24', '25-44', '44-59', '60-74', '75+'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function bdr(color = C.LINE) {
  const b = { style: BorderStyle.SINGLE, size: 4, color };
  return { top: b, bottom: b, left: b, right: b };
}

function noBdr() {
  const b = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  return { top: b, bottom: b, left: b, right: b };
}

function labelPara(text) {
  return new Paragraph({
    spacing: { before: 0, after: 30 },
    children: [new TextRun({ text, bold: true, color: C.MED, size: 15 })],
  });
}

function valuePara(text, bold = false) {
  return new Paragraph({
    spacing: { before: 0, after: 0 },
    children: [new TextRun({
      text: String(text || ''),
      size: 20,
      color: text ? C.TEXT : C.DIM,
      bold,
    })],
  });
}

function radioText(options, selected) {
  return options.map(o => {
    const match = selected && o.toLowerCase().includes(selected.toLowerCase());
    return (match ? '● ' : '○ ') + o;
  }).join('     ');
}

function ageText(selectedAge) {
  return AGE_RANGES.map(r => {
    const selected = selectedAge && selectedAge.replace(/\s/g, '') === r.replace(/\s/g, '');
    return (selected ? '☑' : '☐') + ' ' + r;
  }).join('  ');
}

// TableCell builder
function tc(w, label, value, opts = {}) {
  const shade = opts.shade ?? C.LIGHT;
  const borders = opts.borders ?? bdr();
  const cs = opts.columnSpan;
  const children = [];
  if (label) children.push(labelPara(label));
  if (value !== undefined) {
    if (label === 'Age' && value !== undefined) {
      children.push(new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: ageText(value), size: 16, color: C.TEXT })],
      }));
    } else {
      children.push(valuePara(value, opts.valueBold));
    }
  }
  const cfg = {
    width: { size: w, type: WidthType.DXA },
    borders,
    shading: { fill: shade, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children,
  };
  if (cs) cfg.columnSpan = cs;
  return new TableCell(cfg);
}

// Dark header cell
function hdrCell(w, text, cs) {
  const cfg = {
    width: { size: w, type: WidthType.DXA },
    borders: bdr(C.DARK),
    shading: { fill: C.DARK, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, color: C.WHITE, size: 18 })],
    })],
  };
  if (cs) cfg.columnSpan = cs;
  return new TableCell(cfg);
}

// Section header row (full-width, dark blue)
function sectionHdrRow(num, title, cols, colWidths) {
  const numW = colWidths[0];
  const titleW = W - numW;
  return new TableRow({
    children: [
      new TableCell({
        width: { size: numW, type: WidthType.DXA },
        borders: bdr(C.DARK),
        shading: { fill: C.DARK, type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 80, right: 80 },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: num, bold: true, color: C.WHITE, size: 24 })],
        })],
        ...(cols > 2 ? { columnSpan: 1 } : {}),
      }),
      new TableCell({
        width: { size: titleW, type: WidthType.DXA },
        borders: bdr(C.DARK),
        shading: { fill: C.DARK, type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 160, right: 80 },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
          children: [new TextRun({ text: title, bold: true, color: C.WHITE, size: 20 })],
        })],
        columnSpan: cols - 1,
      }),
    ],
  });
}

function makeTable(columnWidths, rows) {
  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths,
    rows,
  });
}

// ── Section builders ──────────────────────────────────────────────────────────

function buildHeader(d) {
  return makeTable([W], [
    new TableRow({ children: [
      new TableCell({
        width: { size: W, type: WidthType.DXA },
        borders: bdr(C.DARK),
        shading: { fill: C.DARK, type: ShadingType.CLEAR },
        margins: { top: 160, bottom: 160, left: 200, right: 200 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 60 },
            children: [new TextRun({ text: 'OCCUPANCY DETAILS FORM', bold: true, color: C.WHITE, size: 32 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [new TextRun({ text: 'Resident Registration & Unit Information Record  |  Casagrand Athens Phase I', color: 'A8C4E0', size: 17 })],
          }),
        ],
      }),
    ]}),
    new TableRow({ children: [
      new TableCell({
        width: { size: W, type: WidthType.DXA },
        borders: bdr(),
        shading: { fill: C.GREY, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 160, right: 160 },
        children: [new Paragraph({
          children: [
            new TextRun({ text: 'Unit No:  ', bold: true, color: C.MED, size: 18 }),
            new TextRun({ text: d.unit_number || '', bold: true, color: C.DARK, size: 20 }),
            ...(d.unique_id ? [
              new TextRun({ text: '     Unique ID:  ', bold: true, color: C.MED, size: 18 }),
              new TextRun({ text: d.unique_id, bold: true, color: C.DARK, size: 18 }),
            ] : []),
            new TextRun({ text: '     Date:  ', bold: true, color: C.MED, size: 18 }),
            new TextRun({ text: d.date || '_____ / _____ / _______', size: 18, color: C.TEXT }),
          ],
        })],
      }),
    ]}),
  ]);
}

function buildUnitInfo(d) {
  const c4 = Math.floor(W / 4);
  const c2 = Math.floor(W / 2);
  return makeTable([c4, c4, c4, W - c4 * 3], [
    sectionHdrRow('01', 'UNIT INFORMATION', 4, [c4]),
    new TableRow({ children: [
      tc(c4, 'Block / Tower *', d.block),
      tc(c4, 'Floor No.', d.floor),
      tc(c4, 'Unit Number *', d.unit_number, { valueBold: true }),
      tc(W - c4 * 3, 'Unit Type', d.unit_type),
    ]}),
    new TableRow({ children: [
      tc(c2, 'Car Park Slot(s)', d.car_park, { columnSpan: 2 }),
      tc(W - c2, 'Occupied Since (Month & Year) *', d.occupied_since, { columnSpan: 2 }),
    ]}),
  ]);
}

function buildOwnerDetails(d) {
  const c3 = Math.floor(W / 3);
  return makeTable([c3, c3, W - c3 * 2], [
    sectionHdrRow('02', 'OWNER DETAILS', 3, [c3]),
    new TableRow({ children: [
      tc(W, 'Full Name of Owner *', d.owner_name, { columnSpan: 3 }),
    ]}),
    new TableRow({ children: [
      tc(c3, 'Primary Contact *', d.contact),
      tc(c3, 'WhatsApp No.', d.whatsapp),
      tc(W - c3 * 2, 'Email Address', d.email),
    ]}),
    new TableRow({ children: [
      tc(W, 'Permanent Address (if different from this unit)', d.perm_address, { columnSpan: 3 }),
    ]}),
  ]);
}

function buildOccupancy(d) {
  const occOpts = ['Owner Occupied', 'Tenant Occupied', 'Vacant'];
  const occTxt = radioText(occOpts, d.occupancy_type);
  const c6 = Math.floor(W * 0.6);
  const c4 = W - c6;
  // Member column widths: name 55%, age 20%, relation 25%
  const cName = Math.floor(W * 0.55);
  const cAge  = Math.floor(W * 0.20);
  const cRel  = W - cName - cAge;

  const memberRows = Array.from({ length: 10 }, (_, i) => {
    const n = i + 1;
    return new TableRow({ children: [
      tc(cName, n === 1 ? 'Name — Member 1' : `Name — Member ${n}`, d[`member_${n}_name`]),
      tc(cAge, 'Age', d[`member_${n}_age`]),
      tc(cRel, 'Relation to Owner', d[`member_${n}_relation`]),
    ]});
  });

  return makeTable([cName, cAge, cRel], [
    sectionHdrRow('03', 'OCCUPANCY STATUS & MEMBERS', 3, [cName]),
    new TableRow({ children: [
      new TableCell({
        width: { size: c6, type: WidthType.DXA },
        columnSpan: 2,
        borders: bdr(),
        shading: { fill: C.LIGHT, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [labelPara('Occupancy Type *'), new Paragraph({
          children: [new TextRun({ text: occTxt, size: 18, color: C.TEXT })],
        })],
      }),
      tc(c4, 'Total No. of Occupants', d.total_occupants),
    ]}),
    new TableRow({ children: [
      new TableCell({
        width: { size: W, type: WidthType.DXA },
        columnSpan: 3,
        borders: bdr(C.MED),
        shading: { fill: C.MED, type: ShadingType.CLEAR },
        margins: { top: 60, bottom: 60, left: 120, right: 120 },
        children: [new Paragraph({
          children: [new TextRun({ text: 'MEMBERS — Name, Age & Relation  (up to 10)', bold: true, color: C.WHITE, size: 17 })],
        })],
      }),
    ]}),
    ...memberRows,
  ]);
}

function buildTenantDetails(d) {
  const c3 = Math.floor(W / 3);
  const c35 = Math.floor(W * 0.35);
  const c30 = Math.floor(W * 0.3);
  const cRem = W - c35 - c30;
  const polTxt = radioText(['Yes', 'No', 'N/A'], d.police_verification);
  const agrTxt = radioText(['Yes', 'No'], d.agreement_registered);

  return makeTable([c35, c30, cRem], [
    sectionHdrRow('04', 'TENANT DETAILS  (IF RENTED)', 3, [c35]),
    new TableRow({ children: [
      tc(c3, 'Primary Tenant Name', d.tenant_name, { columnSpan: 1 }),
      tc(c3, 'Tenant Contact No.', d.tenant_contact),
      tc(W - c3 * 2, 'Tenant Email', d.tenant_email),
    ]}),
    new TableRow({ children: [
      tc(c35, 'Agreement Period  (From — To)', d.agreement_period),
      new TableCell({
        width: { size: c30, type: WidthType.DXA },
        borders: bdr(), shading: { fill: C.LIGHT, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [labelPara('Police Verification'), new Paragraph({
          children: [new TextRun({ text: polTxt, size: 17, color: C.TEXT })],
        })],
      }),
      new TableCell({
        width: { size: cRem, type: WidthType.DXA },
        borders: bdr(), shading: { fill: C.LIGHT, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [labelPara('Agreement Registered'), new Paragraph({
          children: [new TextRun({ text: agrTxt, size: 17, color: C.TEXT })],
        })],
      }),
    ]}),
  ]);
}

function buildVehicles(d) {
  const vw = (() => {
    const cols = [
      Math.floor(W * 0.10), Math.floor(W * 0.22), Math.floor(W * 0.22),
      Math.floor(W * 0.13), Math.floor(W * 0.12), 0,
    ];
    cols[5] = W - cols.slice(0, 5).reduce((a, b) => a + b, 0);
    return cols;
  })();

  const dataRows = Array.from({ length: 5 }, (_, i) => {
    const n = i + 1;
    return new TableRow({ children: [
      tc(vw[0], '', d[`vehicle_${n}_type`], { shade: C.WHITE }),
      tc(vw[1], '', d[`vehicle_${n}_make`], { shade: C.WHITE }),
      tc(vw[2], '', d[`vehicle_${n}_reg`],  { shade: C.WHITE }),
      tc(vw[3], '', d[`vehicle_${n}_colour`],{ shade: C.WHITE }),
      tc(vw[4], '', d[`vehicle_${n}_fuel`], { shade: C.WHITE }),
      tc(vw[5], '', d[`vehicle_${n}_park`], { shade: C.WHITE }),
    ]});
  });

  return makeTable(vw, [
    sectionHdrRow('05', 'VEHICLE DETAILS  (UP TO 5)', 6, [vw[0]]),
    new TableRow({ children: [
      hdrCell(vw[0], 'Type'),
      hdrCell(vw[1], 'Make / Model'),
      hdrCell(vw[2], 'Registration No.'),
      hdrCell(vw[3], 'Colour'),
      hdrCell(vw[4], 'Fuel'),
      hdrCell(vw[5], 'Park Slot'),
    ]}),
    ...dataRows,
  ]);
}

function buildPets(d) {
  // 8 columns: Pet Name, Type/Breed, Age, Gender, Vaccinated?, Last Vacc. Date, Next Due Date, Cert Status
  const pw = (() => {
    const cols = [
      Math.floor(W * 0.18), // Pet Name
      Math.floor(W * 0.18), // Type / Breed
      Math.floor(W * 0.08), // Age
      Math.floor(W * 0.09), // Gender
      Math.floor(W * 0.09), // Vaccinated?
      Math.floor(W * 0.13), // Last Vacc. Date
      Math.floor(W * 0.13), // Next Due Date
      0,                    // Certificate Status (remaining)
    ];
    cols[7] = W - cols.slice(0, 7).reduce((a, b) => a + b, 0);
    return cols;
  })();

  const petsTxt = radioText(['Yes', 'No'], d.has_pets);
  const petRows = Array.from({ length: 5 }, (_, i) => {
    const n = i + 1;
    return new TableRow({ children: [
      tc(pw[0], '', d[`pet_${n}_name`],          { shade: C.WHITE }),
      tc(pw[1], '', d[`pet_${n}_breed`],          { shade: C.WHITE }),
      tc(pw[2], '', d[`pet_${n}_age`],            { shade: C.WHITE }),
      tc(pw[3], '', d[`pet_${n}_gender`],         { shade: C.WHITE }),
      tc(pw[4], '', d[`pet_${n}_vaccinated`],     { shade: C.WHITE }),
      tc(pw[5], '', d[`pet_${n}_vacc_date`],      { shade: C.WHITE }),
      tc(pw[6], '', d[`pet_${n}_next_vacc_date`], { shade: C.WHITE }),
      tc(pw[7], '', d[`pet_${n}_cert_status`],    { shade: C.WHITE }),
    ]});
  });

  return makeTable(pw, [
    sectionHdrRow('06', 'PET DETAILS & VACCINATION', 8, [pw[0]]),
    new TableRow({ children: [
      new TableCell({
        width: { size: W, type: WidthType.DXA },
        columnSpan: 8,
        borders: bdr(), shading: { fill: C.LIGHT, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [labelPara('Do you have pets? *'), new Paragraph({
          children: [new TextRun({ text: petsTxt, size: 18, color: C.TEXT })],
        })],
      }),
    ]}),
    new TableRow({ children: [
      hdrCell(pw[0], 'Pet Name'),
      hdrCell(pw[1], 'Type / Breed'),
      hdrCell(pw[2], 'Age'),
      hdrCell(pw[3], 'Gender'),
      hdrCell(pw[4], 'Vaccinated?'),
      hdrCell(pw[5], 'Last Vacc. Date'),
      hdrCell(pw[6], 'Next Due Date'),
      hdrCell(pw[7], 'Cert. Status'),
    ]}),
    ...petRows,
  ]);
}

function buildMembership(d) {
  const memTxt = radioText(['Yes', 'No'], d.membership_completed);
  const c35 = Math.floor(W * 0.35);
  const c30 = Math.floor(W * 0.30);
  const cRem = W - c35 - c30;

  return makeTable([c35, c30, cRem], [
    sectionHdrRow('07', 'ASSOCIATION MEMBERSHIP', 3, [c35]),
    new TableRow({ children: [
      new TableCell({
        width: { size: c35, type: WidthType.DXA },
        borders: bdr(), shading: { fill: C.LIGHT, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [labelPara('Membership Completed? *'), new Paragraph({
          children: [new TextRun({ text: memTxt, size: 18, color: C.TEXT })],
        })],
      }),
      tc(c30, 'Membership ID  (if issued)', d.membership_id),
      tc(cRem, 'Maintenance Paid Up To', d.maintenance_paid_up_to),
    ]}),
  ]);
}

function buildDocuments(d) {
  const c2 = Math.floor(W / 2);
  const ch1 = d.doc_tenant_agreement ? '☑' : '☐';
  const ch2 = d.doc_pet_cert ? '☑' : '☐';

  return makeTable([c2, W - c2], [
    sectionHdrRow('08', 'DOCUMENTS ENCLOSED — CHECKLIST', 2, [c2]),
    new TableRow({ children: [
      new TableCell({
        width: { size: c2, type: WidthType.DXA },
        borders: bdr(), shading: { fill: C.LIGHT, type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: `${ch1}  Tenant Agreement Copy — Attached`, size: 18, color: C.TEXT })] })],
      }),
      new TableCell({
        width: { size: W - c2, type: WidthType.DXA },
        borders: bdr(), shading: { fill: C.LIGHT, type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: `${ch2}  Pet Vaccination Certificate — Enclosed`, size: 18, color: C.TEXT })] })],
      }),
    ]}),
  ]);
}

function buildDeclaration(d) {
  const c6 = Math.floor(W * 0.6);
  return makeTable([c6, W - c6], [
    new TableRow({ children: [
      new TableCell({
        width: { size: W, type: WidthType.DXA },
        columnSpan: 2,
        borders: bdr(),
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({
          spacing: { before: 0, after: 0 },
          children: [
            new TextRun({ text: 'Declaration:  ', bold: true, size: 17, color: C.MED }),
            new TextRun({ text: 'I / We declare that the above information is true and accurate. I / We agree to abide by the rules and bye-laws of the Casagrand Athens Apartment Owners Association, Phase 1. Any change in occupancy details will be notified to the Association Office within 15 days.', size: 16, color: C.TEXT }),
          ],
        })],
      }),
    ]}),
    new TableRow({ children: [
      tc(c6, 'Signature of Owner / Authorised Signatory', ''),
      tc(W - c6, 'Date  (DD / MM / YYYY)', d.date || ''),
    ]}),
    new TableRow({ children: [
      new TableCell({
        width: { size: W, type: WidthType.DXA },
        columnSpan: 2,
        borders: bdr(C.MED),
        shading: { fill: C.GREY, type: ShadingType.CLEAR },
        margins: { top: 60, bottom: 60, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: 'FOR OFFICE USE ONLY', bold: true, color: C.MED, size: 17 })] })],
      }),
    ]}),
    new TableRow({ children: [
      tc(Math.floor(W / 3), 'Received By', ''),
      tc(Math.floor(W / 3), 'Date of Receipt', ''),
      tc(W - Math.floor(W / 3) * 2, 'Verified By', ''),
    ]}),
  ]);
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateFormDocx(data) {
  const d = data || {};

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children: [
        buildHeader(d),
        new Paragraph({ spacing: { before: 0, after: 60 }, children: [] }),
        buildUnitInfo(d),
        new Paragraph({ spacing: { before: 0, after: 60 }, children: [] }),
        buildOwnerDetails(d),
        new Paragraph({ spacing: { before: 0, after: 60 }, children: [] }),
        buildOccupancy(d),
        new Paragraph({ spacing: { before: 0, after: 60 }, children: [] }),
        buildTenantDetails(d),
        new Paragraph({ spacing: { before: 0, after: 60 }, children: [] }),
        buildVehicles(d),
        new Paragraph({ spacing: { before: 0, after: 60 }, children: [] }),
        buildPets(d),
        new Paragraph({ spacing: { before: 0, after: 60 }, children: [] }),
        buildMembership(d),
        new Paragraph({ spacing: { before: 0, after: 60 }, children: [] }),
        buildDocuments(d),
        new Paragraph({ spacing: { before: 0, after: 60 }, children: [] }),
        buildDeclaration(d),
      ],
    }],
  });

  return Packer.toBuffer(doc);
}

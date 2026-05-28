// pdfmake v0.3 ships compiled CJS in js/ — import the correct sub-paths
import PdfPrinter from 'pdfmake/js/Printer';
import URLResolver from 'pdfmake/js/URLResolver';
import virtualfs   from 'pdfmake/js/virtual-fs';   // singleton object, not a class

// ── Font registration (base-14 PDF fonts — no VFS/file embedding needed) ──────
const fonts = {
  Helvetica: {
    normal:      'Helvetica',
    bold:        'Helvetica-Bold',
    italics:     'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};

// v0.3 constructor: PdfPrinter(fontDescriptors, virtualfs, urlResolver, localAccessPolicy)
function makePrinter() {
  const resolver = new URLResolver(virtualfs);
  return new PdfPrinter(fonts, virtualfs, resolver);
}

// ── Constants ─────────────────────────────────────────────────────────────────
const W = 540; // content width in pt  (Letter 612 - 36pt margins each side)

const C = {
  DARK:  '#1B3A6B',
  MED:   '#3A5080',
  LIGHT: '#DCE8F5',
  LINE:  '#B8C9E0',
  WHITE: '#FFFFFF',
  GREY:  '#F0F4F8',
  TEXT:  '#1A1A1A',
  DIM:   '#888888',
};

const AGE_RANGES = ['0-7', '8-14', '15-24', '25-44', '44-59', '60-74', '75+'];

// Shared table layout
const TABLE_LAYOUT = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => C.LINE,
  vLineColor: () => C.LINE,
  paddingLeft:   () => 0,
  paddingRight:  () => 0,
  paddingTop:    () => 0,
  paddingBottom: () => 0,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function radioStr(options, selected) {
  return options.map(o => {
    const match = selected && o.toLowerCase().includes(selected.toLowerCase());
    return (match ? '[X] ' : '[ ] ') + o;
  }).join('   ');
}

function ageStr(selectedAge) {
  return AGE_RANGES.map(r => {
    const sel = selectedAge && selectedAge.replace(/\s/g, '') === r.replace(/\s/g, '');
    return (sel ? '[X] ' : '[ ] ') + r;
  }).join('  ');
}

function lbl(text) {
  return { text, fontSize: 7, bold: true, color: C.MED };
}

// Cell with optional label + value
function cell(label, value, fillColor, opts = {}) {
  const bg = fillColor !== undefined ? fillColor : C.LIGHT;
  const stack = [];
  if (label) stack.push({ ...lbl(label), margin: [0, 0, 0, 2] });
  if (value !== undefined) {
    if (label === 'Age') {
      stack.push({ text: ageStr(value), fontSize: 7.5, color: C.TEXT });
    } else {
      stack.push({
        text: String(value || ''),
        fontSize: 9,
        color: value ? C.TEXT : C.DIM,
        bold: opts.bold || false,
      });
    }
  }
  const cfg = { stack, fillColor: bg, margin: [4, 3, 4, 3] };
  if (opts.colSpan) cfg.colSpan = opts.colSpan;
  return cfg;
}

// Dark section-number + title row
function sectionHdr(num, title, totalCols) {
  const row = [
    { text: num,   fontSize: 11, bold: true, color: C.WHITE, fillColor: C.DARK, alignment: 'center', margin: [3, 5, 3, 5] },
    { text: title, fontSize:  9, bold: true, color: C.WHITE, fillColor: C.DARK, margin: [6, 5, 4, 5], colSpan: totalCols - 1 },
  ];
  for (let i = 2; i < totalCols; i++) row.push({});
  return row;
}

// Medium-blue sub-header (members label etc.)
function subHdr(text, totalCols) {
  const row = [
    { text, fontSize: 8, bold: true, color: C.WHITE, fillColor: C.MED, margin: [4, 3, 4, 3], colSpan: totalCols },
  ];
  for (let i = 1; i < totalCols; i++) row.push({});
  return row;
}

// Dark column-header cell (vehicles / pets tables)
function colHdr(text) {
  return { text, fontSize: 7.5, bold: true, color: C.WHITE, fillColor: C.DARK, margin: [4, 3, 4, 3] };
}

function tbl(widths, body) {
  return { table: { widths, body }, layout: TABLE_LAYOUT, margin: [0, 0, 0, 3] };
}

// ── Section builders ──────────────────────────────────────────────────────────

function buildHeader(d) {
  return tbl([W], [
    [{
      stack: [
        { text: 'OCCUPANCY DETAILS FORM', fontSize: 16, bold: true, color: C.WHITE, alignment: 'center', margin: [0, 0, 0, 2] },
        { text: 'Resident Registration & Unit Information Record  |  Casagrand Athens Phase I', fontSize: 8, color: '#A8C4E0', alignment: 'center' },
      ],
      fillColor: C.DARK,
      margin: [8, 8, 8, 8],
    }],
    [{
      text: [
        { text: 'Unit No:  ', bold: true, color: C.MED, fontSize: 9 },
        { text: d.unit_number || '', bold: true, color: C.DARK, fontSize: 10 },
        ...(d.unique_id ? [
          { text: '     Unique ID:  ', bold: true, color: C.MED, fontSize: 9 },
          { text: d.unique_id, bold: true, color: C.DARK, fontSize: 9 },
        ] : []),
        { text: '     Date:  ', bold: true, color: C.MED, fontSize: 9 },
        { text: d.date || '_____ / _____ / _______', color: C.TEXT, fontSize: 9 },
      ],
      fillColor: C.GREY,
      margin: [8, 5, 8, 5],
    }],
  ]);
}

function buildUnitInfo(d) {
  const q   = Math.floor(W / 4);   // 135
  const q4  = W - q * 3;           // last col remainder

  return tbl([q, q, q, q4], [
    sectionHdr('01', 'UNIT INFORMATION', 4),
    [
      cell('Block / Tower *',  d.block),
      cell('Floor No.',        d.floor),
      cell('Unit Number *',    d.unit_number, C.LIGHT, { bold: true }),
      cell('Unit Type',        d.unit_type),
    ],
    [
      cell('Car Park Slot(s)',                    d.car_park,       C.LIGHT, { colSpan: 2 }), {},
      cell('Occupied Since (Month & Year) *',     d.occupied_since, C.LIGHT, { colSpan: 2 }), {},
    ],
  ]);
}

function buildOwnerDetails(d) {
  const t   = Math.floor(W / 3); // 180
  const t3  = W - t * 2;

  // Permanent address: show "Same as this unit" or the actual address
  const permDisplay = d.perm_address_type === 'same'
    ? 'Same as this unit'
    : (d.perm_address || '');

  return tbl([t, t, t3], [
    sectionHdr('02', 'OWNER DETAILS', 3),
    [cell('Full Name of Owner *', d.owner_name, C.LIGHT, { colSpan: 3 }), {}, {}],
    [
      cell('Primary Contact *', d.contact),
      cell('Primary WhatsApp *', d.whatsapp),
      cell('Primary Email *',    d.email),
    ],
    [
      cell('Secondary Contact',  d.contact2  || ''),
      cell('Secondary WhatsApp', d.whatsapp2 || ''),
      cell('Secondary Email',    d.email2    || ''),
    ],
    [cell('Permanent Address', permDisplay, C.LIGHT, { colSpan: 3 }), {}, {}],
  ]);
}

function buildOccupancy(d) {
  const cName = Math.floor(W * 0.55); // 297
  const cAge  = Math.floor(W * 0.20); // 108
  const cRel  = W - cName - cAge;     // 135

  const occTxt = radioStr(['Owner Occupied', 'Tenant Occupied', 'Vacant'], d.occupancy_type);

  const headerRow = [
    {
      stack: [
        { ...lbl('Occupancy Type *'), margin: [0, 0, 0, 2] },
        { text: occTxt, fontSize: 8.5, color: C.TEXT },
      ],
      fillColor: C.LIGHT, margin: [4, 3, 4, 3], colSpan: 2,
    },
    {},
    cell('Total No. of Occupants', d.total_occupants),
  ];

  // Only show member rows for owner / vacant occupancy (not for tenant)
  const isTenant = d.occupancy_type === 'tenant';
  if (isTenant) {
    return tbl([cName, cAge, cRel], [
      sectionHdr('03', 'OCCUPANCY STATUS & MEMBERS', 3),
      headerRow,
    ]);
  }

  const memberRows = Array.from({ length: 10 }, (_, i) => {
    const n = i + 1;
    return [
      cell(`Name — Member ${n}`, d[`member_${n}_name`]     || ''),
      cell('Age',                d[`member_${n}_age`]      || ''),
      cell('Relation to Owner',  d[`member_${n}_relation`] || ''),
    ];
  });

  return tbl([cName, cAge, cRel], [
    sectionHdr('03', 'OCCUPANCY STATUS & MEMBERS', 3),
    headerRow,
    subHdr('MEMBERS — Name, Age & Relation  (up to 10)', 3),
    ...memberRows,
  ]);
}

// Returns an array of content blocks (main table + family members table),
// or empty array when occupancy is not 'tenant'.
function buildTenantDetails(d) {
  // Only show for tenant occupancy (or when occupancy type is unknown / blank form)
  if (d.occupancy_type && d.occupancy_type !== 'tenant') return [];

  const a   = Math.floor(W * 0.35); // 189
  const b   = Math.floor(W * 0.30); // 162
  const c   = W - a - b;            // 189
  const polTxt = radioStr(['Yes', 'No', 'N/A'], d.police_verification);
  const agrTxt = radioStr(['Yes', 'No'],        d.agreement_registered);

  const cName = Math.floor(W * 0.45); // 243
  const cAge  = Math.floor(W * 0.20); // 108
  const cRel  = W - cName - cAge;     // 189

  const tenantMemberRows = Array.from({ length: 6 }, (_, i) => {
    const n = i + 1;
    return [
      cell('', d[`tenant_member_${n}_name`]     || '', C.WHITE),
      cell('', d[`tenant_member_${n}_age`]      || '', C.WHITE),
      cell('', d[`tenant_member_${n}_relation`] || '', C.WHITE),
    ];
  });

  return [
    tbl([a, b, c], [
      sectionHdr('04', 'TENANT DETAILS', 3),
      [
        cell('Primary Tenant Name', d.tenant_name),
        cell('Age Range',           d.tenant_age || ''),
        cell('Tenant Contact No.',  d.tenant_contact),
      ],
      [
        cell('Tenant Email', d.tenant_email),
        cell('Agreement Period  (From — To)', d.agreement_period),
        cell('', '', C.LIGHT),
      ],
      [
        {
          stack: [{ ...lbl('Police Verification'), margin: [0, 0, 0, 2] }, { text: polTxt, fontSize: 8, color: C.TEXT }],
          fillColor: C.LIGHT, margin: [4, 3, 4, 3], colSpan: 2,
        },
        {},
        {
          stack: [{ ...lbl('Agreement Registered'), margin: [0, 0, 0, 2] }, { text: agrTxt, fontSize: 8, color: C.TEXT }],
          fillColor: C.LIGHT, margin: [4, 3, 4, 3],
        },
      ],
    ]),
    tbl([cName, cAge, cRel], [
      subHdr('TENANT FAMILY MEMBERS  (up to 6)', 3),
      [colHdr('Name'), colHdr('Age Range'), colHdr('Relation to Tenant')],
      ...tenantMemberRows,
    ]),
  ];
}

function buildVehicles(d) {
  const vw = [
    Math.floor(W * 0.10), // 54   Type
    Math.floor(W * 0.22), // 118  Make/Model
    Math.floor(W * 0.22), // 118  Reg No.
    Math.floor(W * 0.13), // 70   Colour
    Math.floor(W * 0.12), // 64   Fuel
    0,                    //      Park Slot (remainder)
  ];
  vw[5] = W - vw.slice(0, 5).reduce((s, v) => s + v, 0);

  const dataRows = Array.from({ length: 5 }, (_, i) => {
    const n = i + 1;
    return [
      cell('', d[`vehicle_${n}_type`]   || '', C.WHITE),
      cell('', d[`vehicle_${n}_make`]   || '', C.WHITE),
      cell('', d[`vehicle_${n}_reg`]    || '', C.WHITE),
      cell('', d[`vehicle_${n}_colour`] || '', C.WHITE),
      cell('', d[`vehicle_${n}_fuel`]   || '', C.WHITE),
      cell('', d[`vehicle_${n}_park`]   || '', C.WHITE),
    ];
  });

  return tbl(vw, [
    sectionHdr('05', 'VEHICLE DETAILS  (UP TO 5)', 6),
    [colHdr('Type'), colHdr('Make / Model'), colHdr('Registration No.'), colHdr('Colour'), colHdr('Fuel'), colHdr('Park Slot')],
    ...dataRows,
  ]);
}

function buildPets(d) {
  const pw = [
    Math.floor(W * 0.18), // 97   Pet Name
    Math.floor(W * 0.18), // 97   Type/Breed
    Math.floor(W * 0.08), // 43   Age
    Math.floor(W * 0.09), // 48   Gender
    Math.floor(W * 0.09), // 48   Vaccinated?
    Math.floor(W * 0.13), // 70   Last Vacc Date
    Math.floor(W * 0.13), // 70   Next Due Date
    0,                    //      Cert Status (remainder)
  ];
  pw[7] = W - pw.slice(0, 7).reduce((s, v) => s + v, 0);

  const petsTxt = radioStr(['Yes', 'No'], d.has_pets);

  const petRows = Array.from({ length: 5 }, (_, i) => {
    const n = i + 1;
    return [
      cell('', d[`pet_${n}_name`]           || '', C.WHITE),
      cell('', d[`pet_${n}_breed`]          || '', C.WHITE),
      cell('', d[`pet_${n}_age`]            || '', C.WHITE),
      cell('', d[`pet_${n}_gender`]         || '', C.WHITE),
      cell('', d[`pet_${n}_vaccinated`]     || '', C.WHITE),
      cell('', d[`pet_${n}_vacc_date`]      || '', C.WHITE),
      cell('', d[`pet_${n}_next_vacc_date`] || '', C.WHITE),
      cell('', d[`pet_${n}_cert_status`]    || '', C.WHITE),
    ];
  });

  return tbl(pw, [
    sectionHdr('06', 'PET DETAILS & VACCINATION', 8),
    [
      {
        stack: [
          { ...lbl('Do you have pets? *'), margin: [0, 0, 0, 2] },
          { text: petsTxt, fontSize: 8.5, color: C.TEXT },
        ],
        fillColor: C.LIGHT, margin: [4, 3, 4, 3], colSpan: 8,
      },
      {}, {}, {}, {}, {}, {}, {},
    ],
    [colHdr('Pet Name'), colHdr('Type / Breed'), colHdr('Age'), colHdr('Gender'), colHdr('Vaccinated?'), colHdr('Last Vacc. Date'), colHdr('Next Due Date'), colHdr('Cert. Status')],
    ...petRows,
  ]);
}

function buildMembership(d) {
  const a   = Math.floor(W * 0.35); // 189
  const b   = Math.floor(W * 0.30); // 162
  const c   = W - a - b;            // 189
  const memTxt = radioStr(['Yes', 'No'], d.membership_completed);

  return tbl([a, b, c], [
    sectionHdr('07', 'ASSOCIATION MEMBERSHIP', 3),
    [
      {
        stack: [
          { ...lbl('Membership Completed? *'), margin: [0, 0, 0, 2] },
          { text: memTxt, fontSize: 8.5, color: C.TEXT },
        ],
        fillColor: C.LIGHT, margin: [4, 3, 4, 3],
      },
      cell('Membership ID  (if issued)', d.membership_id),
      cell('Maintenance Paid Up To',     d.maintenance_paid_up_to),
    ],
  ]);
}

function buildDocuments(d) {
  const h   = Math.floor(W / 3); // 180
  const ch0 = d.doc_sale_deed        ? '[X]' : '[ ]';
  const ch1 = d.doc_tenant_agreement ? '[X]' : '[ ]';
  const ch2 = d.doc_pet_cert         ? '[X]' : '[ ]';

  return tbl([h, h, W - h * 2], [
    sectionHdr('08', 'DOCUMENTS ENCLOSED — CHECKLIST', 3),
    [
      { text: `${ch0}  Sale Deed Copy — Attached`,                 fontSize: 9, color: C.TEXT, fillColor: C.LIGHT, margin: [6, 5, 6, 5] },
      { text: `${ch1}  Tenant Agreement Copy — Attached`,          fontSize: 9, color: C.TEXT, fillColor: C.LIGHT, margin: [6, 5, 6, 5] },
      { text: `${ch2}  Pet Vaccination Certificate — Enclosed`,    fontSize: 9, color: C.TEXT, fillColor: C.LIGHT, margin: [6, 5, 6, 5] },
    ],
  ]);
}

// Declaration is split into two tables (different column counts)
function buildDeclaration(d) {
  const sig  = Math.floor(W * 0.6); // 324
  const dt   = W - sig;             // 216
  const t3   = Math.floor(W / 3);  // 180
  const rem3 = W - t3 * 2;         // 180

  const declarationTable = tbl([sig, dt], [
    [
      {
        text: [
          { text: 'Declaration:  ', bold: true, color: C.MED, fontSize: 8 },
          { text: 'I / We declare that the above information is true and accurate. I / We agree to abide by the rules and bye-laws of the Casagrand Athens Apartment Owners Association, Phase 1. Any change in occupancy details will be notified to the Association Office within 15 days.', color: C.TEXT, fontSize: 8 },
        ],
        colSpan: 2,
        margin: [4, 5, 4, 5],
      },
      {},
    ],
    [
      cell('Signature of Owner / Authorised Signatory', '', C.WHITE),
      cell('Date  (DD / MM / YYYY)', d.date || '', C.WHITE),
    ],
  ]);

  const officeTable = tbl([t3, t3, rem3], [
    [
      { text: 'FOR OFFICE USE ONLY', bold: true, color: C.MED, fontSize: 8, fillColor: C.GREY, colSpan: 3, margin: [4, 5, 4, 5] },
      {},
      {},
    ],
    [
      cell('Received By',     '', C.WHITE),
      cell('Date of Receipt', '', C.WHITE),
      cell('Verified By',     '', C.WHITE),
    ],
  ]);

  return [declarationTable, officeTable];
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateFormPdf(data) {
  const d = data || {};

  const docDefinition = {
    pageSize:    'LETTER',
    pageMargins: [36, 36, 36, 36],
    defaultStyle: {
      font:       'Helvetica',
      fontSize:   9,
      color:      C.TEXT,
      lineHeight: 1.2,
    },
    content: [
      buildHeader(d),
      buildUnitInfo(d),
      buildOwnerDetails(d),
      buildOccupancy(d),
      ...buildTenantDetails(d),  // returns [] for non-tenant, [table, membersTable] for tenant
      buildVehicles(d),
      buildPets(d),
      buildMembership(d),
      buildDocuments(d),
      ...buildDeclaration(d),
    ],
  };

  // createPdfKitDocument is async in pdfmake v0.3
  const pdfDoc = await makePrinter().createPdfKitDocument(docDefinition);

  return new Promise((resolve, reject) => {
    const chunks = [];
    pdfDoc.on('data',  chunk => chunks.push(chunk));
    pdfDoc.on('end',   ()    => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', err   => reject(err));
    pdfDoc.end();
  });
}

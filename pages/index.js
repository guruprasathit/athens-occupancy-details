import { useState, useCallback, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.css';

const AGE_RANGES = ['', '0-7', '8-14', '15-24', '25-44', '44-59', '60-74', '75+'];
const EMPTY_MEMBER = { name: '', age: '', relation: '' };
const EMPTY_VEHICLE = { type: '', make: '', reg: '', colour: '', fuel: '', park: '' };
const EMPTY_PET = { breed: '', age: '', vaccinated: '', vacc_date: '', cert_status: '' };

function initForm() {
  return {
    unit_number: '', block: '', floor: '', unit_type: '', car_park: '', unique_id: '', occupied_since: '',
    owner_name: '', contact: '', whatsapp: '', email: '', perm_address: '',
    occupancy_type: '', total_occupants: '',
    members: Array(10).fill(null).map(() => ({ ...EMPTY_MEMBER })),
    tenant_name: '', tenant_contact: '', tenant_email: '',
    agreement_period: '', police_verification: '', agreement_registered: '',
    vehicles: Array(5).fill(null).map(() => ({ ...EMPTY_VEHICLE })),
    has_pets: '', membership_completed: '', membership_id: '', maintenance_paid_up_to: '',
    pets: Array(5).fill(null).map(() => ({ ...EMPTY_PET })),
    doc_tenant_agreement: false, doc_pet_cert: false,
    date: new Date().toLocaleDateString('en-IN'),
  };
}

export default function Home() {
  const router = useRouter();
  const [unitInput, setUnitInput] = useState('');
  const [form, setForm] = useState(initForm());
  const [showForm, setShowForm] = useState(false);
  const [lookupStatus, setLookupStatus] = useState(null); // null | 'loading' | 'found' | 'not_found' | 'error'
  const [submissionLoaded, setSubmissionLoaded] = useState(false); // true when existing submission was fetched
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  // ── Auto-lookup when arriving from admin (?unit=E103) ──────────────────────
  useEffect(() => {
    const unit = router.query.unit;
    if (unit) performLookup(unit);
  }, [router.query.unit]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Core lookup logic (shared by form submit and URL param) ────────────────

  const performLookup = useCallback(async (unit) => {
    if (!unit?.trim()) return;
    setUnitInput(unit.trim());
    setLookupStatus('loading');
    setSubmissionLoaded(false);
    setGenError('');
    try {

      const [lookupRes, subRes] = await Promise.all([
        fetch(`/api/lookup?unit=${encodeURIComponent(unit.trim())}`),
        fetch(`/api/get-submission?unit=${encodeURIComponent(unit.trim())}`),
      ]);

      const data = await lookupRes.json();
      if (!lookupRes.ok) throw new Error(data.error || 'Lookup failed');

      const sub = subRes.ok ? await subRes.json() : { found: false };

      if (sub.found) {
        // Restore members array from flat keys (member_1_name, member_1_age, ...)
        const members = Array(10).fill(null).map((_, i) => ({
          name:     sub[`member_${i + 1}_name`]     || '',
          age:      sub[`member_${i + 1}_age`]      || '',
          relation: sub[`member_${i + 1}_relation`] || '',
        }));
        // Restore vehicles array
        const vehicles = Array(5).fill(null).map((_, i) => ({
          type:   sub[`vehicle_${i + 1}_type`]   || '',
          make:   sub[`vehicle_${i + 1}_make`]   || '',
          reg:    sub[`vehicle_${i + 1}_reg`]    || '',
          colour: sub[`vehicle_${i + 1}_colour`] || '',
          fuel:   sub[`vehicle_${i + 1}_fuel`]   || '',
          park:   sub[`vehicle_${i + 1}_park`]   || '',
        }));
        setForm({
          ...initForm(),
          unit_number:          sub.unit_number          || unit.toUpperCase(),
          block:                sub.block                || '',
          floor:                sub.floor                || '',
          unit_type:            sub.unit_type            || '',
          car_park:             sub.car_park             || '',
          unique_id:            sub.unique_id            || data.unique_id || '',
          occupied_since:       sub.occupied_since       || '',
          owner_name:           sub.owner_name           || '',
          contact:              sub.contact              || '',
          whatsapp:             sub.whatsapp             || '',
          email:                sub.email                || '',
          perm_address:         sub.permanent_address    || '',
          occupancy_type:       sub.occupancy_type       || '',
          total_occupants:      sub.total_occupants      || '',
          members,
          tenant_name:          sub.tenant_name          || '',
          tenant_contact:       sub.tenant_contact       || '',
          tenant_email:         sub.tenant_email         || '',
          agreement_period:     sub.agreement_period     || '',
          police_verification:  sub.police_verification  || '',
          agreement_registered: sub.agreement_registered || '',
          vehicles,
          has_pets:             sub.has_pets             || '',
          membership_completed: sub.membership_completed || '',
          membership_id:        sub.membership_id        || '',
          maintenance_paid_up_to: sub.maintenance_paid_up_to || '',
          pets:                 Array(5).fill(null).map(() => ({ ...EMPTY_PET })),
          date:                 new Date().toLocaleDateString('en-IN'),
        });
        setSubmissionLoaded(true);
      } else {
        // No saved submission — pre-fill from Units sheet only
        setForm({
          ...initForm(),
          unit_number:    data.unit_number    || unit.toUpperCase(),
          block:          data.block          || '',
          floor:          data.floor          || '',
          unit_type:      data.unit_type      || '',
          car_park:       data.car_park       || '',
          unique_id:      data.unique_id      || '',
          owner_name:     data.owner_name     || '',
          contact:        data.contact        || '',
          whatsapp:       data.whatsapp       || '',
          email:          data.email          || '',
          occupancy_type: data.occupancy_type || '',
          date:           new Date().toLocaleDateString('en-IN'),
          members:        Array(10).fill(null).map(() => ({ ...EMPTY_MEMBER })),
          vehicles:       Array(5).fill(null).map(() => ({ ...EMPTY_VEHICLE })),
          pets:           Array(5).fill(null).map(() => ({ ...EMPTY_PET })),
        });
      }

      setLookupStatus(data.found ? 'found' : 'not_found');
      setShowForm(true);
    } catch (err) {
      setLookupStatus('error');
      setGenError(err.message);
    }
  }, []);

  const handleLookup = useCallback(async (e) => {
    e.preventDefault();
    await performLookup(unitInput);
  }, [unitInput, performLookup]);

  // ── Field updaters ──────────────────────────────────────────────────────────

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const setMember = (i, field, value) =>
    setForm(f => {
      const members = [...f.members];
      members[i] = { ...members[i], [field]: value };
      return { ...f, members };
    });

  const setVehicle = (i, field, value) =>
    setForm(f => {
      const vehicles = [...f.vehicles];
      vehicles[i] = { ...vehicles[i], [field]: value };
      return { ...f, vehicles };
    });

  const setPet = (i, field, value) =>
    setForm(f => {
      const pets = [...f.pets];
      pets[i] = { ...pets[i], [field]: value };
      return { ...f, pets };
    });

  // ── Generate ────────────────────────────────────────────────────────────────

  const handleGenerate = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setGenError('');

    // Flatten members/vehicles/pets into form payload
    const payload = { ...form };
    form.members.forEach((m, i) => {
      payload[`member_${i + 1}_name`] = m.name;
      payload[`member_${i + 1}_age`] = m.age;
      payload[`member_${i + 1}_relation`] = m.relation;
    });
    form.vehicles.forEach((v, i) => {
      payload[`vehicle_${i + 1}_type`] = v.type;
      payload[`vehicle_${i + 1}_make`] = v.make;
      payload[`vehicle_${i + 1}_reg`] = v.reg;
      payload[`vehicle_${i + 1}_colour`] = v.colour;
      payload[`vehicle_${i + 1}_fuel`] = v.fuel;
      payload[`vehicle_${i + 1}_park`] = v.park;
    });
    form.pets.forEach((p, i) => {
      payload[`pet_${i + 1}_breed`] = p.breed;
      payload[`pet_${i + 1}_age`] = p.age;
      payload[`pet_${i + 1}_vaccinated`] = p.vaccinated;
      payload[`pet_${i + 1}_vacc_date`] = p.vacc_date;
      payload[`pet_${i + 1}_cert_status`] = p.cert_status;
    });
    delete payload.members;
    delete payload.vehicles;
    delete payload.pets;

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Athens_Occupancy_${form.unit_number || 'Form'}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setGenError('Error generating form: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <Head>
        <title>Athens Occupancy Form</title>
        <meta name="description" content="Casagrand Athens Phase I — Occupancy Registration" />
      </Head>

      {/* ─── Header ─── */}
      <div className={styles.header}>
        <div className="container-lg py-3">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div className="d-flex align-items-center gap-3">
              <div className={styles.headerIcon}>🏢</div>
              <div>
                <h1 className="mb-0 fw-bold text-white fs-4">Athens Occupancy Form</h1>
                <p className="mb-0 text-white opacity-75 small">
                  Casagrand Athens Phase I — Resident Registration
                </p>
              </div>
            </div>
            <Link href="/admin" className="btn btn-sm btn-outline-light fw-semibold">
              Admin
            </Link>
          </div>
        </div>
      </div>

      <div className="container-lg py-4">

        {/* ─── Search ─── */}
        <div className={`card shadow-sm mb-4 ${styles.searchCard}`}>
          <div className="card-body p-4">
            <h5 className={`fw-semibold mb-1 ${styles.sectionTitle}`}>Unit Number Lookup</h5>
            <p className="text-muted small mb-3">
              Enter the flat / unit number to auto-fill owner details from the database.
            </p>
            <form onSubmit={handleLookup} className="d-flex gap-2 flex-wrap">
              <input
                type="text"
                className="form-control"
                style={{ maxWidth: 200 }}
                placeholder="e.g. E103, A1002"
                value={unitInput}
                onChange={e => setUnitInput(e.target.value)}
                required
              />
              <button
                type="submit"
                className={`btn ${styles.btnPrimary}`}
                disabled={lookupStatus === 'loading'}
              >
                {lookupStatus === 'loading' ? (
                  <><span className="spinner-border spinner-border-sm me-2" />Looking up…</>
                ) : 'Search'}
              </button>
              {showForm && (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => { setShowForm(false); setForm(initForm()); setLookupStatus(null); setSubmissionLoaded(false); setUnitInput(''); }}
                >
                  Clear
                </button>
              )}
            </form>

            {lookupStatus === 'found' && submissionLoaded && (
              <div className="alert alert-success mt-3 mb-0 py-2 small">
                ✅ Previously saved details for <strong>{form.unit_number}</strong> loaded — review and update as needed.
              </div>
            )}
            {lookupStatus === 'found' && !submissionLoaded && (
              <div className="alert alert-success mt-3 mb-0 py-2 small">
                ✅ Owner data found for <strong>{form.unit_number}</strong> — complete the form and save.
              </div>
            )}
            {lookupStatus === 'not_found' && submissionLoaded && (
              <div className="alert alert-info mt-3 mb-0 py-2 small">
                ℹ️ Previously saved details for <strong>{form.unit_number}</strong> loaded — unit not in master list.
              </div>
            )}
            {lookupStatus === 'not_found' && !submissionLoaded && (
              <div className="alert alert-warning mt-3 mb-0 py-2 small">
                ⚠️ Unit <strong>{unitInput.toUpperCase()}</strong> not found in database. Fill in manually.
              </div>
            )}
            {lookupStatus === 'error' && (
              <div className="alert alert-danger mt-3 mb-0 py-2 small">
                ❌ {genError}
              </div>
            )}
          </div>
        </div>

        {/* ─── Form ─── */}
        {showForm && (
          <form onSubmit={handleGenerate}>

            {/* 01 — Unit Information */}
            <SectionCard num="01" title="UNIT INFORMATION">
              <div className="row g-3">
                <div className="col-6 col-md-3">
                  <FormField label="Block / Tower *" value={form.block} onChange={v => set('block', v)} />
                </div>
                <div className="col-6 col-md-3">
                  <FormField label="Floor No." value={form.floor} onChange={v => set('floor', v)} />
                </div>
                <div className="col-6 col-md-3">
                  <FormField label="Unit Number *" value={form.unit_number} onChange={v => set('unit_number', v)} required />
                </div>
                <div className="col-6 col-md-3">
                  <FormField label="Unit Type" value={form.unit_type} onChange={v => set('unit_type', v)}
                    placeholder="2BHK, 3BHK…" />
                </div>
                <div className="col-md-3">
                  <div>
                    <label className={styles.fieldLabel}>Unique ID</label>
                    <input
                      type="text"
                      className="form-control form-control-sm mt-1"
                      value={form.unique_id}
                      readOnly
                      style={{ background: '#f0f4f8', fontWeight: 600, letterSpacing: '0.08em', color: '#1B3A6B' }}
                    />
                  </div>
                </div>
                <div className="col-md-3">
                  <FormField label="Car Park Slot(s)" value={form.car_park} onChange={v => set('car_park', v)} />
                </div>
                <div className="col-md-6">
                  <FormField label="Occupied Since (Month & Year) *" value={form.occupied_since}
                    onChange={v => set('occupied_since', v)} placeholder="e.g. Jan 2022" />
                </div>
              </div>
            </SectionCard>

            {/* 02 — Owner Details */}
            <SectionCard num="02" title="OWNER DETAILS">
              <div className="row g-3">
                <div className="col-12">
                  <FormField label="Full Name of Owner *" value={form.owner_name}
                    onChange={v => set('owner_name', v)} required />
                </div>
                <div className="col-md-4">
                  <FormField label="Primary Contact *" value={form.contact}
                    onChange={v => set('contact', v)} type="tel" />
                </div>
                <div className="col-md-4">
                  <FormField label="WhatsApp No." value={form.whatsapp}
                    onChange={v => set('whatsapp', v)} type="tel" />
                </div>
                <div className="col-md-4">
                  <FormField label="Email Address" value={form.email}
                    onChange={v => set('email', v)} type="email" />
                </div>
                <div className="col-12">
                  <FormField label="Permanent Address (if different from this unit)"
                    value={form.perm_address} onChange={v => set('perm_address', v)} />
                </div>
              </div>
            </SectionCard>

            {/* 03 — Occupancy & Members */}
            <SectionCard num="03" title="OCCUPANCY STATUS & MEMBERS">
              <div className="row g-3 mb-3">
                <div className="col-md-8">
                  <label className={styles.fieldLabel}>Occupancy Type *</label>
                  <div className="d-flex flex-wrap gap-3 mt-1">
                    {['owner', 'tenant', 'vacant'].map(opt => (
                      <div key={opt} className="form-check">
                        <input className="form-check-input" type="radio" id={`occ_${opt}`}
                          name="occupancy_type" value={opt}
                          checked={form.occupancy_type === opt}
                          onChange={() => set('occupancy_type', opt)} />
                        <label className="form-check-label text-capitalize" htmlFor={`occ_${opt}`}>
                          {opt === 'owner' ? 'Owner Occupied' : opt === 'tenant' ? 'Tenant Occupied' : 'Vacant'}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="col-md-4">
                  <FormField label="Total No. of Occupants" value={form.total_occupants}
                    onChange={v => set('total_occupants', v)} type="number" min="0" max="30" />
                </div>
              </div>

              <div className={styles.membersHeader}>
                MEMBERS — Name, Age &amp; Relation (up to 10)
              </div>

              <div className="table-responsive">
                <table className="table table-sm mb-0" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead>
                    <tr className={styles.membersThead}>
                      <th style={{ width: '4%' }}>#</th>
                      <th style={{ width: '38%' }}>Name</th>
                      <th style={{ width: '30%' }}>Age Range</th>
                      <th style={{ width: '28%' }}>Relation to Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.members.map((m, i) => (
                      <tr key={i} className={styles.memberRow}>
                        <td className="text-muted small align-middle">{i + 1}</td>
                        <td>
                          <input type="text" className={`form-control form-control-sm ${styles.tableInput}`}
                            value={m.name} onChange={e => setMember(i, 'name', e.target.value)}
                            placeholder={i === 0 ? 'Head of household' : ''} />
                        </td>
                        <td>
                          <select className={`form-select form-select-sm ${styles.tableInput}`}
                            value={m.age} onChange={e => setMember(i, 'age', e.target.value)}>
                            {AGE_RANGES.map(r => <option key={r} value={r}>{r || '— select —'}</option>)}
                          </select>
                        </td>
                        <td>
                          <input type="text" className={`form-control form-control-sm ${styles.tableInput}`}
                            value={m.relation} onChange={e => setMember(i, 'relation', e.target.value)}
                            placeholder="Self / Spouse / Child…" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            {/* 04 — Tenant Details */}
            <SectionCard num="04" title="TENANT DETAILS (IF RENTED)">
              <div className="row g-3">
                <div className="col-md-4">
                  <FormField label="Primary Tenant Name" value={form.tenant_name}
                    onChange={v => set('tenant_name', v)} />
                </div>
                <div className="col-md-4">
                  <FormField label="Tenant Contact No." value={form.tenant_contact}
                    onChange={v => set('tenant_contact', v)} type="tel" />
                </div>
                <div className="col-md-4">
                  <FormField label="Tenant Email" value={form.tenant_email}
                    onChange={v => set('tenant_email', v)} type="email" />
                </div>
                <div className="col-md-4">
                  <FormField label="Agreement Period (From — To)" value={form.agreement_period}
                    onChange={v => set('agreement_period', v)} placeholder="e.g. Jan 2024 — Dec 2024" />
                </div>
                <div className="col-md-4">
                  <label className={styles.fieldLabel}>Police Verification</label>
                  <div className="d-flex gap-3 mt-1 flex-wrap">
                    {['Yes', 'No', 'N/A'].map(opt => (
                      <div key={opt} className="form-check">
                        <input className="form-check-input" type="radio" id={`pol_${opt}`}
                          name="police_verification" value={opt.toLowerCase()}
                          checked={form.police_verification === opt.toLowerCase()}
                          onChange={() => set('police_verification', opt.toLowerCase())} />
                        <label className="form-check-label" htmlFor={`pol_${opt}`}>{opt}</label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="col-md-4">
                  <label className={styles.fieldLabel}>Agreement Registered</label>
                  <div className="d-flex gap-3 mt-1">
                    {['Yes', 'No'].map(opt => (
                      <div key={opt} className="form-check">
                        <input className="form-check-input" type="radio" id={`agr_${opt}`}
                          name="agreement_registered" value={opt.toLowerCase()}
                          checked={form.agreement_registered === opt.toLowerCase()}
                          onChange={() => set('agreement_registered', opt.toLowerCase())} />
                        <label className="form-check-label" htmlFor={`agr_${opt}`}>{opt}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* 05 — Vehicles */}
            <SectionCard num="05" title="VEHICLE DETAILS (UP TO 5)">
              <div className="table-responsive">
                <table className="table table-sm mb-0">
                  <thead>
                    <tr className={styles.membersThead}>
                      <th>#</th>
                      <th>Type</th>
                      <th>Make / Model</th>
                      <th>Registration No.</th>
                      <th>Colour</th>
                      <th>Fuel</th>
                      <th>Park Slot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.vehicles.map((v, i) => (
                      <tr key={i} className={styles.memberRow}>
                        <td className="text-muted small align-middle">{i + 1}</td>
                        {['type', 'make', 'reg', 'colour', 'fuel', 'park'].map(f => (
                          <td key={f}>
                            <input type="text" className={`form-control form-control-sm ${styles.tableInput}`}
                              value={v[f]} onChange={e => setVehicle(i, f, e.target.value)} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            {/* 06 — Pets */}
            <SectionCard num="06" title="PET DETAILS & VACCINATION">
              <div className="mb-3">
                <label className={styles.fieldLabel}>Do you have pets? *</label>
                <div className="d-flex gap-3 mt-1">
                  {['Yes', 'No'].map(opt => (
                    <div key={opt} className="form-check">
                      <input className="form-check-input" type="radio" id={`pets_${opt}`}
                        name="has_pets" value={opt.toLowerCase()}
                        checked={form.has_pets === opt.toLowerCase()}
                        onChange={() => set('has_pets', opt.toLowerCase())} />
                      <label className="form-check-label" htmlFor={`pets_${opt}`}>{opt}</label>
                    </div>
                  ))}
                </div>
              </div>
              {form.has_pets === 'yes' && (
                <div className="table-responsive">
                  <table className="table table-sm mb-0">
                    <thead>
                      <tr className={styles.membersThead}>
                        <th>#</th>
                        <th>Type / Breed</th>
                        <th>Age</th>
                        <th>Vaccinated?</th>
                        <th>Last Vacc. Date</th>
                        <th>Certificate Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.pets.map((p, i) => (
                        <tr key={i} className={styles.memberRow}>
                          <td className="text-muted small align-middle">{i + 1}</td>
                          {['breed', 'age', 'vaccinated', 'vacc_date', 'cert_status'].map(f => (
                            <td key={f}>
                              <input type="text" className={`form-control form-control-sm ${styles.tableInput}`}
                                value={p[f]} onChange={e => setPet(i, f, e.target.value)} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            {/* 07 — Association Membership */}
            <SectionCard num="07" title="ASSOCIATION MEMBERSHIP">
              <div className="row g-3">
                <div className="col-md-4">
                  <label className={styles.fieldLabel}>Membership Completed? *</label>
                  <div className="d-flex gap-3 mt-1">
                    {['Yes', 'No'].map(opt => (
                      <div key={opt} className="form-check">
                        <input className="form-check-input" type="radio" id={`mem_${opt}`}
                          name="membership_completed" value={opt.toLowerCase()}
                          checked={form.membership_completed === opt.toLowerCase()}
                          onChange={() => set('membership_completed', opt.toLowerCase())} />
                        <label className="form-check-label" htmlFor={`mem_${opt}`}>{opt}</label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="col-md-4">
                  <FormField label="Membership ID (if issued)" value={form.membership_id}
                    onChange={v => set('membership_id', v)} />
                </div>
                <div className="col-md-4">
                  <FormField label="Maintenance Paid Up To" value={form.maintenance_paid_up_to}
                    onChange={v => set('maintenance_paid_up_to', v)} placeholder="e.g. Mar 2025" />
                </div>
              </div>
            </SectionCard>

            {/* 08 — Documents */}
            <SectionCard num="08" title="DOCUMENTS ENCLOSED — CHECKLIST">
              <div className="d-flex flex-wrap gap-4">
                <div className="form-check">
                  <input className="form-check-input" type="checkbox" id="doc_tenant"
                    checked={form.doc_tenant_agreement}
                    onChange={e => set('doc_tenant_agreement', e.target.checked)} />
                  <label className="form-check-label" htmlFor="doc_tenant">
                    Tenant Agreement Copy — Attached
                  </label>
                </div>
                <div className="form-check">
                  <input className="form-check-input" type="checkbox" id="doc_pet"
                    checked={form.doc_pet_cert}
                    onChange={e => set('doc_pet_cert', e.target.checked)} />
                  <label className="form-check-label" htmlFor="doc_pet">
                    Pet Vaccination Certificate — Enclosed
                  </label>
                </div>
              </div>
            </SectionCard>

            {/* ─── Generate Button ─── */}
            {genError && (
              <div className="alert alert-danger small mt-2">{genError}</div>
            )}
            <div className="d-flex justify-content-end gap-3 mt-4 pb-4">
              <button type="button" className="btn btn-outline-secondary"
                onClick={() => { setShowForm(false); setForm(initForm()); setLookupStatus(null); setSubmissionLoaded(false); setUnitInput(''); }}>
                Cancel
              </button>
              <button type="submit" className={`btn ${styles.btnPrimary} px-4`} disabled={generating}>
                {generating ? (
                  <><span className="spinner-border spinner-border-sm me-2" />Generating…</>
                ) : '⬇ Download Occupancy Form (.docx)'}
              </button>
            </div>

          </form>
        )}
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({ num, title, children }) {
  return (
    <div className={`card shadow-sm mb-3 ${styles.sectionCard}`}>
      <div className={styles.sectionCardHeader}>
        <span className={styles.sectionNum}>{num}</span>
        <span className={styles.sectionTitle}>{title}</span>
      </div>
      <div className="card-body p-3">{children}</div>
    </div>
  );
}

function FormField({ label, value, onChange, type = 'text', required, placeholder, ...rest }) {
  return (
    <div>
      <label className={styles.fieldLabel}>{label}</label>
      <input
        type={type}
        className="form-control form-control-sm mt-1"
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        placeholder={placeholder || ''}
        {...rest}
      />
    </div>
  );
}

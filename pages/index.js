import { useState, useCallback, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.css';

const AGE_RANGES = ['', '0-7', '8-14', '15-24', '25-44', '44-59', '60-74', '75+'];
const RELATIONS  = [
  '',
  'Self',
  'Spouse',
  'Son',
  'Daughter',
  'Father',
  'Mother',
  'Father-in-law',
  'Mother-in-law',
  'Brother',
  'Sister',
  'Son-in-law',
  'Daughter-in-law',
  'Grandson',
  'Granddaughter',
  'Grandfather',
  'Grandmother',
  'Uncle',
  'Aunt',
  'Nephew',
  'Niece',
  'Domestic Help',
  'Other',
];
const EMPTY_MEMBER = { name: '', age: '', relation: '' };
const EMPTY_TENANT_MEMBER = { name: '', age: '', relation: '' };
const TENANT_RELATIONS = ['', 'Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Grandfather', 'Grandmother', 'Other'];
const EMPTY_VEHICLE   = { type: '', make: '', reg: '', colour: '', fuel: '', park: '' };
const VEHICLE_TYPES   = ['', '2 Wheeler', '4 Wheeler'];
const FUEL_TYPES      = ['', 'Petrol', 'Diesel', 'Electric'];
const EMPTY_PET     = { name: '', breed: '', age: '', gender: '', vaccinated: '', vacc_date: '', next_vacc_date: '', cert_status: '' };
const PET_GENDERS   = ['', 'Male', 'Female'];
const PET_VACC_OPTS = ['', 'Yes', 'No'];

function initForm() {
  return {
    unit_number: '', block: '', floor: '', unit_type: '', car_park: '', unique_id: '', occupied_since: '',
    owner_name: '', contact: '', whatsapp: '', email: '',
    contact2: '', whatsapp2: '', email2: '',
    perm_address_type: '', perm_address: '',
    occupancy_type: '', total_occupants: '',
    members: Array(10).fill(null).map(() => ({ ...EMPTY_MEMBER })),
    tenant_name: '', tenant_age: '', tenant_contact: '', tenant_email: '',
    tenant_members: Array(6).fill(null).map(() => ({ ...EMPTY_TENANT_MEMBER })),
    agreement_period: '', police_verification: '', agreement_registered: '',
    vehicles: Array(5).fill(null).map(() => ({ ...EMPTY_VEHICLE })),
    has_pets: '', membership_completed: '', membership_id: '', maintenance_paid_up_to: '',
    sale_deeds:     [],  // [{name, url, fileId, status}]
    tenant_docs:    [],  // [{name, url, fileId, status}]
    pet_vacc_docs:  [],  // [{name, url, fileId, status}]
    pets: Array(5).fill(null).map(() => ({ ...EMPTY_PET })),
    doc_sale_deed: false, doc_tenant_agreement: false, doc_pet_cert: false,
    date: new Date().toLocaleDateString('en-IN'),
  };
}

// Derive Block/Tower and Floor from unit number pattern:
//   5 chars (e.g. A1201) → block "A", floor "12" (2nd + 3rd char)
//   4 chars (e.g. E103)  → block "E", floor "1"  (2nd char only)
function deriveBlockFloor(unit) {
  const u = (unit || '').toUpperCase().trim();
  return {
    block: u.length >= 1 ? u[0] : '',
    floor: u.length >= 5 ? u.slice(1, 3) : (u.length >= 2 ? u[1] : ''),
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
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [genError, setGenError] = useState('');

  // ── Identity verification (shown when a saved submission already exists) ──────
  const [verificationStep, setVerificationStep] = useState(false);
  const [verifyInput, setVerifyInput]     = useState('');
  const [verifying, setVerifying]         = useState(false);
  const [verifyError, setVerifyError]     = useState('');
  const [pendingData, setPendingData]     = useState(null); // { data, sub }

  // ── Auto-lookup when arriving from admin (?unit=E103) ──────────────────────
  useEffect(() => {
    const unit = router.query.unit;
    if (unit) performLookup(unit);
  }, [router.query.unit]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Core lookup logic (shared by form submit and URL param) ────────────────

  // ── Restore a saved submission into form state ──────────────────────────────
  // Sheet header → key mapping differs from form field names, e.g.:
  //   "Primary Contact" → primary_contact  (not `contact`)
  //   "Tenant Agreement URLs" → tenant_agreement_urls  (not `tenant_doc_urls`)
  const applySubmission = useCallback((sub, data, unit) => {
    const urlList = key =>
      sub[key]
        ? String(sub[key]).split(',').filter(Boolean).map(u => ({ url: u.trim(), name: u.trim().split('/').pop(), status: 'saved' }))
        : [];

    const members = Array(10).fill(null).map((_, i) => ({
      name:     sub[`member_${i + 1}_name`]     || '',
      age:      sub[`member_${i + 1}_age`]      || '',
      relation: sub[`member_${i + 1}_relation`] || '',
    }));
    const vehicles = Array(5).fill(null).map((_, i) => ({
      type:   sub[`vehicle_${i + 1}_type`]   || '',
      make:   sub[`vehicle_${i + 1}_make`]   || '',
      reg:    sub[`vehicle_${i + 1}_reg`]    || '',
      colour: sub[`vehicle_${i + 1}_colour`] || '',
      fuel:   sub[`vehicle_${i + 1}_fuel`]   || '',
      park:   sub[`vehicle_${i + 1}_park`]   || '',
    }));
    const pets = Array(5).fill(null).map((_, i) => ({
      name:          sub[`pet_${i + 1}_name`]           || '',
      breed:         sub[`pet_${i + 1}_breed`]          || '',
      age:           sub[`pet_${i + 1}_age`]            || '',
      gender:        sub[`pet_${i + 1}_gender`]         || '',
      vaccinated:    sub[`pet_${i + 1}_vaccinated`]     || '',
      // Sheet header "Pet N Last Vacc Date" → key pet_N_last_vacc_date
      vacc_date:     sub[`pet_${i + 1}_last_vacc_date`] || '',
      // Sheet header "Pet N Next Due Date" → key pet_N_next_due_date
      next_vacc_date:sub[`pet_${i + 1}_next_due_date`]  || '',
      cert_status:   sub[`pet_${i + 1}_cert_status`]    || '',
    }));

    // Helper: normalise Yes/No/yes/no stored values to lowercase for radio buttons
    const lc = v => String(v || '').toLowerCase();

    // Helper: try multiple URL key names, return first non-empty list
    const urlListAny = (...keys) => {
      for (const k of keys) {
        const r = urlList(k);
        if (r.length) return r;
      }
      return [];
    };

    const unitUp = (sub.unit_number || unit || '').toUpperCase();
    const derived = deriveBlockFloor(unitUp);
    setForm({
      ...initForm(),
      unit_number:            unitUp,
      block:                  derived.block,
      floor:                  derived.floor,
      unit_type:              sub.unit_type                                || '',
      car_park:               sub.car_park                                 || '',
      unique_id:              sub.unique_id                                || (data && data.unique_id) || '',
      occupied_since:         sub.occupied_since                           || '',
      owner_name:             sub.owner_name                               || '',
      // Sheet header "Primary Contact" → key primary_contact (fallback: old "Contact" header)
      contact:                sub.primary_contact  || sub.contact          || '',
      whatsapp:               sub.primary_whatsapp || sub.whatsapp         || '',
      email:                  sub.primary_email    || sub.email            || '',
      contact2:               sub.secondary_contact  || sub.contact2       || '',
      whatsapp2:              sub.secondary_whatsapp || sub.whatsapp2      || '',
      email2:                 sub.secondary_email    || sub.email2         || '',
      // "Permanent Address" → permanent_address; fallback if old sheet used perm_address
      perm_address:           sub.permanent_address || sub.perm_address    || '',
      perm_address_type:      sub.permanent_address_type ||
                              ((sub.permanent_address || sub.perm_address) ? 'different' : 'same'),
      // occupancy_type stored as lowercase ('owner','tenant','vacant') — keep as-is
      occupancy_type:         sub.occupancy_type                           || '',
      total_occupants:        sub.total_occupants                          || '',
      members,
      tenant_name:            sub.tenant_name                              || '',
      tenant_age:             sub.tenant_age                               || '',
      tenant_contact:         sub.tenant_contact                           || '',
      tenant_email:           sub.tenant_email                             || '',
      tenant_members:         Array(6).fill(null).map((_, i) => ({
        name:     sub[`tenant_member_${i + 1}_name`]     || '',
        age:      sub[`tenant_member_${i + 1}_age`]      || '',
        relation: sub[`tenant_member_${i + 1}_relation`] || '',
      })),
      agreement_period:       sub.agreement_period                         || '',
      // Radio buttons saved as lowercase; normalise in case old data used 'Yes'/'No'
      police_verification:    lc(sub.police_verification),
      agreement_registered:   lc(sub.agreement_registered),
      vehicles,
      // Radio saved as 'yes'/'no' — normalise for same reason
      has_pets:               lc(sub.has_pets),
      membership_completed:   lc(sub.membership_completed),
      membership_id:          sub.membership_id                            || '',
      maintenance_paid_up_to: sub.maintenance_paid_up_to                  || '',
      // URLs: try new key first, fall back to older key variants
      sale_deeds:    urlListAny('sale_deed_urls',         'sale_deed_doc_urls'),
      tenant_docs:   urlListAny('tenant_agreement_urls',  'tenant_doc_urls'),
      pet_vacc_docs: urlListAny('pet_vaccination_urls',   'pet_vacc_doc_urls'),
      pets,
      // Sheet headers "Doc: Sale Deed" / "Doc: Tenant Agreement" / "Doc: Pet Certificate"
      // Apps Script: .toLowerCase().replace(/\s+/g,'_') → colon kept → "doc:_sale_deed"
      doc_sale_deed:        lc(sub['doc:_sale_deed'])        === 'yes',
      doc_tenant_agreement: lc(sub['doc:_tenant_agreement']) === 'yes',
      doc_pet_cert:         lc(sub['doc:_pet_certificate'])  === 'yes',
      date: new Date().toLocaleDateString('en-IN'),
    });
    setSubmissionLoaded(true);
  }, []);

  const performLookup = useCallback(async (unit) => {
    if (!unit?.trim()) return;
    setUnitInput(unit.trim());
    setLookupStatus('loading');
    setSubmissionLoaded(false);
    setVerificationStep(false);
    setVerifyInput('');
    setVerifyError('');
    setPendingData(null);
    setShowForm(false);
    setGenError('');
    try {
      const [lookupRes, subRes] = await Promise.all([
        fetch(`/api/lookup?unit=${encodeURIComponent(unit.trim())}`),
        fetch(`/api/get-submission?unit=${encodeURIComponent(unit.trim())}`),
      ]);

      const data = await lookupRes.json();
      if (!lookupRes.ok) throw new Error(data.error || 'Lookup failed');

      const sub = subRes.ok ? await subRes.json() : { found: false };

      setLookupStatus(data.found ? 'found' : 'not_found');

      if (!data.found && !sub.found) {
        // Unit not in database and no prior submission — block completely
        return;
      }

      if (sub.found) {
        // Existing submission — show identity verification before revealing data
        setPendingData({ data, sub });
        setVerificationStep(true);
      } else {
        // Unit found in database, no prior submission — show blank form
        const unitUp = (data.unit_number || unit || '').toUpperCase();
        const derived = deriveBlockFloor(unitUp);
        setForm({
          ...initForm(),
          unit_number:    unitUp,
          block:          derived.block,
          floor:          derived.floor,
          unit_type:      data.unit_type      || '',
          car_park:       data.car_park       || '',
          unique_id:      data.unique_id      || '',
          owner_name:     data.owner_name     || '',
          contact:        data.contact        || '',
          whatsapp:       data.whatsapp       || '',
          email:          data.email          || '',
          contact2:       '',
          whatsapp2:      '',
          email2:         '',
          occupancy_type: data.occupancy_type || '',
          date:           new Date().toLocaleDateString('en-IN'),
          members:        Array(10).fill(null).map(() => ({ ...EMPTY_MEMBER })),
          vehicles:       Array(5).fill(null).map(() => ({ ...EMPTY_VEHICLE })),
          pets:           Array(5).fill(null).map(() => ({ ...EMPTY_PET })),
        });
        setShowForm(true);
      }
    } catch (err) {
      setLookupStatus('error');
      setGenError(err.message);
    }
  }, [applySubmission]);

  const handleLookup = useCallback(async (e) => {
    e.preventDefault();
    await performLookup(unitInput);
  }, [unitInput, performLookup]);

  // ── Verify identity before loading saved submission ─────────────────────────
  const handleVerify = async () => {
    if (!verifyInput.trim()) return;
    setVerifying(true);
    setVerifyError('');
    try {
      const res = await fetch('/api/verify-identity', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ unit: unitInput, value: verifyInput.trim() }),
      });
      const result = await res.json();
      if (result.verified) {
        applySubmission(pendingData.sub, pendingData.data, unitInput);
        setVerificationStep(false);
        setShowForm(true);
      } else {
        setVerifyError('Verification failed. Please check your Unique ID and try again.');
      }
    } catch {
      setVerifyError('Verification error. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  // ── Clear everything and reset to search ────────────────────────────────────
  const handleClear = () => {
    setShowForm(false);
    setVerificationStep(false);
    setVerifyInput('');
    setVerifyError('');
    setPendingData(null);
    setForm(initForm());
    setLookupStatus(null);
    setSubmissionLoaded(false);
    setUnitInput('');
    setSubmitSuccess(false);
    setGenError('');
  };

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

  // ── Submit and download PDF ─────────────────────────────────────────────────

  const handleSubmitAndDownload = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setSubmitSuccess(false);
    setGenError('');
    try {
      const res = await fetch('/api/submit-and-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error);
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `Athens_Occupancy_${form.unit_number || 'Form'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setSubmitSuccess(true);
    } catch (err) {
      setGenError('Error submitting form: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  // ── File upload handler factory (used for sale deeds & tenant agreements) ───
  // NOTE: makeFileHandler is defined later after handleTenantFiles section

  // Sale deed handler — defined after makeFileHandler below

  const removeDeed = (idx) => {
    setForm(prev => {
      const updated = [...(prev.sale_deeds || [])];
      updated.splice(idx, 1);
      return { ...prev, sale_deeds: updated };
    });
  };

  // ── Tenant agreement upload (reuses same API, different docType / stateKey) ──

  // Max file size: 5 MB
  const MAX_FILE_BYTES = 5 * 1024 * 1024;

  const makeFileHandler = (stateKey, docType) => async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Client-side size check — reject oversized files before uploading
    const oversized = files.filter(f => f.size > MAX_FILE_BYTES);
    if (oversized.length) {
      alert(`File${oversized.length > 1 ? 's' : ''} too large: ${oversized.map(f => f.name).join(', ')}\n\nMaximum size is 3 MB per file. Please compress or reduce the file size and try again.`);
      e.target.value = '';
      return;
    }

    const existing = form[stateKey] || [];
    if (existing.length + files.length > 5) {
      alert('You can upload up to 5 files total.');
      e.target.value = '';
      return;
    }
    const pending = files.map(f => ({ name: f.name, status: 'uploading', url: '', fileId: '' }));
    setForm(prev => ({ ...prev, [stateKey]: [...(prev[stateKey] || []), ...pending] }));
    e.target.value = '';
    for (let idx = 0; idx < files.length; idx++) {
      const file     = files[idx];
      const slotIdx  = existing.length + idx;
      try {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload  = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const res = await fetch('/api/upload-deed', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ filename: file.name, mimeType: file.type || 'application/octet-stream', base64, unitNumber: form.unit_number || 'Unknown', docType }),
        });

        // Safely parse JSON — a 413 from Vercel returns plain text, not JSON
        let data;
        try {
          data = await res.json();
        } catch {
          const msg = res.status === 413
            ? 'File too large. Please keep files under 3 MB.'
            : `Server error (${res.status}). Please try again.`;
          throw new Error(msg);
        }

        if (!res.ok || !data.success) throw new Error(data.error || 'Upload failed');
        setForm(prev => {
          const updated = [...(prev[stateKey] || [])];
          updated[slotIdx] = { name: file.name, url: data.url, fileId: data.fileId, status: 'done' };
          return { ...prev, [stateKey]: updated };
        });
      } catch (err) {
        setForm(prev => {
          const updated = [...(prev[stateKey] || [])];
          updated[slotIdx] = { name: file.name, url: '', fileId: '', status: 'error', error: err.message };
          return { ...prev, [stateKey]: updated };
        });
      }
    }
  };

  const handleTenantFiles   = makeFileHandler('tenant_docs',   'tenant_agreement');
  const handleDeedFiles     = makeFileHandler('sale_deeds',    'sale_deed');
  const handlePetVaccFiles  = makeFileHandler('pet_vacc_docs', 'pet_vaccination');

  const removeTenantDoc = (idx) => {
    setForm(prev => {
      const updated = [...(prev.tenant_docs || [])];
      updated.splice(idx, 1);
      return { ...prev, tenant_docs: updated };
    });
  };

  const removePetVaccDoc = (idx) => {
    setForm(prev => {
      const updated = [...(prev.pet_vacc_docs || [])];
      updated.splice(idx, 1);
      return { ...prev, pet_vacc_docs: updated };
    });
  };

  // ── Build flat payload ───────────────────────────────────────────────────────

  const buildPayload = () => {
    const payload = { ...form };
    form.members.forEach((m, i) => {
      payload[`member_${i + 1}_name`]     = m.name;
      payload[`member_${i + 1}_age`]      = m.age;
      payload[`member_${i + 1}_relation`] = m.relation;
    });
    form.vehicles.forEach((v, i) => {
      payload[`vehicle_${i + 1}_type`]   = v.type;
      payload[`vehicle_${i + 1}_make`]   = v.make;
      payload[`vehicle_${i + 1}_reg`]    = v.reg;
      payload[`vehicle_${i + 1}_colour`] = v.colour;
      payload[`vehicle_${i + 1}_fuel`]   = v.fuel;
      payload[`vehicle_${i + 1}_park`]   = v.park;
    });
    form.pets.forEach((p, i) => {
      payload[`pet_${i + 1}_name`]          = p.name;
      payload[`pet_${i + 1}_breed`]         = p.breed;
      payload[`pet_${i + 1}_age`]           = p.age;
      payload[`pet_${i + 1}_gender`]        = p.gender;
      payload[`pet_${i + 1}_vaccinated`]    = p.vaccinated;
      payload[`pet_${i + 1}_vacc_date`]     = p.vacc_date;
      payload[`pet_${i + 1}_next_vacc_date`]= p.next_vacc_date;
      payload[`pet_${i + 1}_cert_status`]   = p.cert_status;
    });
    (form.tenant_members || []).forEach((m, i) => {
      payload[`tenant_member_${i + 1}_name`]     = m.name;
      payload[`tenant_member_${i + 1}_age`]      = m.age;
      payload[`tenant_member_${i + 1}_relation`] = m.relation;
    });
    delete payload.members;
    delete payload.vehicles;
    delete payload.pets;
    delete payload.tenant_members;
    // Flatten file URLs to comma-separated strings
    payload.sale_deed_urls = (form.sale_deeds || [])
      .filter(f => f.status === 'done' || f.status === 'saved')
      .map(f => f.url).join(', ');
    payload.tenant_doc_urls = (form.tenant_docs || [])
      .filter(f => f.status === 'done' || f.status === 'saved')
      .map(f => f.url).join(', ');
    payload.pet_vacc_doc_urls = (form.pet_vacc_docs || [])
      .filter(f => f.status === 'done' || f.status === 'saved')
      .map(f => f.url).join(', ');
    delete payload.sale_deeds;
    delete payload.tenant_docs;
    delete payload.pet_vacc_docs;
    return payload;
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
            <Link href="/" className="d-flex align-items-center gap-3 text-decoration-none">
              <div className={styles.headerIcon}>🏢</div>
              <div>
                <h1 className="mb-0 fw-bold text-white fs-4">Athens Occupancy Form</h1>
                <p className="mb-0 text-white opacity-75 small">
                  Casagrand Athens Phase I — Resident Registration
                </p>
              </div>
            </Link>
            <div className="d-flex gap-2">
              <Link href="/" className="btn btn-sm btn-outline-light fw-semibold">🏠 Home</Link>
              <Link href="/admin" className="btn btn-sm btn-outline-light fw-semibold">Admin</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container-lg py-4">

        {/* ─── Search ─── */}
        <div className={`card shadow-sm mb-4 ${styles.searchCard}`}>
          <div className="card-body p-4">
            <h5 className={`fw-semibold mb-1 ${styles.sectionTitle}`}>Unit Number Lookup</h5>
            <p className="text-muted small mb-3">
              Enter the flat / unit number to fill the Occupancy form
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
              {(showForm || verificationStep) && (
                <button type="button" className="btn btn-outline-secondary" onClick={handleClear}>
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
              <div className="alert alert-danger mt-3 mb-0 py-2 small">
                ❌ Unit <strong>{unitInput.toUpperCase()}</strong> is not registered in our database.
                Please contact the Association office for assistance.
              </div>
            )}
            {lookupStatus === 'error' && (
              <div className="alert alert-danger mt-3 mb-0 py-2 small">
                ❌ {genError}
              </div>
            )}
          </div>
        </div>

        {/* ─── Identity Verification ─── */}
        {verificationStep && !showForm && (
          <div className="card shadow-sm mb-4" style={{ border: '2px solid #3A5080' }}>
            <div className="card-body p-4">
              <h5 className="fw-semibold mb-1" style={{ color: '#1B3A6B' }}>
                🔐 Identity Verification
              </h5>
              <p className="text-muted small mb-3">
                A form has already been submitted for unit <strong>{unitInput.toUpperCase()}</strong>.
                Please verify your identity to view and update your details.
              </p>
              <div className="d-flex gap-2 flex-wrap align-items-start">
                <div style={{ flex: 1, minWidth: 260 }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter your Unique ID"
                    value={verifyInput}
                    onChange={e => setVerifyInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleVerify()}
                    autoFocus
                  />
                </div>
                <button
                  className="btn btn-success"
                  onClick={handleVerify}
                  disabled={verifying || !verifyInput.trim()}
                >
                  {verifying
                    ? <><span className="spinner-border spinner-border-sm me-2" />Verifying…</>
                    : '✔ Verify & Open Form'}
                </button>
              </div>
              {verifyError && (
                <div className="alert alert-danger mt-3 mb-0 py-2 small">❌ {verifyError}</div>
              )}
              <p className="text-muted mt-3 mb-0" style={{ fontSize: '0.78rem' }}>
                Enter your <strong>Unique ID</strong> (from your welcome letter / previous form submission).
              </p>
            </div>
          </div>
        )}

        {/* ─── Form ─── */}
        {showForm && (
          <form onSubmit={handleSubmitAndDownload}>

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
                {/* Unique ID is hidden from the form but included in the downloaded .docx */}
                <div className="col-md-3">
                  <FormField label="Car Park Slot(s)" value={form.car_park} onChange={v => set('car_park', v)}
                    placeholder="e.g. 120, 120A" />
                </div>
                <div className="col-md-6">
                  <MonthPickerField label="Occupied Since (Month & Year) *" value={form.occupied_since}
                    onChange={v => set('occupied_since', v)} required />
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

                {/* Primary contact row */}
                <div className="col-12">
                  <label className={styles.fieldLabel} style={{ color: '#3A5080', fontWeight: 700 }}>
                    Primary Contact
                  </label>
                </div>
                <div className="col-md-4">
                  <FormField label="Contact No. *" value={form.contact}
                    onChange={v => set('contact', v)} type="tel" required />
                </div>
                <div className="col-md-4">
                  <FormField label="WhatsApp No. *" value={form.whatsapp}
                    onChange={v => set('whatsapp', v)} type="tel" required />
                </div>
                <div className="col-md-4">
                  <FormField label="Email Address *" value={form.email}
                    onChange={v => set('email', v)} type="email" required />
                </div>

                {/* Secondary contact row */}
                <div className="col-12">
                  <label className={styles.fieldLabel} style={{ color: '#3A5080', fontWeight: 700 }}>
                    Secondary Contact
                  </label>
                </div>
                <div className="col-md-4">
                  <FormField label="Contact No." value={form.contact2}
                    onChange={v => set('contact2', v)} type="tel" />
                </div>
                <div className="col-md-4">
                  <FormField label="WhatsApp No." value={form.whatsapp2}
                    onChange={v => set('whatsapp2', v)} type="tel" />
                </div>
                <div className="col-md-4">
                  <FormField label="Email Address" value={form.email2}
                    onChange={v => set('email2', v)} type="email" />
                </div>

                <div className="col-12">
                  <label className={styles.fieldLabel}>Permanent Address</label>
                  <div className="d-flex gap-4 mt-1 mb-2">
                    <div className="form-check">
                      <input className="form-check-input" type="radio" id="perm_same"
                        name="perm_address_type" value="same"
                        checked={form.perm_address_type === 'same'}
                        onChange={() => set('perm_address_type', 'same')} />
                      <label className="form-check-label" htmlFor="perm_same">Same as this unit</label>
                    </div>
                    <div className="form-check">
                      <input className="form-check-input" type="radio" id="perm_different"
                        name="perm_address_type" value="different"
                        checked={form.perm_address_type === 'different'}
                        onChange={() => { set('perm_address_type', 'different'); }} />
                      <label className="form-check-label" htmlFor="perm_different">Different</label>
                    </div>
                  </div>
                  {form.perm_address_type === 'different' && (
                    <textarea
                      className="form-control form-control-sm"
                      rows={3}
                      placeholder="Enter permanent address"
                      value={form.perm_address}
                      onChange={e => set('perm_address', e.target.value)}
                    />
                  )}
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

              {form.occupancy_type !== 'tenant' && (<>
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
                            placeholder="" />
                        </td>
                        <td>
                          <select className={`form-select form-select-sm ${styles.tableInput}`}
                            value={m.age} onChange={e => setMember(i, 'age', e.target.value)}>
                            {AGE_RANGES.map(r => <option key={r} value={r}>{r || '— select —'}</option>)}
                          </select>
                        </td>
                        <td>
                          <select className={`form-select form-select-sm ${styles.tableInput}`}
                            value={m.relation} onChange={e => setMember(i, 'relation', e.target.value)}>
                            {RELATIONS.map(r => <option key={r} value={r}>{r || '— select —'}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>)}
            </SectionCard>

            {/* 04 — Tenant Details (only when Tenant Occupied) */}
            {form.occupancy_type === 'tenant' && (
            <SectionCard num="04" title="TENANT DETAILS">
              <div className="row g-3">
                <div className="col-md-4">
                  <FormField label="Primary Tenant Name *" value={form.tenant_name}
                    onChange={v => set('tenant_name', v)} required />
                </div>
                <div className="col-md-4">
                  <label className={styles.fieldLabel}>Age Range *</label>
                  <select className="form-select form-select-sm mt-1" value={form.tenant_age}
                    onChange={e => set('tenant_age', e.target.value)} required>
                    {AGE_RANGES.map(a => <option key={a} value={a}>{a || 'Select age range'}</option>)}
                  </select>
                </div>
                <div className="col-md-4">
                  <FormField label="Tenant Contact No. *" value={form.tenant_contact}
                    onChange={v => set('tenant_contact', v)} type="tel" required />
                </div>
                <div className="col-md-4">
                  <FormField label="Tenant Email *" value={form.tenant_email}
                    onChange={v => set('tenant_email', v)} type="email" required />
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

                {/* Tenant Agreement Upload */}
                <div className="col-12 mt-2">
                  <label className={styles.fieldLabel}>
                    Tenant Agreement Upload &nbsp;
                    <span style={{ fontWeight: 400, color: '#6c757d', fontSize: '0.78rem' }}>
                      Please upload agreement copy
                    </span>
                  </label>
                  <div className="mt-2 p-3 rounded"
                    style={{ border: '1.5px dashed #b8c9e0', background: '#f8fafd' }}>

                    {/* File list */}
                    {(form.tenant_docs || []).length > 0 && (
                      <ul className="list-unstyled mb-2">
                        {form.tenant_docs.map((f, idx) => (
                          <li key={idx} className="d-flex align-items-center gap-2 mb-1 small">
                            {f.status === 'uploading' && (
                              <span className="spinner-border spinner-border-sm text-primary" />
                            )}
                            {f.status === 'done'  && <span style={{ color: '#198754' }}>✔</span>}
                            {f.status === 'saved' && <span style={{ color: '#1B3A6B' }}>🔗</span>}
                            {f.status === 'error' && <span style={{ color: '#dc3545' }}>✖</span>}

                            {f.url
                              ? <a href={f.url} target="_blank" rel="noopener noreferrer"
                                  className="text-truncate" style={{ maxWidth: 300 }}>{f.name}</a>
                              : <span className="text-muted text-truncate" style={{ maxWidth: 300 }}>{f.name}</span>}
                            {f.status === 'error' && (
                              <span className="text-danger" style={{ fontSize: '0.72rem' }}>({f.error})</span>
                            )}
                            <button type="button" className="btn btn-sm btn-link text-danger p-0 ms-auto"
                              onClick={() => removeTenantDoc(idx)} style={{ fontSize: '0.78rem' }}
                              disabled={f.status === 'uploading'}>
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Upload button (hidden when 5 files reached) */}
                    {(form.tenant_docs || []).length < 5 && (
                      <label className="btn btn-sm btn-outline-primary mb-0" style={{ cursor: 'pointer' }}>
                        + Add File
                        <input type="file" hidden multiple
                          accept=".pdf,image/*"
                          onChange={handleTenantFiles} />
                      </label>
                    )}

                    <p className="mb-0 mt-2 text-muted" style={{ fontSize: '0.75rem' }}>
                      Upload PDF or image · Max 5 MB per file
                    </p>
                  </div>
                </div>

                {/* Tenant Family Members */}
                <div className="col-12 mt-2">
                  <label className={styles.fieldLabel} style={{ color: '#3A5080', fontWeight: 700 }}>
                    Tenant Family Members (up to 6)
                  </label>
                  <div className="table-responsive mt-2">
                    <table className="table table-sm mb-0" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                      <thead>
                        <tr className={styles.membersThead}>
                          <th style={{ width: '4%' }}>#</th>
                          <th style={{ width: '38%' }}>Name</th>
                          <th style={{ width: '28%' }}>Age Range</th>
                          <th style={{ width: '30%' }}>Relation to Tenant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.tenant_members.map((m, i) => (
                          <tr key={i} className={styles.memberRow}>
                            <td className="text-muted small align-middle">{i + 1}</td>
                            <td>
                              <input type="text" className={`form-control form-control-sm ${styles.tableInput}`}
                                value={m.name}
                                onChange={e => {
                                  const updated = form.tenant_members.map((r, j) => j === i ? { ...r, name: e.target.value } : r);
                                  set('tenant_members', updated);
                                }}
                                placeholder="" />
                            </td>
                            <td>
                              <select className={`form-select form-select-sm ${styles.tableInput}`}
                                value={m.age}
                                onChange={e => {
                                  const updated = form.tenant_members.map((r, j) => j === i ? { ...r, age: e.target.value } : r);
                                  set('tenant_members', updated);
                                }}>
                                {AGE_RANGES.map(a => <option key={a} value={a}>{a || '— select —'}</option>)}
                              </select>
                            </td>
                            <td>
                              <select className={`form-select form-select-sm ${styles.tableInput}`}
                                value={m.relation}
                                onChange={e => {
                                  const updated = form.tenant_members.map((r, j) => j === i ? { ...r, relation: e.target.value } : r);
                                  set('tenant_members', updated);
                                }}>
                                {TENANT_RELATIONS.map(r => <option key={r} value={r}>{r || '— select —'}</option>)}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </SectionCard>
            )}

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
                        <td>
                          <select className={`form-select form-select-sm ${styles.tableInput}`}
                            value={v.type} onChange={e => setVehicle(i, 'type', e.target.value)}>
                            {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t || '— select —'}</option>)}
                          </select>
                        </td>
                        {['make', 'reg', 'colour'].map(f => (
                          <td key={f}>
                            <input type="text" className={`form-control form-control-sm ${styles.tableInput}`}
                              value={v[f]} onChange={e => setVehicle(i, f, e.target.value)} />
                          </td>
                        ))}
                        <td>
                          <select className={`form-select form-select-sm ${styles.tableInput}`}
                            value={v.fuel} onChange={e => setVehicle(i, 'fuel', e.target.value)}>
                            {FUEL_TYPES.map(t => <option key={t} value={t}>{t || '— select —'}</option>)}
                          </select>
                        </td>
                        <td>
                          <input type="text" className={`form-control form-control-sm ${styles.tableInput}`}
                            value={v.park} onChange={e => setVehicle(i, 'park', e.target.value)} />
                        </td>
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
                <>
                  <div className="table-responsive">
                    <table className="table table-sm mb-0">
                      <thead>
                        <tr className={styles.membersThead}>
                          <th style={{ width: '4%' }}>#</th>
                          <th>Pet Name</th>
                          <th>Type / Breed</th>
                          <th>Age</th>
                          <th>Gender</th>
                          <th>Vaccinated?</th>
                          <th>Last Vacc. Date</th>
                          <th>Next Due Date</th>
                          <th>Certificate Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.pets.map((p, i) => (
                          <tr key={i} className={styles.memberRow}>
                            <td className="text-muted small align-middle">{i + 1}</td>
                            <td>
                              <input type="text" className={`form-control form-control-sm ${styles.tableInput}`}
                                value={p.name} onChange={e => setPet(i, 'name', e.target.value)} />
                            </td>
                            <td>
                              <input type="text" className={`form-control form-control-sm ${styles.tableInput}`}
                                value={p.breed} onChange={e => setPet(i, 'breed', e.target.value)}
                                placeholder="e.g. Dog – Labrador" />
                            </td>
                            <td>
                              <input type="text" className={`form-control form-control-sm ${styles.tableInput}`}
                                value={p.age} onChange={e => setPet(i, 'age', e.target.value)} />
                            </td>
                            <td>
                              <select className={`form-select form-select-sm ${styles.tableInput}`}
                                value={p.gender} onChange={e => setPet(i, 'gender', e.target.value)}>
                                {PET_GENDERS.map(g => <option key={g} value={g}>{g || '— select —'}</option>)}
                              </select>
                            </td>
                            <td>
                              <select className={`form-select form-select-sm ${styles.tableInput}`}
                                value={p.vaccinated} onChange={e => setPet(i, 'vaccinated', e.target.value)}>
                                {PET_VACC_OPTS.map(v => <option key={v} value={v}>{v || '— select —'}</option>)}
                              </select>
                            </td>
                            <td>
                              <input type="text" className={`form-control form-control-sm ${styles.tableInput}`}
                                value={p.vacc_date} onChange={e => setPet(i, 'vacc_date', e.target.value)}
                                placeholder="dd/mm/yyyy" />
                            </td>
                            <td>
                              <input type="text" className={`form-control form-control-sm ${styles.tableInput}`}
                                value={p.next_vacc_date} onChange={e => setPet(i, 'next_vacc_date', e.target.value)}
                                placeholder="dd/mm/yyyy" />
                            </td>
                            <td>
                              <input type="text" className={`form-control form-control-sm ${styles.tableInput}`}
                                value={p.cert_status} onChange={e => setPet(i, 'cert_status', e.target.value)} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pet Vaccination Certificate Upload */}
                  <div className="mt-3">
                    <label className={styles.fieldLabel}>
                      Vaccination Certificate Upload &nbsp;
                      <span style={{ fontWeight: 400, color: '#6c757d', fontSize: '0.78rem' }}>
                        Please upload vaccination certificate copy
                      </span>
                    </label>
                    <div className="mt-2 p-3 rounded"
                      style={{ border: '1.5px dashed #b8c9e0', background: '#f8fafd' }}>

                      {(form.pet_vacc_docs || []).length > 0 && (
                        <ul className="list-unstyled mb-2">
                          {form.pet_vacc_docs.map((f, idx) => (
                            <li key={idx} className="d-flex align-items-center gap-2 mb-1 small">
                              {f.status === 'uploading' && (
                                <span className="spinner-border spinner-border-sm text-primary" />
                              )}
                              {f.status === 'done'  && <span style={{ color: '#198754' }}>✔</span>}
                              {f.status === 'saved' && <span style={{ color: '#1B3A6B' }}>🔗</span>}
                              {f.status === 'error' && <span style={{ color: '#dc3545' }}>✖</span>}

                              {f.url
                                ? <a href={f.url} target="_blank" rel="noopener noreferrer"
                                    className="text-truncate" style={{ maxWidth: 300 }}>{f.name}</a>
                                : <span className="text-muted text-truncate" style={{ maxWidth: 300 }}>{f.name}</span>}
                              {f.status === 'error' && (
                                <span className="text-danger" style={{ fontSize: '0.72rem' }}>({f.error})</span>
                              )}
                              <button type="button" className="btn btn-sm btn-link text-danger p-0 ms-auto"
                                onClick={() => removePetVaccDoc(idx)} style={{ fontSize: '0.78rem' }}
                                disabled={f.status === 'uploading'}>
                                Remove
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}

                      {(form.pet_vacc_docs || []).length < 5 && (
                        <label className="btn btn-sm btn-outline-primary mb-0" style={{ cursor: 'pointer' }}>
                          + Add File
                          <input type="file" hidden multiple
                            accept=".pdf,image/*"
                            onChange={handlePetVaccFiles} />
                        </label>
                      )}

                      <p className="mb-0 mt-2 text-muted" style={{ fontSize: '0.75rem' }}>
                        Upload PDF or image · Max 5 MB per file
                      </p>
                    </div>
                  </div>
                </>
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
                  <MonthPickerField label="Maintenance Paid Up To" value={form.maintenance_paid_up_to}
                    onChange={v => set('maintenance_paid_up_to', v)} />
                </div>

                {/* Sale Deed Upload */}
                <div className="col-12 mt-2">
                  <label className={styles.fieldLabel}>
                    Sale Deed Upload &nbsp;
                    <span style={{ fontWeight: 400, color: '#6c757d', fontSize: '0.78rem' }}>
                      Please upload the first eight pages of the Sale Deed
                    </span>
                  </label>
                  <div className="mt-2 p-3 rounded"
                    style={{ border: '1.5px dashed #b8c9e0', background: '#f8fafd' }}>

                    {/* File list */}
                    {(form.sale_deeds || []).length > 0 && (
                      <ul className="list-unstyled mb-2">
                        {form.sale_deeds.map((f, idx) => (
                          <li key={idx} className="d-flex align-items-center gap-2 mb-1 small">
                            {f.status === 'uploading' && (
                              <span className="spinner-border spinner-border-sm text-primary" />
                            )}
                            {f.status === 'done' && <span style={{ color: '#198754' }}>✔</span>}
                            {f.status === 'saved' && <span style={{ color: '#1B3A6B' }}>🔗</span>}
                            {f.status === 'error' && <span style={{ color: '#dc3545' }}>✖</span>}

                            {f.url
                              ? <a href={f.url} target="_blank" rel="noopener noreferrer"
                                  className="text-truncate" style={{ maxWidth: 300 }}>{f.name}</a>
                              : <span className="text-muted text-truncate" style={{ maxWidth: 300 }}>{f.name}</span>}
                            {f.status === 'error' && (
                              <span className="text-danger" style={{ fontSize: '0.72rem' }}>({f.error})</span>
                            )}
                            <button type="button" className="btn btn-sm btn-link text-danger p-0 ms-auto"
                              onClick={() => removeDeed(idx)} style={{ fontSize: '0.78rem' }}
                              disabled={f.status === 'uploading'}>
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Upload button (hidden when 5 files reached) */}
                    {(form.sale_deeds || []).length < 5 && (
                      <label className="btn btn-sm btn-outline-primary mb-0" style={{ cursor: 'pointer' }}>
                        + Add File
                        <input type="file" hidden multiple
                          accept=".pdf,image/*"
                          onChange={handleDeedFiles} />
                      </label>
                    )}

                    <p className="mb-0 mt-2 text-muted" style={{ fontSize: '0.75rem' }}>
                      Upload PDF or image · Max 5 MB per file
                    </p>
                  </div>
                </div>

              </div>
            </SectionCard>

            {/* 08 — Documents */}
            <SectionCard num="08" title="DOCUMENTS ENCLOSED — CHECKLIST">
              <div className="d-flex flex-wrap gap-4">
                <div className="form-check">
                  <input className="form-check-input" type="checkbox" id="doc_sale_deed"
                    checked={form.doc_sale_deed}
                    onChange={e => set('doc_sale_deed', e.target.checked)} />
                  <label className="form-check-label" htmlFor="doc_sale_deed">
                    Sale Deed Copy — Attached
                  </label>
                </div>
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
            {submitSuccess && (
              <div className="alert alert-success mt-2 py-3 px-4">
                <div className="fw-bold mb-1" style={{ fontSize: '1rem' }}>
                  🎉 Thank you for filling in your details!
                </div>
                <div className="small">
                  Your information has been saved and your form PDF has been downloaded. You have
                  taken an important step towards building a <strong>safe and secure gateway
                  community</strong> at Casagrand Athens.
                </div>
              </div>
            )}
            <div className="d-flex justify-content-end gap-3 mt-4 pb-4 flex-wrap">
              <button type="button" className="btn btn-outline-secondary" onClick={handleClear}>
                Cancel
              </button>
              <button type="submit" className={`btn ${styles.btnPrimary} px-4`} disabled={generating}>
                {generating ? (
                  <><span className="spinner-border spinner-border-sm me-2" />Saving &amp; Downloading…</>
                ) : '⬇ Submit and Download (.pdf)'}
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

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Parse "Jan 2022" → { month: 'Jan', year: '2022' }
function parseMonthYear(val) {
  if (!val) return { month: '', year: '' };
  const parts = val.trim().split(/\s+/);
  if (parts.length === 2) {
    const m = MONTH_NAMES.find(n => n.toLowerCase() === parts[0].toLowerCase());
    return { month: m || '', year: parts[1] || '' };
  }
  return { month: '', year: '' };
}

function MonthPickerField({ label, value, onChange, required }) {
  const parsed = parseMonthYear(value);
  const [selMonth, setSelMonth] = useState(parsed.month);
  const [selYear, setSelYear]   = useState(parsed.year);

  // Keep dropdowns in sync when parent loads existing data
  useEffect(() => {
    const { month, year } = parseMonthYear(value);
    setSelMonth(month);
    setSelYear(year);
  }, [value]);

  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = 1990; y <= currentYear + 2; y++) years.push(y);

  const handleMonthChange = (m) => {
    setSelMonth(m);
    if (m && selYear) onChange(`${m} ${selYear}`);
    else onChange('');
  };

  const handleYearChange = (y) => {
    setSelYear(y);
    if (selMonth && y) onChange(`${selMonth} ${y}`);
    else onChange('');
  };

  return (
    <div>
      <label className={styles.fieldLabel}>{label}</label>
      <div className="d-flex gap-2 mt-1">
        <select
          className="form-select form-select-sm"
          value={selMonth}
          onChange={e => handleMonthChange(e.target.value)}
          required={required}
          style={{ flex: 1 }}
        >
          <option value="">Month</option>
          {MONTH_NAMES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          className="form-select form-select-sm"
          value={selYear}
          onChange={e => handleYearChange(e.target.value)}
          style={{ flex: 1 }}
        >
          <option value="">Year</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
    </div>
  );
}

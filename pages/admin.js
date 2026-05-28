import { useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/Admin.module.css';

export default function Admin() {
  const router = useRouter();
  const [token, setToken]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPwd, setShowPwd]           = useState(false);
  const [loginError, setLoginError]     = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [submissions, setSubmissions]   = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError]     = useState('');
  const [search, setSearch]             = useState('');
  const [exporting, setExporting]       = useState(false);
  const [deleting, setDeleting]         = useState(null);   // unit number currently being deleted
  const [deleteError, setDeleteError]   = useState('');
  const [selectedSub, setSelectedSub]   = useState(null);   // submission open in detail modal

  // Session is intentionally NOT restored on page load —
  // password is required every time the admin page is visited.

  // ── Fetch all submissions ────────────────────────────────────────
  const fetchSubmissions = useCallback(async (tok) => {
    setFetchLoading(true);
    setFetchError('');
    try {
      const res = await fetch('/api/admin/submissions', {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (res.status === 401) {
        sessionStorage.removeItem('admin_token');
        setToken('');
        return;
      }
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setSubmissions(data.submissions || []);
    } catch (err) {
      setFetchError(err.message);
    } finally {
      setFetchLoading(false);
    }
  }, []);

  // ── Login ────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const res  = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      setToken(data.token);
      fetchSubmissions(data.token);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Export all submissions as Excel ─────────────────────────────
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/admin/export-excel', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `Athens_Submissions_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = () => {
    setToken('');
    setSubmissions([]);
    setSearch('');
  };

  // ── Delete submission ───────────────────────────────────────────
  const handleDelete = async (unitNumber) => {
    const confirmed = window.confirm(
      `Delete submission for unit ${unitNumber}?\n\nThis will permanently remove the row from the sheet. This action cannot be undone.`
    );
    if (!confirmed) return;

    setDeleting(unitNumber);
    setDeleteError('');
    try {
      const res = await fetch(
        `/api/admin/delete-submission?unit=${encodeURIComponent(unitNumber)}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      // Remove from local state immediately — no need to refetch
      setSubmissions(prev => prev.filter(s => s.unit_number !== unitNumber));
    } catch (err) {
      setDeleteError(`Failed to delete ${unitNumber}: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  // ── Filter ───────────────────────────────────────────────────────
  const filtered = submissions.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (s.unit_number  || '').toLowerCase().includes(q) ||
      (s.owner_name   || '').toLowerCase().includes(q) ||
      (s.block        || '').toLowerCase().includes(q) ||
      (s.occupancy_type || '').toLowerCase().includes(q)
    );
  });

  // ── Stats ────────────────────────────────────────────────────────
  const countByType = (type) => submissions.filter(s => s.occupancy_type === type).length;

  // ── Render: Login ────────────────────────────────────────────────
  if (!token) {
    return (
      <>
        <Head><title>Admin — Athens Occupancy Form</title></Head>

        <div className={styles.header}>
          <div className="container-lg py-3">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div className="d-flex align-items-center gap-3">
                <div className={styles.headerIcon}>🏢</div>
                <div>
                  <h1 className="mb-0 fw-bold text-white fs-4">Athens Occupancy Form</h1>
                  <p className="mb-0 text-white opacity-75 small">Admin Panel</p>
                </div>
              </div>
              <Link href="/" className="btn btn-sm btn-outline-light fw-semibold">🏠 Home</Link>
            </div>
          </div>
        </div>

        <div className="container-lg">
          <div className={styles.loginCard + ' card shadow-sm'}>
            <div className={styles.loginHeader}>
              <h5 className="mb-0 fw-semibold">Admin Login</h5>
              <p className="mb-0 small opacity-75 mt-1">Enter your admin password to continue</p>
            </div>
            <div className="card-body p-4">
              <form onSubmit={handleLogin}>
                <div className="mb-3">
                  <label className="form-label fw-semibold small">Password</label>
                  <div className="input-group">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      className="form-control"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter admin password"
                      autoFocus
                      required
                    />
                    <button type="button" className="btn btn-outline-secondary"
                      onClick={() => setShowPwd(p => !p)}>
                      {showPwd ? '🙈' : '👁'}
                    </button>
                  </div>
                </div>
                {loginError && (
                  <div className="alert alert-danger py-2 small">{loginError}</div>
                )}
                <button type="submit" className={`btn ${styles.btnPrimary} w-100`}
                  disabled={loginLoading}>
                  {loginLoading
                    ? <><span className="spinner-border spinner-border-sm me-2" />Checking…</>
                    : 'Login'}
                </button>
              </form>
              <div className="text-center mt-3">
                <Link href="/" className="small text-muted">← Back to form</Link>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Render: Dashboard ────────────────────────────────────────────
  return (
    <>
      <Head><title>Admin Dashboard — Athens Occupancy Form</title></Head>

      <div className={styles.header}>
        <div className="container-lg py-3">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div className="d-flex align-items-center gap-3">
              <div className={styles.headerIcon}>🏢</div>
              <div>
                <h1 className="mb-0 fw-bold text-white fs-4">Athens Occupancy Form</h1>
                <p className="mb-0 text-white opacity-75 small">Admin Dashboard</p>
              </div>
            </div>
            <div className="d-flex gap-2 flex-wrap">
              <button className="btn btn-sm btn-outline-light"
                onClick={() => fetchSubmissions(token)} disabled={fetchLoading}>
                {fetchLoading ? <span className="spinner-border spinner-border-sm" /> : '↻ Refresh'}
              </button>
              <button
                className="btn btn-sm btn-success fw-semibold"
                onClick={handleExportExcel}
                disabled={exporting || submissions.length === 0}
                title="Download all submissions as Excel"
              >
                {exporting
                  ? <><span className="spinner-border spinner-border-sm me-1" />Exporting…</>
                  : `⬇ Export Excel (${submissions.length})`}
              </button>
              <Link href="/" className="btn btn-sm btn-light fw-semibold">🏠 Home</Link>
              <button className="btn btn-sm btn-outline-light" onClick={handleLogout}>Logout</button>
            </div>
          </div>
        </div>
      </div>

      <div className="container-lg py-4">

        {/* Stats */}
        <div className={`${styles.statsBar} d-flex flex-wrap gap-4 mb-4`}>
          <div className={styles.statItem}>
            <div className={styles.statNumber}>{submissions.length}</div>
            <div className={styles.statLabel}>Total Submissions</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statNumber}>{countByType('owner')}</div>
            <div className={styles.statLabel}>Owner Occupied</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statNumber}>{countByType('tenant')}</div>
            <div className={styles.statLabel}>Tenant Occupied</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statNumber}>{countByType('vacant')}</div>
            <div className={styles.statLabel}>Vacant</div>
          </div>
          <div className={`${styles.statItem} ms-auto`}>
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Search unit, owner, block…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ minWidth: 220 }}
            />
          </div>
        </div>

        {fetchError && (
          <div className="alert alert-danger small">{fetchError}</div>
        )}
        {deleteError && (
          <div className="alert alert-danger small d-flex justify-content-between align-items-center">
            {deleteError}
            <button type="button" className="btn-close btn-sm" onClick={() => setDeleteError('')} />
          </div>
        )}

        {/* Table */}
        <div className={styles.tableCard}>
          {fetchLoading ? (
            <div className="text-center py-5">
              <span className="spinner-border text-primary" />
              <p className="mt-2 text-muted small">Loading submissions…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className={styles.emptyState}>
              {submissions.length === 0
                ? <>No submissions yet.<br /><Link href="/" className="small">Submit the first form →</Link></>
                : 'No results match your search.'}
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr className={styles.tableHead}>
                    <th>#</th>
                    <th>Unit</th>
                    <th>Unique ID</th>
                    <th>Block</th>
                    <th>Floor</th>
                    <th>Owner Name</th>
                    <th>Contact</th>
                    <th>Occupancy</th>
                    <th>Members</th>
                    <th>Last Updated</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, i) => {
                    const occClass =
                      s.occupancy_type === 'owner'  ? styles.occOwner :
                      s.occupancy_type === 'tenant' ? styles.occTenant :
                      styles.occVacant;
                    return (
                      <tr key={i} className={styles.tableRow}>
                        <td className="text-muted">{i + 1}</td>
                        <td><span className={styles.unitBadge}>{s.unit_number}</span></td>
                        <td><code style={{ fontSize: '0.78rem', color: '#1B3A6B' }}>{s.unique_id || '—'}</code></td>
                        <td>{s.block}</td>
                        <td>{s.floor}</td>
                        <td className="fw-semibold">{s.owner_name || '—'}</td>
                        <td>{s.contact || '—'}</td>
                        <td>
                          {s.occupancy_type
                            ? <span className={`${styles.occBadge} ${occClass}`}>{s.occupancy_type}</span>
                            : '—'}
                        </td>
                        <td className="text-center">{s.total_occupants || '—'}</td>
                        <td className="text-muted small">{s.submitted_at || '—'}</td>
                        <td>
                          <div className="d-flex gap-1">
                            <button
                              className={styles.btnDetails}
                              onClick={() => setSelectedSub(s)}
                            >
                              Details
                            </button>
                            <button
                              className={styles.btnEdit}
                              onClick={() => router.push(`/?unit=${encodeURIComponent(s.unit_number)}`)}
                            >
                              Edit
                            </button>
                            <button
                              className={styles.btnDelete}
                              onClick={() => handleDelete(s.unit_number)}
                              disabled={deleting === s.unit_number}
                              title={`Delete submission for ${s.unit_number}`}
                            >
                              {deleting === s.unit_number
                                ? <span className="spinner-border spinner-border-sm" />
                                : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-muted small mt-2 text-end">
          Showing {filtered.length} of {submissions.length} submissions
        </p>
      </div>

      {/* ─── Detail Modal ─── */}
      {selectedSub && (
        <DetailModal sub={selectedSub} onClose={() => setSelectedSub(null)} />
      )}
    </>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────────

function DetailModal({ sub: s, onClose }) {
  // Read a value trying multiple fallback key names
  const get = (...keys) => keys.reduce((acc, k) => acc || s[k] || '', '');

  // Doc checkbox — supports colon-key (new) and plain-key (old sheet)
  const docYes = (k1, k2) => {
    const v = (s[k1] || s[k2] || '').toLowerCase();
    return v === 'yes' || v === 'true';
  };

  const members = Array.from({ length: 10 }, (_, i) => ({
    num: i + 1,
    name:     s[`member_${i+1}_name`]     || '',
    age:      s[`member_${i+1}_age`]      || '',
    relation: s[`member_${i+1}_relation`] || '',
  })).filter(m => m.name || m.age || m.relation);

  const tenantMembers = Array.from({ length: 6 }, (_, i) => ({
    num: i + 1,
    name:     s[`tenant_member_${i+1}_name`]     || '',
    age:      s[`tenant_member_${i+1}_age`]      || '',
    relation: s[`tenant_member_${i+1}_relation`] || '',
  })).filter(m => m.name);

  const vehicles = Array.from({ length: 5 }, (_, i) => ({
    num:    i + 1,
    type:   s[`vehicle_${i+1}_type`]   || '',
    make:   s[`vehicle_${i+1}_make`]   || '',
    reg:    s[`vehicle_${i+1}_reg`]    || '',
    colour: s[`vehicle_${i+1}_colour`] || '',
    fuel:   s[`vehicle_${i+1}_fuel`]   || '',
    park:   s[`vehicle_${i+1}_park`]   || '',
  })).filter(v => v.type || v.make || v.reg);

  const pets = Array.from({ length: 5 }, (_, i) => ({
    num:        i + 1,
    name:       s[`pet_${i+1}_name`]          || '',
    breed:      s[`pet_${i+1}_breed`]         || '',
    age:        s[`pet_${i+1}_age`]           || '',
    gender:     s[`pet_${i+1}_gender`]        || '',
    vaccinated: s[`pet_${i+1}_vaccinated`]    || '',
    vacDate:    s[`pet_${i+1}_last_vacc_date`]|| '',
    nextDate:   s[`pet_${i+1}_next_due_date`] || '',
    cert:       s[`pet_${i+1}_cert_status`]   || '',
  })).filter(p => p.name);

  const occBg    = s.occupancy_type === 'owner'  ? '#d1f5ea'
                 : s.occupancy_type === 'tenant' ? '#fff3cd' : '#f1f3f5';
  const occColor = s.occupancy_type === 'owner'  ? '#0a6640'
                 : s.occupancy_type === 'tenant' ? '#7d5a00' : '#555';

  // Small row: label + value
  const Row = ({ label, value }) =>
    value ? (
      <div className="d-flex gap-2 mb-1" style={{ fontSize: '0.875rem' }}>
        <span style={{ color: '#6c757d', minWidth: 170, flexShrink: 0 }}>{label}</span>
        <span style={{ fontWeight: 500, color: '#1a1a1a', wordBreak: 'break-word' }}>{value}</span>
      </div>
    ) : null;

  // Section block with title divider
  const Section = ({ title, children }) => (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={{
        fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.09em',
        color: '#1B3A6B', textTransform: 'uppercase',
        borderBottom: '1.5px solid #b8c9e0', paddingBottom: '0.3rem', marginBottom: '0.6rem',
      }}>{title}</div>
      {children}
    </div>
  );

  // Mini table header style
  const th = { fontWeight: 600, fontSize: '0.78rem', background: '#eef3fb',
               padding: '5px 8px', borderBottom: '1px solid #dde6f3' };
  const td = { fontSize: '0.82rem', padding: '5px 8px', borderBottom: '1px solid #f0f0f0' };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '1.5rem 1rem', overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 14, width: '100%', maxWidth: 900,
          boxShadow: '0 12px 48px rgba(0,0,0,0.22)', flexShrink: 0,
          marginBottom: '1.5rem',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Modal Header ── */}
        <div style={{
          background: '#1B3A6B', color: '#fff', borderRadius: '14px 14px 0 0',
          padding: '0.9rem 1.25rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
        }}>
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>Unit {s.unit_number}</span>
            {s.occupancy_type && (
              <span style={{
                background: occBg, color: occColor,
                padding: '2px 10px', borderRadius: 20,
                fontSize: '0.73rem', fontWeight: 700, textTransform: 'capitalize',
              }}>{s.occupancy_type}</span>
            )}
            <span style={{ opacity: 0.85, fontSize: '0.92rem' }}>{s.owner_name || ''}</span>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
            borderRadius: 6, padding: '4px 12px', cursor: 'pointer',
            fontSize: '0.88rem', fontWeight: 600, flexShrink: 0,
          }}>✕ Close</button>
        </div>

        {/* ── Modal Body ── */}
        <div style={{ padding: '1.25rem 1.5rem' }}>

          {/* 1 — Unit Information */}
          <Section title="Unit Information">
            <div className="row g-0">
              <div className="col-md-6">
                <Row label="Unit Number"    value={s.unit_number} />
                <Row label="Block / Tower"  value={s.block} />
                <Row label="Floor"          value={s.floor} />
                <Row label="Unit Type"      value={s.unit_type} />
              </div>
              <div className="col-md-6">
                <Row label="Car Park Slot"  value={s.car_park} />
                <Row label="Unique ID"      value={s.unique_id} />
                <Row label="Occupied Since" value={s.occupied_since} />
                <Row label="Last Submitted" value={s.submitted_at} />
              </div>
            </div>
          </Section>

          {/* 2 — Owner Details */}
          <Section title="Owner Details">
            <div className="row g-0">
              <div className="col-md-6">
                <Row label="Owner Name"         value={s.owner_name} />
                <Row label="Primary Contact"    value={get('primary_contact','contact')} />
                <Row label="Primary WhatsApp"   value={get('primary_whatsapp','whatsapp')} />
                <Row label="Primary Email"      value={get('primary_email','email')} />
              </div>
              <div className="col-md-6">
                <Row label="Secondary Contact"  value={get('secondary_contact','contact2')} />
                <Row label="Secondary WhatsApp" value={get('secondary_whatsapp','whatsapp2')} />
                <Row label="Secondary Email"    value={get('secondary_email','email2')} />
                <Row label="Permanent Address"
                  value={
                    s.permanent_address_type === 'same' ? 'Same as unit' :
                    (s.permanent_address || s.perm_address || '')
                  } />
              </div>
            </div>
          </Section>

          {/* 3 — Occupancy & Members */}
          <Section title="Occupancy & Members">
            <div className="row g-0 mb-2">
              <div className="col-md-4">
                <Row label="Occupancy Type"   value={s.occupancy_type} />
              </div>
              <div className="col-md-4">
                <Row label="Total Occupants"  value={s.total_occupants} />
              </div>
            </div>
            {s.occupancy_type !== 'tenant' && members.length > 0 && (
              <>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3A5080', marginBottom: 4 }}>
                  Family Members
                </div>
                <div className="table-responsive">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ ...th, width: '5%' }}>#</th>
                        <th style={th}>Name</th>
                        <th style={th}>Age Range</th>
                        <th style={th}>Relation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map(m => (
                        <tr key={m.num}>
                          <td style={{ ...td, color: '#999' }}>{m.num}</td>
                          <td style={td}>{m.name || '—'}</td>
                          <td style={td}>{m.age || '—'}</td>
                          <td style={td}>{m.relation || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Section>

          {/* 4 — Tenant Details (only when tenant) */}
          {s.occupancy_type === 'tenant' && (
            <Section title="Tenant Details">
              <div className="row g-0 mb-2">
                <div className="col-md-6">
                  <Row label="Tenant Name"          value={s.tenant_name} />
                  <Row label="Age Range"            value={s.tenant_age} />
                  <Row label="Contact"              value={s.tenant_contact} />
                  <Row label="Email"                value={s.tenant_email} />
                </div>
                <div className="col-md-6">
                  <Row label="Agreement Period"     value={s.agreement_period} />
                  <Row label="Police Verification"  value={s.police_verification} />
                  <Row label="Agreement Registered" value={s.agreement_registered} />
                </div>
              </div>
              {tenantMembers.length > 0 && (
                <>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3A5080', marginBottom: 4 }}>
                    Tenant Family Members
                  </div>
                  <div className="table-responsive">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ ...th, width: '5%' }}>#</th>
                          <th style={th}>Name</th><th style={th}>Age</th><th style={th}>Relation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tenantMembers.map(m => (
                          <tr key={m.num}>
                            <td style={{ ...td, color: '#999' }}>{m.num}</td>
                            <td style={td}>{m.name}</td>
                            <td style={td}>{m.age || '—'}</td>
                            <td style={td}>{m.relation || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Section>
          )}

          {/* 5 — Vehicle Details */}
          {vehicles.length > 0 && (
            <Section title="Vehicle Details">
              <div className="table-responsive">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, width: '5%' }}>#</th>
                      <th style={th}>Type</th><th style={th}>Make / Model</th>
                      <th style={th}>Reg No.</th><th style={th}>Colour</th>
                      <th style={th}>Fuel</th><th style={th}>Park Slot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.map(v => (
                      <tr key={v.num}>
                        <td style={{ ...td, color: '#999' }}>{v.num}</td>
                        <td style={td}>{v.type || '—'}</td>
                        <td style={td}>{v.make || '—'}</td>
                        <td style={td}>
                          <code style={{ fontSize: '0.8rem', color: '#1B3A6B' }}>
                            {v.reg || '—'}
                          </code>
                        </td>
                        <td style={td}>{v.colour || '—'}</td>
                        <td style={td}>{v.fuel || '—'}</td>
                        <td style={td}>{v.park || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* 6 — Pet Details */}
          {pets.length > 0 && (
            <Section title="Pet Details">
              <div className="table-responsive">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, width: '5%' }}>#</th>
                      <th style={th}>Name</th><th style={th}>Breed</th>
                      <th style={th}>Age</th><th style={th}>Gender</th>
                      <th style={th}>Vaccinated</th><th style={th}>Last Vacc</th><th style={th}>Next Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pets.map(p => (
                      <tr key={p.num}>
                        <td style={{ ...td, color: '#999' }}>{p.num}</td>
                        <td style={td}>{p.name}</td>
                        <td style={td}>{p.breed || '—'}</td>
                        <td style={td}>{p.age || '—'}</td>
                        <td style={td}>{p.gender || '—'}</td>
                        <td style={td}>{p.vaccinated || '—'}</td>
                        <td style={td}>{p.vacDate || '—'}</td>
                        <td style={td}>{p.nextDate || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* 7 — Association & Documents */}
          <Section title="Association Membership & Documents">
            <div className="row g-0">
              <div className="col-md-6">
                <Row label="Membership Completed"   value={s.membership_completed} />
                <Row label="Membership ID"          value={s.membership_id} />
                <Row label="Maintenance Paid Up To" value={s.maintenance_paid_up_to} />
              </div>
              <div className="col-md-6">
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3A5080', marginBottom: 6 }}>
                  Documents Enclosed
                </div>
                <div style={{ fontSize: '0.875rem', lineHeight: 2 }}>
                  <span style={{ marginRight: 16 }}>
                    {docYes('doc:_sale_deed','doc_sale_deed') ? '☑' : '☐'} Sale Deed
                  </span>
                  <span style={{ marginRight: 16 }}>
                    {docYes('doc:_tenant_agreement','doc_tenant_agreement') ? '☑' : '☐'} Tenant Agreement
                  </span>
                  <span>
                    {docYes('doc:_pet_certificate','doc_pet_cert') ? '☑' : '☐'} Pet Certificate
                  </span>
                </div>
                {/* Uploaded file links */}
                {s.sale_deed_urls && (
                  <div className="mt-2">
                    <div style={{ fontSize: '0.72rem', color: '#6c757d', fontWeight: 600, marginBottom: 2 }}>
                      Sale Deed Files
                    </div>
                    {s.sale_deed_urls.split(',').filter(Boolean).map((url, i) => (
                      <a key={i} href={url.trim()} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'block', fontSize: '0.78rem' }}>
                        📄 View file {i + 1}
                      </a>
                    ))}
                  </div>
                )}
                {s.tenant_agreement_urls && (
                  <div className="mt-1">
                    <div style={{ fontSize: '0.72rem', color: '#6c757d', fontWeight: 600, marginBottom: 2 }}>
                      Tenant Agreement Files
                    </div>
                    {s.tenant_agreement_urls.split(',').filter(Boolean).map((url, i) => (
                      <a key={i} href={url.trim()} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'block', fontSize: '0.78rem' }}>
                        📄 View file {i + 1}
                      </a>
                    ))}
                  </div>
                )}
                {s.pet_vaccination_urls && (
                  <div className="mt-1">
                    <div style={{ fontSize: '0.72rem', color: '#6c757d', fontWeight: 600, marginBottom: 2 }}>
                      Pet Vaccination Files
                    </div>
                    {s.pet_vaccination_urls.split(',').filter(Boolean).map((url, i) => (
                      <a key={i} href={url.trim()} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'block', fontSize: '0.78rem' }}>
                        📄 View file {i + 1}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Section>

        </div>
      </div>
    </div>
  );
}

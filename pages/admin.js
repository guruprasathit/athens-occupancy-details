import { useState, useEffect, useCallback } from 'react';
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

  // ── Restore session on page load ────────────────────────────────
  useEffect(() => {
    const saved = typeof window !== 'undefined' && sessionStorage.getItem('admin_token');
    if (saved) { setToken(saved); fetchSubmissions(saved); }
  }, []);

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
      sessionStorage.setItem('admin_token', data.token);
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
    sessionStorage.removeItem('admin_token');
    setToken('');
    setSubmissions([]);
    setSearch('');
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
            <div className="d-flex align-items-center gap-3">
              <div className={styles.headerIcon}>🏢</div>
              <div>
                <h1 className="mb-0 fw-bold text-white fs-4">Athens Occupancy Form</h1>
                <p className="mb-0 text-white opacity-75 small">Admin Panel</p>
              </div>
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
              <Link href="/" className="btn btn-sm btn-light fw-semibold">+ New Form</Link>
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
                          <button
                            className={styles.btnEdit}
                            onClick={() => router.push(`/?unit=${encodeURIComponent(s.unit_number)}`)}
                          >
                            Edit
                          </button>
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
    </>
  );
}

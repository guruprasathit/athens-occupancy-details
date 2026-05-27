const SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;

function checkConfig() {
  if (!SCRIPT_URL) throw new Error('GOOGLE_SCRIPT_URL env variable is not set');
}

export async function lookupUnit(unitNumber) {
  checkConfig();
  const url = `${SCRIPT_URL}?action=lookup&unit=${encodeURIComponent(unitNumber.trim())}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Lookup request failed: ${res.status}`);
  return res.json();
}

export async function getSubmission(unitNumber) {
  checkConfig();
  const url = `${SCRIPT_URL}?action=getsubmission&unit=${encodeURIComponent(unitNumber.trim())}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Get submission failed: ${res.status}`);
  return res.json();
}

export async function saveSubmission(formData) {
  checkConfig();
  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain' }, // Apps Script requires text/plain for doPost
    body: JSON.stringify({ action: 'submit', data: formData }),
  });
  if (!res.ok) throw new Error(`Save request failed: ${res.status}`);
  return res.json();
}

export async function getAllSubmissions() {
  checkConfig();
  const url = `${SCRIPT_URL}?action=getallsubmissions`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Get all submissions failed: ${res.status}`);
  return res.json();
}

export async function setupSheet() {
  checkConfig();
  const url = `${SCRIPT_URL}?action=setup`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Setup request failed: ${res.status}`);
  return res.json();
}

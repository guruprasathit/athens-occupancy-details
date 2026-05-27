// AES-256-GCM field-level encryption for sensitive PII stored in Google Sheets.
// The ENCRYPTION_KEY env var must be a 64-char hex string (32 bytes).
// Values are stored as "ENC:<base64>" so plaintext legacy values still decrypt safely.

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const PREFIX    = 'ENC:';

function getKey() {
  const hex = (process.env.ENCRYPTION_KEY || '').trim();
  if (!hex || hex.length !== 64) return null;
  return Buffer.from(hex, 'hex');
}

// Encrypt a single string value. Returns "ENC:<base64>" or original if key missing.
export function encrypt(text) {
  if (text === null || text === undefined || text === '') return text;
  const str = String(text);
  if (str.startsWith(PREFIX)) return str; // already encrypted
  const key = getKey();
  if (!key) return str; // no key — store plaintext (graceful degradation)

  const iv        = crypto.randomBytes(12);
  const cipher    = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(str, 'utf8'), cipher.final()]);
  const tag       = cipher.getAuthTag();
  // Layout: [12 bytes IV][16 bytes auth tag][N bytes ciphertext]
  return PREFIX + Buffer.concat([iv, tag, encrypted]).toString('base64');
}

// Decrypt a single "ENC:<base64>" value. Returns original string if not encrypted.
export function decrypt(text) {
  if (!text || !String(text).startsWith(PREFIX)) return text;
  const key = getKey();
  if (!key) return text; // can't decrypt without key

  try {
    const buf       = Buffer.from(String(text).slice(PREFIX.length), 'base64');
    const iv        = buf.subarray(0, 12);
    const tag       = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher  = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
  } catch {
    return text; // return as-is if decryption fails (corrupt / wrong key)
  }
}

// Encrypt a set of named fields in a plain object (returns new object).
export function encryptFields(data, fields) {
  const out = { ...data };
  fields.forEach(f => { if (out[f] !== undefined) out[f] = encrypt(out[f]); });
  return out;
}

// Decrypt a set of named fields in a plain object (returns new object).
export function decryptFields(data, fields) {
  const out = { ...data };
  fields.forEach(f => { if (out[f] !== undefined) out[f] = decrypt(out[f]); });
  return out;
}

// All PII fields that get encrypted on submit and decrypted on read.
export const SENSITIVE_FIELDS = [
  // Owner contacts
  'contact', 'whatsapp', 'email',
  // Secondary contacts
  'contact2', 'whatsapp2', 'email2',
  // Tenant contacts
  'tenant_contact', 'tenant_email',
  // Vehicle registration numbers
  'vehicle_1_reg', 'vehicle_2_reg', 'vehicle_3_reg', 'vehicle_4_reg', 'vehicle_5_reg',
];

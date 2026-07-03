import crypto from 'crypto';

/*
  Field-level encryption for talent PAYOUT details (bank account, national ID,
  PayPal). Kept in a separate restricted table (talent_payout_details) with the
  whole payload encrypted at rest — a DB/backup leak yields ciphertext only.

  Key: PAYOUT_ENC_KEY env var = 32 bytes, base64 (generate with
  `openssl rand -base64 32`). Set it in Vercel only — NEVER commit it. Losing the
  key makes existing payout details unrecoverable, so store a backup somewhere safe.

  Scheme: AES-256-GCM. Wire format = base64( iv[12] | authTag[16] | ciphertext ).
*/

const ALG = 'aes-256-gcm';

function getKey(): Buffer {
  const raw = (process.env.PAYOUT_ENC_KEY || '').trim();
  if (!raw) throw new Error('PAYOUT_ENC_KEY_MISSING');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('PAYOUT_ENC_KEY_BAD_LENGTH');
  return key;
}

/** True if the encryption key is configured (so callers can fail cleanly). */
export function payoutEncConfigured(): boolean {
  try { getKey(); return true; } catch { return false; }
}

export function encryptJson(obj: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, getKey(), iv);
  const pt = Buffer.from(JSON.stringify(obj), 'utf8');
  const ct = Buffer.concat([cipher.update(pt), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

export function decryptJson<T = Record<string, unknown>>(blob: string): T {
  const buf = Buffer.from(blob, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALG, getKey(), iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(pt.toString('utf8')) as T;
}

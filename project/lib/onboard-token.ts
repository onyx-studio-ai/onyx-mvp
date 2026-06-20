import { createHmac, timingSafeEqual } from 'node:crypto';

/*
  Stateless onboarding token (no DB column needed). Generated when an
  application is approved; embedded in the approval email as a one-time-ish
  link so the talent can complete onboarding WITHOUT a login. Carries the
  talent id + expiry, HMAC-signed with a server-only secret.
*/

const SECRET = process.env.ONBOARD_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — talents need time to act

export function signOnboardToken(talentId: string): string {
  const exp = Date.now() + TTL_MS;
  const payload = `${talentId}.${exp}`;
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
  return `${Buffer.from(payload).toString('base64url')}.${sig}`;
}

/** Returns the talent id if the token is valid + unexpired, else null. */
export function verifyOnboardToken(token: string): string | null {
  if (!SECRET || !token) return null;
  const [b64, sig] = token.split('.');
  if (!b64 || !sig) return null;
  let payload: string;
  try { payload = Buffer.from(b64, 'base64url').toString('utf8'); } catch { return null; }
  const expected = createHmac('sha256', SECRET).update(payload).digest('hex');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [talentId, expStr] = payload.split('.');
  const exp = Number(expStr);
  if (!talentId || !exp || Date.now() > exp) return null;
  return talentId;
}

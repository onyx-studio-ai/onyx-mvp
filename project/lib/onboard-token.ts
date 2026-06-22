import { createHmac, timingSafeEqual } from 'node:crypto';

/*
  Stateless onboarding token (no DB column needed). Generated when an
  application is approved; embedded in the approval email as a one-time-ish
  link so the talent can complete onboarding WITHOUT a login. Carries the
  talent id + expiry, HMAC-signed with a server-only secret.

  The whole token is ONE base64url string (payload|sig encoded together) — no "."
  in it, because a dot in a URL path segment makes Next.js treat it as a static
  file and skip the dynamic route (-> 404).
*/

const SECRET = process.env.ONBOARD_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — talents need time to act

export function signOnboardToken(talentId: string): string {
  const exp = Date.now() + TTL_MS;
  const payload = `${talentId}.${exp}`;
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}|${sig}`).toString('base64url');
}

/** Returns the talent id if the token is valid + unexpired, else null. */
export function verifyOnboardToken(token: string): string | null {
  if (!SECRET || !token) return null;
  let decoded: string;
  try { decoded = Buffer.from(token, 'base64url').toString('utf8'); } catch { return null; }
  const [payload, sig] = decoded.split('|');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', SECRET).update(payload).digest('hex');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [talentId, expStr] = payload.split('.');
  const exp = Number(expStr);
  if (!talentId || !exp || Date.now() > exp) return null;
  return talentId;
}

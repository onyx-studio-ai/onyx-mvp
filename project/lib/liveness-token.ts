import { createHmac, timingSafeEqual } from 'node:crypto';

/*
  Stateless liveness-verification token. Generated when an admin sends a real-human
  verification request; embedded in the email link so the talent can record WITHOUT
  a login. Carries the talent id + expiry, HMAC-signed with a server-only secret.
  Separate from the onboarding token so the two links can't be used interchangeably.
*/

const SECRET =
  process.env.LIVENESS_TOKEN_SECRET ||
  process.env.ONBOARD_TOKEN_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';
const TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days to act

export function signLivenessToken(talentId: string): string {
  const exp = Date.now() + TTL_MS;
  const payload = `lv.${talentId}.${exp}`;
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
  return `${Buffer.from(payload).toString('base64url')}.${sig}`;
}

/** Returns the talent id if the token is valid + unexpired, else null. */
export function verifyLivenessToken(token: string): string | null {
  if (!SECRET || !token) return null;
  const [b64, sig] = token.split('.');
  if (!b64 || !sig) return null;
  let payload: string;
  try { payload = Buffer.from(b64, 'base64url').toString('utf8'); } catch { return null; }
  const expected = createHmac('sha256', SECRET).update(payload).digest('hex');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [prefix, talentId, expStr] = payload.split('.');
  const exp = Number(expStr);
  if (prefix !== 'lv' || !talentId || !exp || Date.now() > exp) return null;
  return talentId;
}

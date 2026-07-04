import { createHmac, timingSafeEqual } from 'node:crypto';

/*
  Shared stateless email-OTP signing — extracted so BOTH the email-code route
  (send/verify) and the apply/submit route can independently confirm "this email
  passed OTP", without a DB table.

  A valid { email, code, exp } → token = HMAC(`${email}:${code}:${exp}`). Holding a
  token that recomputes to sign(email, code, exp) proves the holder knew the code
  that was emailed — so submit can re-verify server-side instead of trusting a
  client boolean. Secret + email lowercasing are kept identical to the original
  email-code route so tokens stay interchangeable across the two endpoints.
*/

const SECRET = process.env.EMAIL_CODE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export function hasOtpSecret(): boolean {
  return Boolean(SECRET);
}

export function signOtp(email: string, code: string, exp: number): string {
  return createHmac('sha256', SECRET).update(`${email.toLowerCase()}:${code}:${exp}`).digest('hex');
}

/**
 * Re-verify an OTP proof independently (used by apply/submit).
 * Returns true only when the token matches sign(email, code, exp) and exp is in the future.
 */
export function verifyOtpProof(email: string, code: string, token: string, exp: number): boolean {
  if (!SECRET || !email || !token) return false;
  if (!/^\d{6}$/.test(code) || !exp || Date.now() > exp) return false;
  const expected = signOtp(email, code, exp);
  const a = Buffer.from(expected), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

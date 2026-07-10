import { NextRequest, NextResponse } from 'next/server';
import { randomInt, timingSafeEqual } from 'node:crypto';
import { sendEmail } from '@/lib/mail';
import { verificationCodeEmail } from '@/lib/mail-templates';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { signOtp } from '@/lib/otp-code';

/*
  Stateless email-verification OTP — no DB table / no migration.
  send:   server makes a 6-digit code, HMAC-signs `${email}:${code}:${exp}`
          into a token, emails the CODE to the user, returns { token, exp }.
          The code travels only by email; the token reveals nothing on its own.
  verify: client returns { email, code, token, exp }; server recomputes the
          HMAC and timing-safe compares + checks expiry.
  Secret reuses an existing server-only key (never shipped to the client).
  Rate-limited (durable, otp_send_log): same email ≤1/60s, same IP ≤10/hour.
*/

const SECRET = process.env.EMAIL_CODE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
// 2 h — the OTP exp is stamped at code-REQUEST time and must outlast the whole apply
// flow (fill the form + upload a demo, which submit does before re-verifying the OTP).
// 10 min was too short: a slow/large demo upload expired the proof and the applicant
// got "Email not verified" at submit despite having verified (report 2026-07-09). 2h
// is practically "never expires" for a form + upload, while keeping the code time-boxed.
const TTL_MS = 120 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// HMAC signing lives in lib/otp-code (signOtp) so apply/submit can re-verify the
// same token independently. Behaviour here is unchanged (same secret + lowercasing).

// Verification-code email now uses the shared branded template (verificationCodeEmail).

export async function POST(request: NextRequest) {
  if (!SECRET) {
    console.error('[email-code] missing signing secret');
    return NextResponse.json({ error: 'Email verification is not configured' }, { status: 500 });
  }
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }

  const action = body.action;
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Invalid email' }, { status: 400 });

  if (action === 'send') {
    // 已是會員 / 已申請過 → 不再發驗證碼,回頭引導登入(防同一 email 一直重複申請)。
    const db = getSupabaseServiceClient();
    const [tRes, aRes] = await Promise.all([
      db.from('talents').select('id').ilike('email', email).limit(1).maybeSingle(),
      db.from('talent_applications').select('id').ilike('email', email).limit(1).maybeSingle(),
    ]);
    if (tRes.data) return NextResponse.json({ error: 'already_member' }, { status: 409 });
    if (aRes.data) return NextResponse.json({ error: 'already_applied' }, { status: 409 });

    // ⑤ 發送限流(durable, otp_send_log):同 email 60 秒內一次、同 IP 每小時最多 10 次。
    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    const nowMs = Date.now();
    const [recent, ipCount] = await Promise.all([
      db.from('otp_send_log').select('id', { head: true, count: 'exact' }).ilike('email', email).gte('created_at', new Date(nowMs - 60_000).toISOString()),
      db.from('otp_send_log').select('id', { head: true, count: 'exact' }).eq('ip', ip).gte('created_at', new Date(nowMs - 3_600_000).toISOString()),
    ]);
    if ((recent.count || 0) > 0) return NextResponse.json({ error: 'too_soon' }, { status: 429 });
    if ((ipCount.count || 0) >= 10) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const exp = Date.now() + TTL_MS;
    const token = signOtp(email, code, exp);
    const { subject, html } = verificationCodeEmail({ code, locale: typeof body.locale === 'string' ? body.locale : undefined });
    const res = await sendEmail({ category: 'HELLO', to: email, subject, html });
    if (!res.success) return NextResponse.json({ error: res.error || 'Failed to send code' }, { status: 502 });
    await db.from('otp_send_log').insert({ email: email.toLowerCase(), ip });   // 成功才計入限流
    return NextResponse.json({ token, exp });
  }

  if (action === 'verify') {
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const token = typeof body.token === 'string' ? body.token : '';
    const exp = typeof body.exp === 'number' ? body.exp : 0;
    if (!/^\d{6}$/.test(code) || !token || !exp) return NextResponse.json({ ok: false }, { status: 400 });
    if (Date.now() > exp) return NextResponse.json({ ok: false, expired: true });
    const expected = signOtp(email, code, exp);
    const a = Buffer.from(expected), b = Buffer.from(token);
    const ok = a.length === b.length && timingSafeEqual(a, b);
    return NextResponse.json({ ok });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

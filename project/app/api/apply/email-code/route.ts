import { NextRequest, NextResponse } from 'next/server';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { sendEmail } from '@/lib/mail';
import { verificationCodeEmail } from '@/lib/mail-templates';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  Stateless email-verification OTP — no DB table / no migration.
  send:   server makes a 6-digit code, HMAC-signs `${email}:${code}:${exp}`
          into a token, emails the CODE to the user, returns { token, exp }.
          The code travels only by email; the token reveals nothing on its own.
  verify: client returns { email, code, token, exp }; server recomputes the
          HMAC and timing-safe compares + checks expiry.
  Secret reuses an existing server-only key (never shipped to the client).
  Known v1 limitation: no rate-limiting / send-throttle (audience is an invited
  ~2000-talent list); add a durable throttle before opening this publicly.
*/

const SECRET = process.env.EMAIL_CODE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TTL_MS = 10 * 60 * 1000; // 10 minutes
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sign(email: string, code: string, exp: number): string {
  return createHmac('sha256', SECRET).update(`${email.toLowerCase()}:${code}:${exp}`).digest('hex');
}

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

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const exp = Date.now() + TTL_MS;
    const token = sign(email, code, exp);
    const { subject, html } = verificationCodeEmail({ code, locale: typeof body.locale === 'string' ? body.locale : undefined });
    const res = await sendEmail({ category: 'HELLO', to: email, subject, html });
    if (!res.success) return NextResponse.json({ error: res.error || 'Failed to send code' }, { status: 502 });
    return NextResponse.json({ token, exp });
  }

  if (action === 'verify') {
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const token = typeof body.token === 'string' ? body.token : '';
    const exp = typeof body.exp === 'number' ? body.exp : 0;
    if (!/^\d{6}$/.test(code) || !token || !exp) return NextResponse.json({ ok: false }, { status: 400 });
    if (Date.now() > exp) return NextResponse.json({ ok: false, expired: true });
    const expected = sign(email, code, exp);
    const a = Buffer.from(expected), b = Buffer.from(token);
    const ok = a.length === b.length && timingSafeEqual(a, b);
    return NextResponse.json({ ok });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

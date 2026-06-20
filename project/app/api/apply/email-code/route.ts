import { NextRequest, NextResponse } from 'next/server';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { sendEmail } from '@/lib/mail';

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

function codeEmail(code: string, locale?: string): { subject: string; html: string } {
  const L = locale === 'zh-CN' ? 'cn' : locale?.startsWith('zh') ? 'tw' : 'en';
  const t = {
    tw: { subject: 'Onyx 報名驗證碼', line: '你的 Onyx 配音員報名驗證碼:', note: '10 分鐘內有效。若不是你本人操作,請忽略這封信。' },
    cn: { subject: 'Onyx 报名验证码', line: '你的 Onyx 配音员报名验证码:', note: '10 分钟内有效。若不是你本人操作,请忽略这封信。' },
    en: { subject: 'Your Onyx verification code', line: 'Your Onyx talent-application verification code:', note: 'Valid for 10 minutes. If this wasn’t you, please ignore this email.' },
  }[L];
  return {
    subject: t.subject,
    html: `<div style="font-family:system-ui,sans-serif;background:#000;color:#fff;padding:32px;border-radius:12px;max-width:420px;margin:auto;text-align:center;">
      <p style="color:#d1d5db;font-size:15px;margin:0 0 16px;">${t.line}</p>
      <p style="font-size:34px;letter-spacing:8px;font-weight:700;color:#f59e0b;margin:0 0 16px;">${code}</p>
      <p style="color:#6b7280;font-size:12px;margin:0;">${t.note}</p>
    </div>`,
  };
}

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
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const exp = Date.now() + TTL_MS;
    const token = sign(email, code, exp);
    const { subject, html } = codeEmail(code, typeof body.locale === 'string' ? body.locale : undefined);
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

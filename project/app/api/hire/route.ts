import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/mail';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  Client brief intake. Persists the brief to marketplace_briefs (Phase 3c) so
  active talents can quote on it, AND emails Onyx + a localized confirmation to
  the client. The DB write is best-effort: if the table isn't migrated yet, the
  Phase 2 email-only behaviour still works.
*/

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const esc = (s: unknown) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));

const LOGO = 'https://www.onyxstudios.ai/logo-email.png';

export async function POST(request: NextRequest) {
  try {
    const b = await request.json();
    const email = String(b.email || '').trim();
    if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    if (!String(b.brief || '').trim()) return NextResponse.json({ error: 'Brief is required' }, { status: 400 });

    const cats = Array.isArray(b.categories) ? b.categories.join(', ') : '';

    // Persist to the talent marketplace (best-effort; non-fatal pre-migration).
    try {
      const db = getSupabaseServiceClient();
      const { error: insErr } = await db.from('marketplace_briefs').insert({
        client_email: email,
        client_name: b.name || null,
        company: b.company || null,
        categories: Array.isArray(b.categories) ? b.categories : [],
        language: b.language || null,
        length: b.length || null,
        budget: b.budget || null,
        deadline: b.deadline || null,
        brief: String(b.brief),
        locale: b.locale || '',
      });
      if (insErr) console.error('[hire] brief persist failed (non-fatal):', insErr.message);
    } catch (e) {
      console.error('[hire] brief persist threw (non-fatal):', e);
    }

    const row = (label: string, val: unknown) =>
      val ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;white-space:nowrap;vertical-align:top;">${label}</td><td style="padding:4px 0;color:#111;">${esc(val)}</td></tr>` : '';

    // 1) Notify Onyx team
    const teamHtml = `<div style="font-family:system-ui,sans-serif;max-width:560px;">
      <h2 style="margin:0 0 12px;">新配音需求 / New voiceover brief</h2>
      <table style="font-size:14px;border-collapse:collapse;">
        ${row('Email', email)}
        ${row('稱呼 Name', b.name)}
        ${row('公司 Company', b.company)}
        ${row('類型 Type', cats)}
        ${row('語言 Language', b.language)}
        ${row('長度 Length', b.length)}
        ${row('預算 Budget', b.budget)}
        ${row('截止 Deadline', b.deadline)}
        ${row('語系 Locale', b.locale)}
      </table>
      <p style="margin:14px 0 4px;color:#6b7280;font-size:13px;">需求說明 / Brief:</p>
      <p style="white-space:pre-wrap;background:#f4f4f5;border-radius:8px;padding:12px;font-size:14px;color:#111;">${esc(b.brief)}</p>
    </div>`;
    await sendEmail({ category: 'HELLO', to: 'hello@onyxstudios.ai', subject: `新配音需求 — ${b.name || email}${cats ? ` (${cats})` : ''}`, html: teamHtml, replyTo: email });

    // 2) Confirm to the client (localized)
    const L = b.locale === 'zh-CN' ? 'cn' : String(b.locale || '').startsWith('zh') ? 'tw' : 'en';
    const t = {
      tw: { subject: 'Onyx Studios 已收到您的配音需求', line: '謝謝您的需求,我們已收到。團隊會盡快為您挑選合適的配音員並與您聯繫報價。', sign: '— Onyx Studios' },
      cn: { subject: 'Onyx Studios 已收到您的配音需求', line: '谢谢您的需求,我们已收到。团队会尽快为您挑选合适的配音员并与您联系报价。', sign: '— Onyx Studios' },
      en: { subject: 'Onyx Studios has received your voiceover brief', line: 'Thanks for your brief — we’ve received it. Our team will shortlist suitable voices and get back to you with a quote shortly.', sign: '— Onyx Studios' },
    }[L];
    const clientHtml = `<div style="background:#0a0a0a;padding:32px 16px;font-family:system-ui,sans-serif;">
      <div style="max-width:440px;margin:0 auto;">
        <img src="${LOGO}" alt="Onyx Studios" width="180" style="display:block;width:180px;max-width:60%;height:auto;margin:0 0 24px;border:0;" />
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">${t.line}</p>
        <p style="color:#9ca3af;font-size:13px;margin:0;">${t.sign}</p>
      </div>
    </div>`;
    await sendEmail({ category: 'HELLO', to: email, subject: t.subject, html: clientHtml });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[hire] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

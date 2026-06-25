import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/mail';

/*
  POST /api/admin/casting/invite — invite known voice actors to a casting call by
  email. Each gets a stable, reusable magic link (/casting/<token>) that lets them
  audition WITHOUT registering — and return anytime to upload later (the token is
  their identity; valid until the call closes). Idempotent per (brief, email).
*/
const SITE = 'https://www.onyxstudios.ai';
const EMAILRE = /^[\w.%+-]+@[\w.-]+\.[a-z]{2,}$/i;

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  let b: { brief_id?: string; emails?: unknown };
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const briefId = String(b.brief_id || '');
  if (!briefId) return NextResponse.json({ error: 'brief_id is required' }, { status: 400 });

  // accept array or newline/comma-separated string
  const raw = Array.isArray(b.emails) ? b.emails.map(String) : String(b.emails || '').split(/[\n,;]/);
  const emails = [...new Set(raw.map((e) => e.trim().toLowerCase()).filter((e) => EMAILRE.test(e)))].slice(0, 200);
  if (!emails.length) return NextResponse.json({ error: '沒有有效的 email' }, { status: 400 });

  const db = getSupabaseServiceClient();
  const { data: brief } = await db.from('marketplace_briefs').select('id, title, kind, status').eq('id', briefId).maybeSingle();
  if (!brief || brief.kind !== 'casting') return NextResponse.json({ error: '找不到這個試音案' }, { status: 404 });

  let invited = 0;
  for (const email of emails) {
    // reuse an existing invite (so the same person keeps one stable link)
    const { data: existing } = await db.from('casting_invites').select('token').eq('brief_id', briefId).eq('email', email).maybeSingle();
    const token = existing?.token || crypto.randomBytes(24).toString('hex');
    if (!existing) {
      const { error } = await db.from('casting_invites').insert({ brief_id: briefId, email, token });
      if (error) continue;
    }
    const link = `${SITE}/zh-TW/casting/${token}`;
    const html = `<div style="font-family:'PingFang TC',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.8;color:#222;max-width:540px">
<p>您好，</p>
<p>Onyx Studios 邀請您試音 —— <strong>${brief.title || '配音試音案'}</strong>。</p>
<p>點下面的連結即可<strong>直接試音，免註冊、免密碼</strong>。可以先看案子，之後有空再回來上傳 —— <strong>隨時點同一條連結都回得來</strong>，您的進度會保留。</p>
<p><a href="${link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px">前往試音 →</a></p>
<p style="font-size:12px;color:#999">這是您專屬的連結，請保留這封信以便日後回來上傳。</p>
<p style="margin-bottom:2px">Onyx Studios 配音團隊</p>
<p style="margin-top:0;color:#666">onyxstudios.ai</p>
</div>`;
    await sendEmail({ category: 'HELLO', to: email, subject: `試音邀請 · ${brief.title || 'Onyx Studios'}`, html }).catch(() => {});
    invited++;
  }
  return NextResponse.json({ ok: true, invited });
}

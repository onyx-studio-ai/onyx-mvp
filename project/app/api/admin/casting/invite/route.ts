import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/mail';
import { castingInviteEmail } from '@/lib/mail-templates';

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
    const mail = castingInviteEmail({ title: brief.title || undefined, link, locale: 'zh-TW' });
    await sendEmail({ category: 'HELLO', to: email, subject: mail.subject, html: mail.html }).catch(() => {});
    invited++;
  }
  return NextResponse.json({ ok: true, invited });
}

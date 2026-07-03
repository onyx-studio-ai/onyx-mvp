import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/mail';
import { completeProfileEmail } from '@/lib/mail-templates';

/*
  POST /api/admin/talents/nudge-complete { id } — nudge a talent whose account
  exists but whose profile is still empty (no demos/traits/specialties) to log in
  and finish it so we can publish them. Includes a one-click recovery link so they
  can get in even if they never set a password.
*/
const SITE = 'https://www.onyxstudios.ai';
const ZH = /中文|國語|国语|粵語|粤语|台語|台语|Mandarin|Cantonese|Chinese/i;

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  let body: { id?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const id = String(body.id || '');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const db = getSupabaseServiceClient();
  const { data: t } = await db.from('talents').select('id, name, email, languages').eq('id', id).maybeSingle();
  if (!t) return NextResponse.json({ error: 'Talent not found' }, { status: 404 });
  const email = (t.email as string || '').trim();
  if (!email) return NextResponse.json({ error: '這位配音員沒有 email,無法通知。' }, { status: 400 });

  // English by default; Traditional Chinese only if they list a Chinese language.
  const langs = Array.isArray(t.languages) ? (t.languages as string[]) : [];
  const locale = langs.some((l) => ZH.test(l)) ? 'zh-TW' : 'en';
  const lp = locale && locale !== 'en' ? `/${locale}` : '';

  // One-click way in (recovery link) so they can log in regardless of password state.
  let profileLink = `${SITE}${lp}/talent`;
  try {
    const { data: link } = await db.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: `${SITE}${lp}/auth/reset-password` } });
    if (link?.properties?.action_link) profileLink = link.properties.action_link;
  } catch { /* fall back to the plain /talent link */ }

  const mail = completeProfileEmail({ talentName: (t.name as string) || '', profileLink, locale });
  const res = await sendEmail({ category: 'HELLO', to: email, subject: mail.subject, html: mail.html });
  if (!res?.success) return NextResponse.json({ error: res?.error || '寄送失敗' }, { status: 500 });

  return NextResponse.json({ ok: true, to: email });
}

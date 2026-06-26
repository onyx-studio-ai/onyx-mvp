import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/mail';

/*
  POST /api/admin/casting — create a human-VO casting call (kind='casting').

  Admin self-service posting (the poster fills this in; later opens to outside
  posters). Reuses marketplace_briefs so casting calls appear at
  /talent/opportunities alongside client briefs. The AI track is untouched.
  On publish, active talents whose language matches are emailed (in the case's
  language) so they come and audition.
*/
export const maxDuration = 60; // notifying matching talents can fan out

type RoleIn = { name?: string; gender?: string; age?: string; personality?: string; emotion?: string; speed?: string; sample_line?: string; is_lead?: boolean; image?: string };
const METHODS = ['home', 'studio', 'online'];
const SITE = 'https://www.onyxstudios.ai';
const ZH_RE = /中文|國語|国语|普通话|普通話|台語|台语|粵|粤|cantonese|mandarin|chinese/i;
const EN_RE = /english|英語|英语|英文/i;

// Email active talents whose language matches the case, in the case's language.
async function notifyMatchingTalents(db: ReturnType<typeof getSupabaseServiceClient>, brief: { title: string; language: string }, opts: { dryRun?: boolean } = {}) {
  const lang = brief.language || '';
  const isZh = ZH_RE.test(lang);
  const isEn = !isZh && EN_RE.test(lang);
  if (!isZh && !isEn) return 0; // unknown language → skip auto-notify
  // Scope B: notify ALL recruited talent of the matching language, not only the
  // published (is_active) ones — recruited-but-not-yet-listed actors are exactly
  // who wants a real paying casting call. Junk/internal/dup emails filtered below.
  const { data: talents } = await db.from('talents')
    .select('email, languages, native_languages')
    .eq('type', 'VO')
    .not('email', 'is', null)
    .limit(800);
  const re = isZh ? ZH_RE : EN_RE;
  const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const SKIP = /@(?:onyxstudios\.ai|example\.com|test\.com|test\.test)$/i; // internal / placeholder
  const asText = (v: unknown) => (Array.isArray(v) ? v.join(' ') : String(v || ''));
  const seen = new Set<string>();
  const matched = (talents || []).filter((t) => {
    const email = String(t.email || '').trim().toLowerCase();
    if (!EMAIL_OK.test(email) || SKIP.test(email) || seen.has(email)) return false;
    const langs = `${asText(t.languages)} ${asText(t.native_languages)}`;
    if (!re.test(langs)) return false;
    seen.add(email);
    return true;
  }).slice(0, 250);
  if (opts.dryRun) return matched.length; // preview count only — no emails sent
  const link = `${SITE}/${isZh ? 'zh-TW/' : ''}talent`;
  await Promise.all(matched.map(async (t) => {
    const subject = isZh ? `新試音案 · ${brief.title}` : `New audition · ${brief.title}`;
    const html = isZh
      ? `<div style="font-family:'PingFang TC',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.8;color:#222;max-width:540px"><p>您好,</p><p>有一個新的配音試音案符合您的語言 —— <strong>${brief.title}</strong>。</p><p>登入後台即可查看角色、唸樣詞、上傳試音並報價。平台不抽成,您報多少就拿多少。</p><p><a href="${link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px">前往試音 →</a></p><p style="margin-bottom:2px">Onyx Studios 配音團隊</p><p style="margin-top:0;color:#666">onyxstudios.ai</p></div>`
      : `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.8;color:#222;max-width:540px"><p>Hi,</p><p>A new voiceover casting matches your language — <strong>${brief.title}</strong>.</p><p>Sign in to view the roles, read the lines, upload your audition and quote. No platform fee — you keep what you quote.</p><p><a href="${link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px">Go to auditions →</a></p><p style="margin-bottom:2px">The Onyx Studios Talent Team</p><p style="margin-top:0;color:#666">onyxstudios.ai</p></div>`;
    await sendEmail({ category: 'HELLO', to: t.email as string, subject, html }).catch(() => {});
  }));
  return matched.length;
}

// GET /api/admin/casting?id=<briefId> — load one brief to pre-fill the form
// (used when an admin "completes" a client request into a casting call).
export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
  const db = getSupabaseServiceClient();
  const { data: brief } = await db.from('marketplace_briefs').select('*').eq('id', id).maybeSingle();
  if (!brief) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ brief });
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const title = String(b.title || '').trim();
  const briefText = String(b.brief || '').trim();
  if (!title) return NextResponse.json({ error: '請填標題' }, { status: 400 });
  if (!briefText) return NextResponse.json({ error: '請填案件說明' }, { status: 400 });

  const roles = Array.isArray(b.roles)
    ? (b.roles as RoleIn[]).filter((r) => r && String(r.name || '').trim()).slice(0, 100).map((r) => ({
        name: String(r.name).trim().slice(0, 80),
        gender: String(r.gender || '').trim().slice(0, 20),
        age: String(r.age || '').trim().slice(0, 20),
        personality: String(r.personality || '').trim().slice(0, 60),
        emotion: String(r.emotion || '').trim().slice(0, 120),
        speed: String(r.speed || '').trim().slice(0, 40),
        sample_line: String(r.sample_line || '').trim().slice(0, 500),
        is_lead: !!r.is_lead,
        image: String(r.image || '').trim().slice(0, 1000) || undefined,
      }))
    : [];
  const refLinks = Array.isArray(b.reference_links)
    ? (b.reference_links as unknown[]).map((l) => String(l || '').trim()).filter(Boolean).slice(0, 30)
    : [];
  const refFiles = Array.isArray(b.reference_files)
    ? (b.reference_files as { name?: string; url?: string }[]).filter((f) => f && f.url).slice(0, 30)
        .map((f) => ({ name: String(f.name || '').slice(0, 120), url: String(f.url).slice(0, 1000) }))
    : [];
  const methods = Array.isArray(b.recording_methods)
    ? (b.recording_methods as unknown[]).map((m) => String(m)).filter((m) => METHODS.includes(m))
    : [];

  const fromId = String(b.id || '').trim(); // present = publishing a client request in place

  const row = {
    kind: 'casting',
    title,
    content_type: String(b.content_type || '').slice(0, 80) || null, // 類別(廣告/旁白/遊戲…)
    brief: briefText,
    language: String(b.language || '').slice(0, 80) || null,
    rate_note: String(b.rate_note || '').slice(0, 200) || null,
    base_revisions: Number.isFinite(Number(b.base_revisions)) ? Math.max(0, Math.trunc(Number(b.base_revisions))) : 1,
    audition_cap: Number.isFinite(Number(b.audition_cap)) ? Math.max(1, Math.trunc(Number(b.audition_cap))) : 5,
    audition_deadline: String(b.audition_deadline || '').slice(0, 120) || null,
    recording_start: String(b.recording_start || '').slice(0, 120) || null,
    recording_methods: methods,
    roles,
    audition_script: String(b.audition_script || '').slice(0, 20000) || null,
    reference_links: refLinks,
    reference_files: refFiles,
    // Voices-style case data (all optional; surfaced on the casting card)
    length: String(b.length || '').slice(0, 120) || null,
    deadline: String(b.deadline || '').slice(0, 120) || null,
    media_scope: String(b.media_scope || '').slice(0, 200) || null,
    territory: String(b.territory || '').slice(0, 120) || null,
    license_term: String(b.license_term || '').slice(0, 200) || null,
    accent: String(b.accent || '').slice(0, 120) || null,
    voice_style: String(b.voice_style || '').slice(0, 120) || null,
    voice_age: String(b.voice_age || '').slice(0, 120) || null,
    locale: String(b.locale || 'zh-TW'),
    status: 'open',
  };

  const db = getSupabaseServiceClient();
  // From a client request: fill in roles/rate/specs and flip to open IN PLACE —
  // keep the client's identity + budget (no duplicate row). From scratch: insert
  // with the poster-side placeholder client (talents never see it).
  const result = fromId
    ? await db.from('marketplace_briefs').update(row).eq('id', fromId).eq('kind', 'casting').select('id, brief_number').single()
    : await db.from('marketplace_briefs').insert({ ...row, client_email: 'casting@onyxstudios.ai', client_name: 'Onyx Casting' }).select('id, brief_number').single();
  const { data, error } = result;
  if (error || !data) return NextResponse.json({ error: error?.message || '發案失敗' }, { status: 500 });

  // Notify matching-language talents (default on; client can opt out with notify:false).
  let notified = 0;
  if (b.notify !== false) {
    try { notified = await notifyMatchingTalents(db, { title, language: row.language || '' }); } catch { /* best-effort */ }
  }
  return NextResponse.json({ ok: true, id: data.id, brief_number: data.brief_number, notified });
}

// Re-notify matching talents for an already-published casting call (the publish-time
// auto-notify only fires once). { id, send:false } previews the recipient count;
// { id, send:true } actually emails them.
export async function PATCH(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  let b: Record<string, unknown>;
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const id = String(b.id || '').trim();
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
  const db = getSupabaseServiceClient();
  const { data: brief } = await db.from('marketplace_briefs').select('title, language, kind, status').eq('id', id).maybeSingle();
  if (!brief || brief.kind !== 'casting') return NextResponse.json({ error: 'not a casting call' }, { status: 404 });
  if (brief.status !== 'open') return NextResponse.json({ error: '案件尚未發佈(open),無法通知' }, { status: 400 });
  const notified = await notifyMatchingTalents(db, { title: String(brief.title || ''), language: String(brief.language || '') }, { dryRun: b.send !== true });
  return NextResponse.json({ ok: true, notified, sent: b.send === true });
}

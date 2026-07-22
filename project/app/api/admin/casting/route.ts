import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { CASE_TIMEZONES } from '@/lib/case-time';
import { sendEmail } from '@/lib/mail';
import { castingNotifyEmail, clientBriefPublishedEmail, castingInviteEmail } from '@/lib/mail-templates';
import { caseCode } from '@/lib/casting';

/*
  POST /api/admin/casting — create a human-VO casting call (kind='casting').

  Admin self-service posting (the poster fills this in; later opens to outside
  posters). Reuses marketplace_briefs so casting calls appear at
  /talent/opportunities alongside client briefs. The AI track is untouched.
  On publish, active talents whose language matches are emailed (in the case's
  language) so they come and audition.
*/
export const maxDuration = 60; // notifying matching talents can fan out

type RoleIn = { name?: string; weight?: string; gender?: string; age?: string; timbre?: string; personality?: string; emotion?: string; speed?: string; volume?: string; note?: string; sample_line?: string; is_lead?: boolean; image?: string };
const METHODS = ['home', 'studio', 'online'];
const SITE = 'https://www.onyxstudios.ai';
const ZH_RE = /中文|國語|国语|普通话|普通話|台語|台语|粵|粤|cantonese|mandarin|chinese/i;
const EN_RE = /english|英語|英语|英文/i;

// Email approved applicants whose language matches the case, in the case's language,
// using the branded casting-invite template. Recipients = approved applicants
// (application_id set) — this excludes guest-created lightweight talents and the
// internal Onyx personas. Invites them to audition AND finish their profile.
async function notifyMatchingTalents(
  db: ReturnType<typeof getSupabaseServiceClient>,
  brief: { title: string; language: string; rate_note?: string | null; code?: string; content_type?: string | null; gender_needs?: string | null; audition_deadline?: string | null },
  opts: { dryRun?: boolean; mode?: 'lang' | 'all'; aiType?: string | null; excludeEmails?: string[] } = {},
) {
  // 2026-07-22 Wing:一鍵通知。mode 'lang'(預設)= 該語系;'all' = 全站。
  // 語言比對:中/英沿用寬鬆正則(涵蓋舊自由文字資料);其他語言用主語言精確比對
  // (「Malay」對得上「Malay」,不再直接跳過)。AI 案一律交集合作意願 flag ——
  // 沒同意 AI 的人通知了也看不到案子(briefs API 有意願閘)。
  const mode = opts.mode || 'lang';
  const lang = brief.language || '';
  const isZh = ZH_RE.test(lang);
  const isEn = !isZh && EN_RE.test(lang);
  const primary = (v: unknown) => String(v || '').split('·')[0].trim().toLowerCase();
  const wantPrimary = primary(lang);
  if (mode === 'lang' && !isZh && !isEn && !wantPrimary) return 0; // 沒語言可比 → 不廣播
  const { data: talents } = await db.from('talents')
    .select('email, languages, native_languages, coop_ai_clone, coop_ai_training')
    .eq('type', 'VO')
    .not('application_id', 'is', null) // approved applicants only (no guests / internal personas)
    .not('email', 'is', null)
    .limit(800);
  const re = isZh ? ZH_RE : isEn ? EN_RE : null;
  const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const SKIP = /@(?:onyxstudios\.ai|example\.com|test\.com|test\.test)$/i; // internal / placeholder
  const asText = (v: unknown) => (Array.isArray(v) ? v.join(' ') : String(v || ''));
  const excl = new Set((opts.excludeEmails || []).map((e) => String(e).trim().toLowerCase()));
  const seen = new Set<string>();
  const matched = (talents || []).filter((t) => {
    const email = String(t.email || '').trim().toLowerCase();
    if (!EMAIL_OK.test(email) || SKIP.test(email) || seen.has(email) || excl.has(email)) return false;
    if (opts.aiType === 'clone' && !(t as { coop_ai_clone?: boolean }).coop_ai_clone) return false;
    if (opts.aiType === 'training' && !(t as { coop_ai_training?: boolean }).coop_ai_training) return false;
    if (mode === 'lang') {
      if (re) {
        const langs = `${asText(t.languages)} ${asText(t.native_languages)}`;
        if (!re.test(langs)) return false;
      } else {
        const set = new Set(([...(Array.isArray(t.languages) ? t.languages : []), ...(Array.isArray(t.native_languages) ? t.native_languages : [])]).map(primary));
        if (!set.has(wantPrimary)) return false;
      }
    }
    seen.add(email);
    return true;
  }).slice(0, 250);
  if (opts.dryRun) return matched.length; // preview count only — no emails sent
  const url = `${SITE}/${isZh ? 'zh-TW/' : ''}talent`;
  const { subject, html } = castingNotifyEmail({
    title: brief.title, caseCode: brief.code, language: brief.language,
    rateNote: brief.rate_note || undefined, contentType: brief.content_type || undefined,
    genderNeeds: brief.gender_needs || undefined, auditionDeadline: brief.audition_deadline || undefined,
    url, locale: isZh ? 'zh-TW' : 'en',
  });
  await Promise.all(matched.map((t) => sendEmail({ category: 'HELLO', to: t.email as string, subject, html }).catch(() => {})));
  return matched.length;
}

// Email a SPECIFIC, admin-selected set of talents (the publish-time picker).
// GATE depends on case type:
//  - Normal cases: only ONLINE (is_active) talents — Onyx's vetting is the moat.
//  - AI cases: open to anyone who opted into the matching consent (vetted or not) —
//    an AI corpus wants "a voice + willing to be AI", not professional VO vetting.
async function notifySelectedTalents(
  db: ReturnType<typeof getSupabaseServiceClient>,
  brief: { title: string; language: string; rate_note?: string | null; code?: string; content_type?: string | null; gender_needs?: string | null; audition_deadline?: string | null },
  talentIds: string[],
  aiType?: string | null, // 'clone' | 'training' | null — AI cases gate on consent, not vetting
) {
  if (!talentIds.length) return 0;
  const { data: talents } = await db.from('talents')
    .select('email, is_active, coop_ai_clone, coop_ai_training')
    .in('id', talentIds.slice(0, 500))
    .not('email', 'is', null)
    .limit(500);
  const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const SKIP = /@(?:onyxstudios\.ai|example\.com|test\.com|test\.test)$/i;
  const seen = new Set<string>();
  const recips = (talents || []).filter((t) => {
    // AI case → require the matching consent (any vetting status). Normal case →
    // require vetting (is_active). Belt-and-suspenders on top of the UI picker.
    if (aiType === 'clone') { if (!t.coop_ai_clone) return false; }
    else if (aiType === 'training') { if (!t.coop_ai_training) return false; }
    else if (!t.is_active) return false;
    const e = String(t.email || '').trim().toLowerCase();
    if (!EMAIL_OK.test(e) || SKIP.test(e) || seen.has(e)) return false;
    seen.add(e); return true;
  });
  if (!recips.length) return 0;
  const isZh = ZH_RE.test(brief.language || '');
  const url = `${SITE}/${isZh ? 'zh-TW/' : ''}talent`;
  const { subject, html } = castingNotifyEmail({
    title: brief.title, caseCode: brief.code, language: brief.language,
    rateNote: brief.rate_note || undefined, contentType: brief.content_type || undefined,
    genderNeeds: brief.gender_needs || undefined, auditionDeadline: brief.audition_deadline || undefined,
    url, locale: isZh ? 'zh-TW' : 'en',
  });
  await Promise.all(recips.map((t) => sendEmail({ category: 'HELLO', to: t.email as string, subject, html }).catch(() => {})));
  return recips.length;
}

// Invite a set of emails to a casting call via a免註冊 magic-link (/casting/<token>).
// Used for AI cases, whose pool = applicants who opted into AI (talent_applications)
// — many have no talent account yet, so a per-email invite (not /talent notify) is
// the right channel. Idempotent per (brief, email): reuses an existing token.
async function inviteEmailsMagicLink(
  db: ReturnType<typeof getSupabaseServiceClient>,
  brief: { id: string; title?: string | null },
  emails: string[],
) {
  const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const SKIP = /@(?:onyxstudios\.ai|example\.com|test\.com|test\.test)$/i;
  const clean = [...new Set(emails.map((e) => String(e).trim().toLowerCase()))].filter((e) => EMAIL_OK.test(e) && !SKIP.test(e)).slice(0, 500);
  let invited = 0;
  for (const email of clean) {
    const { data: existing } = await db.from('casting_invites').select('token').eq('brief_id', brief.id).eq('email', email).maybeSingle();
    let token = existing?.token as string | undefined;
    if (!token) {
      token = crypto.randomBytes(24).toString('hex');
      const { error } = await db.from('casting_invites').insert({ brief_id: brief.id, email, token });
      if (error) continue; // possible race on (brief,email) unique — skip, they still get one link
    }
    const link = `${SITE}/zh-TW/casting/${token}`;
    const mail = castingInviteEmail({ title: brief.title || undefined, link, locale: 'zh-TW' });
    await sendEmail({ category: 'HELLO', to: email, subject: mail.subject, html: mail.html }).catch(() => {});
    invited++;
  }
  return invited;
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
  // 本案的試音/報價(給編輯頁「指派」下拉:有試音的人置頂+帶他的報價當預設派工價)。
  const { data: quotes } = await db.from('marketplace_quotes')
    .select('talent_id, talent_name, role_name, gross_amount, currency, status')
    .eq('brief_id', id).neq('status', 'withdrawn');
  // 已建的角色製作單(給編輯頁標「這角色已指派給誰」)。
  // 注意:voice_orders.talent_id 沒有 FK 到 talents,PostgREST 的 talents(name) 關聯
  // 查詢會直接炸(2026-07-15 Wing 指派 N 次標記都不亮的根因)→ 兩步查詢自己拼。
  const { data: ords } = await db.from('voice_orders')
    .select('role_name, talent_id, talent_price, pay_unit, pay_rate, status')
    .eq('brief_id', id).not('role_name', 'is', null);
  const tIds = [...new Set((ords || []).map((o) => o.talent_id).filter(Boolean))] as string[];
  const nameById = new Map<string, string>();
  if (tIds.length) {
    const { data: ts } = await db.from('talents').select('id, name').in('id', tIds);
    for (const t of ts || []) nameById.set(String(t.id), String(t.name || ''));
  }
  const assigned = (ords || []).map((o) => ({ role_name: o.role_name, talent_name: nameById.get(String(o.talent_id)) || null, talent_price: o.talent_price, pay_unit: o.pay_unit, pay_rate: o.pay_rate, status: o.status }));
  return NextResponse.json({ brief, quotes: quotes || [], assigned });
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
        weight: String(r.weight || '').trim().slice(0, 20),
        gender: String(r.gender || '').trim().slice(0, 20),
        age: String(r.age || '').trim().slice(0, 20),
        timbre: String(r.timbre || '').trim().slice(0, 80),
        personality: String(r.personality || '').trim().slice(0, 60),
        emotion: String(r.emotion || '').trim().slice(0, 120),
        speed: String(r.speed || '').trim().slice(0, 40),
        volume: String(r.volume || '').trim().slice(0, 60),
        note: String(r.note || '').trim().slice(0, 300),
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

  const tzOk = (v: unknown) => CASE_TIMEZONES.some((t) => t.v === v);
  const row = {
    kind: 'casting',
    title,
    timezone: tzOk(b.timezone) ? String(b.timezone) : 'Asia/Taipei',   // 案件時區:全案時間溝通以它為準
    content_type: String(b.content_type || '').slice(0, 80) || null, // 類別(廣告/旁白/遊戲…)
    brief: briefText,
    language: String(b.language || '').slice(0, 80) || null,
    gender_needs: String(b.gender_needs || '').slice(0, 200) || null, // 需求人數/性別, e.g. 男聲 1 位、女聲 1 位
    voices_needed: Number.isFinite(Number(b.voices_needed)) && Number(b.voices_needed) > 0 ? Math.trunc(Number(b.voices_needed)) : null,
    has_singing: b.has_singing === true,
    wants_director: b.wants_director === true,
    rate_note: String(b.rate_note || '').slice(0, 200) || null,
    base_revisions: Number.isFinite(Number(b.base_revisions)) ? Math.max(0, Math.trunc(Number(b.base_revisions))) : 1,
    audition_cap: Number.isFinite(Number(b.audition_cap)) ? Math.max(1, Math.trunc(Number(b.audition_cap))) : 5,
    audition_deadline: String(b.audition_deadline || '').slice(0, 120) || null,
    audition_deadline_time: /^\d{1,2}:\d{2}$/.test(String(b.audition_deadline_time || '')) ? String(b.audition_deadline_time) : null,
    recording_start: String(b.recording_start || '').slice(0, 120) || null,
    recording_methods: methods,
    roles,
    audition_script: String(b.audition_script || '').slice(0, 20000) || null,
    reference_links: refLinks,
    reference_files: refFiles,
    // Voices-style case data (all optional; surfaced on the casting card)
    length: String(b.length || '').slice(0, 120) || null,
    deadline: String(b.deadline || '').slice(0, 120) || null,
    deadline_time: /^\d{1,2}:\d{2}$/.test(String(b.deadline_time || '')) ? String(b.deadline_time) : null,
    media_scope: String(b.media_scope || '').slice(0, 200) || null,
    territory: String(b.territory || '').slice(0, 120) || null,
    license_term: String(b.license_term || '').slice(0, 200) || null,
    accent: String(b.accent || '').slice(0, 120) || null,
    voice_style: String(b.voice_style || '').slice(0, 120) || null,
    voice_age: String(b.voice_age || '').slice(0, 120) || null,
    // Client-side AI/TTS case: 'clone' = 聲音變AI, 'training' = 訓練素材; else null (ordinary casting).
    ai_type: ['clone', 'training'].includes(String(b.ai_type)) ? String(b.ai_type) : null,
    // 內部客戶備註(這案是誰的:WeChat/LINE 客戶名+聯絡方式)。只給後台看,talent/client 端一律不回。
    internal_client_note: String(b.internal_client_note || '').slice(0, 300) || null,
    license_summary: String(b.license_summary || '').slice(0, 4000) || null, // AI 案授權要點(試音前必同意;去識別化,不提終端客戶名)
    locale: String(b.locale || 'zh-TW'),
    status: 'open',
  };

  const db = getSupabaseServiceClient();
  // From a client request: fill in roles/rate/specs and flip to open IN PLACE —
  // keep the client's identity + budget (no duplicate row). From scratch: insert
  // with the poster-side placeholder client (talents never see it).
  const result = fromId
    ? await db.from('marketplace_briefs').update(row).eq('id', fromId).eq('kind', 'casting').select('id, brief_number, created_at, gender_needs, client_email, client_name, locale').single()
    : await db.from('marketplace_briefs').insert({ ...row, client_email: 'casting@onyxstudios.ai', client_name: 'Onyx Casting' }).select('id, brief_number, created_at, gender_needs, client_email, client_name, locale').single();
  const { data, error } = result;
  if (error || !data) return NextResponse.json({ error: error?.message || '發案失敗' }, { status: 500 });

  // Publishing a CLIENT-commissioned brief (not the platform's own casting@ placeholder):
  // let the client know their brief passed review and is now live for auditions.
  // Best-effort — never block the publish on a mail failure.
  const clientEmail = String((data as { client_email?: string | null }).client_email || '');
  if (clientEmail && clientEmail !== 'casting@onyxstudios.ai') {
    const note = clientBriefPublishedEmail({
      clientName: (data as { client_name?: string | null }).client_name || undefined,
      title, briefNumber: data.brief_number as string,
      url: `${SITE}/dashboard/requests`,
      locale: (data as { locale?: string | null }).locale || row.locale,
    });
    sendEmail({ category: 'PRODUCTION', to: clientEmail, subject: note.subject, html: note.html }).catch(() => {});
  }

  // Invite talents. If the publish-time picker sent an explicit selection
  // (invite_talent_ids — an array, possibly empty), invite exactly those ONLINE
  // talents. Otherwise fall back to the legacy "notify all matching language".
  let notified = 0;
  const briefMeta = {
    title, language: row.language || '', rate_note: row.rate_note,
    content_type: row.content_type, gender_needs: (data as { gender_needs?: string | null }).gender_needs, audition_deadline: row.audition_deadline,
    code: caseCode({ content_type: row.content_type, created_at: data.created_at, brief_number: data.brief_number }),
  };
  try {
    if (row.ai_type && Array.isArray(b.invite_emails)) {
      // AI case: invite opted-in applicants (incl. not-yet-approved) by免註冊 magic-link.
      notified = await inviteEmailsMagicLink(db, { id: data.id as string, title }, (b.invite_emails as unknown[]).map(String));
    } else if (Array.isArray(b.invite_talent_ids)) {
      notified = await notifySelectedTalents(db, briefMeta, (b.invite_talent_ids as unknown[]).map(String).filter(Boolean), row.ai_type);
    } else if (b.notify !== false && !row.ai_type) {
      // Never broadcast an AI case by language — those go only to opted-in talents
      // via the explicit picker selection above.
      notified = await notifyMatchingTalents(db, briefMeta);
    }
    // 一鍵廣播(Wing 2026-07-22):與上面的手動勾選並存 —— 勾的人已收邀請,這裡
    // 再對「該語系 / 全站」廣播通知信(去重:排除已邀 email)。AI 案自動交集意願。
    if (b.notify_mode === 'lang' || b.notify_mode === 'all') {
      let excludeEmails: string[] = [];
      if (row.ai_type && Array.isArray(b.invite_emails)) excludeEmails = (b.invite_emails as unknown[]).map(String);
      else if (Array.isArray(b.invite_talent_ids) && (b.invite_talent_ids as unknown[]).length) {
        const { data: sel } = await db.from('talents').select('email').in('id', (b.invite_talent_ids as unknown[]).map(String));
        excludeEmails = (sel || []).map((t) => String(t.email || ''));
      }
      notified += await notifyMatchingTalents(db, briefMeta, { mode: b.notify_mode as 'lang' | 'all', aiType: row.ai_type, excludeEmails });
    }
    // 指定邀請(可含未上線):不論案別,對點名的 email 額外寄免註冊 magic-link 試音連結。
    // 讓 Wing 能按名字點名任何已核准的人(含未上線),系統用它存的 email 寄,不必手打 email。
    if (Array.isArray(b.pin_invite_emails) && b.pin_invite_emails.length) {
      notified += await inviteEmailsMagicLink(db, { id: data.id as string, title }, (b.pin_invite_emails as unknown[]).map(String));
    }
  } catch { /* best-effort */ }
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

  // Full edit (fields + roles, e.g. correcting a role's 台詞) — no status change, no notify.
  if (b.edit && typeof b.edit === 'object') {
    const e = b.edit as Record<string, unknown>;
    const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const setStr = (k: string, max: number) => { if (e[k] !== undefined) upd[k] = String(e[k] ?? '').slice(0, max) || null; };
    for (const [k, max] of [['title', 200], ['content_type', 80], ['language', 80], ['brief', 20000], ['rate_note', 200], ['audition_deadline', 120], ['recording_start', 120], ['deadline', 120], ['length', 120], ['media_scope', 200], ['territory', 120], ['license_term', 200], ['accent', 120], ['voice_style', 120], ['voice_age', 120], ['audition_script', 20000], ['gender_needs', 120], ['internal_client_note', 300], ['license_summary', 4000], ['audition_deadline_time', 5], ['deadline_time', 5]] as [string, number][]) setStr(k, max);
    if (e.base_revisions !== undefined) upd.base_revisions = Math.max(0, Math.trunc(Number(e.base_revisions) || 0));
    if (e.audition_cap !== undefined) upd.audition_cap = Math.max(1, Math.trunc(Number(e.audition_cap) || 5));
    // 含唱歌 / 聲音導演 / 線上監錄 / 錄音方式 —— 讓編輯頁能改(修正從客戶請求帶入時自動勾的)。
    for (const k of ['has_singing', 'wants_director', 'wants_live_session']) if (e[k] !== undefined) upd[k] = !!e[k];
    if (e.timezone !== undefined && CASE_TIMEZONES.some((t) => t.v === e.timezone)) upd.timezone = String(e.timezone);
    if (Array.isArray(e.recording_methods)) upd.recording_methods = (e.recording_methods as unknown[]).map(String).filter((x) => ['home', 'studio', 'online'].includes(x));
    if (Array.isArray(e.roles)) {
      upd.roles = (e.roles as RoleIn[]).filter((r) => r && String(r.name || '').trim()).slice(0, 100).map((r) => ({
        name: String(r.name).trim().slice(0, 80),
        weight: String(r.weight || '').trim().slice(0, 20),
        gender: String(r.gender || '').trim().slice(0, 20),
        age: String(r.age || '').trim().slice(0, 20),
        timbre: String(r.timbre || '').trim().slice(0, 80),
        personality: String(r.personality || '').trim().slice(0, 60),
        emotion: String(r.emotion || '').trim().slice(0, 120),
        speed: String(r.speed || '').trim().slice(0, 40),
        volume: String(r.volume || '').trim().slice(0, 60),
        note: String(r.note || '').trim().slice(0, 300),
        sample_line: String(r.sample_line || '').trim().slice(0, 500),
        is_lead: !!r.is_lead,
        image: String(r.image || '').trim().slice(0, 1000) || undefined,
      }));
    }
    const { data, error } = await db.from('marketplace_briefs').update(upd).eq('id', id).eq('kind', 'casting').select('id').single();
    if (error || !data) return NextResponse.json({ error: error?.message || '更新失敗' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // 指定邀請(按名字)—— 對已發佈案件,寄免註冊 magic-link 給點名的 email(含未上線者)。
  // send:false 只回可寄數量(不實寄);send:true 才真的寄。用系統存的 email,Wing 不必手打。
  if (Array.isArray(b.pin_invite_emails)) {
    const { data: pb } = await db.from('marketplace_briefs').select('title, kind').eq('id', id).maybeSingle();
    if (!pb || pb.kind !== 'casting') return NextResponse.json({ error: 'not a casting call' }, { status: 404 });
    const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emails = (b.pin_invite_emails as unknown[]).map((e) => String(e).trim().toLowerCase());
    if (b.send !== true) {
      const clean = [...new Set(emails)].filter((e) => EMAIL_OK.test(e));
      return NextResponse.json({ ok: true, notified: clean.length, sent: false });
    }
    const n = await inviteEmailsMagicLink(db, { id, title: pb.title }, emails);
    return NextResponse.json({ ok: true, notified: n, sent: true });
  }

  const { data: brief } = await db.from('marketplace_briefs').select('title, language, kind, status, content_type, created_at, brief_number, rate_note, gender_needs, audition_deadline, ai_type').eq('id', id).maybeSingle();
  if (!brief || brief.kind !== 'casting') return NextResponse.json({ error: 'not a casting call' }, { status: 404 });
  if (brief.status !== 'open') return NextResponse.json({ error: '案件尚未發佈(open),無法通知' }, { status: 400 });
  const notified = await notifyMatchingTalents(db, {
    title: String(brief.title || ''), language: String(brief.language || ''),
    rate_note: brief.rate_note, content_type: brief.content_type, gender_needs: brief.gender_needs, audition_deadline: brief.audition_deadline, code: caseCode(brief),
  }, { dryRun: b.send !== true, mode: b.notify_mode === 'all' ? 'all' : 'lang', aiType: (brief as { ai_type?: string | null }).ai_type });
  return NextResponse.json({ ok: true, notified, sent: b.send === true });
}

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient, supabaseErrorResponse } from '@/lib/supabase-server';
import { USE_CASE_KEYS, VOICE_AGE_KEYS, demoLimit, DEMO_MAX_SECONDS, type DemoItem } from '@/lib/talent-taxonomy';
import { stripContactsAndLinks } from '@/lib/sanitize-text';

/*
  Talent self-service profile API. Authenticated by the talent's OWN Supabase
  session (Bearer access token from the browser client). Every operation is
  scoped to their own talents row via auth_user_id (with a verified-email
  fallback + lazy-link) — a talent can only ever read or write their own profile.

  DRAFT / PUBLISH: the row is the talent's editable draft. Any edit flips
  pending_review=true; it does NOT touch published_snapshot, so the public
  roster/profile keep showing the last admin-approved version until an admin
  republishes. See migration 20260622120000.
*/

// Simple text fields the talent may edit. Identity (email), service tags,
// is_active, pricing and the published_snapshot are intentionally excluded.
// location = country key, availability_note = comma-joined preset keys,
// studio_partner = URL, clients/awards/notable_works = structured credits.
const TEXT_FIELDS = ['name', 'english_name', 'bio', 'gender', 'location', 'availability_note', 'studio_partner', 'equipment', 'clients', 'awards', 'notable_works', 'special_skills', 'turnaround', 'portfolio_url'] as const;

const COLS =
  'id, name, english_name, bio, languages, accent, gender, tags, voice_traits, specialties, voice_ages, demos, demo_urls, headshot_url, ' +
  'location, availability_note, equipment, studio_partner, clients, awards, notable_works, special_skills, turnaround, portfolio_url, years_experience, native_languages, type, email, is_active, ' +
  'coop_accept_jobs, coop_open_buyout, coop_ai_clone, coop_ai_training, coop_proofread, coop_voice_director, low_price_data_optin, expected_rates, ' +
  'pending_review, published_snapshot, liveness_status';

// Cooperation opt-ins the talent may toggle themselves (booleans). These change
// what work Onyx may offer them (buyout / AI / proofreading / directing / low-price
// data gigs) — never shown to clients, used for casting/eligibility only.
const COOP_FIELDS = ['coop_accept_jobs', 'coop_open_buyout', 'coop_ai_clone', 'coop_ai_training', 'coop_proofread', 'coop_voice_director', 'low_price_data_optin'] as const;

// traits/specialties accept preset keys AND free-text custom values ("其他").
const cleanTags = (arr: unknown): string[] =>
  Array.isArray(arr)
    ? [...new Set(arr.filter((s): s is string => typeof s === 'string').map((s) => s.trim()).filter(Boolean).map((s) => s.slice(0, 40)))].slice(0, 30)
    : [];

// This project has no generated DB types, so a string select() yields a loose
// row. Narrow to the fields we actually touch (the rest stay unknown).
interface TalentRow { id: string; email: string | null; demos: DemoItem[] | null; [k: string]: unknown }

async function resolveTalent(request: NextRequest) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { error: 'Not authenticated', status: 401 as const };

  const db = getSupabaseServiceClient();
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user) return { error: 'Invalid or expired session', status: 401 as const };

  const r1 = await db.from('talents').select(COLS).eq('auth_user_id', user.id).maybeSingle();
  let talent = r1.data as unknown as TalentRow | null;
  if (!talent && user.email) {
    const r2 = await db.from('talents').select(COLS).eq('email', user.email).maybeSingle();
    const byEmail = r2.data as unknown as TalentRow | null;
    if (byEmail) {
      await db.from('talents').update({ auth_user_id: user.id }).eq('id', byEmail.id);
      talent = byEmail;
    }
  }
  if (!talent) return { error: 'No talent profile is linked to this account', status: 404 as const };

  // 帶回登入帳號本身(id + email),讓 isClient 判斷能對應「同一登入帳號」的
  // 下單/發案紀錄,而非只認 talents 表登記的那個 email。
  return { db, talent, userId: user.id, userEmail: user.email || '' };
}

// Validate a URL points inside one of OUR public storage buckets — blocks
// injecting arbitrary external audio/images onto the roster.
function inOurBucket(raw: string, bucket: string): boolean {
  let ourHost = '';
  try { ourHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').host; } catch { return false; }
  try {
    const u = new URL(raw);
    return !!ourHost && u.host === ourHost && u.pathname.startsWith(`/storage/v1/object/public/${bucket}/`);
  } catch { return false; }
}

export async function GET(request: NextRequest) {
  try {
    const r = await resolveTalent(request);
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
    // Dual-role: is this account ALSO a client (placed any order)? Drives access
    // to the client dashboard + the cross-portal switcher. Check every order
    // type — a talent who only bought music/orchestra is still a client.
    //
    // 放寬(2026-07):不再只認 talents 表登記的那個 email。同一個「登入帳號」
    // 只要下過單/發過案就算客戶,涵蓋兩種被漏判的情況:
    //   (a) 用不同 email 下單 → 也比對登入帳號的 email(user.email);
    //   (b) 帳號直接綁在紀錄上 → orchestra_orders.user_id / briefs.client_user_id
    //       直接對 auth 使用者 id。
    // 仍然是「這個帳號真的下過單/發過案」才算客戶,沒下過單的人不會被誤放。
    let isClient = false;
    // (0) admin 手動標記「也是客戶」—— 給「本身也是客戶」或內部/測試帳號用,不靠訂單、
    //     只有被標記 true 的才算(不誤放外人)。欄位可能還沒建 → try/catch 兜底,不 crash。
    try {
      const { data: flag } = await r.db.from('talents').select('is_also_client').eq('id', r.talent.id).maybeSingle();
      if (flag && (flag as Record<string, unknown>).is_also_client === true) isClient = true;
    } catch { /* 欄位未建 / RLS quirk — 不阻擋檔案載入 */ }
    // 候選 email:talents 表 email + 登入帳號 email。去重(大小寫不敏感去重,
    // 但保留原始大小寫做精確 .eq 比對 —— 不用 ilike,避免 email local part 內
    // 的底線 `_` 在 LIKE 中變成萬用字元造成誤放)。
    const seen = new Set<string>();
    const emails: string[] = [];
    for (const raw of [r.talent.email || '', r.userEmail]) {
      const e = raw.trim();
      const key = e.toLowerCase();
      if (e && !seen.has(key)) { seen.add(key); emails.push(e); }
    }

    // (1) 依 email 比對三種訂單表(voice/music/orchestra 都只有 email 欄位可比)。
    for (const email of emails) {
      if (isClient) break;
      for (const table of ['voice_orders', 'music_orders', 'orchestra_orders'] as const) {
        try {
          const { data: ord } = await r.db.from(table).select('id').eq('email', email).limit(1).maybeSingle();
          if (ord) { isClient = true; break; }
        } catch { /* non-fatal — table/RLS quirk shouldn't block the profile load */ }
      }
    }

    // (2) orchestra_orders 另有 user_id,直接對登入帳號 id(涵蓋以不同 email 下單)。
    if (!isClient) {
      try {
        const { data: ord } = await r.db.from('orchestra_orders').select('id').eq('user_id', r.userId).limit(1).maybeSingle();
        if (ord) isClient = true;
      } catch { /* non-fatal */ }
    }

    // (3) 透過 /hire 發過配音需求(可能還沒付款成單)也算客戶 —— 需要客戶後台
    //     追蹤狀態。比對 client_email(候選 email)+ client_user_id(登入帳號 id)。
    if (!isClient) {
      for (const email of emails) {
        try {
          const { data: brief } = await r.db.from('marketplace_briefs').select('id').eq('client_email', email).limit(1).maybeSingle();
          if (brief) { isClient = true; break; }
        } catch { /* non-fatal */ }
      }
    }
    if (!isClient) {
      try {
        const { data: brief } = await r.db.from('marketplace_briefs').select('id').eq('client_user_id', r.userId).limit(1).maybeSingle();
        if (brief) isClient = true;
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({ talent: r.talent, isClient });
  } catch (err) {
    return supabaseErrorResponse(err, 'api/talent/me:GET');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const r = await resolveTalent(request);
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });

    const body = await request.json();
    const submit = body.submit === true; // true = submit for review; false = save draft only
    const updates: Record<string, unknown> = {};

    for (const k of TEXT_FIELDS) {
      if (k in body) updates[k] = typeof body[k] === 'string' ? body[k].slice(0, 4000) : body[k];
    }
    if ('name' in updates && (typeof updates.name !== 'string' || !updates.name.trim())) {
      return NextResponse.json({ error: 'Display name cannot be empty' }, { status: 400 });
    }
    // Strip links / personal contact info from free-text — links belong in the
    // dedicated field, contact info stays private (never shown to clients).
    for (const k of ['bio', 'clients', 'awards', 'notable_works', 'special_skills', 'equipment'] as const) {
      if (typeof updates[k] === 'string') updates[k] = stripContactsAndLinks(updates[k] as string);
    }

    // headshot_url: must live in our talent-photos bucket (or be cleared).
    if ('headshot_url' in body) {
      const h = body.headshot_url;
      if (h && (typeof h !== 'string' || !inOurBucket(h, 'talent-photos'))) {
        return NextResponse.json({ error: 'Invalid photo url' }, { status: 400 });
      }
      updates.headshot_url = h || null;
    }

    // voice_traits / specialties: preset keys + free-text custom ("其他").
    if ('voice_traits' in body) {
      if (!Array.isArray(body.voice_traits)) return NextResponse.json({ error: 'voice_traits must be an array' }, { status: 400 });
      updates.voice_traits = cleanTags(body.voice_traits);
    }
    if ('specialties' in body) {
      if (!Array.isArray(body.specialties)) return NextResponse.json({ error: 'specialties must be an array' }, { status: 400 });
      updates.specialties = cleanTags(body.specialties);
    }
    // voice_ages: preset keys only (no custom).
    if ('voice_ages' in body) {
      if (!Array.isArray(body.voice_ages)) return NextResponse.json({ error: 'voice_ages must be an array' }, { status: 400 });
      updates.voice_ages = [...new Set(body.voice_ages.filter((a: unknown): a is string => typeof a === 'string' && VOICE_AGE_KEYS.has(a)))];
    }
    // years_experience: a non-negative integer (clamped); native_languages: which
    // of the talent's languages are native (a free subset, validated as the rest).
    if ('years_experience' in body) {
      const n = parseInt(String(body.years_experience), 10);
      updates.years_experience = Number.isFinite(n) && n >= 0 ? Math.min(n, 80) : null;
    }
    if ('native_languages' in body) {
      if (!Array.isArray(body.native_languages)) return NextResponse.json({ error: 'native_languages must be an array' }, { status: 400 });
      updates.native_languages = cleanTags(body.native_languages);
    }

    // Cooperation opt-ins: plain booleans (coerced). Internal-only — they gate what
    // work Onyx may offer the talent, never shown to clients.
    for (const k of COOP_FIELDS) {
      if (k in body) updates[k] = body[k] === true || body[k] === 'true';
    }
    // expected_rates: a small free-form object of the talent's own rate expectations
    // (e.g. { tts_hourly, micro_gig, per_project, note }). Internal reference for
    // quoting, not public. Values clamped to numbers/short strings.
    if ('expected_rates' in body) {
      const er = body.expected_rates;
      if (er === null || er === undefined || er === '') {
        updates.expected_rates = null;
      } else if (typeof er === 'object' && !Array.isArray(er)) {
        const clean: Record<string, string | number> = {};
        for (const [k, v] of Object.entries(er as Record<string, unknown>).slice(0, 20)) {
          const key = k.slice(0, 40);
          if (typeof v === 'number' && Number.isFinite(v)) clean[key] = v;
          else if (typeof v === 'string' && v.trim()) clean[key] = stripContactsAndLinks(v).slice(0, 200);
        }
        updates.expected_rates = Object.keys(clean).length ? clean : null;
      } else {
        return NextResponse.json({ error: 'expected_rates must be an object' }, { status: 400 });
      }
    }

    // demos: categorized [{category,name,url,language,seconds}]. Validate bucket,
    // category, per-category cap and the 3-min length cap.
    let cleanDemos: DemoItem[] | null = null;
    if ('demos' in body) {
      const arr = body.demos;
      if (!Array.isArray(arr)) return NextResponse.json({ error: 'demos must be an array' }, { status: 400 });
      const counts: Record<string, number> = {};
      cleanDemos = [];
      for (const d of arr) {
        const url = typeof d?.url === 'string' ? d.url : '';
        const category = typeof d?.category === 'string' ? d.category : '';
        if (!USE_CASE_KEYS.has(category)) return NextResponse.json({ error: `Invalid demo category: ${category}` }, { status: 400 });
        if (!inOurBucket(url, 'talent-demos')) return NextResponse.json({ error: 'Invalid demo url' }, { status: 400 });
        const seconds = Number(d?.seconds) || 0;
        if (seconds > DEMO_MAX_SECONDS + 1) return NextResponse.json({ error: 'A demo exceeds the 3-minute limit' }, { status: 400 });
        counts[category] = (counts[category] || 0) + 1;
        if (counts[category] > demoLimit(category)) {
          return NextResponse.json({ error: `Too many demos in one category (max ${demoLimit(category)})` }, { status: 400 });
        }
        cleanDemos.push({
          category,
          name: (stripContactsAndLinks(String(d?.name || 'Demo')).replace(/[\s_,、・\-]+$/g, '').trim() || 'Demo').slice(0, 120),
          url,
          language: typeof d?.language === 'string' ? d.language : undefined,
          seconds: seconds || undefined,
        });
      }
      updates.demos = cleanDemos;
    }

    // Every demo must declare its language, or the language filter silently misses
    // it. Enforced on submit (drafts can still be saved mid-edit).
    if (submit && cleanDemos && cleanDemos.some((d) => !d.language)) {
      return NextResponse.json({ error: 'demo_without_language' }, { status: 400 });
    }

    // languages: each claimed language MUST be backed by at least one demo in
    // that language — you can't claim a language we can't hear. Checked against
    // the demos being saved in this same request (or the existing ones).
    if ('languages' in body) {
      if (!Array.isArray(body.languages)) return NextResponse.json({ error: 'languages must be an array' }, { status: 400 });
      const langs: string[] = [...new Set((body.languages as unknown[]).filter((l): l is string => typeof l === 'string' && !!l.trim()).map((l) => l.trim()))];
      const demosForCheck: DemoItem[] = cleanDemos ?? (Array.isArray(r.talent.demos) ? r.talent.demos : []);
      const demoLangs = new Set<string>(demosForCheck.map((d) => d.language).filter((x): x is string => !!x));
      // Only enforce the "language needs a demo" rule when SUBMITTING for review
      // — a half-finished draft can be saved with languages still missing demos.
      const missing = langs.filter((l) => !demoLangs.has(l));
      if (submit && missing.length > 0) {
        return NextResponse.json({ error: 'language_without_demo', languages: missing }, { status: 400 });
      }
      updates.languages = langs;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    // Minimum completeness to ENTER the review queue — stop near-empty profiles
    // (no demo / language / voice trait / specialty) from reaching the admin. A
    // draft can still be saved incomplete; only an explicit submit is gated.
    if (submit) {
      const t = r.talent as Record<string, unknown>;
      const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
      const finalDemos = cleanDemos ?? (arr(t.demos) as DemoItem[]);
      const finalLangs = ('languages' in updates ? updates.languages : t.languages) as unknown;
      const finalTraits = ('voice_traits' in updates ? updates.voice_traits : t.voice_traits) as unknown;
      const finalSpecs = ('specialties' in updates ? updates.specialties : t.specialties) as unknown;
      const missing: string[] = [];
      if (!finalDemos.length) missing.push('demo');
      if (!arr(finalLangs).length) missing.push('languages');
      if (!arr(finalTraits).length) missing.push('voice_traits');
      if (!arr(finalSpecs).length) missing.push('specialties');
      if (missing.length) return NextResponse.json({ error: 'incomplete_profile', missing }, { status: 400 });
    }

    // Saving a draft does NOT touch review state. Only an explicit submit enters
    // the review queue; admin publish is what clears pending_review back to false.
    if (submit) updates.pending_review = true;

    const { data, error } = await r.db
      .from('talents')
      .update(updates)
      .eq('id', r.talent.id)
      .select(COLS)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ talent: data });
  } catch (err) {
    return supabaseErrorResponse(err, 'api/talent/me:PATCH');
  }
}

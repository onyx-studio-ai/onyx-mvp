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
const TEXT_FIELDS = ['name', 'english_name', 'bio', 'gender', 'location', 'availability_note', 'studio_partner', 'equipment', 'clients', 'awards', 'notable_works', 'special_skills', 'turnaround'] as const;

const COLS =
  'id, name, english_name, bio, languages, accent, gender, tags, voice_traits, specialties, voice_ages, demos, demo_urls, headshot_url, ' +
  'location, availability_note, equipment, studio_partner, clients, awards, notable_works, special_skills, turnaround, years_experience, native_languages, type, email, is_active, ' +
  'pending_review, published_snapshot, liveness_status';

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

  return { db, talent };
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
    // Dual-role: also a client (has placed voiceover orders)? Lets the dashboard
    // offer a "switch to client area" link only when relevant.
    let isClient = false;
    try {
      const { data: ord } = await r.db.from('voice_orders').select('id').eq('email', r.talent.email || '').limit(1).maybeSingle();
      isClient = !!ord;
    } catch { /* non-fatal */ }
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

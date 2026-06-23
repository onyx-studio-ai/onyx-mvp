import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient, supabaseErrorResponse } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/mail';
import { talentReviewEmail } from '@/lib/mail-templates';
import { translateFields, localizeName } from '@/lib/translate';
import { stripContactsAndLinks } from '@/lib/sanitize-text';
import { TRAIT_KEYS, USE_CASE_KEYS } from '@/lib/talent-taxonomy';

/*
  Admin publish: promote a talent's current DRAFT (the talents row) into the
  public published_snapshot, and clear pending_review. This is the ONLY path that
  changes what clients see — talent self-edits never do. Also flips is_active=true
  (first publish), so this doubles as the onboarding go-live step.

  Free-text fields (bio, clients, awards, notable work, special skills) are
  auto-translated to {zh-TW, zh-CN, en} via DeepL (lib/translate) so the public
  profile shows each viewer their own language. The admin may tweak the bio source
  (body.bio) in the publish dialog; 简体/English are derived from it. Degrades to
  originals if DEEPL_API_KEY is unset.

  Only public-safe fields go into the snapshot — never email/phone/payment_details
  /internal_cost/auth_user_id.
*/

const SNAPSHOT_COLS =
  'id, name, english_name, email, languages, gender, accent, bio, tags, voice_traits, specialties, voice_ages, demos, demo_urls, ' +
  'headshot_url, sample_url, location, availability_note, equipment, clients, awards, notable_works, special_skills, turnaround, years_experience, native_languages, category';

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const talentId = body.talentId;
    if (!talentId) return NextResponse.json({ error: 'talentId is required' }, { status: 400 });

    const db = getSupabaseServiceClient();
    const { data, error } = await db.from('talents').select(SNAPSHOT_COLS).eq('id', talentId).single();
    if (error || !data) return NextResponse.json({ error: 'Talent not found' }, { status: 404 });
    // No generated DB types → loose row.
    const t = data as unknown as Record<string, unknown>;

    // Bio source: the admin may have tweaked it in the publish dialog (body.bio);
    // otherwise use the talent's draft bio. This single source is auto-translated.
    const draftBio = stripContactsAndLinks((typeof body.bio === 'string' ? body.bio : (t.bio as string)) || '');

    // Publish is the single chokepoint: EVERY free-text field that reaches the
    // public snapshot is stripped of phone/email/links here, no matter how it was
    // entered (self-service, admin form, or approval). `tidy` also trims trailing
    // separators left by a stripped phone (e.g. "Name_0975…" → "Name").
    const tidy = (s: string) => stripContactsAndLinks(s || '').replace(/[\s_,、・\-]+$/g, '').replace(/^[\s_,、・\-]+/g, '').trim();

    // Auto-translate the (stripped) free-text fields to {zh-TW,zh-CN,en} via DeepL.
    const trf = await translateFields({
      bio: draftBio,
      clients: tidy((t.clients as string) || ''),
      awards: tidy((t.awards as string) || ''),
      notable_works: tidy((t.notable_works as string) || ''),
      special_skills: tidy((t.special_skills as string) || ''),
      equipment: tidy((t.equipment as string) || ''),
    });

    // Demo names are free text too — strip + translate each.
    const draftDemos = Array.isArray(t.demos) ? (t.demos as Array<Record<string, unknown>>) : [];
    const nameTrf = await translateFields(
      Object.fromEntries(draftDemos.map((d, i) => [`d${i}`, tidy((d?.name as string) || '')]))
    );
    const snapshotDemos = draftDemos.map((d, i) => ({ ...d, name: nameTrf[`d${i}`] ?? d.name ?? '' }));

    const snapshotBio = trf.bio ?? draftBio ?? null;

    // Name: stripped, never machine-translated. 繁簡 via OpenCC; English = self-provided.
    const cleanName = tidy((t.name as string) || '') || (t.name as string) || '';
    const nameI18n = localizeName(cleanName, tidy((t.english_name as string) || ''));

    // Voice-trait / specialty tags: preset keys pass through; custom (free-text)
    // ones get stripped + translated. Store the cleaned arrays AND the i18n map so
    // neither the array nor the display can leak a phone a talent hid in a "tag".
    const cleanTag = (x: string) => (TRAIT_KEYS.has(x) || USE_CASE_KEYS.has(x) ? x : tidy(x));
    const vtClean = (Array.isArray(t.voice_traits) ? (t.voice_traits as string[]) : []).filter((x) => typeof x === 'string').map(cleanTag).filter(Boolean);
    const spClean = (Array.isArray(t.specialties) ? (t.specialties as string[]) : []).filter((x) => typeof x === 'string').map(cleanTag).filter(Boolean);
    const customTags = [...new Set([...vtClean.filter((x) => !TRAIT_KEYS.has(x)), ...spClean.filter((x) => !USE_CASE_KEYS.has(x))])];
    const tagTrf = customTags.length ? await translateFields(Object.fromEntries(customTags.map((c, i) => [`t${i}`, c]))) : {};
    const tagI18n: Record<string, unknown> = {};
    customTags.forEach((c, i) => { const v = tagTrf[`t${i}`]; if (v && typeof v === 'object') tagI18n[c] = v; });

    const snapshot = {
      name: cleanName,
      name_i18n: nameI18n,
      languages: t.languages || [],
      gender: t.gender || null,
      accent: t.accent || null,
      bio: snapshotBio,
      tags: t.tags || [],
      voice_traits: vtClean,
      specialties: spClean,
      tag_i18n: tagI18n,
      voice_ages: t.voice_ages || [],
      demos: snapshotDemos,
      demo_urls: t.demo_urls || [],
      headshot_url: t.headshot_url || null,
      sample_url: t.sample_url || null,
      location: t.location || null,
      availability_note: t.availability_note || null,
      turnaround: t.turnaround || null,
      years_experience: typeof t.years_experience === 'number' ? t.years_experience : null,
      native_languages: t.native_languages || [],
      equipment: trf.equipment ?? t.equipment ?? null,
      clients: trf.clients ?? t.clients ?? null,
      awards: trf.awards ?? t.awards ?? null,
      notable_works: trf.notable_works ?? t.notable_works ?? null,
      special_skills: trf.special_skills ?? t.special_skills ?? null,
      category: t.category || null,
    };

    const { error: upErr } = await db
      .from('talents')
      .update({ published_snapshot: snapshot, bio: draftBio, pending_review: false, is_active: true })
      .eq('id', talentId);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    // Notify the talent their profile is live (best-effort; transactional, fired
    // by the admin's own click). Skippable via { notify: false }.
    const email = t.email as string | null;
    if (body.notify !== false && email) {
      try {
        let locale = 'zh-TW';
        const { data: appRow } = await db.from('talent_applications').select('locale').eq('email', email).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (appRow?.locale) locale = appRow.locale as string;
        const { subject, html } = talentReviewEmail({
          talentName: (t.name as string) || '', approved: true, locale,
          profileLink: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.onyxstudios.ai'}/talent`,
        });
        await sendEmail({ category: 'HELLO', to: email, subject, html });
      } catch { /* email is best-effort */ }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return supabaseErrorResponse(err, 'admin/talents/publish');
  }
}

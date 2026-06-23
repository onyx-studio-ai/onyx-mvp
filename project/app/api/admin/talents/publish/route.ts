import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient, supabaseErrorResponse } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/mail';
import { talentReviewEmail } from '@/lib/mail-templates';
import { translateFields, localizeName } from '@/lib/translate';
import { stripContactsAndLinks } from '@/lib/sanitize-text';

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
  'headshot_url, sample_url, location, availability_note, equipment, clients, awards, notable_works, special_skills, category';

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

    // Auto-translate the free-text fields to {zh-TW,zh-CN,en} via DeepL (source
    // auto-detected). Degrades gracefully to originals if no key / on error.
    const trf = await translateFields({
      bio: draftBio,
      clients: (t.clients as string) || '',
      awards: (t.awards as string) || '',
      notable_works: (t.notable_works as string) || '',
      special_skills: (t.special_skills as string) || '',
      equipment: (t.equipment as string) || '',
    });

    // Demo names are free text too (e.g. 廣告台詞 / 時光小屋) — translate each so the
    // English page doesn't show Chinese labels. Keyed d0, d1, … to map back by index.
    const draftDemos = Array.isArray(t.demos) ? (t.demos as Array<Record<string, unknown>>) : [];
    const nameTrf = await translateFields(
      Object.fromEntries(draftDemos.map((d, i) => [`d${i}`, (d?.name as string) || '']))
    );
    const snapshotDemos = draftDemos.map((d, i) => ({ ...d, name: nameTrf[`d${i}`] ?? d.name ?? '' }));

    // bio: auto-translation result (a {zh-TW,zh-CN,en} object), or the plain
    // source string if translation is unavailable (pickLocale handles both).
    const snapshotBio = trf.bio ?? draftBio ?? null;

    // Name: never machine-translated. 繁簡 via OpenCC; English = self-provided
    // english_name, else the original. Kept alongside the plain `name` string
    // (which many consumers still read) — public UI prefers name_i18n.
    const nameI18n = localizeName((t.name as string) || '', (t.english_name as string) || '');

    const snapshot = {
      name: t.name,
      name_i18n: nameI18n,
      languages: t.languages || [],
      gender: t.gender || null,
      accent: t.accent || null,
      bio: snapshotBio,
      tags: t.tags || [],
      voice_traits: t.voice_traits || [],
      specialties: t.specialties || [],
      voice_ages: t.voice_ages || [],
      demos: snapshotDemos,
      demo_urls: t.demo_urls || [],
      headshot_url: t.headshot_url || null,
      sample_url: t.sample_url || null,
      location: t.location || null,
      availability_note: t.availability_note || null,
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

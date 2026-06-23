import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient, supabaseErrorResponse } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/mail';
import { talentReviewEmail } from '@/lib/mail-templates';

/*
  Admin publish: promote a talent's current DRAFT (the talents row) into the
  public published_snapshot, and clear pending_review. This is the ONLY path that
  changes what clients see — talent self-edits never do. Also flips is_active=true
  (first publish), so this doubles as the onboarding go-live step.

  bioTranslations is the admin's manual i18n of the bio (Phase 1 — auto-translate
  comes later once a translation key is configured). Stored as {locale: text} so
  the public profile shows the viewer's language; falls back to the plain draft
  bio for any locale the admin left blank.

  Only public-safe fields go into the snapshot — never email/phone/payment_details
  /internal_cost/auth_user_id.
*/

const SNAPSHOT_COLS =
  'id, name, email, languages, gender, accent, bio, tags, voice_traits, specialties, voice_ages, demos, demo_urls, ' +
  'headshot_url, sample_url, location, availability_note, equipment, studio_partner, clients, awards, notable_works, special_skills, category';

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

    // Build the bio i18n object from the admin's translations, falling back to the
    // draft bio for any blank locale. If nothing was provided, keep the plain bio.
    const tr = (body.bioTranslations || {}) as Record<string, string>;
    const draftBio = (t.bio as string) || '';
    const bioObj: Record<string, string> = {};
    const tw = (tr['zh-TW'] || draftBio || '').trim(); // zh-TW always present (draft fallback)
    if (tw) bioObj['zh-TW'] = tw;
    if ((tr['zh-CN'] || '').trim()) bioObj['zh-CN'] = tr['zh-CN'].trim();
    if ((tr['en'] || '').trim()) bioObj['en'] = tr['en'].trim();
    const snapshotBio = Object.keys(bioObj).length > 0 ? bioObj : draftBio;

    const snapshot = {
      name: t.name,
      languages: t.languages || [],
      gender: t.gender || null,
      accent: t.accent || null,
      bio: snapshotBio,
      tags: t.tags || [],
      voice_traits: t.voice_traits || [],
      specialties: t.specialties || [],
      voice_ages: t.voice_ages || [],
      demos: t.demos || [],
      demo_urls: t.demo_urls || [],
      headshot_url: t.headshot_url || null,
      sample_url: t.sample_url || null,
      location: t.location || null,
      availability_note: t.availability_note || null,
      equipment: t.equipment || null,
      studio_partner: t.studio_partner || null,
      clients: t.clients || null,
      awards: t.awards || null,
      notable_works: t.notable_works || null,
      special_skills: t.special_skills || null,
      category: t.category || null,
    };

    const { error: upErr } = await db
      .from('talents')
      .update({ published_snapshot: snapshot, pending_review: false, is_active: true })
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

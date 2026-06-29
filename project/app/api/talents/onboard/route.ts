import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient, supabaseErrorResponse } from '@/lib/supabase-server';
import { verifyOnboardToken } from '@/lib/onboard-token';
import { talentAccountSetupEmail } from '@/lib/mail-templates';
import { sendEmail, emailLocaleForTalent } from '@/lib/mail';

/*
  Post-approval onboarding (token-gated, no login). GET validates the token
  and returns the talent's public name + whether they've already completed it.
  POST records agreement to the cooperation terms (onboarded_at) and provisions a
  self-service login account (Supabase Auth) so they can manage their own profile
  at /talent — emailing them a set-password link.

  It deliberately does NOT publish the talent (is_active stays false): they go
  live on the public roster only after they've reviewed/polished their profile
  and an admin flips them Active. So onboarding ≠ going public.
*/

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.onyxstudios.ai';

export async function GET(request: NextRequest) {
  try {
    const token = new URL(request.url).searchParams.get('t') || '';
    const appId = verifyOnboardToken(token);
    if (!appId) return NextResponse.json({ valid: false }, { status: 400 });

    const db = getSupabaseServiceClient();
    const { data } = await db.from('talents').select('name, onboarded_at').eq('application_id', appId).single();
    if (!data) return NextResponse.json({ valid: false }, { status: 404 });

    return NextResponse.json({ valid: true, name: data.name, done: !!data.onboarded_at });
  } catch (err) {
    return supabaseErrorResponse(err, 'api/talents/onboard:GET');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const appId = verifyOnboardToken(body.token || '');
    if (!appId) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 });
    if (!body.agree) return NextResponse.json({ error: 'Please agree to the terms' }, { status: 400 });

    const db = getSupabaseServiceClient();
    const { data: talent, error } = await db
      .from('talents')
      .select('id, name, email, auth_user_id')
      .eq('application_id', appId)
      .single();
    if (error || !talent) {
      return NextResponse.json({ error: error?.message || 'Talent not found' }, { status: 500 });
    }
    if (!talent.email) {
      return NextResponse.json({ error: 'No email on file — please contact hello@onyxstudios.ai.' }, { status: 400 });
    }

    // Reading language for the setup mail + link. Stored locale = the page-language
    // they applied from, which mis-tags foreign VOs who used a /zh-TW/ link — so
    // resolve to the language they actually read.
    const { data: appRow } = await db
      .from('talent_applications')
      .select('locale, languages')
      .eq('id', appId)
      .single();
    const locale = emailLocaleForTalent(appRow?.locale, appRow?.languages);

    // Provision (or reuse) the self-service login account. This is NOT silent
    // best-effort anymore: if we can't end up with a real account we fail loudly
    // and DON'T mark onboarding done — so the talent retries instead of being left
    // with a ghost record + no way to log in (the old silent path caused exactly
    // that). An account may already exist (pre-provisioned at approval) — reuse it.
    let userId = (talent.auth_user_id as string | null) || null;
    if (!userId) {
      const created = await db.auth.admin.createUser({ email: talent.email, email_confirm: true });
      userId = created.data?.user?.id || null;
      if (!userId) {
        // Email may already have an auth user from a prior attempt — reuse it.
        const { data: list } = await db.auth.admin.listUsers();
        userId = list?.users?.find((u) => (u.email || '').toLowerCase() === talent.email!.toLowerCase())?.id || null;
      }
      if (!userId) {
        console.error('[onboard] account provisioning failed for', talent.email);
        return NextResponse.json({ error: '帳號建立失敗,請稍後再試一次;若持續發生請回信 hello@onyxstudios.ai。' }, { status: 502 });
      }
      await db.from('talents').update({ auth_user_id: userId }).eq('id', talent.id);
    }

    // (Re)send the set-password link every time — this also lets a talent who lost
    // or expired the first email just re-open their onboarding link to get a fresh
    // one. Locale-prefixed reset page (next-intl: en = no prefix).
    const lp = locale && locale !== 'en' ? `/${locale}` : '';
    const { data: link } = await db.auth.admin.generateLink({
      type: 'recovery',
      email: talent.email,
      options: { redirectTo: `${SITE}${lp}/auth/reset-password` },
    });
    const setupUrl = link?.properties?.action_link || `${SITE}${lp}/auth/reset-password`;
    const mail = talentAccountSetupEmail({ name: talent.name, setupUrl, dashboardUrl: `${SITE}/talent`, locale });
    await sendEmail({ category: 'HELLO', to: talent.email, subject: mail.subject, html: mail.html });

    // Mark onboarding complete only now that the account exists + link was sent.
    await db.from('talents').update({ onboarded_at: new Date().toISOString() }).eq('id', talent.id);

    return NextResponse.json({ ok: true, accountCreated: true });
  } catch (err) {
    return supabaseErrorResponse(err, 'api/talents/onboard:POST');
  }
}

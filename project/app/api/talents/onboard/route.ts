import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient, supabaseErrorResponse } from '@/lib/supabase-server';
import { verifyOnboardToken } from '@/lib/onboard-token';
import { talentAccountSetupEmail } from '@/lib/mail-templates';
import { sendEmail } from '@/lib/mail';

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
    // Record onboarding — but DON'T publish (is_active stays false). The talent
    // reviews/polishes their profile at /talent; an admin publishes them later.
    // Keep this query free of auth_user_id so onboarding still works even if the
    // talent-account migration hasn't been applied yet.
    const { data: talent, error } = await db
      .from('talents')
      .update({ onboarded_at: new Date().toISOString() })
      .eq('application_id', appId)
      .select('id, name, email')
      .single();
    if (error || !talent) {
      return NextResponse.json({ error: error?.message || 'Talent not found' }, { status: 500 });
    }

    // Provision a self-service account so the talent can log in at /talent and
    // edit their own profile. Best-effort: activation already succeeded, so any
    // failure here (incl. the auth_user_id column not existing yet) is logged
    // but doesn't fail the onboarding.
    let accountCreated = false;
    if (talent.email) {
      try {
        // Skip if already linked (idempotent re-submits). This read also fails
        // gracefully into the catch if the migration isn't applied yet.
        const { data: linkRow } = await db.from('talents').select('auth_user_id').eq('id', talent.id).single();
        if (linkRow?.auth_user_id) throw new Error('already linked');

        const { data: appRow } = await db
          .from('talent_applications')
          .select('locale')
          .eq('id', appId)
          .single();
        const locale = appRow?.locale || 'en';

        // Create the auth user (or find the existing one if the email is taken).
        let userId: string | null = null;
        const created = await db.auth.admin.createUser({ email: talent.email, email_confirm: true });
        if (created.data?.user) {
          userId = created.data.user.id;
        } else {
          const { data: list } = await db.auth.admin.listUsers();
          userId =
            list?.users?.find((u) => (u.email || '').toLowerCase() === talent.email!.toLowerCase())?.id || null;
        }

        if (userId) {
          await db.from('talents').update({ auth_user_id: userId }).eq('id', talent.id);
          // Locale-prefixed reset page so a zh talent lands on the Chinese page
          // (next-intl: en = no prefix). Allowlisted via *.onyxstudios.ai/**.
          const lp = locale && locale !== 'en' ? `/${locale}` : '';
          const { data: link } = await db.auth.admin.generateLink({
            type: 'recovery',
            email: talent.email,
            options: { redirectTo: `${SITE}${lp}/auth/reset-password` },
          });
          const setupUrl = link?.properties?.action_link || `${SITE}${lp}/auth/reset-password`;
          const mail = talentAccountSetupEmail({
            name: talent.name,
            setupUrl,
            dashboardUrl: `${SITE}/talent`,
            locale,
          });
          await sendEmail({ category: 'HELLO', to: talent.email, subject: mail.subject, html: mail.html });
          accountCreated = true;
        }
      } catch (e) {
        // 'already linked' is the normal idempotent re-submit path — not an error.
        if (!(e instanceof Error && e.message === 'already linked')) {
          console.error('[onboard] account provisioning failed (non-fatal):', e);
        }
      }
    }

    return NextResponse.json({ ok: true, accountCreated });
  } catch (err) {
    return supabaseErrorResponse(err, 'api/talents/onboard:POST');
  }
}

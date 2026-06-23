import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/mail';
import { passwordResetEmail } from '@/lib/mail-templates';
import { verifyTurnstile } from '@/lib/turnstile';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { email, turnstileToken, locale: pageLocale } = await request.json();

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    if (!(await verifyTurnstile(turnstileToken, ip))) {
      return NextResponse.json({ error: 'Bot check failed — please try again.' }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const admin = getAdminClient();

    // Email language: prefer the user's stored locale (from their application),
    // fall back to the page locale they reset from, else English.
    let locale = pageLocale || 'en';
    try {
      const { data: appRow } = await admin
        .from('talent_applications')
        .select('locale')
        .eq('email', email.trim().toLowerCase())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (appRow?.locale) locale = appRow.locale;
    } catch { /* non-fatal — use pageLocale */ }

    // Locale-prefixed reset page so the user lands in their own language
    // (next-intl: en = no prefix). Allowlisted via *.onyxstudios.ai/**.
    const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.onyxstudios.ai';
    const lp = locale && locale !== 'en' ? `/${locale}` : '';
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: email.trim().toLowerCase(),
      options: {
        redirectTo: `${SITE}${lp}/auth/reset-password`,
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      // Don't reveal whether user exists
      console.error('[Auth Reset] Generate link error:', linkError);
      return NextResponse.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
    }

    const resetLink = linkData.properties.action_link;
    const { subject, html } = passwordResetEmail({ resetLink, locale });

    await sendEmail({
      category: 'SUPPORT',
      to: email.trim().toLowerCase(),
      subject,
      html,
    });

    return NextResponse.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
  } catch (err) {
    console.error('[Auth Reset] Server error:', err);
    return NextResponse.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/mail';
import { signupConfirmationEmail } from '@/lib/mail-templates';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const admin = getAdminClient();

    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: false,
    });

    if (createError) {
      console.error('[Auth Signup] Create user error:', createError);
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'signup',
      email: email.trim().toLowerCase(),
      password,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.onyxstudios.ai'}/auth/confirm`,
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error('[Auth Signup] Generate link error:', linkError);
      return NextResponse.json(
        { error: 'Account created but confirmation email could not be sent. Please try logging in.' },
        { status: 500 }
      );
    }

    const confirmLink = linkData.properties.action_link;
    const { subject, html } = signupConfirmationEmail({ confirmLink });

    await sendEmail({
      category: 'HELLO',
      to: email.trim().toLowerCase(),
      subject,
      html,
    });

    return NextResponse.json({
      success: true,
      userId: newUser.user?.id,
      message: 'Account created. Please check your email to confirm.',
    });
  } catch (err) {
    console.error('[Auth Signup] Server error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

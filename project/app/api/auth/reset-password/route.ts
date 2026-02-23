import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/mail';
import { passwordResetEmail } from '@/lib/mail-templates';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const admin = getAdminClient();

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: email.trim().toLowerCase(),
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.onyxstudios.ai'}/auth/reset-password`,
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      // Don't reveal whether user exists
      console.error('[Auth Reset] Generate link error:', linkError);
      return NextResponse.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
    }

    const resetLink = linkData.properties.action_link;
    const { subject, html } = passwordResetEmail({ resetLink });

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

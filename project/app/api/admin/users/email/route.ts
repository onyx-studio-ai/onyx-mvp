import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/mail';
import { adminMessageEmail } from '@/lib/mail-templates';
import { requireAdminOnly } from '@/app/api/admin/_utils/requireAdmin';

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminOnly(request);
  if (unauthorized) return unauthorized;

  try {
    const { to, subject, body } = await request.json();

    if (!to || !subject) {
      return NextResponse.json({ error: 'Recipient and subject required' }, { status: 400 });
    }

    // Unified branded layout (logo header + footer) for admin-composed messages.
    const { html } = adminMessageEmail({ subject, body: body || '' });

    const result = await sendEmail({
      category: 'HELLO',
      to,
      subject,
      html,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Email failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Admin Email] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/mail';

export async function POST(request: NextRequest) {
  try {
    const { to, subject, body } = await request.json();

    if (!to || !subject) {
      return NextResponse.json({ error: 'Recipient and subject required' }, { status: 400 });
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #000; padding: 24px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 20px;">ONYX STUDIOS</h1>
        </div>
        <div style="padding: 32px 24px; background: #111; color: #eee; line-height: 1.6;">
          ${(body || '').split('\n').map((line: string) => `<p style="margin: 0 0 12px 0;">${line}</p>`).join('')}
        </div>
        <div style="padding: 16px 24px; background: #000; text-align: center;">
          <p style="color: #666; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Onyx Studios. All rights reserved.</p>
        </div>
      </div>
    `;

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

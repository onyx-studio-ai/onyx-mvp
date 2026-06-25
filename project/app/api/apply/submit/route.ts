import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, emailLocaleForTalent } from '@/lib/mail';
import { applicationReceivedEmail, applicationTeamNotifyEmail } from '@/lib/mail-templates';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getServiceClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[Apply API] Missing Supabase config:', {
      hasUrl: Boolean(SUPABASE_URL),
      hasServiceRoleKey: Boolean(SERVICE_ROLE_KEY),
    });
    return NextResponse.json({ error: 'Apply service is not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    // `locale` is pulled out (like the file fields) so it drives the email
    // language but never reaches the insert — talent_applications has no such column.
    const { fileUrl, fileName, fileSize, locale, ...formData } = body;

    const payload = {
      ...formData,
      locale: locale || '',
      demo_file_url: fileUrl || '',
      demo_file_name: fileName || '',
      demo_file_size: fileSize || 0,
      status: 'pending',
      application_number: '',
    };

    const db = getServiceClient();
    const { data, error } = await db
      .from('talent_applications')
      .insert(payload)
      .select('application_number')
      .single();

    if (error) {
      console.error('[Apply API] Insert error:', error);
      // A repeat application (same email / voice id) trips a unique constraint — that's
      // not a server fault. Don't leak the raw "duplicate key value" SQL to the applicant
      // (a real applicant, Ted, hit this and was blocked); tell them we already have them.
      if ((error as { code?: string }).code === '23505' || /duplicate key/i.test(error.message || '')) {
        const dup = locale?.startsWith('zh')
          ? '這個 email 似乎已經報名過了 —— 我們已收到您的申請,會盡快與您聯絡。若要更新資料,請來信 hello@onyxstudios.ai。'
          : "This email has already applied — we've got your application and will be in touch. To update your details, email hello@onyxstudios.ai.";
        return NextResponse.json({ error: dup, duplicate: true }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Send confirmation to applicant
    const applicantName = formData.full_name || formData.name || 'Applicant';
    const appNumber = data.application_number;
    const applicantEmail = formData.email;

    if (applicantEmail) {
      // Use the language the applicant actually reads, not just the page they applied
      // from — a foreign VO who used a /zh-TW/ link shouldn't get a Chinese confirmation.
      const emailLocale = emailLocaleForTalent(locale, formData.languages);
      const { subject: confirmSubject, html: confirmHtml } = applicationReceivedEmail({
        applicantName,
        applicationNumber: appNumber,
        email: applicantEmail,
        locale: emailLocale,
      });
      await sendEmail({ category: 'HELLO', to: applicantEmail, subject: confirmSubject, html: confirmHtml });

      const { subject: teamSubject, html: teamHtml } = applicationTeamNotifyEmail({
        applicantName,
        applicationNumber: appNumber,
        email: applicantEmail,
        category: formData.category || formData.talent_type || 'General',
      });
      await sendEmail({ category: 'HELLO', to: 'hello@onyxstudios.ai', subject: teamSubject, html: teamHtml });
    }

    return NextResponse.json({
      success: true,
      application_number: data.application_number,
    });
  } catch (err) {
    console.error('[Apply API] Server error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

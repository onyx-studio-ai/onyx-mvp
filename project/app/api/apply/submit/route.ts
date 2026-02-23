import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/mail';
import { applicationReceivedEmail, applicationTeamNotifyEmail } from '@/lib/mail-templates';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function getServiceClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileUrl, fileName, fileSize, ...formData } = body;

    const payload = {
      ...formData,
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
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Send confirmation to applicant
    const applicantName = formData.full_name || formData.name || 'Applicant';
    const appNumber = data.application_number;
    const applicantEmail = formData.email;

    if (applicantEmail) {
      const { subject: confirmSubject, html: confirmHtml } = applicationReceivedEmail({
        applicantName,
        applicationNumber: appNumber,
        email: applicantEmail,
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

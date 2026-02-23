import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, type SenderCategory } from '@/lib/mail';
import {
  contactInquiryConfirmationEmail,
  contactInquiryInternalEmail,
} from '@/lib/mail-templates';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const DEPARTMENT_EMAILS: Record<string, string> = {
  HELLO: 'hello@onyxstudios.ai',
  PRODUCTION: 'produce@onyxstudios.ai',
  SUPPORT: 'support@onyxstudios.ai',
  BILLING: 'billing@onyxstudios.ai',
  ADMIN: 'admin@onyxstudios.ai',
};

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function generateInquiryNumber(supabase: ReturnType<typeof getAdminClient>): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `INQ-${dateStr}-`;

  const { data } = await supabase
    .from('contact_inquiries')
    .select('inquiry_number')
    .like('inquiry_number', `${prefix}%`)
    .order('inquiry_number', { ascending: false })
    .limit(1);

  let seq = 1;
  if (data && data.length > 0) {
    const last = data[0].inquiry_number;
    const lastSeq = parseInt(last.split('-').pop() || '0', 10);
    seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(4, '0')}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, message, department = 'HELLO', source = 'general' } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, message' },
        { status: 400 }
      );
    }

    const validDepartment = DEPARTMENT_EMAILS[department] ? department : 'HELLO';
    const supabase = getAdminClient();

    const inquiryNumber = await generateInquiryNumber(supabase);

    const { error: dbError } = await supabase.from('contact_inquiries').insert({
      inquiry_number: inquiryNumber,
      name,
      email,
      message,
      department: validDepartment,
      source,
      status: 'new',
    });

    if (dbError) {
      console.error('[Contact] DB insert failed:', dbError.message);
    } else {
      console.log(`[Contact] Saved inquiry ${inquiryNumber}`);
    }

    const confirmTemplate = contactInquiryConfirmationEmail({
      inquiryNumber,
      name,
      message,
      department: validDepartment,
    });

    const confirmResult = await sendEmail({
      category: validDepartment as SenderCategory,
      to: email,
      subject: confirmTemplate.subject,
      html: confirmTemplate.html,
      replyTo: DEPARTMENT_EMAILS[validDepartment],
    });

    console.log(`[Contact] Confirmation to ${email}:`, confirmResult.success ? 'SENT' : confirmResult.error);

    await new Promise((r) => setTimeout(r, 700));

    const internalTemplate = contactInquiryInternalEmail({
      inquiryNumber,
      name,
      email,
      message,
      department: validDepartment,
      source,
    });

    const deptEmail = DEPARTMENT_EMAILS[validDepartment];
    const internalResult = await sendEmail({
      category: validDepartment as SenderCategory,
      to: deptEmail,
      subject: internalTemplate.subject,
      html: internalTemplate.html,
      replyTo: email,
    });

    console.log(`[Contact] Internal to ${deptEmail}:`, internalResult.success ? 'SENT' : internalResult.error);

    return NextResponse.json({
      success: true,
      inquiryNumber,
      confirmationSent: confirmResult.success,
    });
  } catch (err) {
    console.error('[Contact API] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

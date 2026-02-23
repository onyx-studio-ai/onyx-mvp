import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, type SenderCategory } from '@/lib/mail';
import { contactInquiryReplyEmail } from '@/lib/mail-templates';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getAdminClient();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const department = searchParams.get('department');

    let query = supabase
      .from('contact_inquiries')
      .select('*')
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (department && department !== 'all') {
      query = query.eq('department', department);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { count: newCount } = await supabase
      .from('contact_inquiries')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new');

    return NextResponse.json({ inquiries: data || [], newCount: newCount || 0 });
  } catch (err) {
    console.error('[Admin Inquiries] GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = getAdminClient();
    const body = await request.json();
    const { id, status, notes, assigned_to } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing inquiry id' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (notes !== undefined) updates.notes = notes;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to;

    const { data, error } = await supabase
      .from('contact_inquiries')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ inquiry: data });
  } catch (err) {
    console.error('[Admin Inquiries] PATCH error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getAdminClient();
    const body = await request.json();
    const { id, replyMessage } = body;

    if (!id || !replyMessage) {
      return NextResponse.json(
        { error: 'Missing required fields: id, replyMessage' },
        { status: 400 }
      );
    }

    const { data: inquiry, error: fetchError } = await supabase
      .from('contact_inquiries')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !inquiry) {
      return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
    }

    const template = contactInquiryReplyEmail({
      inquiryNumber: inquiry.inquiry_number,
      clientName: inquiry.name,
      replyMessage,
      department: inquiry.department,
    });

    const result = await sendEmail({
      category: inquiry.department as SenderCategory,
      to: inquiry.email,
      subject: template.subject,
      html: template.html,
      replyTo: getDeptEmail(inquiry.department),
    });

    if (!result.success) {
      console.error(`[Admin Inquiries] Reply failed for ${inquiry.inquiry_number}:`, result.error);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    const existingReplies = Array.isArray(inquiry.replies) ? inquiry.replies : [];
    const newReply = {
      message: replyMessage,
      sentAt: new Date().toISOString(),
      messageId: result.messageId,
    };

    const { error: updateError } = await supabase
      .from('contact_inquiries')
      .update({
        replies: [...existingReplies, newReply],
        status: 'replied',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error(`[Admin Inquiries] Update after reply failed:`, updateError.message);
    }

    console.log(`[Admin Inquiries] Reply sent for ${inquiry.inquiry_number} to ${inquiry.email}`);

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (err) {
    console.error('[Admin Inquiries] POST reply error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

function getDeptEmail(department: string): string {
  const map: Record<string, string> = {
    HELLO: 'hello@onyxstudios.ai',
    PRODUCTION: 'produce@onyxstudios.ai',
    SUPPORT: 'support@onyxstudios.ai',
    BILLING: 'billing@onyxstudios.ai',
    ADMIN: 'admin@onyxstudios.ai',
  };
  return map[department] || 'hello@onyxstudios.ai';
}

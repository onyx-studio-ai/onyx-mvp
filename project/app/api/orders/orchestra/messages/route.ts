import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/mail';
import { stringsWorkflowEmail } from '@/lib/mail-templates';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function getSupabaseClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('order_id');

    if (!orderId) {
      return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
    }

    const db = getSupabaseClient();
    const { data, error } = await db
      .from('orchestra_messages')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { order_id, sender_role, message } = body;

    if (!order_id || !sender_role || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['admin', 'client'].includes(sender_role)) {
      return NextResponse.json({ error: 'Invalid sender_role' }, { status: 400 });
    }

    const db = getSupabaseClient();

    const { data: msg, error } = await db
      .from('orchestra_messages')
      .insert({ order_id, sender_role, message })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Send email notification
    const { data: order } = await db
      .from('orchestra_orders')
      .select('email, order_number')
      .eq('id', order_id)
      .single();

    if (order) {
      const productionEmail = 'produce@onyxstudios.ai';
      const recipientEmail = sender_role === 'admin' ? order.email : productionEmail;
      const senderCategory = sender_role === 'admin' ? 'PRODUCTION' : 'ADMIN';
      
      console.log(`📧 [Orchestra Message] ${sender_role} sent message → notifying ${recipientEmail} (from ${senderCategory})`);

      let dashboardLink = 'https://www.onyxstudios.ai/dashboard';
      try {
        const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        if (SERVICE_KEY) {
          const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
          const { data: linkData } = await adminClient.auth.admin.generateLink({
            type: 'magiclink', email: recipientEmail, options: { redirectTo: 'https://www.onyxstudios.ai/dashboard' },
          });
          if (linkData?.properties?.action_link) dashboardLink = linkData.properties.action_link;
        }
      } catch { /* silent */ }

      const { subject, html } = stringsWorkflowEmail({
        type: 'new_message',
        email: recipientEmail,
        orderNumber: order.order_number,
        orderId: order_id,
        dashboardLink,
        senderRole: sender_role,
        messagePreview: message.substring(0, 200),
      });
      await sendEmail({ category: senderCategory as 'PRODUCTION' | 'ADMIN', to: recipientEmail, subject, html });
    }

    return NextResponse.json(msg);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

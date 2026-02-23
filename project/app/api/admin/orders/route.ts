import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/mail';
import { musicWorkflowEmail, stringsWorkflowEmail, voiceWorkflowEmail, type MusicNotificationType, type StringsNotificationType, type VoiceNotificationType } from '@/lib/mail-templates';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hnblwckpnapsdladcjql.supabase.co';

function getServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, orderType, updates } = body;

    if (!orderId || !orderType || !updates) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getServiceClient();
    const table = orderType === 'music' ? 'music_orders' : orderType === 'strings' ? 'orchestra_orders' : 'voice_orders';

    const { error } = await db.from(table).update(updates).eq('id', orderId);

    if (error) {
      console.error('Admin order update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Send workflow notification if status changed
    if (updates.status) {
      try {
        const { data: orderData } = await db.from(table).select('email, order_number').eq('id', orderId).single();
        if (orderData?.email) {
          let dashboardLink = 'https://www.onyxstudios.ai/dashboard';
          const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
          if (SERVICE_KEY) {
            try {
              const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
              const { data: linkData } = await adminClient.auth.admin.generateLink({
                type: 'magiclink', email: orderData.email, options: { redirectTo: 'https://www.onyxstudios.ai/dashboard' },
              });
              if (linkData?.properties?.action_link) dashboardLink = linkData.properties.action_link;
            } catch { /* silent */ }
          }

          const statusToNotif: Record<string, string> = {
            in_production: (orderType === 'strings' || orderType === 'music') ? 'production_started' : 'in_production',
            demo_ready: 'demos_ready',
            version_ready: 'revision_ready',
            delivered: orderType === 'voice' ? 'version_delivered' : 'delivery_ready',
            completed: orderType === 'music' ? 'final_ready' : orderType === 'voice' ? 'final_ready' : 'order_complete',
          };

          const notifType = statusToNotif[updates.status];
          if (notifType) {
            let emailResult;
            if (orderType === 'music') {
              const estDate = updates.estimated_delivery_date
                ? new Date(updates.estimated_delivery_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                : undefined;
              emailResult = musicWorkflowEmail({ type: notifType as MusicNotificationType, email: orderData.email, orderNumber: orderData.order_number, orderId, dashboardLink, estimatedDate: estDate });
            } else if (orderType === 'strings') {
              emailResult = stringsWorkflowEmail({ type: notifType as StringsNotificationType, email: orderData.email, orderNumber: orderData.order_number, orderId, dashboardLink });
            } else {
              emailResult = voiceWorkflowEmail({ type: notifType as VoiceNotificationType, email: orderData.email, orderNumber: orderData.order_number, orderId, dashboardLink });
            }
            await sendEmail({ category: 'PRODUCTION', to: orderData.email, subject: emailResult.subject, html: emailResult.html });
          }
        }
      } catch (emailErr) {
        console.error('Admin order email notification error:', emailErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Admin order API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

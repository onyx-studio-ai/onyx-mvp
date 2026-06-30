import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/mail';
import { musicWorkflowEmail, stringsWorkflowEmail, voiceWorkflowEmail, type MusicNotificationType, type StringsNotificationType, type VoiceNotificationType } from '@/lib/mail-templates';
import { requireAdmin, getSessionRole } from '@/app/api/admin/_utils/requireAdmin';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

// Columns no admin workflow update should ever change (identity / audit).
const IMMUTABLE_COLUMNS = new Set(['id', 'order_number', 'created_at', 'email', 'stripe_session_id', 'stripe_payment_intent_id', 'user_id']);
// Financial columns only the full admin role may set — production-team users run
// the production workflow (status/delivery), they don't approve payment or pricing.
const FINANCIAL_COLUMNS = new Set(['payment_status', 'paid_at', 'price', 'talent_price', 'amount', 'billing_details', 'refunded_at', 'refund_amount']);

function getServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function PATCH(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Admin database config missing' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { orderId, orderType, updates } = body;

    if (!orderId || !orderType || !updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Harden the (otherwise blind) mass-assignment: drop immutable identity columns,
    // and reject financial columns unless the caller is the full admin role. This is
    // the security boundary — UI gating alone is bypassable.
    const role = getSessionRole(request);
    const safeUpdates: Record<string, unknown> = {};
    const blockedFinancial: string[] = [];
    for (const [k, v] of Object.entries(updates as Record<string, unknown>)) {
      if (IMMUTABLE_COLUMNS.has(k)) continue;
      if (FINANCIAL_COLUMNS.has(k) && role !== 'admin') { blockedFinancial.push(k); continue; }
      safeUpdates[k] = v;
    }
    if (blockedFinancial.length) {
      return NextResponse.json({ error: `Forbidden — admin role required to change: ${blockedFinancial.join(', ')}` }, { status: 403 });
    }
    if (Object.keys(safeUpdates).length === 0) {
      return NextResponse.json({ error: 'No updatable fields' }, { status: 400 });
    }

    const db = getServiceClient();
    const table = orderType === 'music' ? 'music_orders' : orderType === 'strings' ? 'orchestra_orders' : 'voice_orders';

    const { error } = await db.from(table).update(safeUpdates).eq('id', orderId);

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
              // Voice emails are tier-aware (AI vs human) + localized — fetch both,
              // resiliently (the locale column may not be migrated yet).
              const vq = await db.from('voice_orders').select('tier, locale').eq('id', orderId).maybeSingle();
              const vrow = (vq.data || (await db.from('voice_orders').select('tier').eq('id', orderId).maybeSingle()).data) as { tier?: string; locale?: string } | null;
              emailResult = voiceWorkflowEmail({ type: notifType as VoiceNotificationType, email: orderData.email, orderNumber: orderData.order_number, orderId, dashboardLink, tier: vrow?.tier, locale: vrow?.locale });
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

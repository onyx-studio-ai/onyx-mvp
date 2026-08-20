import { NextRequest, NextResponse } from 'next/server';
import { isPlatformCase } from '@/lib/casting';
import { AUTO_APPROVE_DAYS } from '@/lib/auto-approve';
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

    // 交付給客戶時,開始 7 天的自動完成倒數(Wing 2026-08-20)。
    // 為什麼要有:有些客戶拿了檔案就跑,完全忘記回來按確認,配音員的錢就一直卡著。
    // 只對「外部客戶案」生效 —— 平台自營案的帳務聯絡人是我們自己,自動完成沒有意義,
    // 而且會在沒有人看信的情況下無聲結案。客戶可在訂單頁自行延長 7 天,次數不限,
    // 所以真正被自動完成的一定是完全沒動作的單。
    if (orderType === 'voice' && updates.status === 'delivered') {
      try {
        const { data: o } = await db.from('voice_orders').select('email, auto_approve_at').eq('id', orderId).maybeSingle();
        if (o && !isPlatformCase(o.email as string) && !o.auto_approve_at) {
          const at = new Date(Date.now() + AUTO_APPROVE_DAYS * 86400_000).toISOString();
          const { error: aaErr } = await db.from('voice_orders').update({ auto_approve_at: at }).eq('id', orderId);
          if (aaErr) console.error('[admin/orders] auto_approve_at 設定失敗', orderId, aaErr.message);
        }
      } catch (e) { console.error('[admin/orders] auto_approve_at error', orderId, e); }
    }

    // 🔒 治本(Wing 2026-08-05):真人單只要走到 completed,就冪等補一筆 pending 收入
    // ——「可請款餘額」的唯一來源。原本 earnings 只在「指派(assign)」「量產匯入」「客戶
    // 驗收(review)」三處建;平台自營 / 後台直接按「Mark Complete」的真人單(採用建單、
    // per_line 沒跑匯入等)會整條漏掉 → 配音員收款頁顯示「無可請款款項」。這裡是所有真人
    // 單走 completed 的收斂點,idempotent(已有就跳過,不與 review 路徑重複記兩筆)。
    // 單子已有結論(完成)或退回修改中 → 倒數失效,免得修改期間被自動結案。
    if (orderType === 'voice' && (updates.status === 'completed' || updates.status === 'revising' || updates.status === 'in_production')) {
      await db.from('voice_orders').update({ auto_approve_at: null }).eq('id', orderId);
    }

    if (orderType === 'voice' && updates.status === 'completed') {
      try {
        const { data: o } = await db.from('voice_orders')
          .select('talent_id, talent_price, order_number, quote_id, brief_id').eq('id', orderId).maybeSingle();
        const net = Number(o?.talent_price) || 0;
        if (o?.talent_id && net > 0) {
          const { data: existing } = await db.from('talent_earnings').select('id').eq('order_id', orderId).maybeSingle();
          if (!existing) {
            const { error: teErr } = await db.from('talent_earnings').insert({
              talent_id: o.talent_id, order_id: orderId, order_type: 'voice', order_number: o.order_number,
              tier: 'marketplace', order_total: net, commission_rate: 1, commission_amount: net, status: 'pending',
              quote_id: o.quote_id || null, brief_id: o.brief_id || null,
            });
            if (teErr) console.error('[admin/orders] talent_earnings insert on complete failed', o.order_number, teErr.message);
          }
        }
      } catch (e) { console.error('[admin/orders] earnings-on-complete error', orderId, e); }
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
              const vq = await db.from('voice_orders').select('tier, locale, auto_approve_at').eq('id', orderId).maybeSingle();
              const vrow = (vq.data || (await db.from('voice_orders').select('tier').eq('id', orderId).maybeSingle()).data) as { tier?: string; locale?: string; auto_approve_at?: string | null } | null;
              // 交付信要告知自動完成日期(只有外部客戶案有值;平台自營案為 null → 信裡不出現這段)
              emailResult = voiceWorkflowEmail({ type: notifType as VoiceNotificationType, email: orderData.email, orderNumber: orderData.order_number, orderId, dashboardLink, tier: vrow?.tier, locale: vrow?.locale, autoApproveAt: vrow?.auto_approve_at ?? null });
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

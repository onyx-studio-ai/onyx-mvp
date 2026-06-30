import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/mail';
import {
  newOrderNotificationEmail,
  orderConfirmationEmail,
  paymentReceiptEmail,
} from '@/lib/mail-templates';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

type OrderType = 'voice' | 'music' | 'orchestra';
type OrderTable = 'voice_orders' | 'music_orders' | 'orchestra_orders';

function createServiceClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function resolveOrder(orderId: string): Promise<{
  order: any;
  orderType: OrderType;
  orderTable: OrderTable;
}> {
  const db = createServiceClient();

  const { data: voiceOrder } = await db.from('voice_orders').select('*').eq('id', orderId).maybeSingle();
  if (voiceOrder) {
    return { order: voiceOrder, orderType: 'voice', orderTable: 'voice_orders' };
  }

  const { data: musicOrder } = await db.from('music_orders').select('*').eq('id', orderId).maybeSingle();
  if (musicOrder) {
    return { order: musicOrder, orderType: 'music', orderTable: 'music_orders' };
  }

  const { data: orchestraOrder } = await db
    .from('orchestra_orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();
  if (orchestraOrder) {
    return { order: orchestraOrder, orderType: 'orchestra', orderTable: 'orchestra_orders' };
  }

  throw new Error('Order not found in any table');
}

function isOrderAlreadyPaid(order: any): boolean {
  return (
    order?.status === 'paid' ||
    order?.payment_status === 'completed' ||
    order?.payment_status === 'paid'
  );
}

async function ensureUserByEmail(email: string): Promise<string | null> {
  if (!email) return null;
  const adminClient = createServiceClient();
  try {
    const { data } = await adminClient.auth.admin.listUsers();
    const existing = data?.users?.find((u: any) => u.email === email);
    if (existing) return existing.id;

    const { data: created, error } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (error) return null;
    return created?.user?.id ?? null;
  } catch {
    return null;
  }
}

async function generateDashboardMagicLink(email: string): Promise<string> {
  const fallback = 'https://www.onyxstudios.ai/dashboard';
  if (!email) return fallback;

  try {
    const adminClient = createServiceClient();
    const { data } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: fallback },
    });
    return data?.properties?.action_link || fallback;
  } catch {
    return fallback;
  }
}

async function sendOrderEmails(params: {
  order: any;
  orderType: OrderType;
  orderId: string;
  amount: number;
  transactionId: string;
  billingDetails?: any;
}) {
  const { order, orderType, orderId, amount, transactionId, billingDetails } = params;
  const orderNumber = order.order_number || orderId;
  const dashboardLink = await generateDashboardMagicLink(order.email);
  // Emails must show the order's real currency (TWD/CNY/…), not a hardcoded USD.
  const orderCurrency = (order as { currency?: string }).currency || 'USD';

  const confirmPayload = {
    email: order.email,
    orderNumber,
    amount,
    currency: orderCurrency,
    orderType,
    transactionId,
    dashboardLink,
    locale: (order as { locale?: string }).locale,
    orderDetails:
      orderType === 'voice'
        ? {
            projectName: order.project_name,
            language: order.language,
            voiceSelection: order.voice_selection,
            toneStyle: order.tone_style,
            useCase: order.use_case,
            broadcastRights: order.broadcast_rights,
            tier: order.tier,
            duration: order.duration,
          }
        : orderType === 'orchestra'
          ? {
              projectName: order.project_name,
              genre: order.genre,
              tierName: order.tier_name,
              duration: order.duration_minutes,
              usageType: order.usage_type,
            }
          : {
              projectName: order.project_name,
              genre: order.genre,
              vibe: order.vibe,
              mood: order.mood,
              tempo: order.tempo,
              instruments: order.instruments,
            },
  };

  const { subject: confirmSubject, html: confirmHtml } = orderConfirmationEmail(confirmPayload);

  const { subject: receiptSubject, html: receiptHtml } = paymentReceiptEmail({
    email: order.email,
    orderNumber,
    amount,
    currency: orderCurrency,
    transactionId,
    orderType,
    paidAt: new Date().toISOString(),
    locale: (order as { locale?: string }).locale,
    billingDetails: billingDetails
      ? {
          name: billingDetails.fullName || billingDetails.name,
          company: billingDetails.companyName || billingDetails.company_name,
          taxId: billingDetails.vatNumber || billingDetails.vat_number,
        }
      : undefined,
  });

  // Wing monitors hello@ — send the new-paid-order alert there (matches the contact
  // inquiry default recipient, so all order+inquiry notifications land in one inbox).
  const productionEmail = 'hello@onyxstudios.ai';
  const { subject: adminSubject, html: adminHtml } = newOrderNotificationEmail({
    orderNumber,
    orderType,
    email: order.email,
    amount,
    currency: orderCurrency,
    transactionId,
    orderDetails:
      orderType === 'voice'
        ? {
            projectName: order.project_name,
            language: order.language,
            voiceSelection: order.voice_selection,
            tier: order.tier,
            duration: order.duration,
          }
        : orderType === 'orchestra'
          ? {
              projectName: order.project_name,
              genre: order.genre,
              tierName: order.tier_name,
              duration_minutes: order.duration_minutes,
            }
          : {
              projectName: order.project_name,
              genre: order.genre,
              tier: order.tier,
            },
  });

  await sendEmail({ category: 'PRODUCTION', to: order.email, subject: confirmSubject, html: confirmHtml });
  await sendEmail({ category: 'BILLING', to: order.email, subject: receiptSubject, html: receiptHtml });
  await sendEmail({ category: 'PRODUCTION', to: productionEmail, subject: adminSubject, html: adminHtml });
}

export async function finalizeOrderPayment(params: {
  orderId: string;
  transactionId: string;
  amount: number;
  billingDetails?: any;
  licenseeDetails?: any;
}) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error('Supabase payment configuration is incomplete');
  }

  const { orderId, transactionId, amount, billingDetails, licenseeDetails } = params;
  const { order, orderType, orderTable } = await resolveOrder(orderId);

  if (isOrderAlreadyPaid(order)) {
    return {
      alreadyPaid: true,
      orderType,
      orderNumber: order.order_number || orderId,
    };
  }

  const db = createServiceClient();
  const userId = await ensureUserByEmail(order.email);

  // Keep the agreed BASE price intact (do not overwrite with the tax-inclusive
  // total). External tax = Paddle collects + remits it, so it isn't Onyx revenue;
  // the gross paid + tax are recorded separately below.
  const updateData: Record<string, unknown> = {
    status: 'paid',
    payment_status: orderType === 'orchestra' ? 'paid' : 'completed',
    updated_at: new Date().toISOString(),
  };

  if (orderType === 'orchestra') {
    updateData.payment_ref = transactionId;
  } else {
    updateData.transaction_id = transactionId;
    updateData.paid_at = new Date().toISOString();
  }

  if (billingDetails && orderType !== 'orchestra') {
    updateData.billing_details = billingDetails;
  }

  if (licenseeDetails) {
    updateData.licensee_details = licenseeDetails;
  }

  if (userId) {
    updateData.user_id = userId;
  }

  const { error } = await db.from(orderTable).update(updateData).eq('id', orderId);
  if (error) {
    throw new Error(`Order update failed: ${error.message}`);
  }

  // Record what was actually charged + the tax Paddle added on top, separately
  // from the base price. Best-effort: if these columns aren't migrated yet, the
  // base price is already preserved above, so finalize must NOT fail here.
  try {
    const basePrice = Number(order.price) || 0;
    const grossPaid = Number(amount) || 0;
    const taxAmount = Math.max(0, Math.round((grossPaid - basePrice) * 100) / 100);
    await db.from(orderTable).update({ amount_paid: grossPaid, tax_amount: taxAmount }).eq('id', orderId);
  } catch { /* columns not migrated — base price already kept, gross is on Paddle */ }

  try {
    await sendOrderEmails({ order, orderType, orderId, amount, transactionId, billingDetails });
  } catch (error) {
    console.error('[Payment] Email send failed:', error);
  }

  return {
    alreadyPaid: false,
    orderType,
    orderNumber: order.order_number || orderId,
  };
}

// Combined "pay-all" for a multi-role casting project: one Paddle payment covers
// every sub-order under the brief. Marks each PENDING sub-order paid WITHOUT
// touching its own price (unlike finalizeOrderPayment, which overwrites price with
// the single charge amount). Sends one client confirmation + an internal notice.
export async function finalizeProjectPayment(params: {
  briefId: string; transactionId: string; billingDetails?: any; licenseeDetails?: any;
}) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Supabase payment configuration is incomplete');
  const { briefId, transactionId, billingDetails, licenseeDetails } = params;
  const db = createServiceClient();
  const { data: subs } = await db.from('voice_orders')
    .select('id, email, order_number, payment_status, currency, price').eq('brief_id', briefId);
  const pending = (subs || []).filter((o) => o.payment_status !== 'paid' && o.payment_status !== 'completed');
  if (!pending.length) return { alreadyPaid: true, paid: 0 };

  const email = pending[0].email as string;
  const userId = await ensureUserByEmail(email);
  const now = new Date().toISOString();
  for (const o of pending) {
    const upd: Record<string, unknown> = {
      status: 'paid', payment_status: 'completed', paid_at: now, transaction_id: transactionId, updated_at: now,
    };
    if (billingDetails) upd.billing_details = billingDetails;
    if (licenseeDetails) upd.licensee_details = licenseeDetails;
    if (userId) upd.user_id = userId;
    await db.from('voice_orders').update(upd).eq('id', o.id); // keep each sub-order's own price
  }

  try {
    const link = await generateDashboardMagicLink(email);
    sendEmail({ category: 'PRODUCTION', to: email,
      subject: `付款成功 · ${pending.length} 個角色已進入製作`,
      html: `<p>已收到您的付款,本專案 ${pending.length} 個角色的配音已開始製作。</p><p><a href="${link}">查看製作進度</a></p>` }).catch(() => {});
    sendEmail({ category: 'PRODUCTION', to: 'produce@onyxstudios.ai',
      subject: `專案已付款 · ${pending.length} 子單`,
      html: `<p>Brief ${briefId}: ${pending.length} sub-orders paid (txn ${transactionId}).</p>` }).catch(() => {});
  } catch { /* email best-effort */ }

  return { alreadyPaid: false, paid: pending.length, orderNumber: pending[0].order_number };
}

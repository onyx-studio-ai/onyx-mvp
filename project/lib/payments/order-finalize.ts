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

  const confirmPayload = {
    email: order.email,
    orderNumber,
    amount,
    currency: 'USD' as const,
    orderType,
    transactionId,
    dashboardLink,
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
    currency: 'USD',
    transactionId,
    orderType,
    paidAt: new Date().toISOString(),
    billingDetails: billingDetails
      ? {
          name: billingDetails.fullName || billingDetails.name,
          company: billingDetails.companyName || billingDetails.company_name,
          taxId: billingDetails.vatNumber || billingDetails.vat_number,
        }
      : undefined,
  });

  const productionEmail = 'produce@onyxstudios.ai';
  const { subject: adminSubject, html: adminHtml } = newOrderNotificationEmail({
    orderNumber,
    orderType,
    email: order.email,
    amount,
    currency: 'USD',
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

  const updateData: Record<string, unknown> = {
    status: 'paid',
    payment_status: orderType === 'orchestra' ? 'paid' : 'completed',
    updated_at: new Date().toISOString(),
    price: amount,
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

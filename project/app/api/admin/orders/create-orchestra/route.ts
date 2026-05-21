import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/mail';
import { orderConfirmationEmail } from '@/lib/mail-templates';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { isValidPaymentMethod, OFFLINE_PAYMENT_METHODS } from '@/lib/payments/methods';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function generateOrderNumber(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `ORK-${yyyy}${mm}${dd}-${rand}`;
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const {
      email,
      projectName,
      tier,
      tierName,
      durationMinutes,
      genre,
      description,
      referenceUrl,
      usageType,
      price,
      paymentMethod,        // 'send_invoice' | 'already_paid'
      paymentChannel,       // PaymentMethod enum
      paymentReference,
      paymentNotes,
    } = body;

    if (!email || price == null || price <= 0) {
      return NextResponse.json({ error: 'Missing required fields (email, price)' }, { status: 400 });
    }

    const db = getAdminClient();
    const orderNumber = generateOrderNumber();
    const isPaid = paymentMethod === 'already_paid';

    let resolvedPaymentChannel: string | null = null;
    let resolvedPaymentRef: string | null = null;
    if (isPaid) {
      const channel = (typeof paymentChannel === 'string' && paymentChannel.length > 0)
        ? paymentChannel
        : 'admin_manual';
      if (!isValidPaymentMethod(channel)) {
        return NextResponse.json({ error: `Invalid paymentChannel: ${channel}` }, { status: 400 });
      }
      if (OFFLINE_PAYMENT_METHODS.includes(channel) && !paymentReference?.toString().trim()) {
        return NextResponse.json(
          { error: 'Offline payments require a payment reference' },
          { status: 400 },
        );
      }
      resolvedPaymentChannel = channel;
      resolvedPaymentRef = paymentReference ? String(paymentReference).trim() : null;
    }

    const orderData = {
      order_number: orderNumber,
      email: email.trim().toLowerCase(),
      project_name: projectName || null,
      tier: tier || 'tier3',
      tier_name: tierName || 'Television Standard',
      duration_minutes: durationMinutes || 0,
      price,
      genre: genre || '',
      description: description || '',
      reference_url: referenceUrl || '',
      usage_type: usageType || 'Other',
      status: isPaid ? 'paid' : 'pending_payment',
      payment_status: isPaid ? 'completed' : 'unpaid',
      payment_method: resolvedPaymentChannel,
      // orchestra_orders has its own payment_ref column (legacy) — reuse it
      payment_ref: resolvedPaymentRef,
      payment_notes: isPaid && paymentNotes ? String(paymentNotes).trim() : null,
      notes: null,
    };

    const { data, error } = await db
      .from('orchestra_orders')
      .insert(orderData)
      .select('id, order_number')
      .single();

    if (error) {
      console.error('[Admin Create Orchestra Order] Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let dashboardLink = 'https://www.onyxstudios.ai/dashboard';
    let emailSent = false;
    let emailError = '';

    try {
      const { data: existingUsers } = await db.auth.admin.listUsers();
      const userExists = existingUsers?.users?.find(
        (u: { email?: string }) => u.email === orderData.email,
      );
      if (!userExists) {
        await db.auth.admin.createUser({
          email: orderData.email,
          email_confirm: true,
        });
      }
      const { data: linkData } = await db.auth.admin.generateLink({
        type: 'magiclink',
        email: orderData.email,
        options: { redirectTo: 'https://www.onyxstudios.ai/dashboard' },
      });
      if (linkData?.properties?.action_link) {
        dashboardLink = linkData.properties.action_link;
      }
    } catch (authErr) {
      console.error('[Admin Create Orchestra Order] Auth error:', authErr);
    }

    try {
      const emailResult = orderConfirmationEmail({
        orderNumber,
        email: orderData.email,
        orderType: 'orchestra',
        amount: price,
        currency: 'USD',
        transactionId: isPaid ? `ADMIN-${orderNumber}` : 'PENDING',
        dashboardLink,
        orderDetails: {
          projectName: projectName || 'Orchestra Production',
          tier: tierName || tier || 'Orchestra Order',
        },
      });
      const subject = isPaid
        ? `Your Orchestra Order Is Confirmed — #${orderNumber}`
        : `Action Required: Complete Payment for Order #${orderNumber}`;
      const result = await sendEmail({
        category: isPaid ? 'PRODUCTION' : 'BILLING',
        to: orderData.email,
        subject,
        html: emailResult.html,
      });
      emailSent = result?.success ?? true;
    } catch (mailErr) {
      console.error('[Admin Create Orchestra Order] Email error:', mailErr);
      emailError = mailErr instanceof Error ? mailErr.message : 'Email failed';
    }

    return NextResponse.json({
      success: true,
      orderId: data.id,
      orderNumber: data.order_number,
      emailSent,
      emailError,
    });
  } catch (err) {
    console.error('[Admin Create Orchestra Order] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

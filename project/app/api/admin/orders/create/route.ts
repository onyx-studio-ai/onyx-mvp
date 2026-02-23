import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/mail';
import { orderConfirmationEmail } from '@/lib/mail-templates';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const USE_CASE_CODES: Record<string, string> = {
  'Social Media': 'SM',
  'Advertisement': 'AD',
  'Corporate': 'CO',
  'Broadcast': 'BR',
  'E-Learning': 'EL',
  'Podcast': 'PD',
  'Audiobook': 'AB',
  'IVR': 'IV',
};

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function generateOrderNumber(db: ReturnType<typeof getAdminClient>, useCase: string): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const ucCode = USE_CASE_CODES[useCase] || useCase.substring(0, 2).toUpperCase();

  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);

  const { count } = await db
    .from('voice_orders')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', dayStart.toISOString())
    .lte('created_at', dayEnd.toISOString());

  const seq = String((count ?? 0) + 1).padStart(3, '0');
  return `VO-${yy}${mm}${dd}T3${ucCode}YI${seq}`;
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const {
      email,
      projectName,
      language,
      scriptText,
      price,
      talentId,
      toneStyle,
      useCase,
      paymentMethod,
    } = body;

    if (!email || !scriptText || !language || price == null || price <= 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getAdminClient();
    const resolvedUseCase = useCase || 'Advertisement';
    const orderNumber = await generateOrderNumber(db, resolvedUseCase);
    const isPaid = paymentMethod === 'already_paid';

    const orderData = {
      order_number: orderNumber,
      email: email.trim().toLowerCase(),
      language,
      voice_selection: '',
      script_text: scriptText.trim(),
      tone_style: toneStyle || 'Professional',
      use_case: resolvedUseCase,
      broadcast_rights: true,
      tier: 'tier-3',
      duration: 0,
      price,
      project_name: projectName || '',
      talent_id: talentId || null,
      talent_price: 0,
      billing_details: null,
      status: isPaid ? 'paid' : 'pending_payment',
      payment_status: isPaid ? 'completed' : 'pending',
      paid_at: isPaid ? new Date().toISOString() : null,
      revision_count: 0,
      max_revisions: 1,
      rights_level: 'global',
    };

    const { data, error } = await db
      .from('voice_orders')
      .insert(orderData)
      .select('id, order_number')
      .single();

    if (error) {
      console.error('[Admin Create Order] Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let dashboardLink = 'https://www.onyxstudios.ai/dashboard';
    let emailSent = false;
    let emailError = '';

    try {
      const { data: existingUsers } = await db.auth.admin.listUsers();
      const userExists = existingUsers?.users?.find(
        (u: { email?: string }) => u.email === orderData.email
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
      console.error('[Admin Create Order] Auth error:', authErr);
    }

    try {
      const emailResult = orderConfirmationEmail({
        orderNumber,
        email: orderData.email,
        orderType: 'voice',
        amount: price,
        currency: 'USD',
        transactionId: isPaid ? `ADMIN-${orderNumber}` : 'PENDING',
        dashboardLink,
        orderDetails: {
          projectName: projectName || 'Live Studio Order',
          tier: '100% Live Studio',
        },
      });
      const subject = isPaid
        ? `Your 100% Live Studio Order Is Confirmed — #${orderNumber}`
        : `Action Required: Complete Payment for Order #${orderNumber}`;
      const result = await sendEmail({
        category: isPaid ? 'PRODUCTION' : 'BILLING',
        to: orderData.email,
        subject,
        html: emailResult.html,
      });
      emailSent = result?.success ?? true;
    } catch (mailErr) {
      console.error('[Admin Create Order] Email error:', mailErr);
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
    console.error('[Admin Create Order] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

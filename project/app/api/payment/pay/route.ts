import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { TAPPAY_CONFIG } from '@/lib/config';
import { SANCTIONED_COUNTRY_NAMES } from '@/lib/countries';
import { sendEmail, sendInternalError } from '@/lib/mail';
import { orderConfirmationEmail, paymentReceiptEmail, newOrderNotificationEmail } from '@/lib/mail-templates';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hnblwckpnapsdladcjql.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function createServiceClient() {
  const key = SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

// HARDCODED TAPPAY CONFIG - BYPASSING .ENV
const TAPPAY_PARTNER_KEY = TAPPAY_CONFIG.partnerKey;
const TAPPAY_MERCHANT_ID = TAPPAY_CONFIG.merchantId;
const TAPPAY_APP_ID = TAPPAY_CONFIG.appId;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('📦 [Payment API] Received body:', {
      hasPrime: !!body.prime,
      hasOrderId: !!body.orderId,
      amount: body.amount,
      amountType: typeof body.amount
    });

    console.log('🔑 [Payment API] TapPay Config:', {
      environment: TAPPAY_CONFIG.environment,
      appId: TAPPAY_APP_ID,
      merchantId: TAPPAY_MERCHANT_ID,
      hasPartnerKey: !!TAPPAY_PARTNER_KEY
    });

    const { prime, orderId, amount, cardholder, orderEmail, orderNumber, orderType: clientOrderType } = body;

    const missingFields = [];
    if (!prime) missingFields.push('prime');
    if (!orderId) missingFields.push('orderId');
    if (amount === undefined || amount === null) missingFields.push('amount');

    if (missingFields.length > 0) {
      console.error('❌ [Payment API] Missing fields:', missingFields);
      return NextResponse.json(
        {
          error: 'Missing required fields',
          missingFields,
          received: { prime: !!prime, orderId: !!orderId, amount }
        },
        { status: 400 }
      );
    }

    if (typeof amount !== 'number' || amount <= 0) {
      console.error('❌ [Payment API] Invalid amount:', amount);
      return NextResponse.json(
        { error: 'Amount must be a positive number', received: amount },
        { status: 400 }
      );
    }

    const billingCountry = body.billingDetails?.country;
    if (billingCountry && SANCTIONED_COUNTRY_NAMES.includes(billingCountry)) {
      console.error('🚫 [Payment API] Sanctioned country rejected:', billingCountry);
      return NextResponse.json(
        {
          error: 'Service unavailable in your region',
          message: 'Onyx Studios is unable to process payments from this country due to international trade compliance regulations. Please refer to our Terms of Service §14 and Acceptable Use Policy §12 for details.',
        },
        { status: 403 }
      );
    }

    const serviceSupabase = createServiceClient();

    console.log('🔍 [Payment API] Searching for order ID:', orderId);

    let { data: order, error: orderError } = await serviceSupabase
      .from('voice_orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();

    let orderTable = 'voice_orders';
    let orderType = 'voice';

    if (orderError || !order) {
      console.log('⚠️ [Payment API] Not found in voice_orders table, checking music_orders...');

      const { data: musicOrder, error: musicError } = await serviceSupabase
        .from('music_orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      if (musicError || !musicOrder) {
        console.log('⚠️ [Payment API] Not found in music_orders, checking orchestra_orders...');
        const { data: orchestraOrder, error: orchestraError } = await serviceSupabase
          .from('orchestra_orders')
          .select('*')
          .eq('id', orderId)
          .maybeSingle();

        if (orchestraError || !orchestraOrder) {
          if (orderEmail && orderNumber) {
            console.log('⚠️ [Payment API] Using client-provided order data as fallback');
            order = { id: orderId, email: orderEmail, order_number: orderNumber, status: 'pending_payment' };
            const tableMap: Record<string, string> = { music: 'music_orders', voice: 'voice_orders', orchestra: 'orchestra_orders' };
            orderTable = tableMap[clientOrderType] || 'voice_orders';
            orderType = clientOrderType || 'music';
          } else {
            console.error('❌ [Payment API] Order not found in any table');
            return NextResponse.json(
              { error: 'Order not found in any table' },
              { status: 404 }
            );
          }
        } else {
          order = orchestraOrder;
          orderTable = 'orchestra_orders';
          orderType = 'orchestra';
          console.log('✅ [Payment API] Found in orchestra_orders table');
        }
      } else {
        order = musicOrder;
        orderTable = 'music_orders';
        orderType = 'music';
        console.log('✅ [Payment API] Found in music_orders table');
      }
    } else {
      console.log('✅ [Payment API] Found in orders table');
      orderType = order.order_type || 'voice';
    }

    console.log('📋 [Payment API] Order details:', {
      id: order.id,
      email: order.email,
      status: order.status,
      table: orderTable,
      type: orderType
    });

    const orderLabel = orderType === 'music' ? 'Music Order' : orderType === 'orchestra' ? 'Live Strings Order' : 'Voice Order';

    const tappayPayload = {
      prime,
      partner_key: TAPPAY_PARTNER_KEY,
      merchant_id: TAPPAY_MERCHANT_ID,
      details: `${orderLabel} #${order.order_number || orderId}`,
      amount: Math.round(amount),
      cardholder: {
        phone_number: '+886912345678',
        name: cardholder?.name || 'Customer',
        email: order.email,
      },
      remember: false,
    };

    // Determine TapPay endpoint based on environment
    const targetUrl = TAPPAY_CONFIG.environment === 'production'
      ? 'https://api.tappaysdk.com/tpc/payment/pay-by-prime'
      : 'https://sandbox.tappaysdk.com/tpc/payment/pay-by-prime';

    console.log('🚀 [TAPPAY] PAYING TO:', targetUrl);
    console.log('📦 [TAPPAY] PAYLOAD APP_ID:', TAPPAY_APP_ID);
    console.log('📦 [TAPPAY] PAYLOAD MERCHANT_ID:', TAPPAY_MERCHANT_ID);
    console.log('📦 [TAPPAY] PAYLOAD PARTNER_KEY:', TAPPAY_PARTNER_KEY ? `${TAPPAY_PARTNER_KEY.substring(0, 20)}...` : 'MISSING');
    console.log('💰 [TAPPAY] AMOUNT:', Math.round(amount));
    console.log('📧 [TAPPAY] BUYER EMAIL:', order.email);
    console.log('🏷️ [TAPPAY] ORDER DETAILS:', `${orderLabel} #${order.order_number || orderId}`);

    const tappayResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TAPPAY_PARTNER_KEY,
      },
      body: JSON.stringify(tappayPayload),
    });

    console.log('📡 [TAPPAY] Response status:', tappayResponse.status);

    const tappayResult = await tappayResponse.json();
    console.log('📬 [TAPPAY] Full Response:', JSON.stringify(tappayResult, null, 2));

    if (tappayResult.status === 0) {
      console.log('✅ [TAPPAY] Payment successful!', {
        transactionId: tappayResult.rec_trade_id,
        orderId
      });

      let userId = null;

      if (SERVICE_ROLE_KEY) {
        try {
          const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false }
          });
          const { data: existingUser } = await adminClient.auth.admin.listUsers();
          const userExists = existingUser?.users?.find((u: any) => u.email === order.email);

          if (userExists) {
            userId = userExists.id;
          } else {
            const { data: newUser, error: authError } = await adminClient.auth.admin.createUser({
              email: order.email,
              email_confirm: true,
            });

            if (!authError && newUser?.user) {
              userId = newUser.user.id;
            }
          }
        } catch (authError) {
          console.error('⚠️ [Auth] Error handling user account:', authError);
        }
      }

      console.log('💾 [Database] Updating order in table:', orderTable);
      const updateData: any = {
        status: 'paid',
        payment_status: orderType === 'orchestra' ? 'paid' : 'completed',
        price: amount,
        updated_at: new Date().toISOString(),
      };

      if (orderType === 'orchestra') {
        updateData.payment_ref = tappayResult.rec_trade_id;
      } else {
        updateData.paid_at = new Date().toISOString();
        updateData.transaction_id = tappayResult.rec_trade_id;
      }

      if (body.billingDetails && orderType !== 'orchestra') {
        updateData.billing_details = body.billingDetails;
      }

      if (body.licenseeDetails) {
        updateData.licensee_details = body.licenseeDetails;
      }

      if (userId) {
        updateData.user_id = userId;
      }

      const { error: updateError } = await serviceSupabase
        .from(orderTable)
        .update(updateData)
        .eq('id', orderId);

      if (updateError) {
        console.error('❌ [Database] Error updating order status:', updateError);
        console.error('❌ [Database] Table:', orderTable, 'Order ID:', orderId);
      } else {
        console.log('✅ [Database] Order marked as paid in', orderTable, ':', orderId);
      }

      // Generate magic link for dashboard access
      let dashboardLink = 'https://www.onyxstudios.ai/dashboard';
      try {
        const linkClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data: linkData } = await linkClient.auth.admin.generateLink({
          type: 'magiclink',
          email: order.email,
          options: { redirectTo: 'https://www.onyxstudios.ai/dashboard' },
        });
        if (linkData?.properties?.action_link) dashboardLink = linkData.properties.action_link;
      } catch (e) {
        console.warn('[Payment] Magic link generation failed:', e);
      }

      // Send emails sequentially to avoid Resend rate limit (2 req/sec)
      console.log('📧 [Email] Sending confirmation to:', order.email);
      const confirmPayload = {
        email: order.email,
        orderNumber: order.order_number || orderId,
        amount,
        currency: 'TWD' as const,
        orderType: orderType as 'voice' | 'music' | 'orchestra',
        transactionId: tappayResult.rec_trade_id,
        dashboardLink,
        orderDetails: orderType === 'voice' ? {
          projectName: order.project_name,
          language: order.language,
          voiceSelection: order.voice_selection,
          toneStyle: order.tone_style,
          useCase: order.use_case,
          broadcastRights: order.broadcast_rights,
          tier: order.tier,
          duration: order.duration,
        } : orderType === 'orchestra' ? {
          projectName: order.project_name,
          genre: order.genre,
          tierName: order.tier_name,
          duration: order.duration_minutes,
          usageType: order.usage_type,
        } : {
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
        orderNumber: order.order_number || orderId,
        amount,
        currency: 'TWD',
        transactionId: tappayResult.rec_trade_id,
        orderType: orderType as 'voice' | 'music' | 'orchestra',
        paidAt: new Date().toISOString(),
        billingDetails: body.billingDetails ? {
          name: body.billingDetails.full_name,
          company: body.billingDetails.company_name,
          taxId: body.billingDetails.tax_id,
        } : undefined,
      });

      const productionEmail = 'produce@onyxstudios.ai';
      console.log('📧 [Email] Sending new order notification to production:', productionEmail);
      const { subject: adminSubject, html: adminHtml } = newOrderNotificationEmail({
        orderNumber: order.order_number || orderId,
        orderType: orderType as 'voice' | 'music' | 'orchestra',
        email: order.email,
        amount,
        currency: 'TWD',
        transactionId: tappayResult.rec_trade_id,
        orderDetails: orderType === 'voice' ? {
          projectName: order.project_name,
          language: order.language,
          voiceSelection: order.voice_selection,
          tier: order.tier,
          duration: order.duration,
        } : orderType === 'orchestra' ? {
          projectName: order.project_name,
          genre: order.genre,
          tierName: order.tier_name,
          duration_minutes: order.duration_minutes,
        } : {
          projectName: order.project_name,
          genre: order.genre,
          tier: order.tier,
        },
      });

      try {
        await sendEmail({ category: 'PRODUCTION', to: order.email, subject: confirmSubject, html: confirmHtml });
        await sendEmail({ category: 'BILLING', to: order.email, subject: receiptSubject, html: receiptHtml });
        await sendEmail({ category: 'PRODUCTION', to: productionEmail, subject: adminSubject, html: adminHtml });
      } catch (err) {
        console.error('[Email] Sequential send error:', err);
      }

      return NextResponse.json({
        success: true,
        transactionId: tappayResult.rec_trade_id,
        orderId,
        orderNumber: order.order_number,
        message: 'Payment successful! Check your email for confirmation.',
      });
    } else {
      console.error('❌ [TAPPAY] Payment FAILED:', {
        status: tappayResult.status,
        message: tappayResult.msg,
        fullResponse: tappayResult
      });
      return NextResponse.json(
        {
          error: 'Payment failed',
          message: tappayResult.msg || 'Unknown error',
          tappayStatus: tappayResult.status
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Payment API Error:', error);
    await sendInternalError('Payment API Critical Error', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

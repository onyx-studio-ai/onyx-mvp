import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const COMMISSION_RATE = 0.10;

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const talentId = searchParams.get('talent_id');
  const status = searchParams.get('status');

  const supabase = getAdminClient();
  let query = supabase
    .from('talent_earnings')
    .select('*, talents(name, email, payment_method, payment_details)')
    .order('created_at', { ascending: false });

  if (talentId) query = query.eq('talent_id', talentId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ earnings: data });
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const { orderId, orderType, orderNumber, tier, talentId, orderTotal } = body;

    if (!orderId || !orderType || !orderNumber || !tier || !talentId || orderTotal == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (tier === 'tier-3') {
      return NextResponse.json({
        skipped: true,
        reason: 'Tier 3 (100% Live Studio) payments are handled offline',
      });
    }

    const supabase = getAdminClient();

    const { data: existing } = await supabase
      .from('talent_earnings')
      .select('id')
      .eq('order_id', orderId)
      .eq('talent_id', talentId)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Earning already recorded for this order' }, { status: 409 });
    }

    const commissionAmount = Math.round(orderTotal * COMMISSION_RATE * 100) / 100;

    const { data, error } = await supabase
      .from('talent_earnings')
      .insert({
        talent_id: talentId,
        order_id: orderId,
        order_type: orderType,
        order_number: orderNumber,
        tier,
        order_total: orderTotal,
        commission_rate: COMMISSION_RATE,
        commission_amount: commissionAmount,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, earning: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const { ids, status: newStatus, payout_id } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Missing earning ids array' }, { status: 400 });
    }
    if (newStatus !== 'paid' && newStatus !== 'pending') {
      return NextResponse.json({ error: 'Status must be "paid" or "pending"' }, { status: 400 });
    }

    const supabase = getAdminClient();

    const updateData: Record<string, string> = { status: newStatus };
    if (payout_id) updateData.payout_id = payout_id;

    const { data, error } = await supabase
      .from('talent_earnings')
      .update(updateData)
      .in('id', ids)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated: data?.length || 0 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

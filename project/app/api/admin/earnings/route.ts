import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminOnly } from '@/app/api/admin/_utils/requireAdmin';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const COMMISSION_RATE = 0.25;

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminOnly(request);
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
  const unauthorized = requireAdminOnly(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const supabase = getAdminClient();

    // Manual / offline deal: Wing keys in the real client total + the
    // talent payout independently (they may differ wildly — talent never
    // sees the real total). cost_breakdown captures where the gap went.
    if (body.orderType === 'manual') {
      const { talentId, orderNumber, realTotal, payoutAmount, costBreakdown, localFolderPath } = body;

      if (!talentId || !orderNumber || realTotal == null || payoutAmount == null) {
        return NextResponse.json(
          { error: 'Manual entry needs talentId, orderNumber, realTotal, payoutAmount' },
          { status: 400 }
        );
      }

      const { data: existing } = await supabase
        .from('talent_earnings')
        .select('id')
        .eq('order_type', 'manual')
        .eq('order_number', orderNumber)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: `Manual order number "${orderNumber}" already exists` },
          { status: 409 }
        );
      }

      const syntheticOrderId = crypto.randomUUID();

      const { data, error } = await supabase
        .from('talent_earnings')
        .insert({
          talent_id: talentId,
          order_id: syntheticOrderId,
          order_type: 'manual',
          order_number: orderNumber,
          tier: 'manual',
          order_total: realTotal,
          commission_rate: realTotal > 0 ? payoutAmount / realTotal : 0,
          commission_amount: payoutAmount,
          status: 'pending',
          cost_breakdown: costBreakdown || {},
          local_folder_path: localFolderPath || null,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, earning: data });
    }

    // Platform order (existing flow, called by Paddle webhook)
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

const CHECKLIST_FIELDS = [
  'contract_filed',
  'invoice_sent',
  'payment_received',
  'talent_paid',
  'delivered',
] as const;

type ChecklistField = typeof CHECKLIST_FIELDS[number];

export async function PATCH(request: NextRequest) {
  const unauthorized = requireAdminOnly(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const supabase = getAdminClient();

    // Checklist update: { id, checklist: { contract_filed: bool, ... } }
    // For each key set true, also stamp `<key>_at` with now(); for false,
    // clear the timestamp so unchecking erases the record cleanly.
    if (body.checklist && body.id) {
      const updates: Record<string, unknown> = {};
      const now = new Date().toISOString();
      const checklist = body.checklist as Partial<Record<ChecklistField, boolean>>;
      for (const field of CHECKLIST_FIELDS) {
        if (field in checklist) {
          const value = !!checklist[field];
          updates[field] = value;
          updates[`${field}_at`] = value ? now : null;
        }
      }
      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No valid checklist fields provided' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('talent_earnings')
        .update(updates)
        .eq('id', body.id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, earning: data });
    }

    // Existing bulk status update (mark paid/pending)
    const { ids, status: newStatus, payout_id } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Missing earning ids array' }, { status: 400 });
    }
    if (newStatus !== 'paid' && newStatus !== 'pending') {
      return NextResponse.json({ error: 'Status must be "paid" or "pending"' }, { status: 400 });
    }

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

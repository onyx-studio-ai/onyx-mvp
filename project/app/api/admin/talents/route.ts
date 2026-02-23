import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET() {
  try {
    const db = getAdminClient();
    const { data: talents, error } = await db
      .from('talents')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: earnings } = await db
      .from('talent_earnings')
      .select('talent_id, status, commission_amount');

    const earningsMap: Record<string, { pending: number; paid: number; total: number; count: number }> = {};
    for (const e of (earnings || [])) {
      if (!earningsMap[e.talent_id]) earningsMap[e.talent_id] = { pending: 0, paid: 0, total: 0, count: 0 };
      const amount = Number(e.commission_amount) || 0;
      earningsMap[e.talent_id].total += amount;
      earningsMap[e.talent_id].count += 1;
      if (e.status === 'paid') earningsMap[e.talent_id].paid += amount;
      else earningsMap[e.talent_id].pending += amount;
    }

    const enriched = (talents || []).map((t: any) => ({
      ...t,
      earnings_summary: earningsMap[t.id] || null,
    }));

    return NextResponse.json(enriched);
  } catch (err) {
    console.error('[Admin Talents] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = getAdminClient();

    const { data, error } = await db
      .from('talents')
      .insert([body])
      .select('*')
      .single();

    if (error) {
      console.error('[Admin Talents] INSERT error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[Admin Talents] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing talent id' }, { status: 400 });
    }

    const db = getAdminClient();
    const { data, error } = await db
      .from('talents')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('[Admin Talents] UPDATE error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[Admin Talents] PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing talent id' }, { status: 400 });
    }

    const db = getAdminClient();
    const { error } = await db
      .from('talents')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[Admin Talents] DELETE error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Admin Talents] DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

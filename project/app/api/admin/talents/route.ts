import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient, supabaseErrorResponse } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const db = getSupabaseServiceClient();
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
    return supabaseErrorResponse(err, 'admin/talents GET');
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const db = getSupabaseServiceClient();

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
    return supabaseErrorResponse(err, 'admin/talents POST');
  }
}

export async function PATCH(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing talent id' }, { status: 400 });
    }

    const db = getSupabaseServiceClient();
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
    return supabaseErrorResponse(err, 'admin/talents PATCH');
  }
}

export async function DELETE(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing talent id' }, { status: 400 });
    }

    const db = getSupabaseServiceClient();

    // Unlink any applications pointing at this talent first — otherwise the
    // talent_applications.talent_id foreign key blocks the delete (which is
    // why any talent auto-created from an approved application couldn't be
    // removed). The application records are kept as history, just unlinked.
    await db.from('talent_applications').update({ talent_id: null }).eq('talent_id', id);

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
    return supabaseErrorResponse(err, 'admin/talents DELETE');
  }
}

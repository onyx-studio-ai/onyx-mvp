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

    // Which talents are casting-invite accounts? These are the lightweight rows
    // auto-created when a talent is invited to audition (magic-link, no signup).
    // They have no application_id, so the onboarding button doesn't apply to them.
    // ONE query — pull the distinct set of talent_id referenced by casting_invites
    // and flag membership; we deliberately return only a boolean, never the
    // invite token / brief content / any other casting column.
    const { data: castingInvites } = await db
      .from('casting_invites')
      .select('talent_id, name')
      .not('talent_id', 'is', null);
    const castingTalentIds = new Set((castingInvites || []).map((r) => r.talent_id));
    // 邀請時填的「真名」(如 李語寧 → 藝名 寧靜有聲):進搜尋 haystack + 卡片顯示,
    // 不然用真名在後台永遠搜不到人(2026-07-15 實際發生)。只給名字,不外洩其他邀請欄位。
    const inviteNames = new Map<string, string[]>();
    for (const r of castingInvites || []) {
      const n = String(r.name || '').trim();
      if (!n) continue;
      const arr = inviteNames.get(r.talent_id) || [];
      if (!arr.includes(n)) arr.push(n);
      inviteNames.set(r.talent_id, arr);
    }

    const earningsMap: Record<string, { pending: number; paid: number; total: number; count: number }> = {};
    for (const e of (earnings || [])) {
      if (!earningsMap[e.talent_id]) earningsMap[e.talent_id] = { pending: 0, paid: 0, total: 0, count: 0 };
      const amount = Number(e.commission_amount) || 0;
      earningsMap[e.talent_id].total += amount;
      earningsMap[e.talent_id].count += 1;
      if (e.status === 'paid') earningsMap[e.talent_id].paid += amount;
      else earningsMap[e.talent_id].pending += amount;
    }

    // Strip columns that are purely secret machinery — one-time signing tokens
    // and internal linkage the admin UI never renders. This page is for viewing
    // a talent's *profile* (voice conditions / demos / credits), not their
    // secrets. Encrypted bank details already live in the separate restricted
    // talent_payout_details table + /admin/payout-details (on-demand decrypt);
    // the legacy plaintext payment_details/payment_method on this row stay
    // available for the existing Edit form but are never shown in the new
    // profile card.
    const STRIP = [
      'voice_id_token', 'voice_id_token_expires',
      'telegram_link_token', 'telegram_chat_id',
      'auth_user_id',
    ] as const;
    const enriched = (talents || []).map((t: any) => {
      const clean = { ...t } as Record<string, unknown>;
      for (const k of STRIP) delete clean[k];
      return {
        ...clean,
        earnings_summary: earningsMap[t.id] || null,
        is_casting_invite: castingTalentIds.has(t.id),
        invite_names: (inviteNames.get(t.id) || []).filter((n) => n !== t.name),
      };
    });

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

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';

/*
  Admin marketplace view — Onyx mediates briefs + quotes (managed model).
  GET: all briefs + all quotes (with talent name/email) so Onyx can coordinate.
  PATCH: move a brief or quote through its states; accepting a quote awards the
  brief and auto-rejects the other live quotes.

  Degrades gracefully (empty + unavailable) if the marketplace tables aren't
  migrated yet.
*/

const BRIEF_STATUSES = ['open', 'reviewing', 'awarded', 'closed', 'cancelled'];
const QUOTE_STATUSES = ['submitted', 'shortlisted', 'accepted', 'rejected', 'withdrawn'];

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const db = getSupabaseServiceClient();
    const { data: briefs, error } = await db
      .from('marketplace_briefs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    const { data: quotes } = await db
      .from('marketplace_quotes')
      .select('*, talents(name, email)')
      .order('created_at', { ascending: false });
    return NextResponse.json({ briefs: briefs || [], quotes: quotes || [] });
  } catch {
    return NextResponse.json({ briefs: [], quotes: [], unavailable: true });
  }
}

export async function PATCH(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const db = getSupabaseServiceClient();
    const { kind, id, status } = await request.json();
    const now = new Date().toISOString();
    if (!id || !status) return NextResponse.json({ error: 'id and status are required' }, { status: 400 });

    if (kind === 'brief') {
      if (!BRIEF_STATUSES.includes(status)) return NextResponse.json({ error: 'Invalid brief status' }, { status: 400 });
      const { error } = await db.from('marketplace_briefs').update({ status, updated_at: now }).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (kind === 'quote') {
      if (!QUOTE_STATUSES.includes(status)) return NextResponse.json({ error: 'Invalid quote status' }, { status: 400 });
      const { data: q, error } = await db
        .from('marketplace_quotes')
        .update({ status, updated_at: now })
        .eq('id', id)
        .select('brief_id')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (status === 'accepted' && q) {
        // Award the brief to this quote; reject the other still-live quotes.
        await db.from('marketplace_briefs').update({ awarded_quote_id: id, status: 'awarded', updated_at: now }).eq('id', q.brief_id);
        await db
          .from('marketplace_quotes')
          .update({ status: 'rejected', updated_at: now })
          .eq('brief_id', q.brief_id)
          .neq('id', id)
          .in('status', ['submitted', 'shortlisted']);
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown kind' }, { status: 400 });
  } catch (err) {
    console.error('[admin/marketplace] PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

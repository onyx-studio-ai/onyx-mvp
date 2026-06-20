import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { requireAdmin, requireAdminOnly } from '@/app/api/admin/_utils/requireAdmin';

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
  // Awarding a brief decides who gets paid — restrict to the admin role.
  const unauthorized = requireAdminOnly(request);
  if (unauthorized) return unauthorized;
  try {
    const db = getSupabaseServiceClient();
    const { kind, id, status } = await request.json();
    const now = new Date().toISOString();
    if (!id || !status) return NextResponse.json({ error: 'id and status are required' }, { status: 400 });

    if (kind === 'brief') {
      if (!BRIEF_STATUSES.includes(status)) return NextResponse.json({ error: 'Invalid brief status' }, { status: 400 });
      // Reopening/cancelling clears the stale award pointer so it can't linger.
      const patch: Record<string, unknown> = { status, updated_at: now };
      if (['open', 'reviewing', 'cancelled'].includes(status)) patch.awarded_quote_id = null;
      const { error } = await db.from('marketplace_briefs').update(patch).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (kind === 'quote') {
      if (!QUOTE_STATUSES.includes(status)) return NextResponse.json({ error: 'Invalid quote status' }, { status: 400 });

      if (status === 'accepted') {
        // Accept only a quote that is still live (can't resurrect a withdrawn/rejected one).
        const { data: q } = await db
          .from('marketplace_quotes')
          .update({ status: 'accepted', updated_at: now })
          .eq('id', id)
          .in('status', ['submitted', 'shortlisted'])
          .select('brief_id')
          .maybeSingle();
        if (!q) return NextResponse.json({ error: 'Quote is no longer available to accept' }, { status: 409 });

        // Award the brief only if it isn't already awarded — prevents double-award.
        const { data: awarded } = await db
          .from('marketplace_briefs')
          .update({ awarded_quote_id: id, status: 'awarded', updated_at: now })
          .eq('id', q.brief_id)
          .is('awarded_quote_id', null)
          .select('id')
          .maybeSingle();
        if (!awarded) {
          await db.from('marketplace_quotes').update({ status: 'submitted', updated_at: now }).eq('id', id);
          return NextResponse.json({ error: 'This brief is already awarded' }, { status: 409 });
        }

        // Reject the remaining live quotes on this brief.
        await db
          .from('marketplace_quotes')
          .update({ status: 'rejected', updated_at: now })
          .eq('brief_id', q.brief_id)
          .neq('id', id)
          .in('status', ['submitted', 'shortlisted']);
        return NextResponse.json({ ok: true });
      }

      // Non-accept transitions (shortlist / reject / withdraw).
      const { error } = await db.from('marketplace_quotes').update({ status, updated_at: now }).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown kind' }, { status: 400 });
  } catch (err) {
    console.error('[admin/marketplace] PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

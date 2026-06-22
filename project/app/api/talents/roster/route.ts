import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient, supabaseErrorResponse } from '@/lib/supabase-server';

/*
  Public HUMAN talent roster for the hiring marketplace. Distinct from /api/talents
  (the AI-voice catalogue). Lists real voice talents a client can browse — gated by
  is_active (Onyx has activated them).

  DRAFT/PUBLISH: clients see the admin-approved published_snapshot, NEVER the
  talent's live draft columns. The snapshot is built server-side from public-safe
  fields only (see /api/admin/talents/publish), so email / phone / payment_details
  / internal_cost can never leak here by construction.

  Pass ?id=<uuid> to fetch a single talent for the profile page.
*/

export async function GET(request: NextRequest) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    const db = getSupabaseServiceClient();

    // REAL HUMANS ONLY: our own AI/TTS voices (created manually, application_id
    // null) live in the AI catalogue and must never appear here.
    let query = db
      .from('talents')
      .select('id, type, application_id, sort_order, created_at, published_snapshot')
      .eq('is_active', true)
      .in('type', ['VO', 'voice_actor'])
      .not('application_id', 'is', null)
      .not('published_snapshot', 'is', null)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (id) query = query.eq('id', id);

    const { data, error } = await query;
    if (error) {
      console.error('[talents/roster] DB error:', error);
      return NextResponse.json({ error: 'Failed to fetch talents' }, { status: 500 });
    }

    // Flatten: the public record IS the snapshot, with the row id attached.
    const flatten = (row: { id: string; published_snapshot: Record<string, unknown> | null }) => ({
      id: row.id,
      ...(row.published_snapshot || {}),
    });
    const rows = (data || []).map(flatten);

    if (id) return NextResponse.json(rows[0] || null);
    return NextResponse.json(rows);
  } catch (err) {
    return supabaseErrorResponse(err, 'api/talents/roster');
  }
}

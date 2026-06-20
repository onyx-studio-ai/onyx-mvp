import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient, supabaseErrorResponse } from '@/lib/supabase-server';

/*
  Public HUMAN talent roster for the hiring marketplace (Phase 1 gallery).
  Distinct from /api/talents (the AI-voice catalogue, which gates on
  voice_id_status='verified'). Here we list real voice talents a client can
  browse and enquire about — gated only by is_active (Onyx has activated them).

  SECURITY: select ONLY public-safe columns. Never expose email / phone /
  payment_details / internal_cost / application_id from the talents table.
  Pass ?id=<uuid> to fetch a single talent for the profile page.
*/

const PUBLIC_COLUMNS =
  'id, name, type, languages, tags, gender, accent, demo_urls, sample_url, headshot_url, bio, category, sort_order';

export async function GET(request: NextRequest) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    const db = getSupabaseServiceClient();

    // REAL HUMANS ONLY: this roster is the human talent pool. Our own AI/TTS
    // voices (Onyx Alpha/Bravo/Delta) live in the AI catalogue (/voices) and
    // must never appear here. They were created manually (application_id null);
    // real talents always come from an approved application, so we require
    // application_id to be present.
    let query = db
      .from('talents')
      .select(PUBLIC_COLUMNS)
      .eq('is_active', true)
      .in('type', ['VO', 'voice_actor'])
      .not('application_id', 'is', null)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (id) query = query.eq('id', id);

    const { data, error } = await query;
    if (error) {
      console.error('[talents/roster] DB error:', error);
      return NextResponse.json({ error: 'Failed to fetch talents' }, { status: 500 });
    }

    if (id) return NextResponse.json((data && data[0]) || null);
    return NextResponse.json(data || []);
  } catch (err) {
    return supabaseErrorResponse(err, 'api/talents/roster');
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  GET /api/client/requests — the signed-in user's OWN voiceover requests (the
  briefs they submitted via /hire), matched by their verified account email, with
  status + an audition/quote count so they can track progress. This is the client's
  own data (budget/brief included); other clients' data is never returned.
*/
export async function GET(request: NextRequest) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const db = getSupabaseServiceClient();
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  const email = userData?.user?.email;
  if (userErr || !email) return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });

  try {
    const { data: briefs } = await db
      .from('marketplace_briefs')
      .select('id, brief_number, kind, title, content_type, language, status, budget, budget_type, media_scope, territory, license_term, length, audition_deadline, deadline, has_singing, wants_director, wants_live_session, live_session_tool, brief, created_at')
      .ilike('client_email', email)
      .order('created_at', { ascending: false })
      .limit(50);

    // audition/quote counts per request — a progress signal for the client
    const ids = (briefs || []).map((b) => b.id);
    const counts: Record<string, number> = {};
    if (ids.length) {
      const { data: q } = await db
        .from('marketplace_quotes')
        .select('brief_id')
        .in('brief_id', ids)
        .in('status', ['submitted', 'shortlisted', 'accepted']);
      for (const r of q || []) counts[r.brief_id as string] = (counts[r.brief_id as string] || 0) + 1;
    }
    return NextResponse.json({ briefs: briefs || [], counts });
  } catch {
    return NextResponse.json({ briefs: [], counts: {}, unavailable: true });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { resolveCaller } from '@/lib/marketplace-auth';

/*
  GET /api/marketplace/threads — the caller's message threads.
  A thread = (brief, talent). The caller can be the talent (briefs they quoted
  on) and/or the client (briefs they posted, one thread per talent who quoted).
  Degrades gracefully (empty) if the marketplace tables aren't migrated yet.
*/
export async function GET(request: NextRequest) {
  const c = await resolveCaller(request);
  if (!c) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const threads: Array<{
      key: string; brief_id: string; talent_id: string; role: 'client' | 'talent';
      brief_number: string; title: string; brief_status: string; counterpart: string;
    }> = [];

    // Talent side — briefs this talent quoted on.
    if (c.talentId) {
      const { data: quotes } = await c.db.from('marketplace_quotes').select('brief_id').eq('talent_id', c.talentId);
      const ids = [...new Set((quotes || []).map((q) => q.brief_id))];
      if (ids.length) {
        const { data: briefs } = await c.db
          .from('marketplace_briefs')
          .select('id, brief_number, brief, status, client_name, company')
          .in('id', ids);
        for (const b of briefs || []) {
          threads.push({
            key: `${b.id}:${c.talentId}`,
            brief_id: b.id,
            talent_id: c.talentId,
            role: 'talent',
            brief_number: b.brief_number,
            title: (b.brief || '').slice(0, 80),
            brief_status: b.status,
            counterpart: b.client_name || b.company || 'Client',
          });
        }
      }
    }

    // Client side — briefs this user posted, one thread per talent who quoted.
    const { data: myBriefs } = await c.db
      .from('marketplace_briefs')
      .select('id, brief_number, brief, status')
      .or(`client_user_id.eq.${c.userId},client_email.ilike.${c.email}`);
    const myIds = (myBriefs || []).map((b) => b.id);
    if (myIds.length) {
      const { data: qs } = await c.db
        .from('marketplace_quotes')
        .select('brief_id, talent_id, talents(name)')
        .in('brief_id', myIds);
      for (const q of qs || []) {
        const b = (myBriefs || []).find((x) => x.id === q.brief_id);
        if (!b) continue;
        const key = `${q.brief_id}:${q.talent_id}`;
        if (threads.some((t) => t.key === key)) continue; // dedupe (e.g. self-quoting)
        threads.push({
          key,
          brief_id: q.brief_id,
          talent_id: q.talent_id,
          role: 'client',
          brief_number: b.brief_number,
          title: (b.brief || '').slice(0, 80),
          brief_status: b.status,
          counterpart: (q.talents as { name?: string } | null)?.name || 'Talent',
        });
      }
    }

    return NextResponse.json({ threads });
  } catch {
    return NextResponse.json({ threads: [], unavailable: true });
  }
}

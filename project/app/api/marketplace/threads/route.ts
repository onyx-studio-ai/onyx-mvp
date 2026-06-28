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
      last_at?: string | null; last_sender_type?: string | null; last_preview?: string | null;
    }> = [];

    // Talent side — briefs this talent WON (post-award only: 成單後才開對話).
    if (c.talentId) {
      const { data: quotes } = await c.db.from('marketplace_quotes').select('brief_id').eq('talent_id', c.talentId).eq('status', 'accepted');
      const ids = [...new Set((quotes || []).map((q) => q.brief_id))];
      if (ids.length) {
        const { data: briefs } = await c.db
          .from('marketplace_briefs')
          .select('id, brief_number, brief, status, client_name, company')
          .in('id', ids);
        for (const b of briefs || []) {
          threads.push({
            // role-qualified key so the SAME user being both client and talent on a
            // brief (e.g. testing with one account) gets a thread on each side, not
            // one collapsed by dedupe.
            key: `${b.id}:${c.talentId}:talent`,
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
    // Two parameterized .eq queries merged — NOT a .or() string with the email
    // interpolated (that allowed ilike %/_ wildcards + filter break-out, leaking
    // other clients' briefs). Exact eq; relies on client_email stored lowercased
    // at /hire insert (c.email is already lowercased).
    const cols = 'id, brief_number, brief, status';
    const byId = c.userId
      ? (await c.db.from('marketplace_briefs').select(cols).eq('client_user_id', c.userId)).data || []
      : [];
    const byEmail = (await c.db.from('marketplace_briefs').select(cols).eq('client_email', c.email)).data || [];
    const myBriefs = [...byId, ...byEmail].filter((b, i, arr) => arr.findIndex((x) => x.id === b.id) === i);
    const myIds = myBriefs.map((b) => b.id);
    if (myIds.length) {
      const { data: qs } = await c.db
        .from('marketplace_quotes')
        .select('brief_id, talent_id, talents(name)')
        .in('brief_id', myIds)
        .eq('status', 'accepted');
      for (const q of qs || []) {
        const b = (myBriefs || []).find((x) => x.id === q.brief_id);
        if (!b) continue;
        const key = `${q.brief_id}:${q.talent_id}:client`;
        if (threads.some((t) => t.key === key)) continue; // dedupe within client side
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

    // Attach each thread's latest message (for unread badges + previews). One query
    // for all the caller's briefs; first hit per (brief:talent) key is the latest.
    const briefIds = [...new Set(threads.map((t) => t.brief_id))];
    if (briefIds.length) {
      const { data: msgs } = await c.db
        .from('marketplace_messages')
        .select('brief_id, talent_id, sender_type, body, created_at')
        .in('brief_id', briefIds)
        .order('created_at', { ascending: false });
      const latest: Record<string, { at: string; sender: string; preview: string }> = {};
      for (const m of msgs || []) {
        const k = `${m.brief_id}:${m.talent_id}`;
        if (!latest[k]) latest[k] = { at: m.created_at as string, sender: (m.sender_type as string) || '', preview: String(m.body || '').slice(0, 60) };
      }
      for (const t of threads) {
        const l = latest[`${t.brief_id}:${t.talent_id}`];
        if (l) { t.last_at = l.at; t.last_sender_type = l.sender; t.last_preview = l.preview; }
      }
    }
    // Most-recently-active threads first (those with no messages sink to the bottom).
    threads.sort((a, b) => (b.last_at || '').localeCompare(a.last_at || ''));

    return NextResponse.json({ threads });
  } catch {
    return NextResponse.json({ threads: [], unavailable: true });
  }
}

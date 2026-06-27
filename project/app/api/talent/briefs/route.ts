import { NextRequest, NextResponse } from 'next/server';
import { resolveTalentFromRequest } from '@/lib/talent-auth';

/*
  GET /api/talent/briefs — open voice-over briefs the talent can quote on, plus
  the talent's own existing quotes (to show status / prevent double-quoting).

  Anti-leakage: client identity (email / name / company) is NOT exposed to
  talents here — only the brief content. Onyx mediates the introduction.

  Degrades gracefully: if the marketplace tables haven't been migrated yet,
  returns empty lists + unavailable:true rather than erroring, so the talent
  dashboard keeps working.
*/
export async function GET(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id, languages, demos');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });

  // The talent's own published demos — offered as "pick an existing demo" when
  // responding to a general (single-voice) casting call.
  const rawDemos = (r.talent as { demos?: unknown }).demos;
  const myDemos = Array.isArray(rawDemos)
    ? rawDemos.filter((d): d is { url: string; name?: string; category?: string; language?: string } =>
        !!d && typeof (d as { url?: unknown }).url === 'string').slice(0, 60)
    : [];

  try {
    const { data: briefsRaw, error: bErr } = await r.db
      .from('marketplace_briefs')
      .select('id, brief_number, kind, title, roles, audition_script, reference_links, reference_files, recording_start, recording_methods, rate_note, base_revisions, audition_cap, categories, content_type, media_scope, territory, license_term, accent, voice_style, voice_age, script_status, has_singing, wants_director, wants_live_session, live_session_tool, audition_deadline, language, length, budget, budget_type, deadline, brief, created_at, status, client_email')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(50);
    if (bErr) throw bErr;
    const briefs = briefsRaw || [];

    // Per-role audition counts (casting only). The count IS shown to talents, and
    // audition_cap is a soft "popular" threshold (a nudge to try other roles) — NOT
    // a hard cap; talents can still audition a busy role.
    const castingIds = briefs.filter((b) => b.kind === 'casting').map((b) => b.id);
    const roleCounts: Record<string, Record<string, number>> = {};
    if (castingIds.length) {
      const { data: rq } = await r.db
        .from('marketplace_quotes')
        .select('brief_id, role_name, status')
        .in('brief_id', castingIds)
        .in('status', ['submitted', 'shortlisted']);
      for (const q of rq || []) {
        const bid = q.brief_id as string; const rn = (q.role_name as string) || '';
        (roleCounts[bid] ||= {})[rn] = (roleCounts[bid][rn] || 0) + 1;
      }
    }

    const { data: myQuotes } = await r.db
      .from('marketplace_quotes')
      .select('id, brief_id, role_name, gross_amount, net_amount, commission_rate, currency, message, status, sample_url, delivery_url, delivery_uploaded_at, created_at')
      .eq('talent_id', (r.talent as { id: string }).id)
      .order('created_at', { ascending: false });

    // Derive a non-identifying source flag (platform-posted vs from a client) and
    // STRIP client_email — talents see the source label, never the client identity.
    const safeBriefs = briefs.map((b) => {
      const o = { ...b, source: (b as { client_email?: string }).client_email === 'casting@onyxstudios.ai' ? 'platform' : 'client' } as Record<string, unknown>;
      delete o.client_email;
      return o;
    });

    // Jobs the talent WON: accepted quotes whose brief is no longer 'open' (awarded/
    // closed) — the open-only list above drops them, so the talent would lose sight
    // of what they actually got. Surface them separately.
    const acceptedBriefIds = [...new Set((myQuotes || []).filter((q) => q.status === 'accepted').map((q) => q.brief_id as string))];
    const openIds = new Set(briefs.map((b) => (b as { id: string }).id));
    const wonIds = acceptedBriefIds.filter((id) => !openIds.has(id));
    let wonBriefs: unknown[] = [];
    if (wonIds.length) {
      const { data: wb } = await r.db.from('marketplace_briefs')
        .select('id, brief_number, kind, title, content_type, language, status, rate_note')
        .in('id', wonIds);
      wonBriefs = wb || [];
    }

    // Cases the talent APPLIED to that have ended (closed / cancelled / awarded to
    // someone else) — so their audition doesn't just silently vanish; they see the
    // outcome. Excludes the open list (still live) and won cases (shown above).
    const quotedBriefIds = [...new Set((myQuotes || []).map((q) => q.brief_id as string))];
    const endedIds = quotedBriefIds.filter((id) => !openIds.has(id) && !wonIds.includes(id));
    let endedBriefs: unknown[] = [];
    if (endedIds.length) {
      const { data: eb } = await r.db.from('marketplace_briefs')
        .select('id, brief_number, kind, title, content_type, status')
        .in('id', endedIds);
      endedBriefs = eb || [];
    }
    return NextResponse.json({ briefs: safeBriefs, myQuotes: myQuotes || [], roleCounts, myDemos, wonBriefs, endedBriefs });
  } catch {
    // Tables not migrated yet (or transient) — degrade to empty so the UI is fine.
    return NextResponse.json({ briefs: [], myQuotes: [], unavailable: true });
  }
}

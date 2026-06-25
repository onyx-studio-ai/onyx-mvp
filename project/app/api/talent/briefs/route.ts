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
  const r = await resolveTalentFromRequest(request, 'id, languages');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });

  try {
    const { data: briefsRaw, error: bErr } = await r.db
      .from('marketplace_briefs')
      .select('id, brief_number, kind, title, roles, audition_script, reference_links, reference_files, recording_start, recording_methods, rate_note, base_revisions, audition_cap, categories, content_type, media_scope, territory, license_term, script_status, has_singing, wants_director, wants_live_session, live_session_tool, audition_deadline, language, length, budget, budget_type, deadline, brief, created_at, status')
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
      .select('id, brief_id, role_name, gross_amount, net_amount, commission_rate, currency, message, status, sample_url, created_at')
      .eq('talent_id', (r.talent as { id: string }).id)
      .order('created_at', { ascending: false });

    return NextResponse.json({ briefs, myQuotes: myQuotes || [], roleCounts });
  } catch {
    // Tables not migrated yet (or transient) — degrade to empty so the UI is fine.
    return NextResponse.json({ briefs: [], myQuotes: [], unavailable: true });
  }
}

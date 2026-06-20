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
    const { data: briefs, error: bErr } = await r.db
      .from('marketplace_briefs')
      .select('id, brief_number, categories, content_type, media_scope, territory, license_term, script_status, has_singing, language, length, budget, deadline, brief, created_at, status')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(50);
    if (bErr) throw bErr;

    const { data: myQuotes } = await r.db
      .from('marketplace_quotes')
      .select('id, brief_id, gross_amount, net_amount, commission_rate, currency, message, status, created_at')
      .eq('talent_id', (r.talent as { id: string }).id)
      .order('created_at', { ascending: false });

    return NextResponse.json({ briefs: briefs || [], myQuotes: myQuotes || [] });
  } catch {
    // Tables not migrated yet (or transient) — degrade to empty so the UI is fine.
    return NextResponse.json({ briefs: [], myQuotes: [], unavailable: true });
  }
}

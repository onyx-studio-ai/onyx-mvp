import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  GET /api/admin/casting/ai-applicants?type=clone|training

  The invite pool for a client-side AI/TTS casting call: everyone who FILLED THE
  APPLICATION FORM and opted into the matching AI consent — 'clone' → coop_ai_clone
  (voice becomes AI), 'training' → coop_ai_training (records AI training data).

  Sourced from talent_applications (not talents) so it INCLUDES applicants who
  aren't approved/online yet — an AI corpus doesn't need professional VO vetting,
  just "a voice + willing to be AI". For approved applicants (talent_id set) we
  honour their CURRENT opt-in on `talents`, so anyone who later changed their mind
  in their profile is dropped. Returns { applicants: [{ email, name }] }, deduped.
*/
export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const type = new URL(request.url).searchParams.get('type');
  const col = type === 'training' ? 'coop_ai_training' : 'coop_ai_clone';
  const db = getSupabaseServiceClient();

  const { data: apps, error } = await db
    .from('talent_applications')
    .select(`email, display_name, talent_id, ${col}`)
    .eq(col, true)
    .not('email', 'is', null)
    .limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (apps || []) as Record<string, unknown>[];

  // Approved applicants: honour their live opt-in on `talents` (they may have
  // toggled it off later). Drop those whose current talent flag is false.
  const talentIds = [...new Set(rows.map((a) => a.talent_id).filter(Boolean) as string[])];
  const optedOut = new Set<string>();
  if (talentIds.length) {
    const { data: ts } = await db.from('talents').select(`id, ${col}`).in('id', talentIds);
    for (const t of (ts || []) as Record<string, unknown>[]) {
      if (!t[col]) optedOut.add(String(t.id));
    }
  }

  const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const SKIP = /@(?:onyxstudios\.ai|example\.com|test\.com|test\.test)$/i;
  const seen = new Set<string>();
  const applicants: { email: string; name: string }[] = [];
  for (const a of rows) {
    const tid = a.talent_id ? String(a.talent_id) : '';
    if (tid && optedOut.has(tid)) continue; // changed their mind after approval
    const email = String(a.email || '').trim().toLowerCase();
    if (!EMAIL_OK.test(email) || SKIP.test(email) || seen.has(email)) continue;
    seen.add(email);
    applicants.push({ email, name: String(a.display_name || '').trim() || email });
  }
  applicants.sort((x, y) => x.name.localeCompare(y.name));
  return NextResponse.json({ applicants });
}

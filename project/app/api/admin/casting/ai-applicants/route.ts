import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  GET /api/admin/casting/ai-applicants?type=clone|training

  The invite pool for a client-side AI/TTS casting call: everyone who agreed to the
  matching AI consent — 'clone' → coop_ai_clone (voice becomes AI), 'training' →
  coop_ai_training (records AI training data).

  Source = talent_applications (the form they filled) UNION talents, deduped by
  email. Two reasons for the union:
   - applications include people not yet approved/online (an AI corpus doesn't need
     VO vetting — just "a voice + willing to be AI");
   - the coop flags are NOT reliably mirrored application→talents on approval (most
     approved talents have the talents-flag still false even though they consented on
     their form), so the APPLICATION flag is the source of truth. We must NOT drop
     people whose talents flag is false — that was the "list only shows a couple"
     bug. talents is unioned in only to catch the few who opted in via their profile.

  Each applicant carries `langs` (their languages) so the picker can match the case
  language — inviting someone who doesn't speak the language is useless.

  Returns { applicants: [{ email, name, langs }] }.
*/
export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const type = new URL(request.url).searchParams.get('type');
  const col = type === 'training' ? 'coop_ai_training' : 'coop_ai_clone';
  const db = getSupabaseServiceClient();

  const [{ data: apps, error: aErr }, { data: tals }] = await Promise.all([
    db.from('talent_applications').select(`email, display_name, full_name, languages, ${col}`).eq(col, true).not('email', 'is', null).limit(3000),
    db.from('talents').select(`email, name, languages, native_languages, ${col}`).eq(col, true).not('email', 'is', null).limit(3000),
  ]);
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

  const asText = (v: unknown) => (Array.isArray(v) ? v.join(' ') : String(v || ''));
  const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const SKIP = /@(?:onyxstudios\.ai|example\.com|test\.com|test\.test)$/i;
  const seen = new Set<string>();
  const applicants: { email: string; name: string; langs: string }[] = [];
  const add = (emailRaw: unknown, nameRaw: unknown, langs: string) => {
    const email = String(emailRaw || '').trim().toLowerCase();
    if (!EMAIL_OK.test(email) || SKIP.test(email) || seen.has(email)) return;
    seen.add(email);
    applicants.push({ email, name: String(nameRaw || '').trim() || email, langs: langs.trim() });
  };
  for (const a of (apps || []) as Record<string, unknown>[]) add(a.email, a.display_name || a.full_name, asText(a.languages));
  for (const t of (tals || []) as Record<string, unknown>[]) add(t.email, t.name, `${asText(t.languages)} ${asText(t.native_languages)}`); // union — only new emails land
  applicants.sort((x, y) => x.name.localeCompare(y.name));
  return NextResponse.json({ applicants });
}

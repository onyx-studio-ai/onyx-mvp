import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  Admin-only front-end preview of a casting call (any status, incl. a reviewing
  client request). Returns ONLY the talent-facing fields — never the client's
  identity/budget — so it's safe to render in the public talent view layout.
*/
const TALENT_FIELDS =
  'id, brief_number, kind, title, content_type, language, rate_note, status, created_at, ' +
  'audition_deadline, deadline, length, media_scope, territory, license_term, accent, voice_style, voice_age, ' +
  'recording_methods, recording_start, base_revisions, brief, audition_script, reference_links, reference_files, roles';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const db = getSupabaseServiceClient();
  const { data } = await db.from('marketplace_briefs').select(TALENT_FIELDS).eq('id', id).maybeSingle();
  const brief = data as ({ kind?: string } & Record<string, unknown>) | null;
  if (!brief || brief.kind !== 'casting') return NextResponse.json({ error: 'not a casting call' }, { status: 404 });
  return NextResponse.json({ brief });
}

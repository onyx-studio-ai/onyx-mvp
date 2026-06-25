import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  POST /api/admin/casting — create a human-VO casting call (kind='casting').

  Admin self-service posting (the poster fills this in; later opens to outside
  posters). Reuses marketplace_briefs so casting calls appear at
  /talent/opportunities alongside client briefs. The AI track is untouched.
*/
type RoleIn = { name?: string; gender?: string; age?: string; personality?: string; emotion?: string; sample_line?: string; is_lead?: boolean; image?: string };
const METHODS = ['home', 'studio', 'online'];

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const title = String(b.title || '').trim();
  const briefText = String(b.brief || '').trim();
  if (!title) return NextResponse.json({ error: '請填標題' }, { status: 400 });
  if (!briefText) return NextResponse.json({ error: '請填案件說明' }, { status: 400 });

  const roles = Array.isArray(b.roles)
    ? (b.roles as RoleIn[]).filter((r) => r && String(r.name || '').trim()).slice(0, 100).map((r) => ({
        name: String(r.name).trim().slice(0, 80),
        gender: String(r.gender || '').trim().slice(0, 20),
        age: String(r.age || '').trim().slice(0, 20),
        personality: String(r.personality || '').trim().slice(0, 60),
        emotion: String(r.emotion || '').trim().slice(0, 80),
        sample_line: String(r.sample_line || '').trim().slice(0, 500),
        is_lead: !!r.is_lead,
        image: String(r.image || '').trim().slice(0, 1000) || undefined,
      }))
    : [];
  const refLinks = Array.isArray(b.reference_links)
    ? (b.reference_links as unknown[]).map((l) => String(l || '').trim()).filter(Boolean).slice(0, 30)
    : [];
  const refFiles = Array.isArray(b.reference_files)
    ? (b.reference_files as { name?: string; url?: string }[]).filter((f) => f && f.url).slice(0, 30)
        .map((f) => ({ name: String(f.name || '').slice(0, 120), url: String(f.url).slice(0, 1000) }))
    : [];
  const methods = Array.isArray(b.recording_methods)
    ? (b.recording_methods as unknown[]).map((m) => String(m)).filter((m) => METHODS.includes(m))
    : [];

  const row = {
    kind: 'casting',
    client_email: 'casting@onyxstudios.ai',     // poster-side placeholder (NOT NULL); talents never see it
    client_name: 'Onyx Casting',
    title,
    content_type: String(b.content_type || '').slice(0, 80) || null, // 類別(廣告/旁白/遊戲…)
    brief: briefText,
    language: String(b.language || '').slice(0, 80) || null,
    rate_note: String(b.rate_note || '').slice(0, 200) || null,
    base_revisions: Number.isFinite(Number(b.base_revisions)) ? Math.max(0, Math.trunc(Number(b.base_revisions))) : 1,
    audition_cap: Number.isFinite(Number(b.audition_cap)) ? Math.max(1, Math.trunc(Number(b.audition_cap))) : 5,
    audition_deadline: String(b.audition_deadline || '').slice(0, 120) || null,
    recording_start: String(b.recording_start || '').slice(0, 120) || null,
    recording_methods: methods,
    roles,
    audition_script: String(b.audition_script || '').slice(0, 20000) || null,
    reference_links: refLinks,
    reference_files: refFiles,
    locale: String(b.locale || 'zh-TW'),
    status: 'open',
  };

  const db = getSupabaseServiceClient();
  const { data, error } = await db.from('marketplace_briefs').insert(row).select('id, brief_number').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id, brief_number: data.brief_number });
}

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  One of the signed-in client's own requests.
    GET   — load the full brief (must belong to the caller's email).
    PATCH — edit it, ONLY while status='reviewing' (before Onyx confirms). Once it's
            open/awarded the client can no longer change it (contact Onyx).
*/

async function ownerBrief(request: NextRequest, id: string) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { error: 'Not authenticated', status: 401 as const };
  const db = getSupabaseServiceClient();
  const { data: userData, error } = await db.auth.getUser(token);
  const email = userData?.user?.email;
  if (error || !email) return { error: 'Invalid session', status: 401 as const };
  const { data: brief } = await db.from('marketplace_briefs').select('*').eq('id', id).maybeSingle();
  if (!brief) return { error: 'Not found', status: 404 as const };
  if (String(brief.client_email || '').toLowerCase() !== email.toLowerCase()) return { error: 'Not your request', status: 403 as const };
  return { db, brief, email };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await ownerBrief(request, id);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ brief: r.brief });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await ownerBrief(request, id);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.brief.status !== 'reviewing') return NextResponse.json({ error: '此需求已進入處理,如需修改請聯絡 Onyx。' }, { status: 400 });

  let b: Record<string, unknown>;
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const s = (v: unknown, n = 200) => (v == null ? undefined : String(v).slice(0, n));
  // Only the client-editable fields; never status/kind/client_email/etc.
  const patch: Record<string, unknown> = {
    title: s(b.title, 200) ?? null,
    brief: s(b.brief, 8000) ?? r.brief.brief,
    language: s(b.language, 80) ?? null,
    budget: s(b.budget, 80) ?? null,
    budget_type: s(b.budget_type, 40) ?? null,
    audition_deadline: s(b.audition_deadline, 60) ?? null,
    deadline: s(b.deadline, 60) ?? null,
  };
  if (!String(patch.brief || '').trim()) return NextResponse.json({ error: '需求說明不能空白' }, { status: 400 });

  const { data, error } = await r.db.from('marketplace_briefs').update(patch).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ brief: data });
}

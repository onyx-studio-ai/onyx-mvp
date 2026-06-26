import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/mail';

/*
  The signed-in client's in-platform thread with Onyx on one of their own requests.
    GET  — the thread (must belong to the caller's email).
    POST { body } — the client sends a message; Onyx is notified.
  Onyx's side is /api/admin/requests/messages. All correspondence stays in-platform.
*/

async function ownerBrief(request: NextRequest, id: string) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { error: 'Not authenticated', status: 401 as const };
  const db = getSupabaseServiceClient();
  const { data: userData, error } = await db.auth.getUser(token);
  const email = userData?.user?.email;
  if (error || !email) return { error: 'Invalid session', status: 401 as const };
  const { data: brief } = await db.from('marketplace_briefs').select('id, brief_number, client_email, client_name').eq('id', id).maybeSingle();
  if (!brief) return { error: 'Not found', status: 404 as const };
  if (String(brief.client_email || '').toLowerCase() !== email.toLowerCase()) return { error: 'Not your request', status: 403 as const };
  return { db, brief, email };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await ownerBrief(request, id);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const { data } = await r.db.from('brief_messages')
    .select('id, sender_type, sender_name, body, created_at')
    .eq('brief_id', id).order('created_at', { ascending: true });
  return NextResponse.json({ messages: data || [] });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await ownerBrief(request, id);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  let b: { body?: string };
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const body = String(b.body || '').trim().slice(0, 4000);
  if (!body) return NextResponse.json({ error: '訊息不能空白' }, { status: 400 });

  const { data: msg, error } = await r.db.from('brief_messages')
    .insert({ brief_id: id, sender_type: 'client', sender_name: r.brief.client_name || 'Client', body })
    .select('id, sender_type, sender_name, body, created_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Nudge Onyx so they pick it up in the admin (best-effort).
  sendEmail({
    category: 'PRODUCTION', to: 'produce@onyxstudios.ai',
    subject: `客戶回覆 · ${r.brief.brief_number || id}`,
    html: `<p>客戶在請求 <b>${r.brief.brief_number || id}</b> 留了新訊息,請至後台「客戶請求」回覆。</p>`,
  }).catch(() => {});
  return NextResponse.json({ message: msg });
}

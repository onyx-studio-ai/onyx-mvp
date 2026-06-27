import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/mail';
import { newMessageEmail } from '@/lib/mail-templates';

/*
  Onyx ↔ client in-platform thread on a brief (a /hire request). Onyx replies here
  as a TEAM, not a person. This replaces emailing the client directly.

  GET  ?brief_id=  → the thread.
  POST { brief_id, body } → Onyx (admin) sends; the client is notified by email
       with a link to their dashboard (the message itself stays in-platform).
*/

const ONYX_TEAM = 'Onyx Studios 製作團隊';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.onyxstudios.ai';

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const briefId = new URL(request.url).searchParams.get('brief_id') || '';
  if (!briefId) return NextResponse.json({ error: 'brief_id is required' }, { status: 400 });
  const db = getSupabaseServiceClient();
  const { data, error } = await db.from('brief_messages')
    .select('id, sender_type, sender_name, body, created_at')
    .eq('brief_id', briefId).order('created_at', { ascending: true });
  if (error) return NextResponse.json({ messages: [] });
  return NextResponse.json({ messages: data || [] });
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  let b: { brief_id?: string; body?: string };
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const briefId = String(b.brief_id || '').trim();
  const body = String(b.body || '').trim().slice(0, 4000);
  if (!briefId || !body) return NextResponse.json({ error: 'brief_id and body are required' }, { status: 400 });

  const db = getSupabaseServiceClient();
  const { data: brief } = await db.from('marketplace_briefs')
    .select('brief_number, client_email, locale').eq('id', briefId).maybeSingle();
  if (!brief) return NextResponse.json({ error: '找不到此請求' }, { status: 404 });

  const { data: msg, error } = await db.from('brief_messages')
    .insert({ brief_id: briefId, sender_type: 'admin', sender_name: ONYX_TEAM, body })
    .select('id, sender_type, sender_name, body, created_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify the client by email — show the message itself so they can just read it
  // and decide whether to come back to reply.
  if (brief.client_email) {
    const note = newMessageEmail({ briefNumber: brief.brief_number, locale: brief.locale, url: `${SITE}/dashboard/requests/${briefId}`, body, senderName: ONYX_TEAM });
    sendEmail({ category: 'PRODUCTION', to: brief.client_email, subject: note.subject, html: note.html }).catch(() => {});
  }
  return NextResponse.json({ message: msg });
}

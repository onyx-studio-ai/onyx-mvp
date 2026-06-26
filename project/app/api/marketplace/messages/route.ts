import { NextRequest, NextResponse } from 'next/server';
import { resolveCaller, threadRole } from '@/lib/marketplace-auth';
import { sendEmail } from '@/lib/mail';
import { newMessageEmail } from '@/lib/mail-templates';
import { sanitizeMessage } from '@/lib/message-filter';

/*
  Thread messages for a (brief, talent) pairing.
  GET  ?brief_id=&talent_id=  → messages, if the caller is a party.
  POST { brief_id, talent_id, body } → send as the caller's role; notify the
       counterpart by email (best-effort). Onyx can read every thread via the
       admin view (separate route).
*/

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.onyxstudios.ai';

export async function GET(request: NextRequest) {
  const c = await resolveCaller(request);
  if (!c) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const briefId = searchParams.get('brief_id') || '';
  const talentId = searchParams.get('talent_id') || '';
  if (!briefId || !talentId) return NextResponse.json({ error: 'brief_id and talent_id are required' }, { status: 400 });

  try {
    const role = await threadRole(c, briefId, talentId);
    if (!role) return NextResponse.json({ error: 'Not a participant in this thread' }, { status: 403 });

    const { data: messages } = await c.db
      .from('marketplace_messages')
      .select('id, sender_type, sender_name, body, created_at')
      .eq('brief_id', briefId)
      .eq('talent_id', talentId)
      .order('created_at', { ascending: true })
      .limit(500);

    return NextResponse.json({ role, messages: messages || [] });
  } catch {
    return NextResponse.json({ role: null, messages: [], unavailable: true });
  }
}

export async function POST(request: NextRequest) {
  const c = await resolveCaller(request);
  if (!c) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  try {
    const { brief_id: briefId, talent_id: talentId, body: rawBody } = await request.json();
    const raw = String(rawBody || '').trim().slice(0, 4000);
    if (!briefId || !talentId) return NextResponse.json({ error: 'brief_id and talent_id are required' }, { status: 400 });
    if (!raw) return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    // Redact off-platform contact details (links / emails / phone) before storing.
    const { clean: body, redacted } = sanitizeMessage(raw);

    const role = await threadRole(c, briefId, talentId);
    if (!role) return NextResponse.json({ error: 'Not a participant in this thread' }, { status: 403 });

    // Sender display name + the counterpart to notify.
    const { data: brief } = await c.db
      .from('marketplace_briefs')
      .select('brief_number, client_name, client_email, locale')
      .eq('id', briefId)
      .maybeSingle();
    const { data: talent } = await c.db.from('talents').select('name, email').eq('id', talentId).maybeSingle();

    const senderName = role === 'talent' ? talent?.name || 'Talent' : brief?.client_name || 'Client';

    const { data: msg, error } = await c.db
      .from('marketplace_messages')
      .insert({ brief_id: briefId, talent_id: talentId, sender_type: role, sender_user_id: c.userId, sender_name: senderName, body })
      .select('id, sender_type, sender_name, body, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Notify the counterpart (best-effort, non-blocking, branded + localized).
    const to = role === 'talent' ? brief?.client_email : talent?.email;
    if (to) {
      const note = newMessageEmail({ briefNumber: brief?.brief_number, url: `${SITE}/messages`, locale: brief?.locale });
      sendEmail({ category: 'PRODUCTION', to, subject: note.subject, html: note.html }).catch(() => {});
    }

    return NextResponse.json({ message: msg, redacted });
  } catch (err) {
    console.error('[marketplace/messages] POST error:', err);
    return NextResponse.json({ error: 'Could not send message' }, { status: 500 });
  }
}

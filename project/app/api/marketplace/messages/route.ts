import { NextRequest, NextResponse } from 'next/server';
import { resolveCaller, threadRole } from '@/lib/marketplace-auth';
import { sendEmail } from '@/lib/mail';

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
    const body = String(rawBody || '').trim().slice(0, 4000);
    if (!briefId || !talentId) return NextResponse.json({ error: 'brief_id and talent_id are required' }, { status: 400 });
    if (!body) return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });

    const role = await threadRole(c, briefId, talentId);
    if (!role) return NextResponse.json({ error: 'Not a participant in this thread' }, { status: 403 });

    // Sender display name + the counterpart to notify.
    const { data: brief } = await c.db
      .from('marketplace_briefs')
      .select('brief_number, client_name, client_email')
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

    // Notify the counterpart (best-effort, non-blocking).
    const to = role === 'talent' ? brief?.client_email : talent?.email;
    if (to) {
      sendEmail({
        category: 'PRODUCTION',
        to,
        subject: `Onyx — 新訊息 / New message (${brief?.brief_number || 'brief'})`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:520px;">
          <p style="color:#374151;">您在案件 <b>${(brief?.brief_number || '').replace(/[<>&]/g, '')}</b> 有一則新訊息 / You have a new message.</p>
          <p style="margin:16px 0;"><a href="${SITE}/messages" style="background:#16a34a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">查看訊息 / View messages</a></p>
          <p style="color:#9ca3af;font-size:12px;">請於平台內回覆,以便我們協助處理。/ Please reply on-platform.</p>
        </div>`,
      }).catch(() => {});
    }

    return NextResponse.json({ message: msg });
  } catch (err) {
    console.error('[marketplace/messages] POST error:', err);
    return NextResponse.json({ error: 'Could not send message' }, { status: 500 });
  }
}

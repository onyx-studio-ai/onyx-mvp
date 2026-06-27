import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/mail';
import { castingReauditionEmail } from '@/lib/mail-templates';

/*
  POST /api/client/requests/[id]/reaudition { quote_id, note? } — the CLIENT asks a
  specific talent for a second take before deciding. Records the ask on the quote
  (reaudition_note + reaudition_requested_at) and emails the talent. The talent
  re-uploads their sample, which clears the request. Owner-gated; only while the
  case is still auditioning (status='open'). Talent identity stays hidden — Onyx
  mediates the email; the client only ever sees anonymous labels.
*/
const SITE = 'https://www.onyxstudios.ai';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const db = getSupabaseServiceClient();
  const { data: userData, error: uErr } = await db.auth.getUser(token);
  const email = userData?.user?.email;
  if (uErr || !email) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  const { data: brief } = await db.from('marketplace_briefs').select('id, title, content_type, status, client_email').eq('id', id).maybeSingle();
  if (!brief) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (String(brief.client_email || '').toLowerCase() !== email.toLowerCase()) return NextResponse.json({ error: 'Not your request' }, { status: 403 });
  if (brief.status !== 'open') return NextResponse.json({ error: '此案目前無法請求二次試音。' }, { status: 400 });

  let b: { quote_id?: string; note?: string };
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const quoteId = String(b.quote_id || '').trim();
  if (!quoteId) return NextResponse.json({ error: 'quote_id is required' }, { status: 400 });
  const note = String(b.note || '').slice(0, 1000).trim();

  const { data: q } = await db.from('marketplace_quotes').select('id, brief_id, talent_id').eq('id', quoteId).maybeSingle();
  if (!q || q.brief_id !== id) return NextResponse.json({ error: '找不到這個試音' }, { status: 404 });

  const { error } = await db.from('marketplace_quotes')
    .update({ reaudition_note: note || null, reaudition_requested_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', quoteId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify the talent (best-effort).
  if (q.talent_id) {
    const { data: talent } = await db.from('talents').select('name, email').eq('id', q.talent_id).maybeSingle();
    if (talent?.email) {
      const m = castingReauditionEmail({ talentName: talent.name as string, title: (brief.title as string) || (brief.content_type as string) || '配音案件', note, url: `${SITE}/talent/opportunities`, locale: 'zh-TW' });
      sendEmail({ category: 'PRODUCTION', to: talent.email as string, subject: m.subject, html: m.html }).catch(() => {});
    }
  }
  return NextResponse.json({ ok: true });
}

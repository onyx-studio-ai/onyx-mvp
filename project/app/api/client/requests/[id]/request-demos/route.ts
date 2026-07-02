import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/mail';
import { castingMoreDemosEmail } from '@/lib/mail-templates';
import { notifyTalentTelegram } from '@/lib/telegram';

/*
  POST /api/client/requests/[id]/request-demos { quote_id, note? } — the CLIENT asks a
  talent to upload MORE demos (other tones / characters) before deciding. Records
  the ask on the quote (more_demos_note + more_demos_requested_at) + notifies the
  talent. Owner-gated; only while auditioning (status='open'). Talent stays hidden.
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
  if (brief.status !== 'open') return NextResponse.json({ error: '此案目前無法請求更多 demo。' }, { status: 400 });

  let b: { quote_id?: string; note?: string };
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const quoteId = String(b.quote_id || '').trim();
  if (!quoteId) return NextResponse.json({ error: 'quote_id is required' }, { status: 400 });
  const note = String(b.note || '').slice(0, 1000).trim();

  const { data: q } = await db.from('marketplace_quotes').select('id, brief_id, talent_id').eq('id', quoteId).maybeSingle();
  if (!q || q.brief_id !== id) return NextResponse.json({ error: '找不到這個試音' }, { status: 404 });

  const { error } = await db.from('marketplace_quotes')
    .update({ more_demos_note: note || null, more_demos_requested_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', quoteId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (q.talent_id) {
    const { data: talent } = await db.from('talents').select('name, email').eq('id', q.talent_id).maybeSingle();
    const title = (brief.title as string) || (brief.content_type as string) || '配音案件';
    if (talent?.email) {
      const m = castingMoreDemosEmail({ talentName: talent.name as string, title, note, url: `${SITE}/talent/opportunities`, locale: 'zh-TW' });
      sendEmail({ category: 'PRODUCTION', to: talent.email as string, subject: m.subject, html: m.html }).catch(() => {});
    }
    notifyTalentTelegram(db, q.talent_id, `🎬 客戶想聽您更多 demo(其他語氣 / 角色)。請到後台在該案子「追加 demo」上傳幾段。${SITE}/talent/opportunities`);
  }
  return NextResponse.json({ ok: true });
}

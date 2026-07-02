import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/mail';
import { castingMoreDemosEmail } from '@/lib/mail-templates';
import { notifyTalentTelegram } from '@/lib/telegram';

/*
  POST /api/admin/marketplace/request-demos { quote_id, note? }
  Onyx (admin) asks a specific auditioner to upload MORE demos (other tones /
  characters). Records the ask on the quote + notifies the talent (email + TG).
  Used on admin-posted casting cases where Onyx relays the client's request.
*/
const SITE = 'https://www.onyxstudios.ai';

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  let b: { quote_id?: string; note?: string };
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const quoteId = String(b.quote_id || '').trim();
  if (!quoteId) return NextResponse.json({ error: 'quote_id is required' }, { status: 400 });
  const note = String(b.note || '').slice(0, 1000).trim();

  const db = getSupabaseServiceClient();
  const { data: q } = await db.from('marketplace_quotes').select('id, brief_id, talent_id').eq('id', quoteId).maybeSingle();
  if (!q) return NextResponse.json({ error: '找不到這個試音' }, { status: 404 });

  const { error } = await db.from('marketplace_quotes')
    .update({ more_demos_note: note || null, more_demos_requested_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', quoteId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (q.talent_id) {
    const { data: brief } = await db.from('marketplace_briefs').select('title, content_type').eq('id', q.brief_id).maybeSingle();
    const title = (brief?.title as string) || (brief?.content_type as string) || '配音案件';
    const { data: talent } = await db.from('talents').select('name, email').eq('id', q.talent_id).maybeSingle();
    if (talent?.email) {
      const m = castingMoreDemosEmail({ talentName: talent.name as string, title, note, url: `${SITE}/talent/opportunities`, locale: 'zh-TW' });
      sendEmail({ category: 'PRODUCTION', to: talent.email as string, subject: m.subject, html: m.html }).catch(() => {});
    }
    notifyTalentTelegram(db, q.talent_id, `🎬 想聽您更多 demo(其他語氣 / 角色)。請到後台在該案子「追加 demo」上傳幾段。${SITE}/talent/opportunities`);
  }
  return NextResponse.json({ ok: true });
}

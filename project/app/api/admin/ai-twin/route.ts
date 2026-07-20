import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { sendEmail } from '@/lib/mail';
import { plainNoticeEmail } from '@/lib/mail-templates';
import { notifyTalentLine } from '@/lib/line';
import { notifyTalentTelegram } from '@/lib/telegram';

/*
  AI 聲音分身計畫 — 後台審核(Phase 2)。
  GET  → 全部報名(含配音員名)
  POST → { id, action: 'approve'|'reject', note? } 審核+通知
*/
export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const db = getSupabaseServiceClient();
  const { data } = await db.from('ai_twin_enrollments').select('*').order('created_at', { ascending: false }).limit(200);
  const ids = [...new Set((data || []).map((e) => e.talent_id))];
  const { data: ts } = ids.length ? await db.from('talents').select('id, name, talent_no, email').in('id', ids) : { data: [] };
  const tmap = new Map((ts || []).map((t) => [t.id, t]));
  return NextResponse.json({ enrollments: (data || []).map((e) => ({ ...e, talent: tmap.get(e.talent_id) || null })) });
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const db = getSupabaseServiceClient();
  let b: { id?: string; action?: string; note?: string };
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const id = String(b.id || '');
  const action = b.action === 'approve' ? 'approved' : b.action === 'reject' ? 'rejected' : '';
  if (!id || !action) return NextResponse.json({ error: 'id 與 action 必填' }, { status: 400 });
  const note = String(b.note || '').slice(0, 500);
  const { data: en, error } = await db.from('ai_twin_enrollments')
    .update({ status: action, review_note: note || null, updated_at: new Date().toISOString() })
    .eq('id', id).select('talent_id').single();
  if (error || !en) return NextResponse.json({ error: error?.message || 'not found' }, { status: 500 });
  // 通知配音員(best-effort)
  try {
    const { data: t } = await db.from('talents').select('name, email').eq('id', en.talent_id).maybeSingle();
    const ok = action === 'approved';
    const msg = ok
      ? 'AI 聲音分身計畫:您的報名已核准!我們將開始建立您的 AI 聲音,上架後通知您。'
      : `AI 聲音分身計畫:您的資料需要調整${note ? `(${note})` : ''},請至後台查看並更新。`;
    const email = String(t?.email || '');
    if (email && !email.endsWith('@invite.onyxstudios.ai')) {
      const note2 = plainNoticeEmail({
        subject: `AI 聲音分身計畫 — ${ok ? '報名已核准' : '資料需要調整'}`,
        headline: ok ? '報名已核准' : '資料需要調整', cardTitle: 'AI 聲音分身計畫',
        paragraphs: [`${t?.name ? t.name + ' ' : ''}您好,`, msg],
        ctaText: '前往查看', ctaUrl: 'https://www.onyxstudios.ai/zh-TW/talent/ai-twin',
      });
      sendEmail({ category: 'HELLO', to: email, subject: note2.subject, html: note2.html }).catch(() => {});
    }
    notifyTalentLine(db, en.talent_id, msg);
    notifyTalentTelegram(db, en.talent_id, msg);
  } catch { /* best-effort */ }
  return NextResponse.json({ ok: true });
}

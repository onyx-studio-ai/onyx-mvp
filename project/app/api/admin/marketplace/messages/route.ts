import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { sendEmail } from '@/lib/mail';
import { plainNoticeEmail } from '@/lib/mail-templates';
import { notifyTalentTelegram } from '@/lib/telegram';
import { notifyTalentLine } from '@/lib/line';

/*
  Admin view into any marketplace thread (Onyx sees every conversation).
  GET  ?brief_id=&talent_id=  → all messages in that thread.
  POST { brief_id, talent_id, body } → post into the thread as 'admin' (Onyx).
*/

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { searchParams } = new URL(request.url);
  const briefId = searchParams.get('brief_id') || '';
  const talentId = searchParams.get('talent_id') || '';
  if (!briefId || !talentId) return NextResponse.json({ error: 'brief_id and talent_id are required' }, { status: 400 });
  try {
    const db = getSupabaseServiceClient();
    // 'direct' = 平台直訊(不掛案件,brief_id 為 null;Wing 2026-07-18:沒接過案的人也要能溝通)
    let qy = db
      .from('marketplace_messages')
      .select('id, sender_type, sender_name, body, attachments, created_at')
      .eq('talent_id', talentId);
    qy = briefId === 'direct' ? qy.is('brief_id', null) : qy.eq('brief_id', briefId);
    const { data } = await qy
      .order('created_at', { ascending: true })
      .limit(500);
    return NextResponse.json({ messages: data || [] });
  } catch {
    return NextResponse.json({ messages: [], unavailable: true });
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const db = getSupabaseServiceClient();
    const { brief_id: briefId, talent_id: talentId, body: rawBody, attachments: rawAtt } = await request.json();
    const body = String(rawBody || '').trim().slice(0, 4000);
    // 附件:只有後台能上傳(talent 端 API 完全不收這個欄位;客戶端白名單也不回)。
    // 圖片/文件為主;音檔/影片擋掉 —— 試音、完成檔必須走正式交付流程,不能塞聊天室。
    const STORE_PREFIX = `${(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '')}/storage/v1/object/public/`;
    const BLOCKED_EXT = /\.(mp3|wav|m4a|aac|flac|ogg|opus|mp4|mov|avi|mkv|webm)(\?|$)/i;
    const attachments = (Array.isArray(rawAtt) ? rawAtt : []).slice(0, 5)
      .map((a: { name?: unknown; url?: unknown }) => ({ name: String(a?.name || '檔案').slice(0, 120), url: String(a?.url || '') }))
      .filter((a) => a.url.startsWith(STORE_PREFIX) && !BLOCKED_EXT.test(a.url));
    if (!briefId || !talentId || (!body && !attachments.length)) return NextResponse.json({ error: 'brief_id, talent_id and body are required' }, { status: 400 });
    const isDirect = briefId === 'direct';
    const { data, error } = await db
      .from('marketplace_messages')
      // 有附件才帶欄位 —— migration(attachments 欄)沒跑之前,純文字訊息照常能發。
      .insert({ brief_id: isDirect ? null : briefId, talent_id: talentId, sender_type: 'admin', sender_name: 'Onyx', body: body || '(附件)', ...(attachments.length ? { attachments } : {}) })
      .select('id, sender_type, sender_name, body, attachments, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // 主動通知配音員(2026-07-16 Wing:催補錄貼了沒人看到等於沒貼)——
    // email(佔位信箱跳過)+ Telegram(有綁才會到),best-effort 不擋訊息本身。
    try {
      const [{ data: t }, { data: b }] = await Promise.all([
        db.from('talents').select('email, name').eq('id', talentId).maybeSingle(),
        isDirect ? Promise.resolve({ data: null }) : db.from('marketplace_briefs').select('title').eq('id', briefId).maybeSingle(),
      ]);
      const title = isDirect ? 'Onyx 平台訊息' : ((b?.title as string) || '配音案件');
      const email = String(t?.email || '');
      if (email && !email.endsWith('@invite.onyxstudios.ai')) {
        const note = plainNoticeEmail({
          subject: `Onyx 有新訊息 — ${title}`, headline: '您有一則新訊息', sub: title, cardTitle: '案件訊息',
          paragraphs: [`${t?.name ? t.name + ' ' : ''}您好,`, `Onyx 在「${title}」留了新訊息給您:`],
          quote: body.slice(0, 3800) + (attachments.length ? `
(含 ${attachments.length} 個附件)` : ''),
          ctaText: '前往後台查看與回覆', ctaUrl: 'https://www.onyxstudios.ai/talent/opportunities',
          footnote: '小提醒:到後台首頁點「綁定 LINE / Telegram」,之後通知即時推送、不漏接。',
        });
        sendEmail({ category: 'PRODUCTION', to: email, subject: note.subject, html: note.html }).catch(() => {});
      }
      notifyTalentTelegram(db, talentId, `💬 Onyx 新訊息(${title}):${body.slice(0, 200)}${body.length > 200 ? '…' : ''}\nhttps://www.onyxstudios.ai/talent/opportunities`);
      notifyTalentLine(db, talentId, `💬 Onyx 新訊息(${title}):${body.slice(0, 200)}${body.length > 200 ? '…' : ''}${attachments.length ? `(含 ${attachments.length} 個附件)` : ''}\nhttps://www.onyxstudios.ai/talent/opportunities`);
    } catch { /* 通知失敗不影響訊息已送 */ }
    return NextResponse.json({ message: data });
  } catch {
    return NextResponse.json({ error: 'Could not send message' }, { status: 500 });
  }
}

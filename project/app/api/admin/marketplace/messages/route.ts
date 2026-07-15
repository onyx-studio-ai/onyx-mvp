import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { sendEmail } from '@/lib/mail';
import { notifyTalentTelegram } from '@/lib/telegram';

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
    const { data } = await db
      .from('marketplace_messages')
      .select('id, sender_type, sender_name, body, created_at')
      .eq('brief_id', briefId)
      .eq('talent_id', talentId)
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
    const { brief_id: briefId, talent_id: talentId, body: rawBody } = await request.json();
    const body = String(rawBody || '').trim().slice(0, 4000);
    if (!briefId || !talentId || !body) return NextResponse.json({ error: 'brief_id, talent_id and body are required' }, { status: 400 });
    const { data, error } = await db
      .from('marketplace_messages')
      .insert({ brief_id: briefId, talent_id: talentId, sender_type: 'admin', sender_name: 'Onyx', body })
      .select('id, sender_type, sender_name, body, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // 主動通知配音員(2026-07-16 Wing:催補錄貼了沒人看到等於沒貼)——
    // email(佔位信箱跳過)+ Telegram(有綁才會到),best-effort 不擋訊息本身。
    try {
      const [{ data: t }, { data: b }] = await Promise.all([
        db.from('talents').select('email, name').eq('id', talentId).maybeSingle(),
        db.from('marketplace_briefs').select('title').eq('id', briefId).maybeSingle(),
      ]);
      const title = (b?.title as string) || '配音案件';
      const email = String(t?.email || '');
      if (email && !email.endsWith('@invite.onyxstudios.ai')) {
        sendEmail({ category: 'PRODUCTION', to: email, subject: `Onyx 有新訊息 — ${title}`,
          html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.7;color:#222"><p>您好,</p><p>Onyx 在「<strong>${title}</strong>」留了新訊息給您:</p><blockquote style="border-left:3px solid #f59e0b;margin:8px 0;padding:6px 12px;color:#444;white-space:pre-wrap">${body.slice(0, 600)}</blockquote><p><a href="https://www.onyxstudios.ai/talent/opportunities">前往後台查看與回覆 →</a></p></div>` }).catch(() => {});
      }
      notifyTalentTelegram(db, talentId, `💬 Onyx 新訊息(${title}):${body.slice(0, 200)}${body.length > 200 ? '…' : ''}\nhttps://www.onyxstudios.ai/talent/opportunities`);
    } catch { /* 通知失敗不影響訊息已送 */ }
    return NextResponse.json({ message: data });
  } catch {
    return NextResponse.json({ error: 'Could not send message' }, { status: 500 });
  }
}

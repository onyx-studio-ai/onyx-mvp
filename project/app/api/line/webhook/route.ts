import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { replyLine } from '@/lib/line';

/*
  LINE Messaging API webhook(OnyxStudios.ai 官方帳號,全自動、無人工聊天)。
  - 驗簽:X-Line-Signature = HMAC-SHA256(channel secret, raw body) base64。
  - 綁定:配音員從後台拿 6 碼綁定碼,加好友後把碼傳進聊天室 → 對應 talents.line_user_id。
  - 其他訊息:自動回覆導流(官網/申請/後台訊息)—— Wing 拍板此帳號不開人工聊天。
  - unfollow(封鎖):清掉綁定,推播不再嘗試。
  永遠回 200,LINE 才不會重送。
*/

export const runtime = 'nodejs';

type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type?: string; text?: string };
};

const AUTO_REPLY = `感謝您的訊息!此帳號為自動服務:

▶ 試聽聲音、發案報價:
https://www.onyxstudios.ai

▶ 想成為配音員:
https://www.onyxstudios.ai/apply/voice

▶ 平台配音員的案件問題,請登入後台用「訊息」功能留言,製作部都會即時收到並回覆:
https://www.onyxstudios.ai/talent`;

const WELCOME = `歡迎加入 Onyx Studios!

我們提供真人配音、AI 聲音合成與音樂製作。

▶ 試聽與發案:https://www.onyxstudios.ai
▶ 成為配音員:https://www.onyxstudios.ai/apply/voice

已經是平台配音員嗎?到後台按「綁定 LINE 通知」拿綁定碼,把碼傳到這裡,之後開錄通知、案件訊息、交件提醒都會直接推給您。`;

function verifySignature(raw: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return false;
  if (!signature) return false;
  const mac = createHmac('sha256', secret).update(raw).digest();
  const given = Buffer.from(signature, 'base64');
  return mac.length === given.length && timingSafeEqual(mac, given);
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get('x-line-signature'))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: { events?: LineEvent[] };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }); }
  const db = getSupabaseServiceClient();

  for (const ev of body.events || []) {
    const userId = ev.source?.userId || '';
    try {
      if (ev.type === 'follow' && ev.replyToken) {
        await replyLine(ev.replyToken, WELCOME);
        continue;
      }
      if (ev.type === 'unfollow' && userId) {
        // 封鎖 = 解綁,推播額度不浪費在送不到的人身上
        await db.from('talents').update({ line_user_id: null }).eq('line_user_id', userId);
        continue;
      }
      if (ev.type === 'message' && ev.message?.type === 'text' && ev.replyToken) {
        const text = String(ev.message.text || '').trim();
        // 綁定碼:6 碼大寫英數(後台發的),容忍前後空白與小寫
        const code = text.toUpperCase();
        if (/^[A-Z0-9]{6}$/.test(code) && userId) {
          const { data: talent } = await db.from('talents').select('id, name').eq('line_link_token', code).maybeSingle();
          if (talent) {
            await db.from('talents').update({ line_user_id: userId, line_link_token: null }).eq('id', talent.id);
            await replyLine(ev.replyToken, `✅ 已綁定 Onyx Studios 通知${talent.name ? `(${talent.name})` : ''}。\n之後開錄通知、案件訊息、交件提醒都會推送到這裡。\n\n⚠️ 此帳號為自動服務,請勿在此回覆案件內容 —— 要回覆請到平台後台的「訊息」頁,我們會在那邊看到。`);
            continue;
          }
          await replyLine(ev.replyToken, '這組綁定碼對不上或已使用過。請回到配音員後台重新按「綁定 LINE 通知」拿一組新的碼,再傳過來。');
          continue;
        }
        await replyLine(ev.replyToken, AUTO_REPLY);
      }
    } catch { /* 單一事件失敗不影響其他事件,也不讓 LINE 重送 */ }
  }
  return NextResponse.json({ ok: true });
}

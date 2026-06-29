import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { sendTelegram } from '@/lib/telegram';

/*
  Telegram pushes bot updates here. We only act on "/start <token>": match the
  token to a talent (their personal deep-link from /api/talent/telegram) and bind
  that chat. Secured by the secret Telegram echoes in the header below (set when
  the webhook is registered). Always returns 200 so Telegram doesn't retry.
*/

type TgUpdate = { message?: { chat?: { id?: number | string }; text?: string } };

export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && request.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TgUpdate;
  try { update = await request.json(); } catch { return NextResponse.json({ ok: true }); }

  const chatId = update.message?.chat?.id;
  const text = String(update.message?.text || '');
  if (chatId && text.startsWith('/start')) {
    const linkToken = text.split(/\s+/)[1] || '';
    if (linkToken) {
      const db = getSupabaseServiceClient();
      const { data: talent } = await db.from('talents').select('id, name').eq('telegram_link_token', linkToken).maybeSingle();
      if (talent) {
        await db.from('talents').update({ telegram_chat_id: String(chatId) }).eq('id', talent.id);
        await sendTelegram(chatId, `✅ 已綁定 Onyx Studios 通知${talent.name ? `(${talent.name})` : ''}。\n之後有得標、客戶訊息、修改要求,都會在這裡通知您。\n\n⚠️ 這裡是單向通知,請勿在此回覆 —— 要回覆客戶或我們,請到平台的「訊息」頁。`);
        return NextResponse.json({ ok: true });
      }
    }
    await sendTelegram(chatId, '請從 Onyx Studios 配音員後台點「綁定 Telegram」進來,才能對應到您的帳號。');
    return NextResponse.json({ ok: true });
  }
  // Notification-only bot: anything the talent types here goes nowhere useful
  // (we don't read/store it). Reply to set expectations + avoid the impression
  // that messaging the bot reaches us.
  if (chatId && text && !text.startsWith('/')) {
    await sendTelegram(chatId, '這是 Onyx Studios 的通知機器人,沒辦法在這裡回覆喔 🙏 有任何需要,請到 https://www.onyxstudios.ai/talent 的「訊息」回覆,我們會在那邊看到。');
  }
  return NextResponse.json({ ok: true });
}

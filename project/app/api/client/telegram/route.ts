import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { telegramBotUsername } from '@/lib/telegram';

/*
  客戶端 Telegram 綁定(與 /api/talent/telegram 同款,身分=登入客戶的 email,
  存 line_email_bindings.telegram_*)。綁定後平台通知信同步推 Telegram 提醒。
    GET    → { linked, botConfigured, link } — t.me deep-link,點開即綁
    DELETE → 解除綁定。
*/

async function callerEmail(request: NextRequest): Promise<string | null> {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const db = getSupabaseServiceClient();
  const { data, error } = await db.auth.getUser(token);
  const email = data?.user?.email;
  return error || !email ? null : email.toLowerCase();
}

export async function GET(request: NextRequest) {
  const email = await callerEmail(request);
  if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const db = getSupabaseServiceClient();
  const bot = telegramBotUsername();
  try {
    const { data: row } = await db.from('line_email_bindings').select('telegram_chat_id, telegram_link_token').eq('email', email).maybeSingle();
    let token = row?.telegram_link_token || '';
    if (!row?.telegram_chat_id && !token) {
      token = randomUUID().replace(/-/g, '');
      await db.from('line_email_bindings').upsert({ email, telegram_link_token: token }, { onConflict: 'email' });
    }
    return NextResponse.json({
      linked: !!row?.telegram_chat_id,
      botConfigured: !!bot,
      link: bot && token ? `https://t.me/${bot}?start=${token}` : null,
    });
  } catch {
    return NextResponse.json({ linked: false, botConfigured: false, link: null, unavailable: true });
  }
}

export async function DELETE(request: NextRequest) {
  const email = await callerEmail(request);
  if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const db = getSupabaseServiceClient();
  await db.from('line_email_bindings').update({ telegram_chat_id: null, telegram_link_token: null }).eq('email', email);
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { resolveTalentFromRequest } from '@/lib/talent-auth';
import { telegramBotUsername } from '@/lib/telegram';

/*
  Talent-side Telegram binding.
    GET    → { linked, botConfigured, link } — `link` is a personal t.me deep-link
             (https://t.me/<bot>?start=<token>) that, when opened, binds this
             talent's chat via /api/telegram/webhook. Lazily mints the token.
    DELETE → unlink (clears telegram_chat_id).
  (needs migration 20260629160000_talent_telegram)
*/

export async function GET(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id, telegram_chat_id, telegram_link_token');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const t = r.talent as { id: string; telegram_chat_id?: string | null; telegram_link_token?: string | null };
  const bot = telegramBotUsername();
  let token = t.telegram_link_token || '';
  if (!token) {
    token = randomUUID().replace(/-/g, '');
    await r.db.from('talents').update({ telegram_link_token: token }).eq('id', t.id);
  }
  return NextResponse.json({
    linked: !!t.telegram_chat_id,
    botConfigured: !!bot,
    link: bot ? `https://t.me/${bot}?start=${token}` : null,
  });
}

export async function DELETE(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const t = r.talent as { id: string };
  await r.db.from('talents').update({ telegram_chat_id: null }).eq('id', t.id);
  return NextResponse.json({ ok: true });
}

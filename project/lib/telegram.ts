import type { SupabaseClient } from '@supabase/supabase-js';

/*
  Telegram push notifications for talents (opt-in via the bot deep-link).
  Entirely DORMANT until TELEGRAM_BOT_TOKEN is set + the talent has linked their
  chat — every function no-ops otherwise, so it's safe to ship before the bot
  exists. Talent binding lives in /api/telegram/webhook + /api/talent/telegram.
*/

const API = 'https://api.telegram.org';

export function telegramBotUsername() {
  return (process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '');
}

// Low-level send. Best-effort: notifications never block or throw.
export async function sendTelegram(chatId: string | number | null | undefined, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;
  try {
    await fetch(`${API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
  } catch { /* best-effort */ }
}

// Look up a talent's linked chat and notify them. Kept independent of the
// caller's existing queries (and wrapped in try/catch) so it stays a no-op —
// not an error — if the telegram columns aren't migrated yet.
export async function notifyTalentTelegram(db: SupabaseClient, talentId: string | null | undefined, text: string) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !talentId) return;
  try {
    const { data, error } = await db.from('talents').select('telegram_chat_id').eq('id', talentId).maybeSingle();
    if (error || !data?.telegram_chat_id) return;
    await sendTelegram(data.telegram_chat_id as string, text);
  } catch { /* columns not migrated / lookup failed — skip silently */ }
}

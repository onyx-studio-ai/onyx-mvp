import type { SupabaseClient } from '@supabase/supabase-js';

/*
  Discord push notifications for talents (opt-in via OAuth,見 /api/talent/discord)。
  照 lib/telegram.ts 的休眠設計:DISCORD_BOT_TOKEN 沒設、或配音員沒綁,一律 no-op,
  程式可以先上、金鑰後補。

  發 DM 走純 REST(建 DM channel → 發訊息),不需要 Gateway 連線,serverless 可用。
  限制:bot 要與使用者共享伺服器才能開 DM —— 綁定流程用 guilds.join 自動把
  使用者加進 Onyx 伺服器(見 /api/discord/callback),所以正常綁定完就滿足。
*/

const API = 'https://discord.com/api/v10';

export function discordConfigured() {
  return !!(process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);
}

// Low-level DM send. Best-effort: notifications never block or throw.
export async function sendDiscord(userId: string | null | undefined, text: string) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token || !userId) return;
  try {
    const ch = await fetch(`${API}/users/@me/channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bot ${token}` },
      body: JSON.stringify({ recipient_id: userId }),
    });
    if (!ch.ok) return;
    const { id } = await ch.json();
    await fetch(`${API}/channels/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bot ${token}` },
      body: JSON.stringify({ content: text.slice(0, 2000) }),
    });
  } catch { /* best-effort */ }
}

// 查配音員綁定的 Discord user id 並通知。欄位還沒 migration 時靜默跳過。
export async function notifyTalentDiscord(db: SupabaseClient, talentId: string | null | undefined, text: string) {
  if (!process.env.DISCORD_BOT_TOKEN || !talentId) return;
  try {
    const { data, error } = await db.from('talents').select('discord_user_id').eq('id', talentId).maybeSingle();
    if (error || !data?.discord_user_id) return;
    await sendDiscord(data.discord_user_id as string, text);
  } catch { /* columns not migrated / lookup failed — skip silently */ }
}

import type { SupabaseClient } from '@supabase/supabase-js';

/*
  LINE 官方帳號(OnyxStudios.ai)推播通知 —— 與 lib/telegram.ts 同款設計:
  金鑰(LINE_CHANNEL_ACCESS_TOKEN)沒設或配音員沒綁定時,所有函式安靜 no-op,
  先上程式後補金鑰也不會壞。綁定流程在 /api/line/webhook + /api/talent/line。
*/

const API = 'https://api.line.me/v2/bot';

export function lineConfigured() {
  return !!process.env.LINE_CHANNEL_ACCESS_TOKEN;
}

// LINE 官方帳號的 Basic ID(如 @123abcd),給「加好友」連結用;沒設就不顯示綁定入口。
export function lineOaUrl() {
  const id = (process.env.LINE_OA_BASIC_ID || '').trim();
  if (!id) return null;
  return `https://line.me/R/ti/p/${encodeURIComponent(id.startsWith('@') ? id : `@${id}`)}`;
}

// 主動推播(計入 OA 每月推播額度)。best-effort,絕不 throw。
export async function sendLine(userId: string | null | undefined, text: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token || !userId) return;
  try {
    await fetch(`${API}/message/push`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: userId, messages: [{ type: 'text', text: text.slice(0, 4900) }] }),
    });
  } catch { /* best-effort */ }
}

// 回覆訊息(用 replyToken,免費、不吃推播額度)—— webhook 自動回覆走這條。
export async function replyLine(replyToken: string, text: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token || !replyToken) return;
  try {
    await fetch(`${API}/message/reply`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ replyToken, messages: [{ type: 'text', text: text.slice(0, 4900) }] }),
    });
  } catch { /* best-effort */ }
}

// 查配音員綁定的 LINE userId 並通知。欄位還沒 migration 時安靜跳過。
export async function notifyTalentLine(db: SupabaseClient, talentId: string | null | undefined, text: string) {
  if (!lineConfigured() || !talentId) return;
  try {
    const { data, error } = await db.from('talents').select('line_user_id').eq('id', talentId).maybeSingle();
    if (error || !data?.line_user_id) return;
    await sendLine(data.line_user_id as string, text);
  } catch { /* skip silently */ }
}

// 「Email 鏡像」:任何 sendEmail 寄出的信,若收件人在 line_email_bindings 綁過
// LINE(客戶端綁定入口),同步推一則「有新通知」到 LINE。只推主旨不推內文 ——
// 信件可能含敏感連結(重設密碼等),LINE 只當提醒鈴。表沒建/沒綁 = 安靜跳過。
export async function notifyEmailLine(db: SupabaseClient, email: string | null | undefined, subject: string) {
  if (!lineConfigured() || !email) return;
  try {
    const { data, error } = await db.from('line_email_bindings').select('line_user_id').eq('email', email.toLowerCase()).maybeSingle();
    if (error || !data?.line_user_id) return;
    await sendLine(data.line_user_id as string, `📩 ${subject}\n\n詳情請查看 Email,或前往 https://www.onyxstudios.ai/dashboard`);
  } catch { /* skip silently */ }
}

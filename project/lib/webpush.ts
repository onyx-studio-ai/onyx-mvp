import type { SupabaseClient } from '@supabase/supabase-js';
import webpush from 'web-push';

/*
  網頁推播(Web Push)— 照 lib/telegram.ts 的休眠設計:VAPID 金鑰沒設、配音員
  沒訂閱,一律 no-op。訂閱存 talents.push_subscriptions(jsonb 陣列,支援多裝置)。
  已失效的訂閱(410/404,例如使用者清了瀏覽器資料)發送時順手清掉。
*/

type PushSub = { endpoint: string; keys: { p256dh: string; auth: string } };

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:support@onyxstudios.ai', pub, priv);
  configured = true;
  return true;
}

export function webPushConfigured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

// 通知配音員的所有已訂閱裝置。失效訂閱自動剔除。
export async function notifyTalentPush(db: SupabaseClient, talentId: string | null | undefined, text: string, url?: string) {
  if (!talentId || !ensureConfigured()) return;
  try {
    const { data, error } = await db.from('talents').select('push_subscriptions').eq('id', talentId).maybeSingle();
    if (error) return;
    const subs = (data?.push_subscriptions as PushSub[] | null) || [];
    if (!subs.length) return;
    const payload = JSON.stringify({ title: 'Onyx Studios', body: text.slice(0, 500), url: url || '/talent/opportunities' });
    const dead: string[] = [];
    await Promise.all(subs.map(async (s) => {
      try { await webpush.sendNotification(s as webpush.PushSubscription, payload); }
      catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.endpoint);
      }
    }));
    if (dead.length) {
      const alive = subs.filter((s) => !dead.includes(s.endpoint));
      await db.from('talents').update({ push_subscriptions: alive }).eq('id', talentId);
    }
  } catch { /* columns not migrated / send failed — skip silently */ }
}

import type { SupabaseClient } from '@supabase/supabase-js';
import { notifyTalentDiscord } from '@/lib/discord';
import { notifyTalentPush } from '@/lib/webpush';

/*
  新增通知管道的單一入口:Discord DM + 網頁推播。
  在既有的 notifyTalentLine / notifyTalentTelegram 呼叫點旁邊加一行這個即可;
  兩個管道都是休眠設計(金鑰/欄位/訂閱缺一律 no-op),永不 throw。
*/
export function notifyTalentExtra(db: SupabaseClient, talentId: string | null | undefined, text: string) {
  notifyTalentDiscord(db, talentId, text).catch(() => {});
  notifyTalentPush(db, talentId, text).catch(() => {});
}

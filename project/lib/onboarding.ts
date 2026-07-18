import { randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/*
  平台自控的帳號開通碼 —— 取代 Supabase 一次性 recovery token(會過期、重生作廢)。
  病根:Supabase recovery link 綁它自己的 OTP 過期規則,且為同一人再生一條會作廢舊的
  → 配音員半夜收到、隔天點就失效(謝依純/佑芷/Ashley 反覆踩)。
  治法:開通碼存 talents.onboarding_token(長隨機),30 天有效,「重發沿用未過期的舊碼」
  → 同一人的連結永遠是同一條、不作廢;設密碼時後端用 admin 直接改密碼,不碰 Supabase OTP。
*/

const TTL_DAYS = 30;

// 生成(或沿用未過期的)開通連結。同一人重複呼叫回同一條 → 解決「重生作廢」。
export async function mintOnboardingLink(db: SupabaseClient, talentId: string, sitePrefix: string): Promise<string | null> {
  const { data: t } = await db.from('talents').select('id, onboarding_token, onboarding_expires').eq('id', talentId).maybeSingle();
  if (!t) return null;
  let token = (t as { onboarding_token?: string | null }).onboarding_token || '';
  const exp = (t as { onboarding_expires?: string | null }).onboarding_expires;
  const stillValid = token && exp && new Date(exp).getTime() > Date.now();
  if (!stillValid) {
    token = randomBytes(24).toString('base64url');
    await db.from('talents').update({
      onboarding_token: token,
      onboarding_expires: new Date(Date.now() + TTL_DAYS * 86400_000).toISOString(),
    }).eq('id', talentId);
  }
  return `${sitePrefix}/auth/activate?ot=${encodeURIComponent(token)}`;
}

// 驗證開通碼 → 回對應的 talent(未過期才回)。給設密碼頁用。
export async function resolveOnboardingToken(db: SupabaseClient, token: string): Promise<{ id: string; email: string; auth_user_id: string | null; name: string | null } | null> {
  const clean = String(token || '').trim();
  if (!clean) return null;
  const { data: t } = await db.from('talents')
    .select('id, email, auth_user_id, name, onboarding_expires')
    .eq('onboarding_token', clean).maybeSingle();
  if (!t) return null;
  const exp = (t as { onboarding_expires?: string | null }).onboarding_expires;
  if (!exp || new Date(exp).getTime() < Date.now()) return null;   // 過期
  return { id: t.id as string, email: (t.email as string) || '', auth_user_id: (t.auth_user_id as string) || null, name: (t.name as string) || null };
}

// 用掉開通碼(設密碼成功後清掉,不能再用)。
export async function consumeOnboardingToken(db: SupabaseClient, talentId: string): Promise<void> {
  await db.from('talents').update({ onboarding_token: null, onboarding_expires: null }).eq('id', talentId);
}

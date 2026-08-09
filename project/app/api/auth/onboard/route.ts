import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { resolveOnboardingToken, consumeOnboardingToken } from '@/lib/onboarding';

/*
  平台自控開通 —— activate 頁用。不碰 Supabase 一次性 OTP。
  GET  ?token=  → { ok, email, name } 驗證開通碼(給頁面顯示「為 X 設定密碼」)
  POST { token, password } → 用 admin 直接設密碼(無 auth 帳號則建),清掉開通碼,回 { email }
                             → 前端拿 email+password signInWithPassword 即登入。
  開通碼是我們自己發的 30 天長隨機字串,等同一次性授權,安全。
*/
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token') || '';
  const db = getSupabaseServiceClient();
  const t = await resolveOnboardingToken(db, token);
  if (!t) return NextResponse.json({ ok: false, error: 'invalid or expired' }, { status: 404 });
  return NextResponse.json({ ok: true, email: t.email, name: t.name });
}

export async function POST(request: NextRequest) {
  let b: { token?: string; password?: string };
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const token = String(b.token || '').trim();
  const password = String(b.password || '');
  if (password.length < 8) return NextResponse.json({ error: '密碼至少 8 個字' }, { status: 400 });

  const db = getSupabaseServiceClient();
  const t = await resolveOnboardingToken(db, token);
  if (!t) return NextResponse.json({ error: '連結已失效,請向我們索取新連結。' }, { status: 404 });
  if (!t.email || t.email.endsWith('@invite.onyxstudios.ai')) {
    return NextResponse.json({ error: '這個帳號還沒有可登入的 Email,請先聯絡我們補上常用信箱。' }, { status: 400 });
  }

  // 先確保 auth 帳號存在(沒有就建;email_confirm 直接視為已驗證),再統一設密碼。
  let authId = t.auth_user_id;
  if (!authId) {
    const { data, error } = await db.auth.admin.createUser({ email: t.email, email_confirm: true });
    authId = data?.user?.id || null;
    // email 已有 auth 帳號但 talents 沒鏈到 → createUser 撞「已存在」;
    // 用 email 找回既有帳號沿用,不然真人點連結會卡 500(2026-08-09 寄信前檢查抓到)
    if (!authId) {
      const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
      authId = list?.users?.find((u) => (u.email || '').toLowerCase() === t.email.toLowerCase())?.id || null;
    }
    if (!authId) return NextResponse.json({ error: error?.message || '帳號建立失敗,請稍後再試。' }, { status: 500 });
    await db.from('talents').update({ auth_user_id: authId }).eq('id', t.id);
  }
  const { error: pwErr } = await db.auth.admin.updateUserById(authId, { password });
  if (pwErr) return NextResponse.json({ error: pwErr.message }, { status: 500 });

  await consumeOnboardingToken(db, t.id);   // 用掉,不能再用
  return NextResponse.json({ ok: true, email: t.email });
}

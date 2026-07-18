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

  // 設密碼:有 auth 帳號就改,沒有就建(email_confirm 直接視為已驗證)
  let authId = t.auth_user_id;
  if (authId) {
    const { error } = await db.auth.admin.updateUserById(authId, { password });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { data, error } = await db.auth.admin.createUser({ email: t.email, password, email_confirm: true });
    authId = data?.user?.id || null;
    if (error && !authId) return NextResponse.json({ error: error.message }, { status: 500 });
    if (authId) await db.from('talents').update({ auth_user_id: authId }).eq('id', t.id);
  }

  await consumeOnboardingToken(db, t.id);   // 用掉,不能再用
  return NextResponse.json({ ok: true, email: t.email });
}

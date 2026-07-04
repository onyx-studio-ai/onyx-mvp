import { supabase } from '@/lib/supabase';

/*
  authedFetch —— 帶著「當下最新」的 Supabase access_token 去打自家 /api。

  為什麼要有這支:各頁若在元件掛載時 supabase.auth.getSession() 拿一次 token、
  存進 useState,之後所有 fetch 都帶那個「掛載時的舊 token」;access_token 預設
  1 小時過期,client 雖已在背景 refresh 出新 token,但 state 裡還是舊的 →
  1 小時後所有 authed API 回 401「Invalid or expired session」,配音員填久一點
  就被登出、上傳/存草稿失敗。

  解法:每次呼叫都即時 getSession() 拿最新有效 token(autoRefreshToken 已開,
  getSession 回的就是續好的 token),再併進 Authorization header。呼叫端原本帶的
  method / body / 其他 header 一律保留。

  沒有 session/token 時「不硬送」:回一個 status 401 的 Response,呼叫端原本
  `if (!res.ok)` / `if (res.status === 401)` 的分支就會自然接手(導去登入 / 顯示
  未授權),不需要改動既有錯誤處理邏輯。
*/
export async function authedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    // 沒有有效 session → 回一個明確的 401,讓呼叫端沿用既有的未授權處理,不硬送空 token。
    return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

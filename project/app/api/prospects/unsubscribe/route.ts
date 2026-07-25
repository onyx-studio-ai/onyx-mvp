import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  潛在名單退訂 —— 招募信底部連結 /api/prospects/unsubscribe?token=<unsub_token>。
  公開端點(無 auth):憑 token 把該 prospect 標 suppressed(黑名單,永不再寄)。
  冪等:已退訂再點一樣顯示成功。
*/
function page(msg: string) {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Onyx Studios</title>`
    + `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:480px;margin:80px auto;padding:0 20px;text-align:center;color:#111">`
    + `<h2 style="margin-bottom:8px">Onyx Studios</h2><p style="color:#374151;line-height:1.6">${msg}</p></div>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token') || '';
  if (!token) return page('Invalid unsubscribe link.');
  const db = getSupabaseServiceClient();
  const { data } = await db.from('prospects')
    .update({ status: 'suppressed', updated_at: new Date().toISOString() })
    .eq('unsub_token', token).select('email').maybeSingle();
  if (!data) return page('This unsubscribe link is not valid.');
  return page(`You've been unsubscribed. We won't email you about casting opportunities again.`);
}

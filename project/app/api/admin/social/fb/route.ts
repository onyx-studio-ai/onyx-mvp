import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';

/*
  Onyx 官方 FB 粉專一鍵發文。

  FB 粉專走 graph.facebook.com/v23.0(與 IG 是兩套獨立 API):
    - 純文字 / 帶連結 → POST /{FB_PAGE_ID}/feed  body { message, link?, access_token }
    - 帶單圖         → POST /{FB_PAGE_ID}/photos body { url, caption, access_token }
      (url = 我們自己 social-media bucket 的 public URL;Facebook 端自己去抓)

  🔒 金鑰鐵則:只從環境變數讀,程式碼零寫死。Wing 在 Vercel 填:
    FB_PAGE_ID              (粉專的 Page ID)
    FB_PAGE_ACCESS_TOKEN    (該粉專的 Page Access Token)
  任一缺失 → 回明確繁中錯誤(非 500 throw)。
*/

export const runtime = 'nodejs';
export const maxDuration = 30;

const GRAPH = 'https://graph.facebook.com/v23.0';

/** 把 Graph API 的錯誤結構透傳成繁中訊息 */
function graphErrorMessage(json: unknown, raw: string, httpStatus: number): string {
  const j = json as { error?: { message?: string; type?: string; code?: number } } | null;
  const e = j?.error;
  if (e?.message) {
    const codePart = e.code != null ? `(code ${e.code})` : '';
    return `FB API 發文失敗(HTTP ${httpStatus}${codePart}):${e.message}`;
  }
  return `FB API 發文失敗(HTTP ${httpStatus}):${raw || '(FB 未提供訊息)'}`;
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  // 🔒 金鑰只從環境變數讀
  const pageId = process.env.FB_PAGE_ID;
  const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageId || !accessToken) {
    return NextResponse.json(
      { error: 'FB 金鑰未設定,請先在 Vercel 環境變數填入 FB_PAGE_ID 與 FB_PAGE_ACCESS_TOKEN' },
      { status: 400 },
    );
  }

  let body: { text?: string; link?: string; imageUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '請求格式錯誤(不是有效的 JSON)' }, { status: 400 });
  }

  const text = String(body.text || '').trim();
  const link = String(body.link || '').trim();
  const imageUrl = String(body.imageUrl || '').trim();

  // 帶圖時 caption 可空(純圖也行);純文字則 message 必填
  if (!imageUrl && !text) {
    return NextResponse.json({ error: '請輸入貼文內容(或附上圖片)' }, { status: 400 });
  }

  try {
    let endpoint: string;
    const form = new URLSearchParams();
    form.set('access_token', accessToken);

    if (imageUrl) {
      // 帶單圖 → /photos,caption = 主文
      endpoint = `${GRAPH}/${encodeURIComponent(pageId)}/photos`;
      form.set('url', imageUrl);
      if (text) form.set('caption', text);
    } else {
      // 純文字 / 帶連結 → /feed
      endpoint = `${GRAPH}/${encodeURIComponent(pageId)}/feed`;
      form.set('message', text);
      if (link) form.set('link', link);
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    const raw = await res.text();
    let json: unknown = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      /* 非 JSON 回應,下面用 raw 透傳 */
    }

    if (!res.ok) {
      return NextResponse.json({ error: graphErrorMessage(json, raw, res.status) }, { status: 502 });
    }

    // /feed 回 { id: "<pageid>_<postid>" };/photos 回 { id, post_id }
    const j = json as { id?: string; post_id?: string } | null;
    const postId = j?.post_id || j?.id;
    if (!postId) {
      return NextResponse.json(
        { error: `FB API 回應異常,取不到貼文 id:${raw || '(空回應)'}` },
        { status: 502 },
      );
    }
    const url = `https://www.facebook.com/${postId}`;
    return NextResponse.json({ ok: true, postId, url });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'FB 發文失敗';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

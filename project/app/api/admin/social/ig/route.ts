import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';

/*
  Onyx 官方 IG 一鍵發文(新版 Instagram 登入 token)。

  IG 走 graph.instagram.com/v23.0(與 FB 是兩套獨立 API)。
  🚨 IG 強制要媒體(圖或影片),不能純文字。

  兩步流程:
    ① 建 container:POST /{IG_USER_ID}/media
         圖:{ image_url, caption, access_token }
         影片:{ video_url, caption, media_type=REELS, access_token }
       → 拿 creation_id
    ② 發布:POST /{IG_USER_ID}/media_publish { creation_id, access_token } → 拿 media id
    (影片要先輪詢 container 的 status_code=FINISHED 才能發布:
       GET /{creation_id}?fields=status_code)

  🔒 金鑰鐵則:只從環境變數讀,程式碼零寫死。Wing 在 Vercel 填:
    IG_USER_ID       (Instagram 專業帳號的 user id)
    IG_ACCESS_TOKEN  (新版 Instagram 登入 access token)
  任一缺失 → 回明確繁中錯誤(非 500 throw)。
*/

export const runtime = 'nodejs';
export const maxDuration = 60;

const GRAPH = 'https://graph.instagram.com/v23.0';

// 影片 container 輪詢設定:最多約 55 秒(留 5 秒給發布,不超過 maxDuration=60)
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 18;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 把 Graph API 錯誤結構透傳成繁中訊息 */
function graphErrorMessage(json: unknown, raw: string, httpStatus: number, stage: string): string {
  const j = json as { error?: { message?: string; code?: number } } | null;
  const e = j?.error;
  if (e?.message) {
    const codePart = e.code != null ? `(code ${e.code})` : '';
    return `IG API ${stage}失敗(HTTP ${httpStatus}${codePart}):${e.message}`;
  }
  return `IG API ${stage}失敗(HTTP ${httpStatus}):${raw || '(IG 未提供訊息)'}`;
}

/** POST 到 Graph(x-www-form-urlencoded),回 { ok, status, json, raw } */
async function graphPost(endpoint: string, form: URLSearchParams) {
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
    /* 非 JSON,用 raw 透傳 */
  }
  return { ok: res.ok, status: res.status, json, raw };
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  // 🔒 金鑰只從環境變數讀
  const igUserId = process.env.IG_USER_ID;
  const accessToken = process.env.IG_ACCESS_TOKEN;
  if (!igUserId || !accessToken) {
    return NextResponse.json(
      { error: 'IG 金鑰未設定,請先在 Vercel 環境變數填入 IG_USER_ID 與 IG_ACCESS_TOKEN' },
      { status: 400 },
    );
  }

  let body: { caption?: string; mediaUrl?: string; mediaType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '請求格式錯誤(不是有效的 JSON)' }, { status: 400 });
  }

  const caption = String(body.caption || '').trim();
  const mediaUrl = String(body.mediaUrl || '').trim();
  const mediaType = String(body.mediaType || '').trim().toLowerCase();

  // 🚨 IG 必帶媒體
  if (!mediaUrl) {
    return NextResponse.json({ error: 'IG 發文必須附圖片或影片' }, { status: 400 });
  }
  if (mediaType !== 'image' && mediaType !== 'video') {
    return NextResponse.json({ error: 'mediaType 必須是 image 或 video' }, { status: 400 });
  }

  try {
    // ① 建 container
    const createForm = new URLSearchParams();
    createForm.set('access_token', accessToken);
    if (caption) createForm.set('caption', caption);
    if (mediaType === 'video') {
      createForm.set('video_url', mediaUrl);
      createForm.set('media_type', 'REELS'); // 新版影片一律走 REELS container
    } else {
      createForm.set('image_url', mediaUrl);
    }

    const created = await graphPost(`${GRAPH}/${encodeURIComponent(igUserId)}/media`, createForm);
    if (!created.ok) {
      return NextResponse.json(
        { error: graphErrorMessage(created.json, created.raw, created.status, '建立媒體') },
        { status: 502 },
      );
    }
    const creationId = (created.json as { id?: string } | null)?.id;
    if (!creationId) {
      return NextResponse.json(
        { error: `IG API 回應異常,取不到 creation_id:${created.raw || '(空回應)'}` },
        { status: 502 },
      );
    }

    // 影片:輪詢 container 直到 status_code=FINISHED(圖片通常即時可發,略過輪詢)
    if (mediaType === 'video') {
      let finished = false;
      for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
        await sleep(POLL_INTERVAL_MS);
        const statusUrl = `${GRAPH}/${encodeURIComponent(creationId)}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`;
        const res = await fetch(statusUrl);
        const raw = await res.text();
        let json: unknown = null;
        try {
          json = raw ? JSON.parse(raw) : null;
        } catch {
          /* 忽略,續輪詢 */
        }
        const statusCode = (json as { status_code?: string } | null)?.status_code;
        if (statusCode === 'FINISHED') {
          finished = true;
          break;
        }
        if (statusCode === 'ERROR' || statusCode === 'EXPIRED') {
          return NextResponse.json(
            { error: `IG 影片處理失敗(status_code=${statusCode})。請確認影片格式(建議 MP4/H.264)與長度符合 IG Reels 規範` },
            { status: 502 },
          );
        }
        // 其餘(IN_PROGRESS / PUBLISHED 前置狀態)續等
      }
      if (!finished) {
        return NextResponse.json(
          { error: 'IG 影片處理逾時(超過約 55 秒仍未就緒)。影片較大時請稍後再試,或改用較短/較小的影片' },
          { status: 504 },
        );
      }
    }

    // ② 發布
    const publishForm = new URLSearchParams();
    publishForm.set('creation_id', creationId);
    publishForm.set('access_token', accessToken);
    const published = await graphPost(`${GRAPH}/${encodeURIComponent(igUserId)}/media_publish`, publishForm);
    if (!published.ok) {
      return NextResponse.json(
        { error: graphErrorMessage(published.json, published.raw, published.status, '發布') },
        { status: 502 },
      );
    }
    const mediaId = (published.json as { id?: string } | null)?.id;
    if (!mediaId) {
      return NextResponse.json(
        { error: `IG API 發布回應異常,取不到 media id:${published.raw || '(空回應)'}` },
        { status: 502 },
      );
    }

    // 取 permalink(失敗不影響發文成功,permalink 就留空)
    let permalink: string | undefined;
    try {
      const linkUrl = `${GRAPH}/${encodeURIComponent(mediaId)}?fields=permalink&access_token=${encodeURIComponent(accessToken)}`;
      const linkRes = await fetch(linkUrl);
      if (linkRes.ok) {
        const linkJson = (await linkRes.json()) as { permalink?: string };
        permalink = linkJson.permalink;
      }
    } catch {
      /* permalink 取不到就算了 */
    }

    return NextResponse.json({ ok: true, mediaId, permalink });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'IG 發文失敗';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

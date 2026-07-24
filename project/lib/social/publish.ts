import crypto from 'crypto';

/*
  社群發文的「共用入口」——給 /api/cron/social-post 用。

  🚨 為什麼是「cron 內部 fetch 既有 route」而不是「把發文邏輯抽成 lib」:
  app/api/admin/social/{fb,ig,x}/route.ts 三支是**已上線並驗證過**的發文邏輯。
  把 Graph API 呼叫搬出來會動到那三支檔案(它們的邏輯與 NextResponse 回應是交錯寫的,
  搬移必然要重塑回傳形狀 = 有機會改到行為)。依鐵則「已確認的別硬改」,
  這裡選最保守的做法:**三支 route 一個字都不動**,cron 用內部 HTTP 呼叫它們。

  認證:那三支 route 走 requireAdmin(onyx_admin_session cookie,HMAC 簽章)。
  cron 在伺服器端,拿得到同一把 session secret(ADMIN_CODE || SUPABASE_SERVICE_ROLE_KEY),
  所以這裡即時簽一顆 admin session 當 cookie 帶上去 —— 沒有新增任何金鑰、
  沒有在 route 上開後門,用的就是既有那套授權機制。

  代價:多一次 HTTP 往返(可忽略)。好處:上線中的發文路徑零風險。
*/

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.onyxstudios.ai';

export type PublishResult =
  | { ok: true; url?: string; id?: string }
  | { ok: false; error: string };

/** 該平台的金鑰是否齊全 —— 缺就讓 cron 優雅跳過,不要白打一次 API */
export function platformConfigured(platform: string): boolean {
  switch (platform) {
    case 'fb':
      return !!(process.env.FB_PAGE_ID && process.env.FB_PAGE_ACCESS_TOKEN);
    case 'ig':
      return !!(process.env.IG_USER_ID && process.env.IG_ACCESS_TOKEN);
    case 'x':
      return !!(process.env.X_API_KEY && process.env.X_API_SECRET && process.env.X_ACCESS_TOKEN && process.env.X_ACCESS_TOKEN_SECRET);
    default:
      return false;
  }
}

/** 即時簽一顆 admin session(格式與 /api/admin/auth 完全一致:`admin.<ts>.<hmac>`) */
function adminSessionCookie(): string | null {
  const secret = process.env.ADMIN_CODE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return null;
  const payload = `admin.${Date.now()}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `onyx_admin_session=${payload}.${signature}`;
}

/** 內部呼叫 /api/admin/social/* —— 回傳統一形狀,錯誤訊息直接透傳 route 的繁中說明 */
async function callSocialRoute(path: string, body: Record<string, unknown>): Promise<PublishResult> {
  const cookie = adminSessionCookie();
  if (!cookie) return { ok: false, error: '後台 session 金鑰未設定(ADMIN_CODE / SUPABASE_SERVICE_ROLE_KEY),無法內部呼叫發文 API' };
  try {
    const res = await fetch(`${SITE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify(body),
    });
    const raw = await res.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    } catch {
      /* 非 JSON 回應,下面用 raw 透傳 */
    }
    if (!res.ok || !json?.ok) {
      return { ok: false, error: String(json?.error || raw || `HTTP ${res.status}`) };
    }
    return {
      ok: true,
      url: (json.url || json.permalink || json.tweetUrl) as string | undefined,
      id: (json.postId || json.mediaId || json.tweetId) as string | undefined,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '發文請求失敗' };
  }
}

/** FB 粉專:有圖走 /photos(link 會被 FB 忽略,所以連結要寫在主文裡);無圖走 /feed */
export function publishFacebook(input: { text?: string; link?: string; imageUrl?: string }): Promise<PublishResult> {
  return callSocialRoute('/api/admin/social/fb', input);
}

/** IG:強制要媒體(呼叫端要先確認 mediaUrl 有值) */
export function publishInstagram(input: { caption?: string; mediaUrl: string; mediaType: 'image' | 'video' }): Promise<PublishResult> {
  return callSocialRoute('/api/admin/social/ig', input);
}

/** X:主文純文字,連結另發成第一則回覆(省 pay-per-use 費用,route 既有策略) */
export function publishX(input: { text: string; linkReply?: string }): Promise<PublishResult> {
  return callSocialRoute('/api/admin/social/x', input);
}

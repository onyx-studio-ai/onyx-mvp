import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';

/*
  Onyx 官方 X（@onyxstudiosai）一鍵發推文。
  策略:主文純文字（省錢);導流連結另發成「第一則回覆」——
  X pay-per-use 帶連結的推文貴 13 倍,放 reply 可規避。
  認證:OAuth 1.0a user context(app owner 發自己帳號,不跑網頁授權)。

  🔒 金鑰鐵則:四把金鑰只從環境變數讀,程式碼絕不寫死任何金鑰值。
  Wing 在 Vercel 環境變數填入:
    X_API_KEY            (consumer key)
    X_API_SECRET         (consumer secret)
    X_ACCESS_TOKEN
    X_ACCESS_TOKEN_SECRET
  任一缺失 → 回明確繁中錯誤(非 500 throw)。
*/

export const runtime = 'nodejs';
export const maxDuration = 30;

const TWEET_ENDPOINT = 'https://api.twitter.com/2/tweets';
const MAX_TWEET_LEN = 280;

/**
 * RFC 3986 百分比編碼 —— OAuth 1.0a 要求比 encodeURIComponent 更嚴格,
 * 連 ! * ' ( ) 也要編碼。
 */
function rfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!*'()]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

/**
 * 手寫 OAuth 1.0a 簽名,組出 Authorization header。
 * 用 node crypto HMAC-SHA1,不加任何 npm 依賴。
 *
 * 步驟:
 *   1. 組 oauth_* 參數(consumer_key / nonce / signature_method=HMAC-SHA1 /
 *      timestamp / token / version=1.0)
 *   2. 建 signature base string:
 *      METHOD & rfc3986(url) & rfc3986(依 key 排序後的參數字串)
 *      (POST body 是 JSON,不列入簽名;此處也無 query 參數,故只簽 oauth_* 參數)
 *   3. signing key = rfc3986(API_SECRET) & rfc3986(ACCESS_TOKEN_SECRET)
 *   4. oauth_signature = base64( HMAC-SHA1(base string, signing key) )
 *   5. 組成 `OAuth k="v", ...` header
 */
function buildOAuthHeader(
  method: string,
  url: string,
  creds: {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    accessTokenSecret: string;
  },
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: '1.0',
  };

  // 依 key 排序後 → k=v 用 & 串接,整串再編碼
  const paramString = Object.keys(oauthParams)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(oauthParams[k])}`)
    .join('&');

  const baseString = [
    method.toUpperCase(),
    rfc3986(url),
    rfc3986(paramString),
  ].join('&');

  const signingKey = `${rfc3986(creds.apiSecret)}&${rfc3986(creds.accessTokenSecret)}`;

  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(baseString)
    .digest('base64');

  const headerParams: Record<string, string> = {
    ...oauthParams,
    oauth_signature: signature,
  };

  return (
    'OAuth ' +
    Object.keys(headerParams)
      .sort()
      .map((k) => `${rfc3986(k)}="${rfc3986(headerParams[k])}"`)
      .join(', ')
  );
}

/** 呼叫 X /2/tweets 發一則推文,回傳 { id } 或拋出帶 X 原始訊息的錯誤。 */
async function postTweet(
  payload: Record<string, unknown>,
  creds: {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    accessTokenSecret: string;
  },
): Promise<{ id: string }> {
  const authHeader = buildOAuthHeader('POST', TWEET_ENDPOINT, creds);
  const res = await fetch(TWEET_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const raw = await res.text();
  let json: unknown = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    /* 非 JSON 回應(極少見),下面用原始字串透傳 */
  }

  if (!res.ok) {
    // 把 X 回的 status + 訊息透傳(方便除錯),繁中包裝
    const j = json as { title?: string; detail?: string; errors?: { message?: string }[] } | null;
    const xMsg =
      j?.detail ||
      j?.errors?.[0]?.message ||
      j?.title ||
      raw ||
      '(X 未提供訊息)';
    const err = new Error(`X API 發文失敗(HTTP ${res.status}):${xMsg}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }

  const id = (json as { data?: { id?: string } } | null)?.data?.id;
  if (!id) {
    throw new Error(`X API 回應異常,取不到推文 id:${raw || '(空回應)'}`);
  }
  return { id };
}

/*
  GET = 連線診斷(不發任何推文,安全)。
  回報:①四把金鑰的長度/有無空白(絕不回金鑰值本身)②Access Token 格式對不對
  ③用金鑰對 X 做一次「讀取」(GET /2/users/me),把 X 的完整回應透傳。
  用途:401 時精準定位是「金鑰值錯」還是「寫入權限不足」——
  讀取也 401 = 金鑰/簽名問題;讀取成功但發文失敗 = app 權限沒 Read+Write。
*/
export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const vars: Record<string, string | undefined> = {
    X_API_KEY: process.env.X_API_KEY,
    X_API_SECRET: process.env.X_API_SECRET,
    X_ACCESS_TOKEN: process.env.X_ACCESS_TOKEN,
    X_ACCESS_TOKEN_SECRET: process.env.X_ACCESS_TOKEN_SECRET,
    // FB/IG 也一起診斷:確認 Vercel 環境變數在此 build 是否讀得到(不回值)
    FB_PAGE_ID: process.env.FB_PAGE_ID,
    FB_PAGE_ACCESS_TOKEN: process.env.FB_PAGE_ACCESS_TOKEN,
    IG_USER_ID: process.env.IG_USER_ID,
    IG_ACCESS_TOKEN: process.env.IG_ACCESS_TOKEN,
  };
  const envCheck = Object.entries(vars).map(([name, v]) => ({
    name,
    present: !!v,
    length: v ? v.length : 0,
    hasWhitespace: v ? /\s/.test(v) : false, // 中間有空白/換行 = 貼錯
    trimmedDiffers: v ? v !== v.trim() : false, // 前後有空白 = 貼錯
  }));
  const at = vars.X_ACCESS_TOKEN || '';
  const accessTokenFormatOk = /^\d+-\w+/.test(at); // OAuth 1.0a = 數字-字母

  let xReadTest: { status: number; body: string } | { error: string };
  if (vars.X_API_KEY && vars.X_API_SECRET && vars.X_ACCESS_TOKEN && vars.X_ACCESS_TOKEN_SECRET) {
    try {
      const url = 'https://api.twitter.com/2/users/me';
      const authHeader = buildOAuthHeader('GET', url, {
        apiKey: vars.X_API_KEY,
        apiSecret: vars.X_API_SECRET,
        accessToken: vars.X_ACCESS_TOKEN,
        accessTokenSecret: vars.X_ACCESS_TOKEN_SECRET,
      });
      const res = await fetch(url, { headers: { Authorization: authHeader } });
      xReadTest = { status: res.status, body: (await res.text()).slice(0, 600) };
    } catch (e) {
      xReadTest = { error: e instanceof Error ? e.message : String(e) };
    }
  } else {
    xReadTest = { error: '金鑰未齊,略過 X 讀取測試' };
  }

  return NextResponse.json({ envCheck, accessTokenFormatOk, xReadTest });
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  // 🔒 金鑰只從環境變數讀;任一缺失回明確繁中錯誤,不 throw 500
  const apiKey = process.env.X_API_KEY;
  const apiSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET;
  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    return NextResponse.json(
      { error: 'X 金鑰未設定,請先在 Vercel 環境變數填入 X_API_KEY 等四項' },
      { status: 400 },
    );
  }
  const creds = { apiKey, apiSecret, accessToken, accessTokenSecret };

  let body: { text?: string; linkReply?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '請求格式錯誤(不是有效的 JSON)' }, { status: 400 });
  }

  const text = String(body.text || '').trim();
  const linkReply = String(body.linkReply || '').trim();

  if (!text) {
    return NextResponse.json({ error: '請輸入推文主文' }, { status: 400 });
  }
  // X 以 Unicode code point 計長度;用 [...text] 展開避免把 emoji 算成 2
  const textLen = [...text].length;
  if (textLen > MAX_TWEET_LEN) {
    return NextResponse.json(
      { error: `推文主文超過 ${MAX_TWEET_LEN} 字(目前 ${textLen} 字),請縮短` },
      { status: 400 },
    );
  }
  if (linkReply && [...linkReply].length > MAX_TWEET_LEN) {
    return NextResponse.json(
      { error: `導流連結回覆超過 ${MAX_TWEET_LEN} 字,請縮短` },
      { status: 400 },
    );
  }

  try {
    // 1) 發主文
    const main = await postTweet({ text }, creds);
    const tweetUrl = `https://x.com/onyxstudiosai/status/${main.id}`;

    // 2) 若有導流連結 → 發成第一則回覆
    let replyId: string | undefined;
    if (linkReply) {
      const reply = await postTweet(
        { text: linkReply, reply: { in_reply_to_tweet_id: main.id } },
        creds,
      );
      replyId = reply.id;
    }

    return NextResponse.json({
      ok: true,
      tweetId: main.id,
      replyId,
      tweetUrl,
    });
  } catch (e) {
    const status = (e as Error & { status?: number }).status;
    const message = e instanceof Error ? e.message : '發文失敗';
    // X API 錯誤透傳:主文成功但 reply 失敗時,message 會指明是發文哪一步失敗
    return NextResponse.json({ error: message }, { status: status && status >= 400 ? 502 : 500 });
  }
}

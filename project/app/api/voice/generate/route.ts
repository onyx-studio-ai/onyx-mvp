import { NextRequest, NextResponse } from 'next/server';
import { generateVoice, TtsError, type GenerateInput } from '@/lib/tts/engine';

// Tier-1 instant TTS endpoint. Wraps lib/tts/engine (Qwen3-via-fal for now;
// BreezyVoice/wing-e8 pending pod). Generation costs fal credits → basic per-IP
// rate limit so the endpoint can't be hammered. The `preview` path is truncated
// in the engine (first sentences only) so previews stay cheap and can't be used
// to extract a full deliverable for free.
//
// ⚠️ TODO before真上線:① 接訂單/付款狀態(完整版要驗 paid)② 每 talent+style 的
// speaker embedding 存 talents 表(目前由 caller 傳 embeddingUrl)③ 強化 auth。

const RATE_PER_MIN = 12;
const hits = new Map<string, { n: number; t: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now - e.t > 60_000) { hits.set(ip, { n: 1, t: now }); return false; }
  e.n += 1;
  return e.n > RATE_PER_MIN;
}

const STATUS: Record<TtsError['code'], number> = {
  bad_input: 400,
  unsupported_lang: 422,
  not_deployed: 501,
  no_key: 503,
  upstream: 502,
};

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) {
    return NextResponse.json({ error: `Rate limit: max ${RATE_PER_MIN}/min` }, { status: 429 });
  }

  let body: Partial<GenerateInput>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.text || !body.language || !body.embeddingUrl) {
    return NextResponse.json({ error: 'text, language and embeddingUrl are required' }, { status: 400 });
  }

  try {
    const result = await generateVoice({
      text: String(body.text).slice(0, 5000),
      language: String(body.language),
      embeddingUrl: String(body.embeddingUrl),
      refText: body.refText ? String(body.refText) : undefined,
      preview: !!body.preview,
      modelSize: body.modelSize === '0.6B' ? '0.6B' : '1.7B',
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof TtsError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: STATUS[err.code] });
    }
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}

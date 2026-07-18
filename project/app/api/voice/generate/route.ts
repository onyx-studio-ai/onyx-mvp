import { NextRequest, NextResponse } from 'next/server';
import { generateVoice, TtsError } from '@/lib/tts/engine';
import { getVoiceEmbedding } from '@/lib/tts/voice-embeddings';

// Tier-1 instant TTS endpoint. Wraps lib/tts/engine (Qwen3-via-fal for now;
// BreezyVoice/wing-e8 pending pod). Generation costs fal credits → basic per-IP
// rate limit so the endpoint can't be hammered. The `preview` path is truncated
// in the engine (first sentences only) so previews stay cheap and can't be used
// to extract a full deliverable for free.
//
// ⚠️ TODO before真上線:① 接訂單/付款狀態(完整版要驗 paid)② 每 talent+style 的
// speaker embedding 存 talents 表(目前由 caller 傳 embeddingUrl)③ 強化 auth。

// Long scripts synthesize as parallel sentence-chunks (see lib/tts/engine) — a
// 2500-char script takes ~3-4 min of fal calls, so this route needs the full
// Vercel Pro window instead of the default seconds-scale timeout.
export const maxDuration = 300;

// Hard input cap for the SYNCHRONOUS path: ~2500 zh chars ≈ 9 min of audio ≈
// what reliably fits inside maxDuration at measured fal throughput. Beyond this
// we REFUSE loudly (the old `.slice(0, 5000)` silently dropped the tail — that
// plus fal's tiny default max_new_tokens was the「長劇後面斷掉」bug).
const MAX_SYNC_CHARS = 2500;

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

  let body: { text?: string; language?: string; voiceId?: string; voice?: string; tone?: string; preview?: boolean; modelSize?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // voiceId = one of OUR talents (embedding resolved server-side — frontend can't
  // inject an arbitrary URL). voice = a fal preset (for flow-testing). Need one.
  if (!body.text || !body.language || (!body.voiceId && !body.voice)) {
    return NextResponse.json({ error: 'text, language and (voiceId OR voice) are required' }, { status: 400 });
  }
  if (!body.preview && body.text.length > MAX_SYNC_CHARS) {
    return NextResponse.json(
      { error: `Script too long for instant generation (${body.text.length} chars, max ${MAX_SYNC_CHARS}). Split it into scenes and generate each part.`, code: 'too_long' },
      { status: 413 },
    );
  }

  let embeddingUrl: string | undefined;
  let refText: string | undefined;
  let resolvedTone: string | undefined;
  let toneTemperature: number | undefined;
  if (body.voiceId) {
    // tone = the UI tone value (e.g. "Professional"); resolves to that register's
    // embedding, falling back to the voice's default register if not recorded.
    const v = await getVoiceEmbedding(String(body.voiceId), body.tone ? String(body.tone) : undefined);
    if (!v) return NextResponse.json({ error: `Unknown voiceId "${body.voiceId}"` }, { status: 404 });
    embeddingUrl = v.embeddingUrl;
    refText = v.refText;
    resolvedTone = v.tone;
    toneTemperature = v.temperature; // single-register voices vary tone via temperature
  }

  try {
    const result = await generateVoice({
      text: String(body.text),
      language: String(body.language),
      voice: !body.voiceId && body.voice ? String(body.voice) : undefined,
      embeddingUrl,
      refText,
      preview: !!body.preview,
      modelSize: body.modelSize === '0.6B' ? '0.6B' : '1.7B',
      temperature: toneTemperature,
      meta: { voiceKey: body.voiceId ? String(body.voiceId) : (body.voice ? String(body.voice) : undefined) },
    });
    // resolvedTone tells the caller which register actually played — may differ from
    // the requested tone if the talent hasn't recorded it (fell back to default).
    return NextResponse.json({ ...result, tone: resolvedTone });
  } catch (err) {
    if (err instanceof TtsError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: STATUS[err.code] });
    }
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}

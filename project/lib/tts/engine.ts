// ─────────────────────────────────────────────────────────────────────────────
// Onyx TTS generation — engine router + Qwen3-via-fal client.
//
// Tier-1 instant AI per language (see VOICE_LAB/PRODUCTION_TTS_ARCHITECTURE.md):
//   普通話/英日韓歐 (qwen3 langs) → Qwen3-TTS on fal.ai   ← IMPLEMENTED here
//   台灣國語 zh-TW                → BreezyVoice (self-host) ← TODO (pending pod deploy)
//   粵語 yue                      → wing-e8 GPT-SoVITS      ← TODO (pending pod deploy)
//
// Pronunciation fix: Qwen3 is mainland-trained → feed it Simplified (OpenCC 繁→簡)
// so its G2P reads correctly; Taiwan accent comes from the speaker ref, not the glyph.
// Gated on FAL_KEY — without it, generation throws a clear, catchable error.
// ─────────────────────────────────────────────────────────────────────────────
import { Converter } from 'opencc-js';

export type TtsEngine = 'qwen3' | 'breezyvoice' | 'wing-e8';

// Which engine serves each language. Mirrors lib/voices.ts `ai: true` set.
const QWEN3_LANGS = new Set(['zh-CN', 'en', 'ja', 'ko', 'es', 'pt', 'fr', 'de', 'it', 'ru']);
export function engineForLanguage(code: string): TtsEngine | null {
  const c = code.toLowerCase();
  // zh-TW: BreezyVoice (注音 control) is the eventual home; until that pod is up we
  // serve Taiwan Mandarin via Qwen3+OpenCC — accent comes from the talent ref, not glyph.
  if (c === 'zh-tw') return 'qwen3';
  if (c === 'yue') return 'wing-e8'; // Cantonese: pod only (Qwen3 has no Cantonese)
  if (QWEN3_LANGS.has(code) || QWEN3_LANGS.has(c)) return 'qwen3';
  return null; // Tier-2 / human-only language
}

// fal Qwen3 maps our codes → its language dropdown.
const QWEN3_FAL_LANG: Record<string, string> = {
  'zh-CN': 'Chinese', 'zh-TW': 'Chinese', en: 'English', ja: 'Japanese', ko: 'Korean',
  es: 'Spanish', pt: 'Portuguese', fr: 'French', de: 'German', it: 'Italian', ru: 'Russian',
};

// Preview = first sentences only, so prospects hear the voice on THEIR script but
// can't get the full deliverable for free. Full version unlocks after payment.
const PREVIEW_SENTENCES = 2;
const PREVIEW_MAX_CHARS = 120;
export function truncateForPreview(text: string): string {
  const parts = text.split(/(?<=[。!?！？.\n])/).filter((s) => s.trim());
  let out = parts.slice(0, PREVIEW_SENTENCES).join('');
  if (out.length > PREVIEW_MAX_CHARS) out = out.slice(0, PREVIEW_MAX_CHARS);
  return out.trim() || text.slice(0, PREVIEW_MAX_CHARS);
}

// 繁→簡 for Mandarin G2P (Taiwan accent is carried by the ref, not the glyph).
const toSimplified = Converter({ from: 'tw', to: 'cn' });
function preprocess(text: string, code: string): string {
  return code.toLowerCase().startsWith('zh') ? toSimplified(text) : text;
}

// ── Long-text chunking ────────────────────────────────────────────────────────
// fal Qwen3 caps generation at `max_new_tokens` codec tokens (12.5Hz) and its
// DEFAULT is tiny — measured 2026-07-16: 616-char zh input → 15.84s audio, i.e.
// audio silently truncates at ~16s no matter the text length (「長劇後面斷掉」).
// Fix = always pass max_new_tokens explicitly AND synthesize long scripts as
// sentence-boundary chunks stitched server-side (VOICE_LAB B5 SOP). Chunks end
// at sentence-final punctuation, so the join lands where a natural pause
// belongs — no crossfade needed at this layer.
const MAX_CHUNK_CHARS = 150;   // zh ~4.7 chars/s → ≈32s audio ≈ 400 codec tokens
const MAX_NEW_TOKENS = 1600;   // ≥2min headroom per chunk; verified accepted by fal
const CHUNK_CONCURRENCY = 6;   // measured ~50s wall per chunk → 6-wide keeps a
                               // 2500-char script within Vercel's 300s maxDuration

/** Split text into sentence-boundary chunks of ≤ maxChars (hard-split only when
 *  a single sentence itself exceeds the limit). Exported for tests. */
export function splitIntoChunks(text: string, maxChars = MAX_CHUNK_CHARS): string[] {
  const sentences = text.split(/(?<=[。!?！？.;；\n…])/).filter((s) => s.trim());
  const chunks: string[] = [];
  let cur = '';
  for (let s of sentences) {
    while (s.length > maxChars) {           // pathological no-punctuation run
      if (cur) { chunks.push(cur); cur = ''; }
      chunks.push(s.slice(0, maxChars));
      s = s.slice(maxChars);
    }
    if (cur.length + s.length > maxChars) { chunks.push(cur); cur = s; }
    else cur += s;
  }
  if (cur.trim()) chunks.push(cur);
  return chunks;
}

/** Clean an MP3 segment for byte-concat: strip ID3v2 header / ID3v1 trailer and
 *  the Xing/Info metadata frame (its frame count only covers ONE segment, so a
 *  stitched file would report a wrong total duration). Same encoder + params
 *  (24kHz mono) → decoders play the joined stream; each seam sits at a sentence
 *  pause where a tiny gap is natural. Known cosmetic limit: VBR without Xing
 *  means some players estimate duration slightly short until fully buffered —
 *  audio content itself is complete (verified by full decode). */
function cleanSegment(buf: Buffer): Buffer {
  let out = buf;
  if (out.length > 10 && out.toString('latin1', 0, 3) === 'ID3') {
    const size = ((out[6] & 0x7f) << 21) | ((out[7] & 0x7f) << 14) | ((out[8] & 0x7f) << 7) | (out[9] & 0x7f);
    out = out.subarray(10 + size);
  }
  if (out.length > 128 && out.toString('latin1', out.length - 128, out.length - 125) === 'TAG') {
    out = out.subarray(0, out.length - 128);
  }
  const head = out.subarray(0, 2048).toString('latin1');
  const xing = head.indexOf('Xing') >= 0 ? head.indexOf('Xing') : head.indexOf('Info');
  if (xing >= 0) {
    for (let i = xing; i < out.length - 1; i++) {
      if (out[i] === 0xff && (out[i + 1] & 0xe0) === 0xe0) return out.subarray(i);
    }
  }
  return out;
}

/** Upload a stitched deliverable to Supabase storage; returns its public URL.
 *  Mirrors the service-client pattern used across app/api. */
async function uploadDeliverable(mp3: Buffer): Promise<string> {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) throw new TtsError('Supabase not configured for long-text stitching', 'upstream');
  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  // AI 標示合規(EU Art 50(2)):正式交付物在此共同出口嵌 C2PA manifest(lib/c2pa.ts;
  // env 未設或簽署失敗都安靜回原檔,不擋交付)。Wing 2026-07-18 拍板:只蓋正式交付物。
  const { markAiAudio } = await import('@/lib/c2pa');
  const marked = await markAiAudio(mp3);
  await sb.storage.createBucket('tts-audio', { public: true }).catch(() => {}); // idempotent
  const path = `long/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.mp3`;
  const { error } = await sb.storage.from('tts-audio').upload(path, marked, { contentType: 'audio/mpeg' });
  if (error) throw new TtsError(`storage upload failed: ${error.message}`, 'upstream');
  return sb.storage.from('tts-audio').getPublicUrl(path).data.publicUrl;
}

// 3 delivery styles. NOTE: Qwen3 voice-clone has no style param → each style is a
// DIFFERENT speaker embedding (e.g. Eric confident/warm/neutral ref). The caller
// supplies the embedding for the chosen style; this just validates the key.
export const STYLES = ['lively', 'steady', 'commercial'] as const;
export type TtsStyle = (typeof STYLES)[number];

// fal Qwen3 built-in preset voices (native quality, no cloning). Used to run the
// whole pipeline NOW; our own talents (cloned) come later via BreezyVoice on a pod.
export const PRESET_VOICES = ['Vivian', 'Serena', 'Uncle_Fu', 'Dylan', 'Eric', 'Ryan', 'Aiden', 'Ono_Anna', 'Sohee'] as const;

export interface GenerateInput {
  text: string;
  language: string;
  /** EITHER a fal preset voice name (PRESET_VOICES) … */
  voice?: string;
  /** … OR a fal speaker embedding (safetensors) for a cloned talent (from clone-voice). */
  embeddingUrl?: string;
  /** transcript of the reference used to build the embedding (improves quality). */
  refText?: string;
  preview?: boolean;
  modelSize?: '0.6B' | '1.7B';
  /** sampling temperature; 0.7 = Wing-picked sweet spot (clear + lively). */
  temperature?: number;
  /** 計帳歸屬(Phase 1 用量計帳,2026-07-18):voiceKey=平台聲音 key;orderId 之後接單流程帶 */
  meta?: { voiceKey?: string; talentId?: string; purpose?: string; orderId?: string };
}
export interface GenerateResult {
  audioUrl: string;
  engine: TtsEngine;
  language: string;
  preview: boolean;
  charsBilled: number;
  /** how many sentence-chunks were synthesized (1 = single call, unchanged path). */
  chunks: number;
}

export class TtsError extends Error {
  constructor(message: string, readonly code: 'no_key' | 'unsupported_lang' | 'not_deployed' | 'bad_input' | 'upstream') {
    super(message);
  }
}

// One-time per talent (per style): build a speaker embedding from a reference clip.
// fal `clone-voice/1.7b` input: { audio_url, reference_text } → { speaker_embedding: { url } }.
// Store the returned safetensors URL on the talent; generateVoice() reuses it forever.
export async function createSpeakerEmbedding(audioUrl: string, refText: string): Promise<string> {
  const key = process.env.FAL_KEY;
  if (!key) throw new TtsError('FAL_KEY not configured', 'no_key');
  const res = await fetch('https://fal.run/fal-ai/qwen-3-tts/clone-voice/1.7b', {
    method: 'POST',
    headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_url: audioUrl, reference_text: refText }),
  });
  if (!res.ok) throw new TtsError(`fal clone-voice ${res.status}: ${(await res.text()).slice(0, 200)}`, 'upstream');
  const d = (await res.json()) as { speaker_embedding?: { url?: string } };
  const url = d.speaker_embedding?.url;
  if (!url) throw new TtsError('clone-voice returned no embedding', 'upstream');
  return url;
}

/** Generate speech. Throws TtsError on any failure (caller maps to HTTP). */
/** AI 生成用量計帳(Phase 1 地基,2026-07-18)。fire-and-forget:計帳失敗絕不擋生成。
 *  成本以 fal Qwen3 1.7B 官方價 $0.09/1000 字計;0.6B 未查得官方價,先同價保守高估。 */
async function logGeneration(input: GenerateInput, result: GenerateResult): Promise<void> {
  // ⚠️ 必須 await:Vercel serverless 在 response 後凍結,fire-and-forget 會被吞
  //(2026-07-19 實測兩筆成功生成零入帳)。insert ~50ms,可靠性優先。
  try {
    const { getSupabaseServiceClient } = await import('@/lib/supabase-server');
    const db = getSupabaseServiceClient();
    await db.from('ai_generations').insert({
      talent_id: input.meta?.talentId || null,
      voice_key: input.meta?.voiceKey || input.voice || 'unknown',
      language: input.language,
      chars: result.charsBilled,
      engine: `${result.engine}-${input.modelSize || '1.7B'}`,
      purpose: input.meta?.purpose || (result.preview ? 'preview' : 'deliverable'),
      order_id: input.meta?.orderId || null,
      cost_usd: Math.round(result.charsBilled * 0.09) / 1000,
    });
  } catch (e) {
    console.error('[ai-usage] 計帳失敗(不擋生成):', e instanceof Error ? e.message : e);
  }
}

export async function generateVoice(input: GenerateInput): Promise<GenerateResult> {
  const text = (input.text || '').trim();
  if (!text) throw new TtsError('Empty text', 'bad_input');
  if (!input.voice && !input.embeddingUrl) throw new TtsError('Provide a preset voice or a cloned embedding', 'bad_input');

  const engine = engineForLanguage(input.language);
  if (!engine) throw new TtsError(`No AI engine for language "${input.language}" — route to human voiceover`, 'unsupported_lang');
  if (engine !== 'qwen3') {
    // BreezyVoice (zh-TW) and wing-e8 (yue) are self-hosted on RunPod Serverless —
    // not wired yet. Pending pod verification (VOICE_LAB experiment).
    throw new TtsError(`Engine "${engine}" not deployed yet (pending pod)`, 'not_deployed');
  }

  const key = process.env.FAL_KEY;
  if (!key) throw new TtsError('FAL_KEY not configured', 'no_key');

  const full = preprocess(input.preview ? truncateForPreview(text) : text, input.language);
  const falLang = QWEN3_FAL_LANG[input.language] || QWEN3_FAL_LANG[input.language.toLowerCase()] || 'Auto';
  const model = input.modelSize === '0.6B' ? '0.6b' : '1.7b';

  const callFal = async (chunk: string, retried = false): Promise<string> => {
    const args: Record<string, unknown> = {
      text: chunk,
      language: falLang,
      temperature: input.temperature ?? 0.7,
      // ⚠️ 必傳:fal 預設 max_new_tokens 極小 → 音訊 ~16s 就被硬切(長劇斷掉的根因)
      max_new_tokens: MAX_NEW_TOKENS,
    };
    if (input.voice) args.voice = input.voice;                                  // preset (native quality)
    else { args.speaker_voice_embedding_file_url = input.embeddingUrl; args.reference_text = input.refText || ''; } // cloned talent
    const res = await fetch('https://fal.run/fal-ai/qwen-3-tts/text-to-speech/' + model, {
      method: 'POST',
      headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!res.ok) {
      if (!retried && (res.status === 429 || res.status >= 500)) return callFal(chunk, true); // transient → one retry
      throw new TtsError(`fal Qwen3 error ${res.status}: ${(await res.text()).slice(0, 200)}`, 'upstream');
    }
    const data = (await res.json()) as { audio?: { url?: string } };
    if (!data.audio?.url) throw new TtsError('fal returned no audio url', 'upstream');
    return data.audio.url;
  };

  // Preview: single call, return fal's URL directly — unchanged path.
  // 短文本「非 preview」= 正式交付物 → 一樣導進 uploadDeliverable(嵌 C2PA + 永久保存;
  // fal URL 是暫時的,本就不該當交付物連結)。
  if (full.length <= MAX_CHUNK_CHARS) {
    const falUrl = await callFal(full);
    if (input.preview) {
      { const __r: GenerateResult = { audioUrl: falUrl, engine, language: input.language, preview: true, charsBilled: full.length, chunks: 1 }; await logGeneration(input, __r); return __r; }
    }
    const buf = Buffer.from(await (await fetch(falUrl)).arrayBuffer());
    const audioUrl = await uploadDeliverable(buf);
    { const __r: GenerateResult = { audioUrl, engine, language: input.language, preview: false, charsBilled: full.length, chunks: 1 }; await logGeneration(input, __r); return __r; }
  }

  // Long script: sentence-boundary chunks → bounded-concurrency fal calls → ordered
  // byte-stitch → our storage (fal URLs are temp; deliverables need a stable home).
  const parts = splitIntoChunks(full);
  const bufs: Buffer[] = new Array(parts.length);
  let next = 0;
  const worker = async () => {
    while (next < parts.length) {
      const i = next++;
      const url = await callFal(parts[i]);
      bufs[i] = cleanSegment(Buffer.from(await (await fetch(url)).arrayBuffer()));
    }
  };
  await Promise.all(Array.from({ length: Math.min(CHUNK_CONCURRENCY, parts.length) }, worker));
  const audioUrl = await uploadDeliverable(Buffer.concat(bufs));
  { const __r: GenerateResult = { audioUrl, engine, language: input.language, preview: false, charsBilled: full.length, chunks: parts.length }; await logGeneration(input, __r); return __r; }
}

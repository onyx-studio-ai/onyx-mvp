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
  if (c === 'zh-tw') return 'breezyvoice';
  if (c === 'yue') return 'wing-e8';
  if (QWEN3_LANGS.has(code) || QWEN3_LANGS.has(c)) return 'qwen3';
  return null; // Tier-2 / human-only language
}

// fal Qwen3 maps our codes → its language dropdown.
const QWEN3_FAL_LANG: Record<string, string> = {
  'zh-CN': 'Chinese', en: 'English', ja: 'Japanese', ko: 'Korean', es: 'Spanish',
  pt: 'Portuguese', fr: 'French', de: 'German', it: 'Italian', ru: 'Russian',
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

// 3 delivery styles. NOTE: Qwen3 voice-clone has no style param → each style is a
// DIFFERENT speaker embedding (e.g. Eric confident/warm/neutral ref). The caller
// supplies the embedding for the chosen style; this just validates the key.
export const STYLES = ['lively', 'steady', 'commercial'] as const;
export type TtsStyle = (typeof STYLES)[number];

export interface GenerateInput {
  text: string;
  language: string;
  /** fal speaker embedding (safetensors) for this talent+style, from clone-voice. */
  embeddingUrl: string;
  /** transcript of the reference used to build the embedding (improves quality). */
  refText?: string;
  preview?: boolean;
  modelSize?: '0.6B' | '1.7B';
}
export interface GenerateResult {
  audioUrl: string;
  engine: TtsEngine;
  language: string;
  preview: boolean;
  charsBilled: number;
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
export async function generateVoice(input: GenerateInput): Promise<GenerateResult> {
  const text = (input.text || '').trim();
  if (!text) throw new TtsError('Empty text', 'bad_input');
  if (!input.embeddingUrl) throw new TtsError('Missing voice embedding', 'bad_input');

  const engine = engineForLanguage(input.language);
  if (!engine) throw new TtsError(`No AI engine for language "${input.language}" — route to human voiceover`, 'unsupported_lang');
  if (engine !== 'qwen3') {
    // BreezyVoice (zh-TW) and wing-e8 (yue) are self-hosted on RunPod Serverless —
    // not wired yet. Pending pod verification (VOICE_LAB experiment).
    throw new TtsError(`Engine "${engine}" not deployed yet (pending pod)`, 'not_deployed');
  }

  const key = process.env.FAL_KEY;
  if (!key) throw new TtsError('FAL_KEY not configured', 'no_key');

  const body = preprocess(input.preview ? truncateForPreview(text) : text, input.language);
  const res = await fetch('https://fal.run/fal-ai/qwen-3-tts/text-to-speech/' + (input.modelSize === '0.6B' ? '0.6b' : '1.7b'), {
    method: 'POST',
    headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: body,
      speaker_voice_embedding_file_url: input.embeddingUrl,
      reference_text: input.refText || '',
      language: QWEN3_FAL_LANG[input.language] || QWEN3_FAL_LANG[input.language.toLowerCase()] || 'Auto',
    }),
  });
  if (!res.ok) {
    throw new TtsError(`fal Qwen3 error ${res.status}: ${(await res.text()).slice(0, 200)}`, 'upstream');
  }
  const data = (await res.json()) as { audio?: { url?: string } };
  const audioUrl = data.audio?.url;
  if (!audioUrl) throw new TtsError('fal returned no audio url', 'upstream');

  return { audioUrl, engine, language: input.language, preview: !!input.preview, charsBilled: body.length };
}

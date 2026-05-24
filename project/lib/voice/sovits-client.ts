/**
 * GPT-SoVITS API client — proxies to the self-hosted RunPod instance
 * `a52pzfcunv6ov8` (voice-ai-platform wrapper around GPT-SoVITS v4).
 *
 * Set the public URL via SOVITS_API_URL and the bearer key via SOVITS_API_KEY.
 * The pod exposes an OpenAI-compatible TTS endpoint plus a voice-conversion
 * (RVC) endpoint for already-recorded audio.
 *
 * Endpoints (verified once pod is running):
 *   GET  /health                 → {status, model}
 *   POST /v1/audio/speech        → OpenAI-compatible TTS, returns audio/wav
 *   POST /v1/audio/voice_convert → multipart RVC: audio + target_voice
 */

const SOVITS_API_URL = process.env.SOVITS_API_URL || '';
const SOVITS_API_KEY = process.env.SOVITS_API_KEY || '';

export class SovitsError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'SovitsError';
  }
}

function requireUrl(): string {
  if (!SOVITS_API_URL) {
    throw new SovitsError(
      'SOVITS_API_URL env var is not set — GPT-SoVITS unavailable',
      503,
    );
  }
  return SOVITS_API_URL.replace(/\/$/, '');
}

function authHeader(): Record<string, string> {
  return SOVITS_API_KEY ? { Authorization: `Bearer ${SOVITS_API_KEY}` } : {};
}

export interface SovitsHealth {
  status: string;
  model?: string;
}

export async function getHealth(): Promise<SovitsHealth> {
  const res = await fetch(`${requireUrl()}/health`, {
    method: 'GET',
    headers: authHeader(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new SovitsError(`Health check failed (HTTP ${res.status})`, res.status);
  }
  return (await res.json()) as SovitsHealth;
}

export interface SpeechParams {
  text: string;
  voice?: string; // e.g. 'eric_warm_slow' — preset voice on the pod
  speed?: number; // 0.5 – 2.0
  format?: 'wav' | 'mp3' | 'opus';
}

/**
 * OpenAI-compatible TTS: text → audio in the target voice.
 * Used when we want GPT-SoVITS-quality Eric narration directly from text.
 */
export async function synthesizeSpeech(params: SpeechParams): Promise<ArrayBuffer> {
  const body = {
    model: 'tts-1',
    input: params.text,
    voice: params.voice || 'eric_warm_slow',
    response_format: params.format || 'wav',
    speed: params.speed ?? 1.0,
  };

  const res = await fetch(`${requireUrl()}/v1/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000), // GPT-SoVITS inference can be slower than CV3
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new SovitsError(
      `synthesizeSpeech failed (HTTP ${res.status}): ${errorText.slice(0, 200)}`,
      res.status,
    );
  }
  return await res.arrayBuffer();
}

export interface ConvertParams {
  audioFile: Blob;
  audioFilename?: string;
  targetVoice?: string;
  format?: 'wav' | 'mp3';
}

/**
 * RVC voice conversion: any speaker's audio → target voice (e.g. Eric).
 * Endpoint name TBD-verified once the pod is up — the voice-ai-platform
 * wrapper exposes this under /v1/audio/voice_convert based on its README.
 * If the live path differs, adjust here.
 */
export async function convertVoice(params: ConvertParams): Promise<ArrayBuffer> {
  const formData = new FormData();
  formData.append('audio', params.audioFile, params.audioFilename || 'input.wav');
  formData.append('target_voice', params.targetVoice || 'eric_warm_slow');
  formData.append('response_format', params.format || 'wav');

  const res = await fetch(`${requireUrl()}/v1/audio/voice_convert`, {
    method: 'POST',
    headers: authHeader(), // do NOT set Content-Type — browser sets multipart boundary
    body: formData,
    signal: AbortSignal.timeout(180_000), // RVC on long files can take a while
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new SovitsError(
      `convertVoice failed (HTTP ${res.status}): ${errorText.slice(0, 200)}`,
      res.status,
    );
  }
  return await res.arrayBuffer();
}

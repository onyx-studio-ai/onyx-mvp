/**
 * CosyVoice 2 API client — proxies to the self-hosted RunPod instance.
 *
 * The CosyVoice server runs on RunPod (currently behind a Cloudflare tunnel
 * because RunPod's HTTP proxy domain requires port 8080 to be exposed at pod
 * creation, which our existing pod isn't). Set the public URL via the
 * COSYVOICE_API_URL environment variable.
 *
 * Server endpoints (see /workspace/CosyVoice/server.py on the pod):
 *   GET  /health              → {status, model, sample_rate, voices: []}
 *   GET  /voices              → {voices: [{voice_id, audio_path, has_transcript, size_bytes}]}
 *   POST /upload_reference    → multipart: voice_id, transcript, audio (wav)
 *   POST /synthesize          → JSON: {text, voice_id, instruction} → audio/wav
 */

const COSYVOICE_API_URL = process.env.COSYVOICE_API_URL || '';

export class CosyVoiceError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'CosyVoiceError';
  }
}

function requireUrl(): string {
  if (!COSYVOICE_API_URL) {
    throw new CosyVoiceError(
      'COSYVOICE_API_URL env var is not set — voice synthesis unavailable',
      503,
    );
  }
  return COSYVOICE_API_URL.replace(/\/$/, '');
}

export interface VoiceInfo {
  voice_id: string;
  audio_path: string;
  has_transcript: boolean;
  size_bytes: number;
}

export interface HealthInfo {
  status: string;
  model: string;
  sample_rate: number;
  voices: string[];
}

export async function getHealth(): Promise<HealthInfo> {
  const res = await fetch(`${requireUrl()}/health`, {
    method: 'GET',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new CosyVoiceError(`Health check failed (HTTP ${res.status})`, res.status);
  }
  return (await res.json()) as HealthInfo;
}

export async function listVoices(): Promise<VoiceInfo[]> {
  const res = await fetch(`${requireUrl()}/voices`, {
    method: 'GET',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new CosyVoiceError(`List voices failed (HTTP ${res.status})`, res.status);
  }
  const data = (await res.json()) as { voices: VoiceInfo[] };
  return data.voices || [];
}

export async function synthesize(params: {
  text: string;
  voiceId: string;
  instruction?: string;
}): Promise<ArrayBuffer> {
  const res = await fetch(`${requireUrl()}/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: params.text,
      voice_id: params.voiceId,
      instruction: params.instruction || '',
    }),
    signal: AbortSignal.timeout(60_000), // generous — model inference can take 5-30s
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new CosyVoiceError(
      `Synthesize failed (HTTP ${res.status}): ${errorText.slice(0, 200)}`,
      res.status,
    );
  }
  return await res.arrayBuffer();
}

export async function uploadReference(params: {
  voiceId: string;
  transcript: string;
  audioFile: Blob;
  audioFilename?: string;
}): Promise<{ voice_id: string; wav: string; transcript_len: number }> {
  const formData = new FormData();
  formData.append('voice_id', params.voiceId);
  formData.append('transcript', params.transcript);
  formData.append('audio', params.audioFile, params.audioFilename || 'reference.wav');

  const res = await fetch(`${requireUrl()}/upload_reference`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(120_000), // upload can be slow for big wav files
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new CosyVoiceError(
      `Upload reference failed (HTTP ${res.status}): ${errorText.slice(0, 200)}`,
      res.status,
    );
  }
  return (await res.json()) as { voice_id: string; wav: string; transcript_len: number };
}

/**
 * Hash a synthesize request for cache key purposes. Stable across calls so
 * identical text+voice+instruction can be served from a stored audio file
 * without re-hitting the GPU.
 */
export async function synthesizeCacheKey(params: {
  text: string;
  voiceId: string;
  instruction?: string;
}): Promise<string> {
  const payload = JSON.stringify({
    text: params.text.trim(),
    voiceId: params.voiceId,
    instruction: (params.instruction || '').trim(),
  });
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 24); // 24 hex chars is plenty for uniqueness
}

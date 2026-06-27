// Client-side demo watermarking: mix a periodic spoken "Onyx Studios" tag over a
// demo and download it as MP3, so a leaked demo is audibly marked. Runs entirely
// in the browser (Web Audio + the same pure-JS MP3 encoder as to-mp3) — no server
// ffmpeg. The watermark voice asset lives at /public/onyx-watermark.mp3.
import { Mp3Encoder } from '@breezystack/lamejs';

const WATERMARK_URL = '/onyx-watermark.mp3';
const INTERVAL = 12;   // seconds between watermark tags
const WM_GAIN = 0.4;   // watermark loudness relative to the demo

function floatToInt16(f32: Float32Array): Int16Array {
  const i16 = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return i16;
}

/** Mix the Onyx watermark over `srcUrl` and trigger a download. Throws on failure
 *  so the caller can surface an error (never silently hands over the raw file). */
export async function downloadWatermarked(srcUrl: string, filename: string): Promise<void> {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) throw new Error('Audio not supported in this browser');
  const ctx = new AC();
  const [srcBuf, wmBuf] = await Promise.all([
    fetch(srcUrl).then((r) => r.arrayBuffer()).then((a) => ctx.decodeAudioData(a)),
    fetch(WATERMARK_URL).then((r) => r.arrayBuffer()).then((a) => ctx.decodeAudioData(a)),
  ]);
  ctx.close?.();

  const sr = srcBuf.sampleRate;
  const channels = Math.min(srcBuf.numberOfChannels, 2);
  const off = new OfflineAudioContext(channels, srcBuf.length, sr);

  const src = off.createBufferSource();
  src.buffer = srcBuf;
  src.connect(off.destination);
  src.start(0);

  // Repeat the spoken tag at a low level across the clip (first one ~2s in).
  const wmGain = off.createGain();
  wmGain.gain.value = WM_GAIN;
  wmGain.connect(off.destination);
  for (let t = 2; t < srcBuf.duration; t += INTERVAL) {
    const w = off.createBufferSource();
    w.buffer = wmBuf;
    w.connect(wmGain);
    w.start(t);
  }

  const rendered = await off.startRendering();
  const enc = new Mp3Encoder(channels, sr, 192);
  const left = floatToInt16(rendered.getChannelData(0));
  const right = channels > 1 ? floatToInt16(rendered.getChannelData(1)) : null;
  const block = 1152;
  const out: Uint8Array[] = [];
  for (let i = 0; i < left.length; i += block) {
    const l = left.subarray(i, i + block);
    const chunk = right ? enc.encodeBuffer(l, right.subarray(i, i + block)) : enc.encodeBuffer(l);
    if (chunk.length) out.push(chunk);
  }
  const tail = enc.flush();
  if (tail.length) out.push(tail);

  const blob = new Blob(out as BlobPart[], { type: 'audio/mpeg' });
  if (!blob.size) throw new Error('Encoding failed');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/\.[^./]+$/, '') + '_onyx.mp3';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

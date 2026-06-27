// Client-side demo watermarking: mix a periodic spoken "Onyx Studios" tag over a
// demo and download it as MP3, so a leaked demo is audibly marked. Runs entirely
// in the browser (Web Audio + the same pure-JS MP3 encoder as to-mp3) — no server
// ffmpeg. The watermark voice asset lives at /public/onyx-watermark.mp3.
import { Mp3Encoder } from '@breezystack/lamejs';

const WATERMARK_URL = '/onyx-watermark.mp3';
const INTERVAL = 12;   // seconds between watermark tags
const WM_GAIN = 0.2;   // watermark loudness relative to the demo (subtle)

function floatToInt16(f32: Float32Array): Int16Array {
  const i16 = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return i16;
}

// Minimal ID3v2.3 tag (TIT2 title + TPE1 artist) so the downloaded MP3's embedded
// title/artist reads as the platform, not the talent's original tag (re-encoding
// already strips the source's ID3 + the supabase "where-from" URL). UTF-16 so CJK
// names survive.
function id3v2(title: string, artist: string): Uint8Array {
  const utf16 = (s: string) => {
    const out = [0x01, 0xff, 0xfe]; // encoding=UTF-16, BOM little-endian
    for (const ch of s) { const c = ch.charCodeAt(0); out.push(c & 0xff, (c >> 8) & 0xff); }
    out.push(0, 0); // null terminator
    return out;
  };
  const frame = (id: string, body: number[]) => {
    const size = body.length;
    return [...id.split('').map((c) => c.charCodeAt(0)),
      (size >> 24) & 0xff, (size >> 16) & 0xff, (size >> 8) & 0xff, size & 0xff, // v2.3: regular 4-byte size
      0, 0, ...body];
  };
  const frames = [...frame('TIT2', utf16(title)), ...frame('TPE1', utf16(artist))];
  const sz = frames.length;
  const synch = [(sz >> 21) & 0x7f, (sz >> 14) & 0x7f, (sz >> 7) & 0x7f, sz & 0x7f];
  return new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, ...synch, ...frames]); // "ID3" v2.3
}

/** Mix the Onyx watermark over `srcUrl` and trigger a download. Throws on failure
 *  so the caller can surface an error (never silently hands over the raw file).
 *  `filename` is used as-is (sanitized); `artist` (e.g. the talent) goes in ID3. */
export async function downloadWatermarked(srcUrl: string, filename: string, artist = ''): Promise<void> {
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

  // Prepend an ID3 tag so the embedded title reads as the platform (re-encoding
  // already dropped the talent's original tag).
  const tag = id3v2('Onyx Studios', artist || 'Onyx Studios');
  const blob = new Blob([tag, ...out] as BlobPart[], { type: 'audio/mpeg' });
  if (!blob.size) throw new Error('Encoding failed');
  const safe = (filename || 'onyx').replace(/\.[^./]+$/, '').replace(/[^\w.\-]+/g, '_').replace(/^_+|_+$/g, '') || 'onyx';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safe}.mp3`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

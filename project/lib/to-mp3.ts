// Client-side audition → MP3 converter, so every audition file Onyx receives is a
// uniform MP3 regardless of what the talent's phone recorded (m4a / aac / wav / …).
// Decodes with the browser's Web Audio API, re-encodes with a pure-JS MP3 encoder
// (no ffmpeg.wasm — ~150KB, works on mobile). If anything fails it returns the
// ORIGINAL file untouched, so a conversion hiccup never blocks the upload.
import { Mp3Encoder } from '@breezystack/lamejs';

function floatToInt16(f32: Float32Array): Int16Array {
  const i16 = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return i16;
}

export async function toMp3(file: File, bitrate = 192): Promise<File> {
  try {
    if (/mp3|mpeg/i.test(file.type) || /\.mp3$/i.test(file.name)) return file; // already MP3
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return file;
    const ctx = new AC();
    const audio = await ctx.decodeAudioData(await file.arrayBuffer());
    ctx.close?.();

    const channels = Math.min(audio.numberOfChannels, 2);
    const enc = new Mp3Encoder(channels, audio.sampleRate, bitrate);
    const left = floatToInt16(audio.getChannelData(0));
    const right = channels > 1 ? floatToInt16(audio.getChannelData(1)) : null;
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
    if (!blob.size) return file;
    return new File([blob], file.name.replace(/\.[^./]+$/, '') + '.mp3', { type: 'audio/mpeg' });
  } catch {
    return file; // never block the audition on a conversion error
  }
}

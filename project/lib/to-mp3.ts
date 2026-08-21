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

/*
  依檔頭(magic bytes)判斷真實格式,不看副檔名。
  2026-08-21 踩過:配音員上傳的檔案叫 .mp3、內容其實是 M4A(手機/轉檔 app 給錯副檔名),
  原本只比對副檔名就當成「已經是 MP3」跳過轉檔 → 存成 .mp3 卻裝著 M4A,前台播不出來。
*/
function sniff(head: Uint8Array): 'mp3' | 'm4a' | 'wav' | 'ogg' | 'flac' | null {
  if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) return 'mp3';            // ID3
  if (head[0] === 0xff && (head[1] & 0xe0) === 0xe0) return 'mp3';                        // frame sync
  if (head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) return 'm4a'; // ftyp
  if (head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46) return 'wav';  // RIFF
  if (head[0] === 0x4f && head[1] === 0x67 && head[2] === 0x67 && head[3] === 0x53) return 'ogg';  // OggS
  if (head[0] === 0x66 && head[1] === 0x4c && head[2] === 0x61 && head[3] === 0x43) return 'flac'; // fLaC
  return null;
}

/** 轉檔失敗時的保底:副檔名與實際內容不符就改對,免得存進去播不出來。 */
function fixExt(file: File, kind: ReturnType<typeof sniff>): File {
  if (!kind) return file;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === kind || (kind === 'm4a' && ext === 'aac')) return file;
  return new File([file], file.name.replace(/\.[^./]+$/, '') + '.' + kind, { type: file.type });
}

export async function toMp3(file: File, bitrate = 192): Promise<File> {
  let kind: ReturnType<typeof sniff> = null;
  try {
    kind = sniff(new Uint8Array(await file.slice(0, 12).arrayBuffer()));
    if (kind === 'mp3') return file; // 真的已經是 MP3(看內容,不是看檔名)
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return fixExt(file, kind);
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
    if (!blob.size) return fixExt(file, kind);
    return new File([blob], file.name.replace(/\.[^./]+$/, '') + '.mp3', { type: 'audio/mpeg' });
  } catch {
    return fixExt(file, kind); // 轉檔失敗不擋上傳,但至少把副檔名改成實際格式
  }
}

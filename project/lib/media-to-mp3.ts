/*
  瀏覽器端 音檔/影片 → MP3(Wing 2026-07-15:參考音/中選聲線只要不是 mp3 一律自動轉,
  不用手動轉檔、也省儲存空間 —— wav 動輒 30MB+,mp3 只要零頭)。
  先用 AudioContext 解出 PCM,再用 lamejs 編成 160kbps mp3;已是 mp3、或不是音/影檔
  (pdf/zip/圖…)原樣回傳。解碼失敗(罕見編碼)也原樣回傳,不擋上傳。
*/

const NEEDS_CONVERT = /\.(wav|aif|aiff|flac|ogg|oga|opus|m4a|aac|wma|mp4|mov|webm)$/i;

export function needsMp3Convert(file: File): boolean {
  if (/\.mp3$/i.test(file.name) || file.type === 'audio/mpeg') return false;
  return NEEDS_CONVERT.test(file.name)
    || file.type.startsWith('video/')
    || file.type.startsWith('audio/');
}

function toInt16(f32: Float32Array): Int16Array {
  const out = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export async function mediaToMp3(file: File): Promise<File> {
  if (!needsMp3Convert(file)) return file;
  let ac: AudioContext | null = null;
  try {
    const ab = await file.arrayBuffer();
    ac = new AudioContext();
    const audio = await ac.decodeAudioData(ab);
    const ch = Math.min(2, audio.numberOfChannels);
    const { Mp3Encoder } = await import('@breezystack/lamejs');
    const enc = new Mp3Encoder(ch, audio.sampleRate, 160);
    const left = toInt16(audio.getChannelData(0));
    const right = ch === 2 ? toInt16(audio.getChannelData(1)) : null;
    const chunks: Uint8Array[] = [];
    const BLOCK = 1152;
    for (let i = 0; i < left.length; i += BLOCK) {
      const d = right
        ? enc.encodeBuffer(left.subarray(i, i + BLOCK), right.subarray(i, i + BLOCK))
        : enc.encodeBuffer(left.subarray(i, i + BLOCK));
      if (d.length) chunks.push(new Uint8Array(d));
    }
    const tail = enc.flush();
    if (tail.length) chunks.push(new Uint8Array(tail));
    const name = file.name.replace(/\.\w+$/, '') + '.mp3';
    return new File(chunks as BlobPart[], name, { type: 'audio/mpeg' });
  } catch {
    return file;   // 解不出來就傳原檔,至少不擋流程
  } finally {
    ac?.close().catch(() => {});
  }
}

/*
  交付音檔的規格檢查(WAV 檔頭,前 4KB 就夠)。

  Wing 2026-08-19 定調:平台標準一律 48kHz / 24bit / Mono,特殊規格另外溝通。
  用途是「配音員上傳當下就看到」,**不擋上傳**——只友善告知,免得他到交件驗收
  才知道要重錄(2026-08-18 茹芸交了假立體聲,事後才發現、由我們自己轉檔)。
*/

export type WavSpec = { rate: number; bits: number; channels: number };

export const STD = { rate: 48000, bits: 24, channels: 1 } as const;

/** 讀 WAV 檔頭。非 WAV 或讀不出來一律回 null(不是錯誤,就是不檢查)。 */
export async function readWavSpec(file: File): Promise<WavSpec | null> {
  try {
    const buf = new DataView(await file.slice(0, 4096).arrayBuffer());
    if (buf.byteLength < 44) return null;
    const tag = (o: number) => String.fromCharCode(buf.getUint8(o), buf.getUint8(o + 1), buf.getUint8(o + 2), buf.getUint8(o + 3));
    if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;
    // fmt chunk 不一定緊接在 12,前面可能有 LIST/JUNK 等,要逐段走
    let i = 12;
    while (i + 8 <= buf.byteLength) {
      const id = tag(i);
      const size = buf.getUint32(i + 4, true);
      if (id === 'fmt ' && i + 24 <= buf.byteLength) {
        return { channels: buf.getUint16(i + 10, true), rate: buf.getUint32(i + 12, true), bits: buf.getUint16(i + 22, true) };
      }
      i += 8 + size + (size % 2);
    }
    return null;
  } catch {
    return null;
  }
}

export const specMatchesStd = (s: WavSpec) => s.rate === STD.rate && s.bits === STD.bits && s.channels === STD.channels;

/** 「48kHz / 24bit / 單聲道」這樣的人話字串(三語)。 */
export function specLabel(s: WavSpec, tx: (a: string, b: string, c: string) => string): string {
  const ch = s.channels === 1
    ? tx('單聲道', '单声道', 'mono')
    : s.channels === 2
      ? tx('立體聲', '立体声', 'stereo')
      : tx(`${s.channels} 聲道`, `${s.channels} 声道`, `${s.channels} ch`);
  return `${s.rate / 1000}kHz / ${s.bits}bit / ${ch}`;
}

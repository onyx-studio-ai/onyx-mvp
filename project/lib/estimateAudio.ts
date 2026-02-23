const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u31f0-\u31ff\u3200-\u32ff]/g;

const MID_DENSITY_REGEX = /[\u0e00-\u0e7f\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\u0900-\u097f\u0980-\u09ff\u0a00-\u0a7f\u0a80-\u0aff\u0b00-\u0b7f\u0b80-\u0bff\u0c00-\u0c7f\u0c80-\u0cff\u0d00-\u0d7f\u0e80-\u0eff\u1000-\u109f\u1780-\u17ff\u1200-\u137f\u0f00-\u0fff]/g;

const CHARS_PER_MIN_A = 250;
const CHARS_PER_MIN_B = 600;
const CHARS_PER_MIN_C = 1000;

export function estimateAudioMinutes(text: string): number {
  if (!text || text.trim().length === 0) return 0;

  const bucketA = (text.match(CJK_REGEX) || []).length;

  const textWithoutA = text.replace(CJK_REGEX, '');
  const bucketB = (textWithoutA.match(MID_DENSITY_REGEX) || []).length;

  const textWithoutAB = textWithoutA.replace(MID_DENSITY_REGEX, '');
  const bucketC = textWithoutAB.replace(/\s+/g, ' ').trim().length;

  const minutesA = bucketA / CHARS_PER_MIN_A;
  const minutesB = bucketB / CHARS_PER_MIN_B;
  const minutesC = bucketC / CHARS_PER_MIN_C;

  const total = minutesA + minutesB + minutesC;

  return Math.max(1, Math.ceil(total));
}

export function calculatePrice(minutes: number, tier: 'tier-1' | 'tier-2'): number {
  if (minutes <= 0) return 0;
  const rate = tier === 'tier-1' ? 49 : 149;
  return minutes * rate;
}

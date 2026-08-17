import { VOICE_TRAITS, USE_CASES, VOICE_AGES } from '@/lib/talent-taxonomy';

/*
  申請單 → 配音員檔案的欄位對映(2026-08-17 修 bug:核准建帳號時只搬了 tags,
  沒搬 voice_traits / specialties / voice_ages,配音員登入看到半空的檔案、
  也因此永遠審不過上架 —— 羅郁晴(小琴)回報)。

  申請表存的是英文標籤(Warm / Commercial / Young Adult)或自由填的中文,
  帳號要的是 taxonomy key(warm / commercial / young)。對得上就轉 key,
  對不上的(例:「甜美」「知性」)不硬塞進結構化欄位 —— 那些已經在 tags 裡,
  不會遺失。
*/

const byLabel = <T extends { key: string; tw: string; cn: string; en: string }>(list: readonly T[]) => {
  const m = new Map<string, string>();
  for (const o of list) {
    m.set(o.key.toLowerCase(), o.key);
    for (const label of [o.tw, o.cn, o.en]) m.set(label.toLowerCase(), o.key);
  }
  return m;
};

const TRAIT_MAP = byLabel(VOICE_TRAITS);
const USE_MAP = byLabel(USE_CASES);
const AGE_MAP = byLabel(VOICE_AGES);

// 申請表的用詞與 taxonomy 標籤不完全同字,補這些別名(只補明確等義的)
const USE_ALIASES: Record<string, string> = {
  'e-learning': 'elearning', 'corporate training': 'elearning',
  'drama / character': 'drama', 'animation / character': 'animation',
  'video game': 'game', 'ivr / phone system': 'ivr',
  'movie trailer': 'commercial', 'web video': 'corporate', 'tv': 'commercial', 'radio': 'commercial',
};
const AGE_ALIASES: Record<string, string> = {
  youth: 'teen', 'young adult': 'young', 'middle-aged': 'adult', mature: 'senior',
};

const mapList = (vals: unknown, map: Map<string, string>, aliases: Record<string, string> = {}) => {
  const out = new Set<string>();
  for (const v of Array.isArray(vals) ? vals : []) {
    const s = String(v || '').trim().toLowerCase();
    if (!s) continue;
    const key = map.get(s) || (aliases[s] ? map.get(aliases[s]) : undefined);
    if (key) out.add(key);
  }
  return [...out];
};

export type ApplicationLike = {
  voice_types?: unknown; specialties?: unknown; age_range?: unknown;
  microphone_model?: string | null; recording_environment?: string | null;
  messaging_contacts?: { line?: string; telegram?: string; whatsapp?: string } | null;
};

/** 申請單 → talents 的結構化欄位(只回有值的鍵,呼叫端可安全展開/合併)。 */
export function talentFieldsFromApplication(a: ApplicationLike) {
  const out: Record<string, unknown> = {};
  const traits = mapList(a.voice_types, TRAIT_MAP);
  const specs = mapList(a.specialties, USE_MAP, USE_ALIASES);
  const ageKey = a.age_range ? (AGE_MAP.get(String(a.age_range).trim().toLowerCase()) || AGE_MAP.get(AGE_ALIASES[String(a.age_range).trim().toLowerCase()] || '')) : undefined;
  if (traits.length) out.voice_traits = traits;
  if (specs.length) out.specialties = specs;
  if (ageKey) out.voice_ages = [ageKey];
  // 設備欄位:申請表分兩格,檔案是一段文字
  const equip = [a.microphone_model, a.recording_environment].map((s) => String(s || '').trim()).filter(Boolean).join(' · ');
  if (equip) out.equipment = equip;
  return out;
}

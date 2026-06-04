/**
 * Localized language list shared across the 3 partner forms:
 *   /apply/studio       (recording languages)
 *   /apply/director     (native + can-direct languages)
 *   /apply/proofreader  (native + working languages)
 *
 * Was previously a `string[]` of English labels in each form, which meant
 * /zh-TW and /zh-CN visitors saw English-only pills — a localization
 * bug Wing flagged after seeing zh-TW /apply/director.
 *
 * Each entry has a stable `id` (used in form state + the producer email
 * body for stable parsing) and locale-resolved labels. `langLabel(id,
 * locale)` returns the right label for the visitor's locale.
 *
 * Studio's old COMMON_LANGS and the proofreader's broader list are
 * unified here — proofreader's extras (Punjabi, Polish, Turkish, etc.)
 * are included because narrower lists are easy to slice from this set,
 * but ADDING a language to a narrower list is annoying mid-form.
 */

export type PartnerLang = {
  id: string;
  tw: string;
  cn: string;
  en: string;
};

export const PARTNER_LANGS: PartnerLang[] = [
  // Chinese variants — most-used first (Onyx's strongest language area)
  { id: 'mandarin-tw', tw: '中文(台灣普通話)', cn: '中文(台湾普通话)', en: 'Mandarin (TW)' },
  { id: 'mandarin-cn', tw: '中文(大陸普通話)', cn: '中文(大陆普通话)', en: 'Mandarin (CN)' },
  { id: 'cantonese',   tw: '粵語(香港)',       cn: '粤语(香港)',       en: 'Cantonese' },
  { id: 'hokkien',     tw: '台語(閩南語)',     cn: '台语(闽南语)',     en: 'Hokkien' },

  // English variants
  { id: 'en-us',       tw: '英文(美)',         cn: '英文(美)',         en: 'English (US)' },
  { id: 'en-uk',       tw: '英文(英)',         cn: '英文(英)',         en: 'English (UK)' },

  // East Asian
  { id: 'ja',          tw: '日文',             cn: '日文',             en: 'Japanese' },
  { id: 'ko',          tw: '韓文',             cn: '韩文',             en: 'Korean' },

  // Southeast Asian
  { id: 'th',          tw: '泰文',             cn: '泰文',             en: 'Thai' },
  { id: 'vi',          tw: '越南文',           cn: '越南文',           en: 'Vietnamese' },
  { id: 'id',          tw: '印尼文',           cn: '印尼文',           en: 'Indonesian' },
  { id: 'ms',          tw: '馬來文',           cn: '马来文',           en: 'Malay' },
  { id: 'tl',          tw: '他加祿文',         cn: '他加禄文',         en: 'Tagalog' },

  // South Asian
  { id: 'hi',          tw: '印地語',           cn: '印地语',           en: 'Hindi' },
  { id: 'bn',          tw: '孟加拉語',         cn: '孟加拉语',         en: 'Bengali' },
  { id: 'ta',          tw: '淡米爾語',         cn: '泰米尔语',         en: 'Tamil' },
  { id: 'ur',          tw: '烏爾都語',         cn: '乌尔都语',         en: 'Urdu' },
  { id: 'pa',          tw: '旁遮普語',         cn: '旁遮普语',         en: 'Punjabi' },

  // European
  { id: 'es',          tw: '西班牙文',         cn: '西班牙文',         en: 'Spanish' },
  { id: 'fr',          tw: '法文',             cn: '法文',             en: 'French' },
  { id: 'de',          tw: '德文',             cn: '德文',             en: 'German' },
  { id: 'pt',          tw: '葡萄牙文',         cn: '葡萄牙文',         en: 'Portuguese' },
  { id: 'it',          tw: '義大利文',         cn: '意大利文',         en: 'Italian' },
  { id: 'ru',          tw: '俄文',             cn: '俄文',             en: 'Russian' },
  { id: 'pl',          tw: '波蘭文',           cn: '波兰文',           en: 'Polish' },
  { id: 'nl',          tw: '荷蘭文',           cn: '荷兰文',           en: 'Dutch' },
  { id: 'sv',          tw: '瑞典文',           cn: '瑞典文',           en: 'Swedish' },
  { id: 'tr',          tw: '土耳其文',         cn: '土耳其文',         en: 'Turkish' },

  // Middle East / Arabic variants
  { id: 'ar-msa',      tw: '阿拉伯(MSA)',       cn: '阿拉伯(MSA)',       en: 'Arabic (MSA)' },
  { id: 'ar-egyptian', tw: '阿拉伯(埃及)',       cn: '阿拉伯(埃及)',       en: 'Arabic (Egyptian)' },
  { id: 'ar-gulf',     tw: '阿拉伯(海灣)',       cn: '阿拉伯(海湾)',       en: 'Arabic (Gulf)' },
];

/**
 * Locale-resolve a language id. Falls back to the id if it's unknown
 * (e.g. someone passes through a legacy plain-English string).
 */
export function langLabel(id: string, locale: string): string {
  const item = PARTNER_LANGS.find(l => l.id === id);
  if (!item) return id;
  if (locale === 'zh-CN') return item.cn;
  if (locale.startsWith('zh')) return item.tw;
  return item.en;
}

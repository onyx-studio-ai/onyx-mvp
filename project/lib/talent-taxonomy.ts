/*
  Shared talent taxonomy: voice traits (聲線特質) and use-cases (用途/專長, which
  double as demo categories). The canonical KEY (English slug) is what we store in
  the DB; the display label is localized at render time. One source of truth so the
  talent editor, admin review, public profile, roster filters and (later) search
  all speak the same vocabulary.

  Deliberately CURATED, not exhaustive — covering the ~90% of cases clients
  actually filter by, per the product call that ultra-granular tag trees (Voices /
  Voice123) go mostly unused. Free-text search over bio + credits + demo names
  fills the long tail later.
*/

export const pickLabel = (o: { tw: string; cn: string; en: string }, locale: string) =>
  locale === 'zh-CN' ? o.cn : locale.startsWith('zh') ? o.tw : o.en;

export const VOICE_TRAITS = [
  { key: 'warm',          tw: '溫暖',   cn: '温暖',   en: 'Warm' },
  { key: 'friendly',      tw: '親切',   cn: '亲切',   en: 'Friendly' },
  { key: 'calm',          tw: '沉穩',   cn: '沉稳',   en: 'Calm' },
  { key: 'authoritative', tw: '權威',   cn: '权威',   en: 'Authoritative' },
  { key: 'energetic',     tw: '有活力', cn: '有活力', en: 'Energetic' },
  { key: 'deep',          tw: '低沉',   cn: '低沉',   en: 'Deep' },
  { key: 'bright',        tw: '明亮',   cn: '明亮',   en: 'Bright' },
  { key: 'mature',        tw: '成熟',   cn: '成熟',   en: 'Mature' },
  { key: 'youthful',      tw: '年輕',   cn: '年轻',   en: 'Youthful' },
  { key: 'smooth',        tw: '磁性',   cn: '磁性',   en: 'Smooth' },
] as const;

// Use-cases serve double duty: a talent's specialties (what work they take) AND
// the category each demo is filed under.
export const USE_CASES = [
  { key: 'commercial',  tw: '廣告',         cn: '广告',         en: 'Commercial' },
  { key: 'narration',   tw: '旁白',         cn: '旁白',         en: 'Narration' },
  { key: 'audiobook',   tw: '有聲書',       cn: '有声书',       en: 'Audiobook' },
  { key: 'corporate',   tw: '企業形象',     cn: '企业形象',     en: 'Corporate' },
  { key: 'elearning',   tw: '教育課程',     cn: '教育课程',     en: 'E-learning' },
  { key: 'documentary', tw: '紀錄片',       cn: '纪录片',       en: 'Documentary' },
  { key: 'game',        tw: '遊戲角色',     cn: '游戏角色',     en: 'Game character' },
  { key: 'animation',   tw: '動畫',         cn: '动画',         en: 'Animation' },
  { key: 'drama',       tw: '戲劇配音',     cn: '戏剧配音',     en: 'Dubbing / Drama' },
  { key: 'podcast',     tw: 'Podcast',      cn: 'Podcast',      en: 'Podcast' },
  { key: 'news',        tw: '新聞',         cn: '新闻',         en: 'News' },
  { key: 'ivr',         tw: '電話語音 (IVR)', cn: '电话语音 (IVR)', en: 'IVR / On-hold' },
] as const;

export const TRAIT_KEYS = new Set<string>(VOICE_TRAITS.map((t) => t.key));
export const USE_CASE_KEYS = new Set<string>(USE_CASES.map((u) => u.key));

export const traitLabel = (key: string, locale: string) => {
  const o = VOICE_TRAITS.find((x) => x.key === key);
  return o ? pickLabel(o, locale) : key;
};
export const useCaseLabel = (key: string, locale: string) => {
  const o = USE_CASES.find((x) => x.key === key);
  return o ? pickLabel(o, locale) : key;
};

// Per-category demo cap. Game characters are unlimited — a talent's range across
// characters IS the selling point. Everything else is capped to keep the profile
// tight and listenable.
export const DEMO_LIMIT_DEFAULT = 2;
export const DEMO_UNLIMITED = new Set<string>(['game']);
export const demoLimit = (categoryKey: string) =>
  DEMO_UNLIMITED.has(categoryKey) ? Infinity : DEMO_LIMIT_DEFAULT;

export const DEMO_MAX_SECONDS = 180;            // hard cap 3 min (ideal < 60s)
export const DEMO_MAX_BYTES = 12 * 1024 * 1024; // ~12MB safety cap for one MP3
export const PHOTO_MAX_BYTES = 4 * 1024 * 1024; // pre-compression cap; we shrink client-side anyway

export type DemoItem = { category: string; name: string; url: string; language?: string; seconds?: number };

// ---- Languages & accents (both chosen from dropdowns, never free-typed) ----
// A talent's language entry is stored as `${langKey}/${accentKey}` so it is
// standardized + filterable, yet localizable at render. e.g. "english/hongkong"
// shows as 英文 · 香港 (zh) / English · Hong Kong (en). Legacy free-text entries
// (no "/") are shown as-is.
// World languages — searchable; anything missing can still be typed ("其他").
export const BASE_LANGUAGES = [
  { key: 'mandarin',  tw: '中文(華語)', cn: '中文(普通话)', en: 'Chinese (Mandarin)' },
  { key: 'cantonese', tw: '粵語',       cn: '粤语',         en: 'Cantonese' },
  { key: 'hokkien',   tw: '台語(閩南語)', cn: '闽南语',     en: 'Hokkien' },
  { key: 'hakka',     tw: '客家話',     cn: '客家话',       en: 'Hakka' },
  { key: 'english',   tw: '英文',       cn: '英文',         en: 'English' },
  { key: 'japanese',  tw: '日文',       cn: '日文',         en: 'Japanese' },
  { key: 'korean',    tw: '韓文',       cn: '韩文',         en: 'Korean' },
  { key: 'thai',      tw: '泰文',       cn: '泰文',         en: 'Thai' },
  { key: 'vietnamese',tw: '越南文',     cn: '越南文',       en: 'Vietnamese' },
  { key: 'indonesian',tw: '印尼文',     cn: '印尼文',       en: 'Indonesian' },
  { key: 'malay',     tw: '馬來文',     cn: '马来文',       en: 'Malay' },
  { key: 'tagalog',   tw: '菲律賓語(他加祿)', cn: '菲律宾语(他加禄)', en: 'Tagalog / Filipino' },
  { key: 'burmese',   tw: '緬甸文',     cn: '缅甸文',       en: 'Burmese' },
  { key: 'khmer',     tw: '高棉文(柬埔寨)', cn: '高棉文(柬埔寨)', en: 'Khmer' },
  { key: 'lao',       tw: '寮國文',     cn: '老挝文',       en: 'Lao' },
  { key: 'hindi',     tw: '印地文',     cn: '印地文',       en: 'Hindi' },
  { key: 'urdu',      tw: '烏爾都文',   cn: '乌尔都文',     en: 'Urdu' },
  { key: 'bengali',   tw: '孟加拉文',   cn: '孟加拉文',     en: 'Bengali' },
  { key: 'tamil',     tw: '坦米爾文',   cn: '泰米尔文',     en: 'Tamil' },
  { key: 'telugu',    tw: '泰盧固文',   cn: '泰卢固文',     en: 'Telugu' },
  { key: 'nepali',    tw: '尼泊爾文',   cn: '尼泊尔文',     en: 'Nepali' },
  { key: 'spanish',   tw: '西班牙文',   cn: '西班牙文',     en: 'Spanish' },
  { key: 'portuguese',tw: '葡萄牙文',   cn: '葡萄牙文',     en: 'Portuguese' },
  { key: 'french',    tw: '法文',       cn: '法文',         en: 'French' },
  { key: 'german',    tw: '德文',       cn: '德文',         en: 'German' },
  { key: 'italian',   tw: '義大利文',   cn: '意大利文',     en: 'Italian' },
  { key: 'dutch',     tw: '荷蘭文',     cn: '荷兰文',       en: 'Dutch' },
  { key: 'russian',   tw: '俄文',       cn: '俄文',         en: 'Russian' },
  { key: 'ukrainian', tw: '烏克蘭文',   cn: '乌克兰文',     en: 'Ukrainian' },
  { key: 'polish',    tw: '波蘭文',     cn: '波兰文',       en: 'Polish' },
  { key: 'czech',     tw: '捷克文',     cn: '捷克文',       en: 'Czech' },
  { key: 'romanian',  tw: '羅馬尼亞文', cn: '罗马尼亚文',   en: 'Romanian' },
  { key: 'hungarian', tw: '匈牙利文',   cn: '匈牙利文',     en: 'Hungarian' },
  { key: 'greek',     tw: '希臘文',     cn: '希腊文',       en: 'Greek' },
  { key: 'swedish',   tw: '瑞典文',     cn: '瑞典文',       en: 'Swedish' },
  { key: 'norwegian', tw: '挪威文',     cn: '挪威文',       en: 'Norwegian' },
  { key: 'danish',    tw: '丹麥文',     cn: '丹麦文',       en: 'Danish' },
  { key: 'finnish',   tw: '芬蘭文',     cn: '芬兰文',       en: 'Finnish' },
  { key: 'turkish',   tw: '土耳其文',   cn: '土耳其文',     en: 'Turkish' },
  { key: 'arabic',    tw: '阿拉伯文',   cn: '阿拉伯文',     en: 'Arabic' },
  { key: 'hebrew',    tw: '希伯來文',   cn: '希伯来文',     en: 'Hebrew' },
  { key: 'persian',   tw: '波斯文',     cn: '波斯文',       en: 'Persian / Farsi' },
  { key: 'swahili',   tw: '史瓦希里文', cn: '斯瓦希里文',   en: 'Swahili' },
] as const;

export const ACCENTS = [
  { key: 'native',    tw: '標準 / 母語', cn: '标准 / 母语', en: 'Native / Standard' },
  { key: 'taiwan',    tw: '台灣',       cn: '台湾',         en: 'Taiwan' },
  { key: 'mainland',  tw: '大陸',       cn: '大陆',         en: 'Mainland' },
  { key: 'hongkong',  tw: '香港',       cn: '香港',         en: 'Hong Kong' },
  { key: 'american',  tw: '美式',       cn: '美式',         en: 'American' },
  { key: 'british',   tw: '英式',       cn: '英式',         en: 'British' },
  { key: 'australian',tw: '澳洲',       cn: '澳洲',         en: 'Australian' },
  { key: 'canadian',  tw: '加拿大',     cn: '加拿大',       en: 'Canadian' },
  { key: 'indian',    tw: '印度',       cn: '印度',         en: 'Indian' },
  { key: 'singapore', tw: '新加坡',     cn: '新加坡',       en: 'Singapore' },
  { key: 'malaysia',  tw: '馬來西亞',   cn: '马来西亚',     en: 'Malaysia' },
  { key: 'korean',    tw: '韓式',       cn: '韩式',         en: 'Korean' },
  { key: 'japanese',  tw: '日式',       cn: '日式',         en: 'Japanese' },
] as const;

export const baseLangLabel = (key: string, locale: string) => {
  const o = BASE_LANGUAGES.find((x) => x.key === key); return o ? pickLabel(o, locale) : key;
};
export const accentLabel = (key: string, locale: string) => {
  const o = ACCENTS.find((x) => x.key === key); return o ? pickLabel(o, locale) : key;
};
// Render a stored language entry ("english/hongkong") in the viewer's locale.
export const formatLangEntry = (value: string, locale: string) => {
  if (!value.includes('/')) return value; // legacy free-text entry
  const [l, a] = value.split('/');
  const lang = baseLangLabel(l, locale);
  return a && a !== 'native' ? `${lang} · ${accentLabel(a, locale)}` : lang;
};

// Work-availability presets (toggle chips, not free text).
export const AVAILABILITY = [
  { key: 'weekday',  tw: '平日',       cn: '平日',       en: 'Weekdays' },
  { key: 'weekend',  tw: '週末',       cn: '周末',       en: 'Weekends' },
  { key: 'daytime',  tw: '白天',       cn: '白天',       en: 'Daytime' },
  { key: 'evening',  tw: '晚上',       cn: '晚上',       en: 'Evenings' },
  { key: 'flexible', tw: '時間彈性',   cn: '时间弹性',   en: 'Flexible' },
  { key: 'byappt',   tw: '需提前預約', cn: '需提前预约', en: 'By appointment' },
] as const;
export const availabilityLabel = (key: string, locale: string) => {
  const o = AVAILABILITY.find((x) => x.key === key); return o ? pickLabel(o, locale) : key;
};

// Countries (location) — chosen from a searchable dropdown, stored as the key.
export const COUNTRIES = [
  { key: 'TW', tw: '台灣', cn: '台湾', en: 'Taiwan' },
  { key: 'HK', tw: '香港', cn: '香港', en: 'Hong Kong' },
  { key: 'CN', tw: '中國大陸', cn: '中国大陆', en: 'China' },
  { key: 'MO', tw: '澳門', cn: '澳门', en: 'Macau' },
  { key: 'SG', tw: '新加坡', cn: '新加坡', en: 'Singapore' },
  { key: 'MY', tw: '馬來西亞', cn: '马来西亚', en: 'Malaysia' },
  { key: 'JP', tw: '日本', cn: '日本', en: 'Japan' },
  { key: 'KR', tw: '韓國', cn: '韩国', en: 'South Korea' },
  { key: 'TH', tw: '泰國', cn: '泰国', en: 'Thailand' },
  { key: 'VN', tw: '越南', cn: '越南', en: 'Vietnam' },
  { key: 'ID', tw: '印尼', cn: '印尼', en: 'Indonesia' },
  { key: 'PH', tw: '菲律賓', cn: '菲律宾', en: 'Philippines' },
  { key: 'IN', tw: '印度', cn: '印度', en: 'India' },
  { key: 'US', tw: '美國', cn: '美国', en: 'United States' },
  { key: 'CA', tw: '加拿大', cn: '加拿大', en: 'Canada' },
  { key: 'GB', tw: '英國', cn: '英国', en: 'United Kingdom' },
  { key: 'AU', tw: '澳洲', cn: '澳洲', en: 'Australia' },
  { key: 'NZ', tw: '紐西蘭', cn: '新西兰', en: 'New Zealand' },
  { key: 'FR', tw: '法國', cn: '法国', en: 'France' },
  { key: 'DE', tw: '德國', cn: '德国', en: 'Germany' },
  { key: 'ES', tw: '西班牙', cn: '西班牙', en: 'Spain' },
  { key: 'IT', tw: '義大利', cn: '意大利', en: 'Italy' },
  { key: 'NL', tw: '荷蘭', cn: '荷兰', en: 'Netherlands' },
  { key: 'AE', tw: '阿聯', cn: '阿联酋', en: 'UAE' },
  { key: 'OTHER', tw: '其他', cn: '其他', en: 'Other' },
] as const;
export const countryLabel = (key: string, locale: string) => {
  const o = COUNTRIES.find((x) => x.key === key); return o ? pickLabel(o, locale) : key;
};

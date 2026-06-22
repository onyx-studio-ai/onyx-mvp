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

/*
  程序化 SEO 著陸頁的資料定義:/voice-over/{語言}/{用途}。
  純新增路由,不動任何既有頁面(Wing 2026-08-16 拍板)。
  語言值對齊 lib/languages.ts 標準值(用前綴比對涵蓋變體,如 English · American)。
  demo 分類 key 對齊 lib/talent-taxonomy.ts 的 USE_CASES。
*/

export type L3 = { tw: string; cn: string; en: string };

export type VoLang = { slug: string; label: L3; match: string[] };
export const VO_LANGS: VoLang[] = [
  { slug: 'mandarin-taiwan', label: { tw: '台灣國語', cn: '台湾国语', en: 'Taiwanese Mandarin' }, match: ['Mandarin · Taiwan'] },
  { slug: 'english', label: { tw: '英文', cn: '英文', en: 'English' }, match: ['English'] },
  { slug: 'cantonese', label: { tw: '粵語', cn: '粤语', en: 'Cantonese' }, match: ['Cantonese'] },
  { slug: 'taiwanese-hokkien', label: { tw: '台語(閩南語)', cn: '台语(闽南语)', en: 'Taiwanese Hokkien' }, match: ['Taiwanese Hokkien', 'Hokkien'] },
];

export type VoUse = { slug: string; cats: string[]; label: L3; isTts?: boolean };
export const VO_USES: VoUse[] = [
  { slug: 'commercial', cats: ['commercial'], label: { tw: '廣告配音', cn: '广告配音', en: 'Commercial Voice Over' } },
  { slug: 'narration', cats: ['narration', 'documentary', 'corporate'], label: { tw: '旁白配音', cn: '旁白配音', en: 'Narration Voice Over' } },
  { slug: 'ecommerce', cats: ['commercial', 'corporate'], label: { tw: '電商影片配音', cn: '电商视频配音', en: 'E-commerce Video Voice Over' } },
  { slug: 'game', cats: ['game', 'animation', 'drama'], label: { tw: '遊戲角色配音', cn: '游戏角色配音', en: 'Video Game Voice Over' } },
  { slug: 'tts', cats: [], label: { tw: 'TTS / AI 語音數據錄製', cn: 'TTS / AI 语音数据录制', en: 'TTS & AI Voice Data Recording' }, isTts: true },
];

export const voLang = (slug: string) => VO_LANGS.find((l) => l.slug === slug);
export const voUse = (slug: string) => VO_USES.find((u) => u.slug === slug);
export const VO_ROUTES = VO_LANGS.flatMap((l) => VO_USES.map((u) => `/voice-over/${l.slug}/${u.slug}`));

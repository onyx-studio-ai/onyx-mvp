/*
  全平台「語言」唯一真相(Wing 2026-07-14 定)。之前語言散在報名表、發案表單(自由手打)、
  AI 聲音各自一套 → 值不一致、配對不上。統一成這份:
    - `v` = 存進 DB 的標準值(英文正規值),絕不再讓人手打。
    - tw/cn = 顯示標籤;en 直接用 v(去掉 · 前後空白也行)。
  發案表單、報名表都從這份下拉選;顯示時一律用 langLabel(v, locale) 本地化。
  中文家族一律 `Mandarin · 地區` / `Cantonese · 地區`(2026-07-14:Chinese · Taiwan → Mandarin · Taiwan)。
*/

export type LangOption = { v: string; tw: string; cn: string };

export const LANGUAGES: LangOption[] = [
  { v: 'Mandarin · Taiwan', tw: '中文 · 台灣(國語)', cn: '中文 · 台湾(国语)' },
  { v: 'Mandarin · Mainland', tw: '中文 · 普通話 / 大陸', cn: '中文 · 普通话 / 大陆' },
  { v: 'Cantonese · Hong Kong', tw: '中文 · 香港粵語', cn: '中文 · 香港粤语' },
  { v: 'Mandarin · Malaysia', tw: '中文 · 馬來西亞', cn: '中文 · 马来西亚' },
  { v: 'Taiwanese Hokkien', tw: '台語', cn: '台语' },
  { v: 'Hakka', tw: '客家話', cn: '客家话' },
  { v: 'English · American', tw: '英文 · 美國', cn: '英文 · 美国' },
  { v: 'English · British', tw: '英文 · 英國', cn: '英文 · 英国' },
  { v: 'English · Australian', tw: '英文 · 澳洲', cn: '英文 · 澳洲' },
  { v: 'English · Indian', tw: '英文 · 印度', cn: '英文 · 印度' },
  { v: 'English · Singapore', tw: '英文 · 新加坡', cn: '英文 · 新加坡' },
  { v: 'Japanese', tw: '日文', cn: '日文' },
  { v: 'Korean', tw: '韓文', cn: '韩文' },
  { v: 'Vietnamese', tw: '越南文', cn: '越南文' },
  { v: 'Indonesian', tw: '印尼文', cn: '印尼文' },
  { v: 'Thai', tw: '泰文', cn: '泰文' },
  { v: 'Malay', tw: '馬來文', cn: '马来文' },
  { v: 'Spanish · Spain', tw: '西班牙文 · 西班牙', cn: '西班牙文 · 西班牙' },
  { v: 'Spanish · Latin America', tw: '西班牙文 · 拉丁美洲', cn: '西班牙文 · 拉丁美洲' },
  { v: 'French · France', tw: '法文 · 法國', cn: '法文 · 法国' },
  { v: 'French · Canadian', tw: '法文 · 加拿大', cn: '法文 · 加拿大' },
  { v: 'German · Germany', tw: '德文 · 德國', cn: '德文 · 德国' },
  { v: 'German · Austria', tw: '德文 · 奧地利', cn: '德文 · 奥地利' },
  { v: 'Russian', tw: '俄文', cn: '俄文' },
  { v: 'Arabic', tw: '阿拉伯文', cn: '阿拉伯文' },
  { v: 'Portuguese · Brazil', tw: '葡萄牙文 · 巴西', cn: '葡萄牙文 · 巴西' },
  { v: 'Portuguese · Portugal', tw: '葡萄牙文 · 葡萄牙', cn: '葡萄牙文 · 葡萄牙' },
];

const BY_V = new Map(LANGUAGES.map((o) => [o.v, o]));

// 舊值 → 新標準(遷移沒掃到的殘留也能正確顯示)。
const LEGACY: Record<string, string> = { 'Chinese · Taiwan': 'Mandarin · Taiwan' };

/** 把存的標準值顯示成當地語言;非標準值(舊自由文字)原樣回傳,不硬改。 */
export function langLabel(v: string | null | undefined, locale: string): string {
  if (!v) return '';
  const canon = LEGACY[v] || v;
  const o = BY_V.get(canon);
  if (!o) return v;
  return locale === 'zh-TW' ? o.tw : locale === 'zh-CN' ? o.cn : o.v;
}

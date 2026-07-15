/*
  全平台「語言」唯一真相(Wing 2026-07-14 定)。之前語言散在報名表、發案表單(自由手打)、
  AI 聲音各自一套 → 值不一致、配對不上。統一成這份:
    - `v` = 存進 DB 的標準值(英文正規值),絕不再讓人手打。
    - tw/cn = 顯示標籤;en 直接用 v。
  發案表單、報名表都從這份下拉選;顯示時一律用 langLabel(v, locale) 本地化。
  清單參照 Voices.com / Voice123 的語言+口音分級(2026-07-14 擴充):主要商用語言拆口音
  (英文 美/英/澳…、西語 西班牙/拉美/墨…、法/德/葡/阿拉伯 各地區),其餘給單一語言。
  中文家族一律 `Mandarin · 地區` / `Cantonese · 地區`(Chinese · Taiwan 已改名 Mandarin · Taiwan)。
*/

export type LangOption = { v: string; tw: string; cn: string };

export const LANGUAGES: LangOption[] = [
  // ── 中文家族 ──
  { v: 'Mandarin · Taiwan', tw: '中文 · 台灣(國語)', cn: '中文 · 台湾(国语)' },
  { v: 'Mandarin · Mainland', tw: '中文 · 普通話 / 大陸', cn: '中文 · 普通话 / 大陆' },
  { v: 'Mandarin · Malaysia', tw: '中文 · 馬來西亞', cn: '中文 · 马来西亚' },
  { v: 'Cantonese · Hong Kong', tw: '中文 · 香港粵語', cn: '中文 · 香港粤语' },
  { v: 'Cantonese · Guangdong', tw: '中文 · 廣東粵語', cn: '中文 · 广东粤语' },
  { v: 'Taiwanese Hokkien', tw: '台語(閩南語)', cn: '台语(闽南语)' },
  { v: 'Hakka', tw: '客家話', cn: '客家话' },
  // 中國各省方言 / 官話口音(Wing 要收這些人才,一定保留)
  { v: 'Mandarin · Sichuan', tw: '中文 · 四川話', cn: '中文 · 四川话' },
  { v: 'Mandarin · Northeastern', tw: '中文 · 東北話', cn: '中文 · 东北话' },
  { v: 'Mandarin · Beijing', tw: '中文 · 北京(京片子)', cn: '中文 · 北京(京片子)' },
  { v: 'Mandarin · Tianjin', tw: '中文 · 天津話', cn: '中文 · 天津话' },
  { v: 'Mandarin · Shandong', tw: '中文 · 山東話', cn: '中文 · 山东话' },
  { v: 'Mandarin · Henan', tw: '中文 · 河南話(中原官話)', cn: '中文 · 河南话(中原官话)' },
  { v: 'Mandarin · Lanyin', tw: '中文 · 蘭銀官話(西北)', cn: '中文 · 兰银官话(西北)' },
  { v: 'Mandarin · Southwestern', tw: '中文 · 西南官話(雲貴)', cn: '中文 · 西南官话(云贵)' },
  { v: 'Shanghainese · Wu', tw: '上海話(吳語)', cn: '上海话(吴语)' },
  { v: 'Teochew', tw: '潮州話', cn: '潮州话' },
  { v: 'Hokkien · Minnan', tw: '閩南語(福建)', cn: '闽南语(福建)' },
  { v: 'Xiang · Hunanese', tw: '湖南話(湘語)', cn: '湖南话(湘语)' },
  // 通用/不指定地區(母語但沒寫地區時用,別硬塞地區)
  { v: 'Mandarin', tw: '中文 · 通用(不分地區)', cn: '中文 · 通用(不分地区)' },
  { v: 'Cantonese', tw: '粵語 · 通用', cn: '粤语 · 通用' },
  // ── 英文(口音需求最大)──
  { v: 'English · American', tw: '英文 · 美國', cn: '英文 · 美国' },
  { v: 'English · British', tw: '英文 · 英國', cn: '英文 · 英国' },
  { v: 'English · Australian', tw: '英文 · 澳洲', cn: '英文 · 澳洲' },
  { v: 'English · Canadian', tw: '英文 · 加拿大', cn: '英文 · 加拿大' },
  { v: 'English · Irish', tw: '英文 · 愛爾蘭', cn: '英文 · 爱尔兰' },
  { v: 'English · Scottish', tw: '英文 · 蘇格蘭', cn: '英文 · 苏格兰' },
  { v: 'English · New Zealand', tw: '英文 · 紐西蘭', cn: '英文 · 新西兰' },
  { v: 'English · South African', tw: '英文 · 南非', cn: '英文 · 南非' },
  { v: 'English · Indian', tw: '英文 · 印度', cn: '英文 · 印度' },
  { v: 'English · Singapore', tw: '英文 · 新加坡', cn: '英文 · 新加坡' },
  { v: 'English · Filipino', tw: '英文 · 菲律賓', cn: '英文 · 菲律宾' },
  { v: 'English', tw: '英文 · 通用(不分地區)', cn: '英文 · 通用(不分地区)' },
  // ── 西班牙文 ──
  { v: 'Spanish · Spain', tw: '西班牙文 · 西班牙', cn: '西班牙文 · 西班牙' },
  { v: 'Spanish · Latin America', tw: '西班牙文 · 拉丁美洲', cn: '西班牙文 · 拉丁美洲' },
  { v: 'Spanish · Mexican', tw: '西班牙文 · 墨西哥', cn: '西班牙文 · 墨西哥' },
  { v: 'Spanish · Argentine', tw: '西班牙文 · 阿根廷', cn: '西班牙文 · 阿根廷' },
  { v: 'Spanish · Colombian', tw: '西班牙文 · 哥倫比亞', cn: '西班牙文 · 哥伦比亚' },
  { v: 'Spanish', tw: '西班牙文 · 通用', cn: '西班牙文 · 通用' },
  // ── 法文 ──
  { v: 'French · France', tw: '法文 · 法國', cn: '法文 · 法国' },
  { v: 'French · Canadian', tw: '法文 · 加拿大(魁北克)', cn: '法文 · 加拿大(魁北克)' },
  { v: 'French · Belgian', tw: '法文 · 比利時', cn: '法文 · 比利时' },
  { v: 'French · Swiss', tw: '法文 · 瑞士', cn: '法文 · 瑞士' },
  { v: 'French', tw: '法文 · 通用', cn: '法文 · 通用' },
  // ── 葡萄牙文 ──
  { v: 'Portuguese · Brazil', tw: '葡萄牙文 · 巴西', cn: '葡萄牙文 · 巴西' },
  { v: 'Portuguese · Portugal', tw: '葡萄牙文 · 葡萄牙', cn: '葡萄牙文 · 葡萄牙' },
  { v: 'Portuguese', tw: '葡萄牙文 · 通用', cn: '葡萄牙文 · 通用' },
  // ── 德文 ──
  { v: 'German · Germany', tw: '德文 · 德國', cn: '德文 · 德国' },
  { v: 'German · Austria', tw: '德文 · 奧地利', cn: '德文 · 奥地利' },
  { v: 'German · Swiss', tw: '德文 · 瑞士', cn: '德文 · 瑞士' },
  { v: 'German', tw: '德文 · 通用', cn: '德文 · 通用' },
  // ── 阿拉伯文 ──
  { v: 'Arabic · Modern Standard', tw: '阿拉伯文 · 標準', cn: '阿拉伯文 · 标准' },
  { v: 'Arabic · Egyptian', tw: '阿拉伯文 · 埃及', cn: '阿拉伯文 · 埃及' },
  { v: 'Arabic · Gulf', tw: '阿拉伯文 · 海灣', cn: '阿拉伯文 · 海湾' },
  { v: 'Arabic · Levantine', tw: '阿拉伯文 · 黎凡特', cn: '阿拉伯文 · 黎凡特' },
  { v: 'Arabic', tw: '阿拉伯文 · 通用', cn: '阿拉伯文 · 通用' },
  // ── 東亞 / 東南亞 ──
  { v: 'Japanese', tw: '日文', cn: '日文' },
  { v: 'Korean', tw: '韓文', cn: '韩文' },
  { v: 'Vietnamese', tw: '越南文', cn: '越南文' },
  { v: 'Thai', tw: '泰文', cn: '泰文' },
  { v: 'Indonesian', tw: '印尼文', cn: '印尼文' },
  { v: 'Malay', tw: '馬來文', cn: '马来文' },
  { v: 'Filipino / Tagalog', tw: '菲律賓文(他加祿語)', cn: '菲律宾文(他加禄语)' },
  { v: 'Burmese', tw: '緬甸文', cn: '缅甸文' },
  { v: 'Khmer', tw: '高棉文(柬埔寨)', cn: '高棉文(柬埔寨)' },
  { v: 'Lao', tw: '寮國文', cn: '老挝文' },
  { v: 'Mongolian', tw: '蒙古文', cn: '蒙古文' },
  // ── 南亞 ──
  { v: 'Hindi', tw: '印地文', cn: '印地文' },
  { v: 'Bengali', tw: '孟加拉文', cn: '孟加拉文' },
  { v: 'Tamil', tw: '坦米爾文', cn: '泰米尔文' },
  { v: 'Telugu', tw: '泰盧固文', cn: '泰卢固文' },
  { v: 'Urdu', tw: '烏爾都文', cn: '乌尔都文' },
  { v: 'Punjabi', tw: '旁遮普文', cn: '旁遮普文' },
  { v: 'Nepali', tw: '尼泊爾文', cn: '尼泊尔文' },
  { v: 'Sinhala', tw: '僧伽羅文', cn: '僧伽罗文' },
  // ── 歐洲 ──
  { v: 'Italian', tw: '義大利文', cn: '意大利文' },
  { v: 'Dutch', tw: '荷蘭文', cn: '荷兰文' },
  { v: 'Russian', tw: '俄文', cn: '俄文' },
  { v: 'Polish', tw: '波蘭文', cn: '波兰文' },
  { v: 'Ukrainian', tw: '烏克蘭文', cn: '乌克兰文' },
  { v: 'Turkish', tw: '土耳其文', cn: '土耳其文' },
  { v: 'Greek', tw: '希臘文', cn: '希腊文' },
  { v: 'Czech', tw: '捷克文', cn: '捷克文' },
  { v: 'Hungarian', tw: '匈牙利文', cn: '匈牙利文' },
  { v: 'Romanian', tw: '羅馬尼亞文', cn: '罗马尼亚文' },
  { v: 'Swedish', tw: '瑞典文', cn: '瑞典文' },
  { v: 'Norwegian', tw: '挪威文', cn: '挪威文' },
  { v: 'Danish', tw: '丹麥文', cn: '丹麦文' },
  { v: 'Finnish', tw: '芬蘭文', cn: '芬兰文' },
  { v: 'Hebrew', tw: '希伯來文', cn: '希伯来文' },
  { v: 'Persian · Farsi', tw: '波斯文', cn: '波斯文' },
  { v: 'Croatian', tw: '克羅埃西亞文', cn: '克罗地亚文' },
  { v: 'Serbian', tw: '塞爾維亞文', cn: '塞尔维亚文' },
  { v: 'Bulgarian', tw: '保加利亞文', cn: '保加利亚文' },
  { v: 'Slovak', tw: '斯洛伐克文', cn: '斯洛伐克文' },
  { v: 'Catalan', tw: '加泰隆尼亞文', cn: '加泰罗尼亚文' },
  { v: 'Icelandic', tw: '冰島文', cn: '冰岛文' },
  // ── 非洲 ──
  { v: 'Swahili', tw: '史瓦希里文', cn: '斯瓦希里文' },
  { v: 'Afrikaans', tw: '南非荷蘭文', cn: '南非荷兰文' },
  { v: 'Zulu', tw: '祖魯文', cn: '祖鲁文' },
  { v: 'Amharic', tw: '阿姆哈拉文', cn: '阿姆哈拉文' },
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

/*
  normalizeLangValue —— 把「任何來源的語言值」轉成標準值(認不得就原樣保留,不硬猜)。
  吃三類舊格式:①自助改檔頁 talent-taxonomy 的 `langKey/accentKey`(如 mandarin/taiwan、
  english/native);②報名表歷史正規值(Chinese · Taiwan);③自由亂打(國語、台灣國語…)。
  用途:api/talent/me 寫入口統一過這裡 → DB 永遠只進標準值(關掉 2026-07 語言三套格式
  對不上的髒源頭;DL Merlin 改檔即髒的活案例)。/native、無地區 → 對到「通用」值,不猜地區。
*/
const KEY_REGION: Record<string, string> = {
  'mandarin/taiwan': 'Mandarin · Taiwan', 'mandarin/mainland': 'Mandarin · Mainland', 'mandarin/malaysia': 'Mandarin · Malaysia',
  'cantonese/hongkong': 'Cantonese · Hong Kong', 'cantonese/guangdong': 'Cantonese · Guangdong',
  'hokkien/taiwan': 'Taiwanese Hokkien', 'hokkien/native': 'Taiwanese Hokkien',
  'english/american': 'English · American', 'english/british': 'English · British', 'english/australian': 'English · Australian',
  'english/canadian': 'English · Canadian', 'english/irish': 'English · Irish', 'english/scottish': 'English · Scottish',
  'english/indian': 'English · Indian', 'english/singapore': 'English · Singapore', 'english/filipino': 'English · Filipino',
  'spanish/spain': 'Spanish · Spain', 'spanish/latam': 'Spanish · Latin America', 'spanish/latinamerica': 'Spanish · Latin America', 'spanish/mexican': 'Spanish · Mexican',
  'french/france': 'French · France', 'french/canadian': 'French · Canadian', 'french/belgian': 'French · Belgian', 'french/swiss': 'French · Swiss',
  'portuguese/brazil': 'Portuguese · Brazil', 'portuguese/brazilian': 'Portuguese · Brazil', 'portuguese/portugal': 'Portuguese · Portugal',
  'german/germany': 'German · Germany', 'german/austria': 'German · Austria', 'german/swiss': 'German · Swiss',
};
const KEY_BASE: Record<string, string> = {
  mandarin: 'Mandarin', chinese: 'Mandarin', cantonese: 'Cantonese', hokkien: 'Taiwanese Hokkien', hakka: 'Hakka',
  english: 'English', spanish: 'Spanish', french: 'French', german: 'German', portuguese: 'Portuguese',
  arabic: 'Arabic', japanese: 'Japanese', korean: 'Korean', vietnamese: 'Vietnamese', thai: 'Thai',
  indonesian: 'Indonesian', malay: 'Malay', filipino: 'Filipino / Tagalog', tagalog: 'Filipino / Tagalog',
  hindi: 'Hindi', bengali: 'Bengali', tamil: 'Tamil', telugu: 'Telugu', urdu: 'Urdu', punjabi: 'Punjabi',
  nepali: 'Nepali', sinhala: 'Sinhala', italian: 'Italian', dutch: 'Dutch', russian: 'Russian', polish: 'Polish',
  ukrainian: 'Ukrainian', turkish: 'Turkish', greek: 'Greek', czech: 'Czech', hungarian: 'Hungarian',
  romanian: 'Romanian', swedish: 'Swedish', norwegian: 'Norwegian', danish: 'Danish', finnish: 'Finnish',
  hebrew: 'Hebrew', persian: 'Persian · Farsi', farsi: 'Persian · Farsi', burmese: 'Burmese', khmer: 'Khmer',
  lao: 'Lao', mongolian: 'Mongolian', swahili: 'Swahili', afrikaans: 'Afrikaans', zulu: 'Zulu', amharic: 'Amharic',
};
const FREE_TEXT: Record<string, string> = {
  'chinese · taiwan': 'Mandarin · Taiwan', '國語': 'Mandarin · Taiwan', '台灣國語': 'Mandarin · Taiwan', '華語': 'Mandarin · Taiwan',
  '中文台灣腔': 'Mandarin · Taiwan', 'taiwanese mandarin': 'Mandarin · Taiwan', '普通話': 'Mandarin · Mainland', '普通话': 'Mandarin · Mainland',
  '兰银官话': 'Mandarin · Lanyin', '蘭銀官話': 'Mandarin · Lanyin', '廣東話': 'Cantonese · Hong Kong', '广东话': 'Cantonese · Hong Kong',
  '台語': 'Taiwanese Hokkien', '台语': 'Taiwanese Hokkien', '日語': 'Japanese', '日文': 'Japanese', '英語': 'English', '英文': 'English',
  '美式英語': 'English · American', 'mandarin (simplified)': 'Mandarin', 'mandarin (traditional)': 'Mandarin',
};

export function normalizeLangValue(raw: string | null | undefined): string {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (BY_V.has(v)) return v;                       // 已是標準值
  if (LEGACY[v]) return LEGACY[v];                 // 舊正規值改名
  const low = v.toLowerCase();
  if (FREE_TEXT[low]) return FREE_TEXT[low];
  if (KEY_REGION[low]) return KEY_REGION[low];
  if (low.includes('/')) {                         // langKey/accent:地區對地區、/native 對通用
    const [k] = low.split('/');
    if (KEY_BASE[k]) return KEY_BASE[k];
    if (FREE_TEXT[k]) return FREE_TEXT[k];         // 亂打字+/native(如 中文台灣腔/native)也接
  }
  if (KEY_BASE[low]) return KEY_BASE[low];
  return v;                                        // 認不得 → 原樣保留(健檢會報,人來判)
}

/** 陣列版:逐一正規化 + 去空 + 去重。 */
export function normalizeLangArray(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map((x) => normalizeLangValue(typeof x === 'string' ? x : '')).filter(Boolean))];
}

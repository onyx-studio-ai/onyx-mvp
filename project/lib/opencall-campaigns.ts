/*
  公開徵集「活動設定檔」(Wing 2026-08-07:未來會有很多檔徵集)——
  開新徵集 = 在這裡加一個 entry,前台自動有 /opencall/<slug> 頁、上傳與投稿 API 直接可用,
  後台「公開徵集」自動多一個活動篩選。資料同存 opencall_submissions(campaign 欄位區分)。
  文案三語 [繁中, 簡中, 英文];授權/資格等 TTS 通用文案寫在 OpencallForm 元件內,
  若未來有非 TTS 徵集再搬進設定檔。
*/

export type L3 = [string, string, string]; // [zh-TW, zh-CN, en]
export type OpencallCase = { code: string; label: L3; lang: string };
export type OpencallCampaign = {
  slug: string;
  active: boolean;
  title: L3;          // 頁面大標(\n 換行)
  intro: L3;          // 一句話說明
  deadline: string;   // 顯示用截止日
  payNote: L3;        // 酬勞說明
  cases: OpencallCase[];
};

export const OPENCALL_CAMPAIGNS: OpencallCampaign[] = [
  {
    slug: 'dialects-2026-08',
    active: true,
    title: [
      'TTS 自由對話語料\n四個語系開放投 demo',
      'TTS 自由对话语料\n四个语系开放投 demo',
      'TTS Free-talk Corpus\nOpen call for 4 dialects',
    ],
    intro: [
      '用手機錄 1-3 分鐘「自然聊天」(Freetalk,不用唸稿、不用棚錄)上傳即可。免註冊、免下載任何 App。',
      '用手机录 1-3 分钟「自然聊天」(Freetalk,不用念稿、不用棚录)上传即可。免注册、免下载任何 App。',
      'Record 1-3 minutes of natural free talk on your phone (no script, no studio) and upload it here. No sign-up, no app needed.',
    ],
    deadline: '2026-09-30',
    payNote: [
      '每個語系為 5 小時成品語料,整案酬勞 NT$15,000 起/人,依您的資歷、經驗與配音專業背景議定;資深專業配音員費率可另議,也歡迎在表單中提出您的期望酬勞。正式錄製地點:台灣於台北的錄音室進行;大陸、香港地區則由我們安排當地的錄音室錄製(以等值幣別計酬)。居住地較偏遠者,相關補助可於確認合作時一併討論。',
      '每个语系为 5 小时成品语料,整案酬劳 NT$15,000 起/人(约 RMB 3,500 起),依您的资历、经验与配音专业背景议定;资深专业配音员费率可另议,也欢迎在表单中提出您的期望酬劳。正式录制地点:台湾于台北的录音室进行;大陆、香港地区则由我们安排当地的录音室录制(以等值币别计酬)。居住地较偏远者,相关补助可于确认合作时一并讨论。',
      'Each dialect is a 5-finished-hour corpus. Per-person fee starts from NT$15,000, set according to your background, experience and voice-acting expertise; experienced professional rates are negotiable, and you are welcome to state your expected fee in the form. Formal recording takes place in our Taipei studio for Taiwan-based speakers; for mainland China and Hong Kong we arrange a local studio (paid in equivalent currency). Support for remote locations can be discussed when confirming the collaboration.',
    ],
    cases: [
      { code: 'ONYX-VO-260804-2NCH', label: ['福建閩南話(泉州 / 漳州 / 廈門)', '福建闽南话(泉州 / 漳州 / 厦门)', 'Fujian Minnan (Quanzhou / Zhangzhou / Xiamen)'], lang: 'Hokkien · Minnan' },
      { code: 'ONYX-VO-260804-M2DH', label: ['廣州粵語', '广州粤语', 'Guangzhou Cantonese'], lang: 'Cantonese' },
      { code: 'ONYX-VO-260804-8FDH', label: ['上海話', '上海话', 'Shanghainese'], lang: 'Shanghainese · Wu' },
      { code: 'ONYX-VO-260804-TTDH', label: ['台灣閩南語', '台湾闽南语', 'Taiwanese Hokkien'], lang: 'Taiwanese Hokkien' },
    ],
  },
];

export const DEFAULT_OPENCALL_SLUG = 'dialects-2026-08';
export function getCampaign(slug?: string | null): OpencallCampaign | null {
  return OPENCALL_CAMPAIGNS.find((c) => c.slug === (slug || DEFAULT_OPENCALL_SLUG)) || null;
}
export function pickL3(v: L3, locale: string): string {
  return locale === 'zh-CN' ? v[1] : locale.startsWith('zh') ? v[0] : v[2];
}
// 後台用:所有活動的 case → 繁中標籤對照
export function allCaseLabels(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of OPENCALL_CAMPAIGNS) for (const k of c.cases) out[k.code] = k.label[0];
  return out;
}

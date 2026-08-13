/*
  VoiceMatch(Wing 2026-08-13):案件 × 配音員的音色匹配度 0–100。
  用途:發案通知時只寄給 ≥60 分的人,並把分數印在專屬邀請信上 ——
  用一個客觀數字回答「為什麼找你」,取代每人手寫理由。

  權重:語言 40 / 性別 25 / 口音 20 / 專長類型 15。
  語言家族不符 = 直接 0 分(硬性淘汰,不是扣分)。
*/
import { langKeys, primaryLangKey } from './languages';

export type MatchTalent = {
  languages?: unknown; native_languages?: unknown; gender?: string | null;
  accent?: string | null; tags?: unknown; specialties?: unknown;
};
export type MatchBrief = {
  language?: string | null; gender_needs?: string | null;
  accent?: string | null; content_type?: string | null;
};

const asText = (v: unknown) => (Array.isArray(v) ? v.join(' ') : String(v ?? ''));
// 家族鍵(zh/en/yue/nan…):擋語言不擋口音,與案件可見性同一套語意。
const famOf = (s: unknown) => langKeys(String(s ?? '')).filter((k) => !k.includes('-'));

/** 案件要的性別:gender_needs 是「男聲 1 位、女聲 1 位」這種字串。 */
function wantedGenders(needs?: string | null): { male: boolean; female: boolean } {
  const t = String(needs || '');
  return { male: /男[聲声]/.test(t), female: /女[聲声]/.test(t) };
}

/** 口音關鍵詞:台灣/大陸/香港…,用來比對案件 accent 與配音員的語言/口音欄。 */
const ACCENT_KEYS: [RegExp, string][] = [
  [/台灣|台湾|Taiwan/i, 'tw'],
  [/大陸|大陆|Mainland|普通話|普通话/i, 'cn'],
  [/香港|Hong ?Kong|港/i, 'hk'],
  [/美式|American|US\b/i, 'us'],
  [/英式|British|UK\b/i, 'uk'],
];
const accentKeys = (s: string) => ACCENT_KEYS.filter(([re]) => re.test(s)).map(([, k]) => k);

/** 案件類別 → 配音員標籤的對應(標籤來自 talents.tags / specialties)。 */
const TYPE_HINTS: [RegExp, RegExp][] = [
  [/TTS|AI/i, /AI Voice|TTS/i],
  [/紀錄|纪录|Documentary/i, /Documentary|Narration/i],
  [/廣告|广告|Commercial/i, /Commercial/i],
  [/旁白|Narration/i, /Narration/i],
  [/有聲書|有声书|Audiobook/i, /Audiobook/i],
  [/遊戲|游戏|Game/i, /Game|Drama|Character/i],
  [/動畫|动画|Anim/i, /Anim|Character/i],
  [/教育|教學|E-?Learning/i, /E-Learning|Corporate/i],
  [/工商|企業|Corporate/i, /Corporate/i],
  [/IVR|電話|来电|來電/i, /IVR/i],
  [/語音助理|Assistant/i, /Assistant|AI Voice/i],
];

export function voiceMatch(t: MatchTalent, b: MatchBrief): number {
  // ── 語言 40(不符直接淘汰)──
  const briefFam = famOf(b.language);
  const talentLangs = `${asText(t.languages)} ${asText(t.native_languages)}`;
  const talentFam = new Set([
    ...(Array.isArray(t.languages) ? t.languages : []),
    ...(Array.isArray(t.native_languages) ? t.native_languages : []),
  ].flatMap(famOf));
  if (briefFam.length && talentFam.size && !briefFam.some((k) => talentFam.has(k))) return 0;
  // 家族比不出來時退回主語言字串比對(German/Malay 這類 langKeys 認不得的)
  if (briefFam.length && !talentFam.size) {
    const want = primaryLangKey(String(b.language || ''));
    if (want && !talentLangs.toLowerCase().includes(want.toLowerCase())) return 0;
  }
  let score = 40;

  // ── 性別 25(案件指定了性別,明確不符 → 直接淘汰)──
  // 男聲案寄給女聲、還印著「75% 匹配」會很難看,所以這裡跟語言一樣是硬門檻。
  const want = wantedGenders(b.gender_needs);
  if (!want.male && !want.female) score += 22;   // 案件沒指定 → 高分但非滿分
  else {
    const g = String(t.gender || '').toLowerCase();
    const isF = g.includes('female') || g.includes('女');
    const isM = !isF && (g.includes('male') || g.includes('男'));
    if ((isF && want.female) || (isM && want.male)) score += 25;
    else if (!g) score += 12;                    // 性別未填 → 中性,不硬殺
    else return 0;                               // 明確不符 → 淘汰
  }

  // ── 口音 20(指定且符合才滿分;沒指定給高分但非滿分,讓分數有區別度)──
  const bAcc = accentKeys(String(b.accent || '') + ' ' + String(b.language || ''));
  if (!bAcc.length) score += 16;
  else {
    const tAcc = accentKeys(`${talentLangs} ${String(t.accent || '')}`);
    if (tAcc.some((k) => bAcc.includes(k))) score += 20;
    else if (!tAcc.length) score += 12;   // 配音員沒標口音 → 中性
  }

  // ── 專長類型 15 ──
  const tagText = `${asText(t.tags)} ${asText(t.specialties)}`;
  const hint = TYPE_HINTS.find(([re]) => re.test(String(b.content_type || '')));
  if (!hint) score += 9;                        // 案件沒類別 → 中性
  else if (!tagText.trim()) score += 7;         // 配音員沒填標籤 → 中性
  else score += hint[1].test(tagText) ? 15 : 3;

  return Math.max(0, Math.min(100, Math.round(score)));
}

import { zonedTimeToUtc } from './case-time';

/*
  Human-readable case code, computed (no DB column) from the brief's category,
  created date and sequence number — e.g. ONYX-GAME-260626-042.
  Same inputs → same code everywhere (talent card, guest page, admin list).
*/
const TYPE_ABBR: [RegExp, string][] = [
  [/遊戲|游戏|game/i, 'GAME'],
  [/動畫|动画|anim/i, 'ANIM'],
  [/戲劇|戏剧|drama/i, 'DRAMA'],
  [/廣告|广告|commercial/i, 'AD'],
  [/旁白|narration/i, 'NARR'],
  [/有聲書|有声书|audiobook/i, 'AUDIO'],
  [/工商|企業|corporate/i, 'CORP'],
  [/教育|教學|e-learning/i, 'ELRN'],
  [/紀錄|纪录|documentary/i, 'DOC'],
  [/電視|电视|\btv\b/i, 'TV'],
  [/廣播|广播|radio/i, 'RADIO'],
  [/預告|预告|trailer/i, 'TRAIL'],
  [/網路影片|网络视频|web video/i, 'WEB'],
  [/podcast/i, 'POD'],
  [/來電|来电|ivr/i, 'IVR'],
  [/語音助理|语音助理|assistant/i, 'ASST'],
  [/新聞|新闻|news/i, 'NEWS'],
  [/配唱|singing/i, 'SING'],
];

// 試音截止是否已過。取 audition_deadline,沒有就退回 deadline;都沒設 = 永不截止
// (維持原規則)。穩健 parse:吃正常 ISO(2026-06-30),也吃舊/髒的「6/30」這種
// 沒年份短字串(以案子建立年份推年,推出來早於建立日就 +1 年)—— 舊資料過期也擋得住。
// 只判「截止(停收試音)」,不改案子 status;真正結案是採用→建製作單那條。
function endOfDay(y: number, mo: number, d: number): number {
  return new Date(y, mo - 1, d, 23, 59, 59, 999).getTime();
}
function deadlineEndTs(raw: string, createdAt?: string | null): number {
  let m = /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(raw);        // 完整日期 YYYY-MM-DD
  if (m) return endOfDay(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/](\d{1,2})$/.exec(raw);                     // 只有月/日:6/30
  if (m) {
    const cd = createdAt ? new Date(createdAt) : null;
    const baseYear = cd && !isNaN(cd.getTime()) ? cd.getFullYear() : new Date().getFullYear();
    let ts = endOfDay(baseYear, +m[1], +m[2]);
    if (cd && !isNaN(cd.getTime()) && ts < cd.getTime()) ts = endOfDay(baseYear + 1, +m[1], +m[2]);
    return ts;
  }
  return new Date(`${raw.slice(0, 10)}T23:59:59`).getTime();    // 最後才交給原生 parse
}
export function auditionDeadlinePassed(b: { audition_deadline?: string | null; deadline?: string | null; created_at?: string | null; audition_deadline_time?: string | null; timezone?: string | null }): boolean {
  const raw = (b.audition_deadline || b.deadline || '').toString().trim();
  if (!raw) return false; // 沒設截止 = 永不截止
  // 有設精確時間(HH:mm)→ 以「案件時區」的那一刻為準(只有完整日期才適用)
  const m = /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(raw);
  if (m && b.audition_deadline && b.audition_deadline_time && /^\d{1,2}:\d{2}$/.test(b.audition_deadline_time)) {
    const inst = zonedTimeToUtc(`${m[1]}-${String(+m[2]).padStart(2, '0')}-${String(+m[3]).padStart(2, '0')}`, b.audition_deadline_time, b.timezone || 'Asia/Taipei');
    if (inst) return Date.now() > inst.getTime();
  }
  const ts = deadlineEndTs(raw, b.created_at);
  return Number.isFinite(ts) && Date.now() > ts;
}

/*
  平台案判定(Wing 2026-07-23 拍板統一):client_email 小寫等於平台識別信箱才算平台案;
  空白/null 一律視為客戶案。生產已驗證無空白 client_email 的單,此統一無實際影響。
  之前這條 magic string 散在約 20 處且空值語意不一,全部改走這裡。
*/
export const PLATFORM_CASTING_EMAIL = 'casting@onyxstudios.ai';
export function isPlatformCase(clientEmail: string | null | undefined): boolean {
  return String(clientEmail || '').trim().toLowerCase() === PLATFORM_CASTING_EMAIL;
}

export function caseCode(b: { content_type?: string | null; created_at?: string | null; brief_number?: string | null }): string {
  const ct = b.content_type || '';
  let type = 'VO';
  for (const [re, ab] of TYPE_ABBR) if (re.test(ct)) { type = ab; break; }
  let ymd = '';
  if (b.created_at) {
    const d = new Date(b.created_at);
    if (!isNaN(d.getTime())) ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  }
  const seq = (b.brief_number || '').replace(/\D/g, '').slice(-3);
  return ['ONYX', type, ymd, seq].filter(Boolean).join('-');
}

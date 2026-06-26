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

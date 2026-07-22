/*
  案件時區(Wing 2026-07-16):一個案子綁一個時區,全案的時間溝通都以它為準;
  顯示時「永遠標明時區名」,配音員端再附瀏覽器自動換算的當地時間(也標名),
  純換算不標名容易出事 —— 兩個都給最保險。
*/

// 三語標籤(2026-07-22 Wing:英文介面時區名跑出中文)。label = 繁中(既有欄名不動,
// admin 內部頁沿用);cn / en 供配音員端依 locale 選。
export const CASE_TIMEZONES: { v: string; label: string; cn: string; en: string }[] = [
  { v: 'Asia/Taipei', label: '台灣時間(台北)', cn: '台湾时间(台北)', en: 'Taiwan Time (Taipei)' },
  { v: 'Asia/Shanghai', label: '中國時間(北京/上海)', cn: '中国时间(北京/上海)', en: 'China Time (Beijing/Shanghai)' },
  { v: 'Asia/Hong_Kong', label: '香港時間', cn: '香港时间', en: 'Hong Kong Time' },
  { v: 'Asia/Tokyo', label: '日本時間(東京)', cn: '日本时间(东京)', en: 'Japan Time (Tokyo)' },
  { v: 'Asia/Seoul', label: '韓國時間(首爾)', cn: '韩国时间(首尔)', en: 'Korea Time (Seoul)' },
  { v: 'Asia/Singapore', label: '新加坡時間', cn: '新加坡时间', en: 'Singapore Time' },
  { v: 'Europe/London', label: '英國時間(倫敦)', cn: '英国时间(伦敦)', en: 'UK Time (London)' },
  { v: 'Europe/Paris', label: '歐洲中部時間(巴黎/柏林)', cn: '欧洲中部时间(巴黎/柏林)', en: 'Central European Time (Paris/Berlin)' },
  { v: 'America/New_York', label: '美東時間(紐約)', cn: '美东时间(纽约)', en: 'US Eastern Time (New York)' },
  { v: 'America/Los_Angeles', label: '美西時間(洛杉磯)', cn: '美西时间(洛杉矶)', en: 'US Pacific Time (Los Angeles)' },
];

export function tzLabel(tz: string, locale?: string): string {
  const t = CASE_TIMEZONES.find((x) => x.v === tz);
  if (!t) return tz;
  if (locale?.startsWith('en')) return t.en;
  if (locale === 'zh-CN') return t.cn;
  return t.label;
}

/** 把「某時區的 yyyy-mm-dd HH:mm」轉成真正的時刻(兩次逼近處理 DST)。 */
export function zonedTimeToUtc(dateStr: string, timeStr: string, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || '');
  if (!m) return null;
  const [hh, mm] = (timeStr || '00:00').split(':').map((n) => parseInt(n, 10) || 0);
  const target = Date.UTC(+m[1], +m[2] - 1, +m[3], hh, mm);
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(guess));
    const g = (t: string) => parseInt(parts.find((p) => p.type === t)?.value || '0', 10);
    const shown = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'));
    guess += target - shown;
  }
  return new Date(guess);
}

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const WEEK_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** 在指定時區格式化:7/20(一)12:00(en → 7/20 (Mon) 12:00)。無時間時只到日期。 */
export function fmtInTz(instant: Date, tz: string, withTime: boolean, locale?: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false }).formatToParts(instant);
  const g = (t: string) => parts.find((p) => p.type === t)?.value || '';
  const wd = WEEK_EN.indexOf(g('weekday'));
  const wdLabel = locale?.startsWith('en') ? (WEEK_EN[wd] ?? '') : (WEEK[wd] ?? '');
  const base = `${parseInt(g('month'), 10)}/${parseInt(g('day'), 10)}(${wdLabel})`;
  return withTime ? `${base} ${g('hour') === '24' ? '00' : g('hour')}:${g('minute')}` : base;
}

/**
 * 期限的雙時區顯示(client 用)。
 * 回傳 { caseText, localText }:caseText 一定有(案件時區+名稱);
 * localText 只有「有具體時間、且瀏覽器時區 ≠ 案件時區」才給(自動換算+標明時區)。
 */
export function deadlineDisplay(dateStr?: string | null, timeStr?: string | null, tz = 'Asia/Taipei', locale?: string): { caseText: string; localText: string | null } {
  const d = String(dateStr || '').slice(0, 10);
  if (!d) return { caseText: '', localText: null };
  const hasTime = !!(timeStr || '').trim();
  const instant = zonedTimeToUtc(d, timeStr || '00:00', tz);
  if (!instant) return { caseText: d, localText: null };
  const caseText = `${fmtInTz(instant, tz, hasTime, locale)}(${tzLabel(tz, locale)})`;
  if (!hasTime) return { caseText, localText: null };   // 只有日期無法有意義地換算
  let localTz = '';
  try { localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* 拿不到就不換算 */ }
  if (!localTz || localTz === tz) return { caseText, localText: null };
  return { caseText, localText: `${fmtInTz(instant, localTz, true, locale)}(${tzLabel(localTz, locale)})` };
}

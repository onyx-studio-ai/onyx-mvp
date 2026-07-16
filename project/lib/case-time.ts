/*
  案件時區(Wing 2026-07-16):一個案子綁一個時區,全案的時間溝通都以它為準;
  顯示時「永遠標明時區名」,配音員端再附瀏覽器自動換算的當地時間(也標名),
  純換算不標名容易出事 —— 兩個都給最保險。
*/

export const CASE_TIMEZONES: { v: string; label: string }[] = [
  { v: 'Asia/Taipei', label: '台灣時間(台北)' },
  { v: 'Asia/Shanghai', label: '中國時間(北京/上海)' },
  { v: 'Asia/Hong_Kong', label: '香港時間' },
  { v: 'Asia/Tokyo', label: '日本時間(東京)' },
  { v: 'Asia/Seoul', label: '韓國時間(首爾)' },
  { v: 'Asia/Singapore', label: '新加坡時間' },
  { v: 'Europe/London', label: '英國時間(倫敦)' },
  { v: 'Europe/Paris', label: '歐洲中部時間(巴黎/柏林)' },
  { v: 'America/New_York', label: '美東時間(紐約)' },
  { v: 'America/Los_Angeles', label: '美西時間(洛杉磯)' },
];

export function tzLabel(tz: string): string {
  return CASE_TIMEZONES.find((t) => t.v === tz)?.label || tz;
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

/** 在指定時區格式化:7/20(一)12:00。無時間時只到日期。 */
export function fmtInTz(instant: Date, tz: string, withTime: boolean): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false }).formatToParts(instant);
  const g = (t: string) => parts.find((p) => p.type === t)?.value || '';
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday'));
  const base = `${parseInt(g('month'), 10)}/${parseInt(g('day'), 10)}(${WEEK[wd] ?? ''})`;
  return withTime ? `${base} ${g('hour') === '24' ? '00' : g('hour')}:${g('minute')}` : base;
}

/**
 * 期限的雙時區顯示(client 用)。
 * 回傳 { caseText, localText }:caseText 一定有(案件時區+名稱);
 * localText 只有「有具體時間、且瀏覽器時區 ≠ 案件時區」才給(自動換算+標明時區)。
 */
export function deadlineDisplay(dateStr?: string | null, timeStr?: string | null, tz = 'Asia/Taipei'): { caseText: string; localText: string | null } {
  const d = String(dateStr || '').slice(0, 10);
  if (!d) return { caseText: '', localText: null };
  const hasTime = !!(timeStr || '').trim();
  const instant = zonedTimeToUtc(d, timeStr || '00:00', tz);
  if (!instant) return { caseText: d, localText: null };
  const caseText = `${fmtInTz(instant, tz, hasTime)}(${tzLabel(tz)})`;
  if (!hasTime) return { caseText, localText: null };   // 只有日期無法有意義地換算
  let localTz = '';
  try { localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* 拿不到就不換算 */ }
  if (!localTz || localTz === tz) return { caseText, localText: null };
  return { caseText, localText: `${fmtInTz(instant, localTz, true)}(${tzLabel(localTz)})` };
}

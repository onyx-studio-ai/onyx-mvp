/*
  交付後自動完成(Wing 2026-08-20 拍板)。

  問題:有些客戶拿了交付檔就沒下文,忘記回來按「確認」,配音員的錢就一直卡在那裡
  (A422 這批 8/17 交件,到 8/20 都還沒結)。

  規則:
  ・交付給客戶起算 7 天,期間客戶沒有任何動作 → 系統自動完成訂單(等同客戶按確認)。
  ・客戶可在訂單頁自行「延長 7 天」,次數不限 —— 只要他有在管,就永遠不會被自動結案;
    真正被自動完成的一定是完全沒動作的單。
  ・自動完成前 2 天寄一封提醒信,有這封信自動完成才站得住腳。
  ・只對「外部客戶案」生效。平台自營案(casting@onyxstudios.ai)的帳務聯絡人是我們自己,
    自動完成沒有意義,而且會在沒人看信的情況下無聲結案。

  業界對照:Fiverr 交付後 3 天自動完成(買家可再延 5 天);Upwork 固定價 14 天自動放款。
  我們的案子客戶多為企業、需內部傳閱,3 天太短;14 天則讓配音員等太久 —— 取 7 天。
*/

export const AUTO_APPROVE_DAYS = 7;
export const AUTO_APPROVE_EXTEND_DAYS = 7;
/** 自動完成前幾天寄提醒信 */
export const AUTO_APPROVE_REMIND_DAYS_BEFORE = 2;

/** 距離自動完成還有幾天(向上取整;已過期回 0)。 */
export function daysUntilAutoApprove(autoApproveAt: string | null | undefined, now = Date.now()): number | null {
  if (!autoApproveAt) return null;
  const ms = new Date(autoApproveAt).getTime() - now;
  if (Number.isNaN(ms)) return null;
  return ms <= 0 ? 0 : Math.ceil(ms / 86400_000);
}

/** 台北時區的日期字串,給信件與畫面顯示用(客戶多在台灣)。 */
export function formatAutoApproveDate(autoApproveAt: string | null | undefined): string {
  if (!autoApproveAt) return '';
  try {
    return new Date(autoApproveAt).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(autoApproveAt).slice(0, 10);
  }
}

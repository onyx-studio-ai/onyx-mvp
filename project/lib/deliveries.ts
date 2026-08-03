/*
  交付檔按「上傳日期」分組的共用工具。
  配音員一個案子可能分好幾天、每天傳好幾個檔;用上傳日期把它們收成一列一列,
  這樣後台 / 配音員 / 客戶三邊都能看清楚「哪天傳了哪些檔」。純顯示用,不動資料。

  回傳:新到舊排序的分組;每組 { key, date, items }。
  - key:當地日期字串,拿來當「展開/收合」狀態的識別碼(沒有時間戳的檔歸到 'unknown')。
  - date:代表日期(Date | null),由呼叫端各自 toLocaleDateString 依語系格式化。
*/
export function groupByUploadDate<T>(
  items: T[],
  getDate: (x: T) => string | null | undefined,
): { key: string; date: Date | null; items: T[] }[] {
  const map = new Map<string, { date: Date | null; items: T[] }>();
  for (const it of items) {
    const raw = getDate(it);
    const d = raw ? new Date(raw) : null;
    const valid = d && !isNaN(d.getTime()) ? d : null;
    const key = valid ? `${valid.getFullYear()}-${valid.getMonth() + 1}-${valid.getDate()}` : 'unknown';
    const g = map.get(key);
    if (g) g.items.push(it);
    else map.set(key, { date: valid, items: [it] });
  }
  return Array.from(map.entries())
    .map(([key, { date, items }]) => ({ key, date, items }))
    // 新到舊;沒有日期的(unknown)排最後
    .sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.getTime() - a.date.getTime();
    });
}

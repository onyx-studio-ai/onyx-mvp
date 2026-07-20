// AI 聲音分身計畫(Phase 2)— 常數與內測閘門
// 🔒 內測模式(Wing 2026-07-19):只開放白名單帳號;清空陣列 = 全員開放。
export const AI_TWIN_BETA_EMAILS: string[] = ['wingywen@gmail.com'];

export function aiTwinVisible(email: string | null | undefined): boolean {
  if (AI_TWIN_BETA_EMAILS.length === 0) return true;
  return !!email && AI_TWIN_BETA_EMAILS.includes(email.toLowerCase());
}

// 五種語氣與專屬示範稿(訓練完整度:長短句/疑問感嘆/數字/多音字覆蓋)
export const TONE_SCRIPTS: { tone: string; label: string; script: string }[] = [
  { tone: 'Professional', label: '專業 Professional', script: '歡迎了解我們的服務。自 2008 年成立以來,我們已為超過 1,500 位客戶,提供橫跨 40 個國家的專業方案。您可能會問:品質如何確保?答案是三層審核,加上為期 12 個月的完整保固。我們相信,長期的信任,來自每一次準確的交付。' },
  { tone: 'Energetic', label: '活力 Energetic', script: '準備好了嗎?年度最大檔期終於開跑!全館 5 折起,滿 3,000 再送 500!你沒聽錯,只有 72 小時!新品、經典款、限量聯名,一次到齊。還在等什麼?現在就出發,錯過再等一年!' },
  { tone: 'Friendly', label: '親切 Friendly', script: '嘿,好久不見,最近過得怎麼樣?我上週去了一趟花蓮,天氣好得不得了。對了,你上次說想學做菜,後來有開始嗎?其實我也想試試看,不然我們約個週末,一起研究幾道簡單的家常菜,你覺得如何?' },
  { tone: 'Soothing', label: '舒緩 Soothing', script: '現在,請慢慢閉上眼睛,深深吸一口氣,再緩緩地吐出來。感受肩膀一點一點放鬆下來。今天辛苦了。無論發生什麼,此刻都可以先放下。讓呼吸帶著你,回到安靜的地方,好好休息。' },
  { tone: 'Trailer', label: '預告片 Trailer', script: '在一個被遺忘的城市,沉睡著一個千年的秘密。當黑夜降臨,誰能阻止命運的齒輪?他,是最後的守望者。這個冬天,見證傳奇的誕生——《暗夜黎明》,即將震撼登場。' },
];

export const PROOF_LANGS = ['中文', 'English', '日本語', '한국어', 'Español', 'Português', 'Français', 'Deutsch', 'Italiano', 'Русский'];

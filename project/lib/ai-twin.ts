// AI 聲音分身計畫(Phase 2)— 常數與內測閘門
// 🔒 內測模式(Wing 2026-07-19):只開放白名單帳號;清空陣列 = 全員開放。
export const AI_TWIN_BETA_EMAILS: string[] = ['wingywen@gmail.com'];

export function aiTwinVisible(email: string | null | undefined): boolean {
  if (AI_TWIN_BETA_EMAILS.length === 0) return true;
  return !!email && AI_TWIN_BETA_EMAILS.includes(email.toLowerCase());
}

// 語氣示範稿的唯一真相在 app/[locale]/talent/ai-twin/page.tsx 的 TONES(v2);此處不重複。

export const PROOF_LANGS = ['中文', 'English', '日本語', '한국어', 'Español', 'Português', 'Français', 'Deutsch', 'Italiano', 'Русский'];

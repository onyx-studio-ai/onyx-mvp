/*
  Payout fee + Taiwan withholding policy — single source of truth for the talent
  収款 form (notices) and the admin payouts page (net computation). Numbers agreed
  with Wing 2026-07-03; tweak here if they change.

  ⚠️ Standard statutory rates only — resident/non-resident (183-day) determination,
  tax-treaty relief and NHI enrolment edge cases are for the accountant to confirm.
*/

export const FEES = {
  bankTW: { amount: 30, currency: 'TWD' },   // domestic wire (same-bank often free)
  bankIntl: { amount: 20, currency: 'USD' }, // SWIFT, SHA — covers typical intermediary
  paypalPct: 0.05,                            // ~5% cross-border (higher w/ FX)
} as const;

export const MIN_PAYOUT_USD_INTL = 50; // international minimum; domestic (TW) has none

export const TAX = {
  nonResidentRate: 0.20, // foreign <183 days, Taiwan-source professional income
  residentRate: 0.10,    // resident (local, or foreigner w/ ARC ≥183 days)
  nhiRate: 0.0211,       // 二代健保 supplementary premium
  twThreshold: 20000,    // NT$ — resident tax + NHI only kick in at/above this single payment
} as const;

export type TaxLocation = 'TW' | 'overseas';
export type PayoutMethod = 'bank' | 'paypal';

export interface TaxProfile {
  taxLocation: TaxLocation;
  twResident: boolean; // only meaningful when taxLocation==='TW'
}

// Talent-facing notice for what will be deducted, by tax profile.
export function taxNotice(p: TaxProfile, locale?: string): string {
  const L = locale === 'zh-CN' ? 'cn' : locale?.startsWith('zh') ? 'tw' : 'en';
  if (p.taxLocation === 'overseas') {
    return { tw: '你的工作在台灣境外完成,不扣台灣稅,僅收轉帳手續費。', cn: '你的工作在台湾境外完成,不扣台湾税,仅收转账手续费。', en: 'Your work is performed outside Taiwan — no Taiwan tax is withheld, only the transfer fee.' }[L];
  }
  if (p.twResident) {
    return { tw: '台灣居住者:所得稅單筆「超過」NT$20,000 才代扣 10%;二代健保單筆「達」NT$20,000(含)代扣 2.11%。(另加手續費)', cn: '台湾居住者:所得税单笔「超过」NT$20,000 才代扣 10%;二代健保单笔「达」NT$20,000(含)代扣 2.11%。(另加手续费)', en: 'Taiwan tax resident: 10% income tax applies above NT$20,000; 2.11% NHI premium applies at or above NT$20,000. (Plus the transfer fee.)' }[L];
  }
  return { tw: '台灣來源所得 · 非居住者:依法代扣 20% 稅。(另加手續費)', cn: '台湾来源所得 · 非居住者:依法代扣 20% 税。(另加手续费)', en: 'Taiwan-source income, non-resident: 20% withholding tax applies. (Plus the transfer fee.)' }[L];
}

// Compute the deduction breakdown for a payout. Amounts in the payout's own currency;
// the NT$20,000 threshold is applied to TWD figures (TW payouts are TWD).
export function computeDeductions(args: {
  gross: number;
  method: PayoutMethod;
  bankCountry?: string; // 'TW' → domestic wire, else international
  taxLocation: TaxLocation;
  twResident: boolean;
}): { tax: number; nhi: number; fee: number; feeNote: string; net: number } {
  const g = Math.max(0, Number(args.gross) || 0);
  let tax = 0, nhi = 0;
  if (args.taxLocation === 'TW') {
    if (!args.twResident) {
      tax = round2(g * TAX.nonResidentRate);
    } else {
      // 2026-07-05 查證(財政部 + 會計師事務所):所得稅與二代健保門檻「不同」!
      //   所得稅(執行業務所得):每次應扣稅額不超過 2,000 免扣 → 給付「超過」2 萬才扣(20,000 免)。
      if (g > TAX.twThreshold) tax = round2(g * TAX.residentRate);
      //   二代健保補充保費:單次給付「達」2 萬(≥,含 20,000)就扣 2.11%。
      if (g >= TAX.twThreshold) nhi = round2(g * TAX.nhiRate);
    }
  }
  let fee = 0, feeNote = '';
  if (args.method === 'paypal') { fee = round2(g * FEES.paypalPct); feeNote = 'PayPal 約 5%(依地區而異)'; }
  else if ((args.bankCountry || '').toUpperCase() === 'TW') { fee = FEES.bankTW.amount; feeNote = 'NT$15-30'; }
  else { fee = FEES.bankIntl.amount; feeNote = '約 US$20-30'; }
  return { tax, nhi, fee, feeNote, net: round2(g - tax - nhi - fee) };
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

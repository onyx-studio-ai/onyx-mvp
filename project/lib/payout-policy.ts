/*
  Payout fee + Taiwan withholding policy — single source of truth for the talent
  収款 form (notices) and the admin payouts page (net computation). Numbers agreed
  with Wing 2026-07-03; tweak here if they change.

  ⚠️ Standard statutory rates only — resident/non-resident (183-day) determination,
  tax-treaty relief and NHI enrolment edge cases are for the accountant to confirm.
*/

export const FEES = {
  // 手續費 = 我方(台灣端)匯出成本,一律台幣,且「不從配音員實收扣」——
  // Wing 2026-07-05 拍板:全額支付請款額、我方吸收;中間行/當地銀行費用不可預估、另計。
  // 只在後台當成本參考顯示,不進 net、不列進給配音員的通知信。
  bankTW: { amount: 15, currency: 'TWD' },     // 台幣電匯:我方端固定 NT$15(同行常免)
  bankIntl: { amount: 300, currency: 'TWD' },  // 外匯電匯:我方台灣端約 NT$300(中間行另計)
  paypalIntl: { amount: 300, currency: 'TWD' },// PayPal:我方端約 NT$300(中間行另計)
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
    return { tw: '你的工作在台灣境外完成,不扣台灣稅;轉帳手續費由我方負擔。', cn: '你的工作在台湾境外完成,不扣台湾税;转账手续费由我方负担。', en: 'Your work is performed outside Taiwan — no Taiwan tax is withheld; the transfer fee is on us.' }[L];
  }
  if (p.twResident) {
    return { tw: '台灣居住者:所得稅單筆「超過」NT$20,000 才代扣 10%;二代健保單筆「達」NT$20,000(含)代扣 2.11%。轉帳手續費由我方負擔。', cn: '台湾居住者:所得税单笔「超过」NT$20,000 才代扣 10%;二代健保单笔「达」NT$20,000(含)代扣 2.11%。转账手续费由我方负担。', en: 'Taiwan tax resident: 10% income tax applies above NT$20,000; 2.11% NHI premium applies at or above NT$20,000. The transfer fee is on us.' }[L];
  }
  return { tw: '台灣來源所得 · 非居住者:依法代扣 20% 稅。轉帳手續費由我方負擔。', cn: '台湾来源所得 · 非居住者:依法代扣 20% 税。转账手续费由我方负担。', en: 'Taiwan-source income, non-resident: 20% withholding tax applies. The transfer fee is on us.' }[L];
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
  // 手續費一律台幣、代表「我方匯出成本」,不進 net(配音員全額收款、我方吸收)。
  let fee = 0, feeNote = '';
  if (args.method === 'paypal') { fee = FEES.paypalIntl.amount; feeNote = 'PayPal·我方約 NT$300,中間行另計'; }
  else if ((args.bankCountry || '').toUpperCase() === 'TW') { fee = FEES.bankTW.amount; feeNote = '台幣電匯 NT$15'; }
  else { fee = FEES.bankIntl.amount; feeNote = '外匯電匯·我方約 NT$300,中間行另計'; }
  // net = 請款 − 法定代扣(所得稅 + 二代健保);手續費不扣配音員。
  return { tax, nhi, fee, feeNote, net: round2(g - tax - nhi) };
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

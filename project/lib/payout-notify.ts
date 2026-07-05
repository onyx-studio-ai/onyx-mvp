import { randomBytes } from 'node:crypto';
import { computeDeductions } from '@/lib/payout-policy';

/*
  撥款通知的伺服器端輔助:
   1. 生成撥款證明碼(防枚舉,同 certificates.license_id 的尾碼做法)。
   2. 從配音員加密收款資料(talent_payout_details 解密後的 payload)+ 該筆幣別,
      推出扣繳試算與付款方式標籤 —— 推法「刻意對齊」components/admin/PayoutDetails.tsx,
      讓配音員在信裡看到的數字和後台試算、/talent/earnings 一致。
*/

// ONYX-PAY-<請款/發票編號>-<8碼高熵亂碼>。invoice_number 已是唯一,亂碼尾巴防從序號枚舉整批撈金額。
export function generatePayoutCertificateCode(invoiceNumber?: string): string {
  const base = (invoiceNumber || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'INV';
  return `ONYX-PAY-${base}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

export interface PayoutDeductionResult {
  tax: number; nhi: number; fee: number; feeNote: string; net: number;
  methodLabel: string;
}

/*
  details = decryptJson(enc_payload):{ twd?, usd?:{method}, tax?:{tax_location, tw_resident} }
  對齊 PayoutDetails.tsx:
    method      = USD 時看 usd.method(paypal/bank);TWD 一律 bank
    bankCountry = TWD → 'TW'(境內電匯),否則 'X'(國際)
    taxLocation = 只有「TWD 且稅籍在台」才扣台灣稅,其餘視為海外
*/
export function deductionsForPayout(
  gross: number,
  currency: string,
  details: Record<string, unknown> | null | undefined,
  locale?: string,
): PayoutDeductionResult {
  const x = (details || {}) as Record<string, unknown>;
  const usd = (x.usd && typeof x.usd === 'object' ? x.usd : {}) as Record<string, unknown>;
  const tax0 = (x.tax && typeof x.tax === 'object' ? x.tax : {}) as Record<string, unknown>;
  const taxLocation = tax0.tax_location === 'TW' ? 'TW' : 'overseas';
  const twResident = tax0.tw_resident === true;

  const cur = (currency || '').toUpperCase();
  const isPaypal = cur === 'USD' && usd.method === 'paypal';
  const method: 'bank' | 'paypal' = isPaypal ? 'paypal' : 'bank';
  const bankCountry = cur === 'TWD' ? 'TW' : 'X';
  const effTaxLoc: 'TW' | 'overseas' = (cur === 'TWD' && taxLocation === 'TW') ? 'TW' : 'overseas';

  const dd = computeDeductions({ gross: Number(gross) || 0, method, bankCountry, taxLocation: effTaxLoc, twResident });

  const L = locale === 'zh-CN' ? 'cn' : locale?.startsWith('zh') ? 'tw' : 'en';
  const methodLabel = isPaypal
    ? 'PayPal'
    : cur === 'TWD'
      ? (L === 'en' ? 'Bank transfer (TWD)' : L === 'cn' ? '台币电汇' : '台幣電匯')
      : (L === 'en' ? 'Bank transfer (foreign currency)' : L === 'cn' ? '外币账户' : '外幣帳戶');

  return { ...dd, methodLabel };
}

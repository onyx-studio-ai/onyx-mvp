/*
  收款資料嚴格驗證(兩組結構)—— 前端即時提示 + 後端硬擋共用。
  台灣人的台幣戶與外幣戶是不同帳號,所以拆成:
    twd  = 台幣收款(台灣本地銀行,7 或 3 碼代碼)
    usd  = 美金收款(外幣銀行帳戶 或 PayPal)
  至少填一組;稅務(tax_*)共用一份。回傳欄位錯誤,空陣列=通過。
  規則依官方標準:台灣身分證/居留證 1 英文+9 碼、SWIFT 8/11、台灣代碼 3 或 7 碼。
*/

export interface PayoutInput {
  twd?: { account_holder?: string; bank_name?: string; bank_branch?: string; bank_code?: string; account_number?: string };
  usd?: { method?: string; account_holder?: string; bank_name?: string; swift?: string; iban?: string; account_number?: string; paypal_email?: string };
  // 香港戶口(HKD)與大陸收款(CNY:銀行卡 或 支付寶)—— Wing 2026-08-05 加,香港/大陸案請款用
  hkd?: { account_holder?: string; bank_name?: string; bank_code?: string; account_number?: string; fps_id?: string };
  cny?: { method?: string; account_holder?: string; bank_name?: string; account_number?: string; alipay_id?: string };
  tax_location?: string; tw_resident?: boolean; national_id?: string; tax_address?: string;
}
export interface FieldError { field: string; msg: string }

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SWIFT = /^[A-Za-z]{4}[A-Za-z]{2}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?$/;   // 8 或 11
const IBAN = /^[A-Za-z]{2}\d{2}[A-Za-z0-9]{10,30}$/;
const TW_BANKCODE = /^(\d{3}|\d{7})$/;                                       // 3 碼銀行 或 7 碼分行
const TW_ID = /^[A-Za-z][A-Za-z1-2]\d{8}$/;                                  // 身分證/居留證,10 碼
const ACCT = /^[A-Za-z0-9]{6,34}$/;

// 判斷某組是否有填(任一關鍵欄有值)。
export function hasTwd(d: PayoutInput): boolean { const t = d.twd; return !!t && !!(s(t.account_number) || s(t.bank_name) || s(t.bank_code)); }
export function hasUsd(d: PayoutInput): boolean { const u = d.usd; return !!u && !!(s(u.account_number) || s(u.paypal_email) || s(u.bank_name)); }
export function hasHkd(d: PayoutInput): boolean { const h = d.hkd; return !!h && !!(s(h.account_number) || s(h.bank_name) || s(h.fps_id)); }
export function hasCny(d: PayoutInput): boolean { const c = d.cny; return !!c && !!(s(c.account_number) || s(c.bank_name) || s(c.alipay_id)); }

export function validatePayout(d: PayoutInput): FieldError[] {
  const e: FieldError[] = [];
  const twd = hasTwd(d), usd = hasUsd(d), hkd = hasHkd(d), cny = hasCny(d);
  if (!twd && !usd && !hkd && !cny) { e.push({ field: 'method', msg: '請至少填一種收款方式(台幣 / 美金 / 港幣 / 人民幣)' }); return e; }

  if (hkd) {
    const h = d.hkd!;
    if (s(h.account_holder).length < 2) e.push({ field: 'hkd.account_holder', msg: '港幣帳戶:請填戶名' });
    if (s(h.bank_name).length < 2) e.push({ field: 'hkd.bank_name', msg: '港幣帳戶:請填銀行名稱' });
    if (!ACCT.test(s(h.account_number).replace(/[\s-]/g, ''))) e.push({ field: 'hkd.account_number', msg: '港幣帳戶:帳號格式不正確(6–34 碼英數)' });
    if (s(h.bank_code) && !/^\d{3}$/.test(s(h.bank_code))) e.push({ field: 'hkd.bank_code', msg: '港幣帳戶:銀行代碼為 3 碼數字(選填)' });
  }

  if (cny) {
    const c = d.cny!;
    const m = c.method === 'alipay' ? 'alipay' : 'bank';
    if (s(c.account_holder).length < 2) e.push({ field: 'cny.account_holder', msg: '人民幣收款:請填戶名(與證件一致)' });
    if (m === 'alipay') {
      if (s(c.alipay_id).length < 5) e.push({ field: 'cny.alipay_id', msg: '支付寶:請填帳號(手機或 Email)' });
    } else {
      if (s(c.bank_name).length < 2) e.push({ field: 'cny.bank_name', msg: '人民幣銀行卡:請填開戶行(含支行)' });
      if (!/^\d{8,32}$/.test(s(c.account_number).replace(/[\s-]/g, ''))) e.push({ field: 'cny.account_number', msg: '人民幣銀行卡:卡號格式不正確(純數字)' });
    }
  }

  if (twd) {
    const t = d.twd!;
    if (s(t.account_holder).length < 2) e.push({ field: 'twd.account_holder', msg: '台幣帳戶:請填戶名' });
    if (s(t.bank_name).length < 2) e.push({ field: 'twd.bank_name', msg: '台幣帳戶:請填銀行名稱' });
    if (!ACCT.test(s(t.account_number).replace(/[\s-]/g, ''))) e.push({ field: 'twd.account_number', msg: '台幣帳戶:帳號格式不正確(6–34 碼英數)' });
    if (!TW_BANKCODE.test(s(t.bank_code))) e.push({ field: 'twd.bank_code', msg: '台幣帳戶:請填 3 碼銀行代碼或 7 碼分行代碼' });
  }

  if (usd) {
    const u = d.usd!;
    const method = u.method === 'paypal' ? 'paypal' : 'bank';
    if (s(u.account_holder).length < 2) e.push({ field: 'usd.account_holder', msg: '美金收款:請填戶名 / 公司名' });
    if (method === 'paypal') {
      if (!EMAIL.test(s(u.paypal_email))) e.push({ field: 'usd.paypal_email', msg: '美金 PayPal:請填有效 Email' });
    } else {
      if (s(u.bank_name).length < 2) e.push({ field: 'usd.bank_name', msg: '美金外幣帳戶:請填銀行名稱' });
      if (!ACCT.test(s(u.account_number).replace(/[\s-]/g, ''))) e.push({ field: 'usd.account_number', msg: '美金外幣帳戶:帳號格式不正確' });
      if (s(u.swift) && !SWIFT.test(s(u.swift))) e.push({ field: 'usd.swift', msg: 'SWIFT/BIC 格式不正確(8 或 11 碼)' });
      if (s(u.iban) && !IBAN.test(s(u.iban).replace(/\s/g, ''))) e.push({ field: 'usd.iban', msg: 'IBAN 格式不正確' });
    }
  }

  // 稅務(共用一份)
  if (d.tax_location === 'TW') {
    const id = s(d.national_id);
    if (d.tw_resident) { if (!TW_ID.test(id)) e.push({ field: 'national_id', msg: '身分證/居留證號格式不正確(1 英文字母 + 9 碼)' }); }
    else if (id.length < 5) e.push({ field: 'national_id', msg: '請填證件號碼(護照/居留證)' });
    if (s(d.tax_address).length < 8) e.push({ field: 'tax_address', msg: '請填完整地址(縣市 + 區 + 路 + 號)' });
  } else if (d.tax_location !== 'overseas') {
    e.push({ field: 'tax_location', msg: '請選擇稅務所在地(台灣 / 海外)' });
  }

  return e;
}

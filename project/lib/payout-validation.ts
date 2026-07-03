/*
  收款資料嚴格驗證 —— 前端即時提示 + 後端硬擋都用這一支,避免亂填(填錯銀行/帳號
  會匯錯錢)。回傳欄位錯誤陣列;空陣列 = 通過。格式依官方標準:
   - 台灣匯款:7 碼分行代碼(3銀行+4分行)
   - SWIFT/BIC:8 或 11 碼
   - 台灣身分證/居留證:1 英文 + 9 碼(共 10 碼)
   國外不驗台灣證號。
*/

export interface PayoutInput {
  method?: string;
  account_holder?: string; bank_name?: string; bank_country?: string;
  account_number?: string; iban?: string; swift?: string; bank_branch?: string; bank_code?: string;
  paypal_email?: string;
  tax_location?: string; tw_resident?: boolean; national_id?: string; tax_address?: string;
}
export interface FieldError { field: string; msg: string }

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SWIFT = /^[A-Za-z]{4}[A-Za-z]{2}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?$/;   // 8 或 11
const IBAN = /^[A-Za-z]{2}\d{2}[A-Za-z0-9]{10,30}$/;
const TW_BANKCODE = /^\d{7}$/;                                              // 3 銀行 + 4 分行
const TW_ID = /^[A-Za-z][A-Za-z1-2]\d{8}$/;                                 // 身分證/居留證,10 碼

export function validatePayout(d: PayoutInput): FieldError[] {
  const e: FieldError[] = [];
  const method = d.method === 'bank' ? 'bank' : d.method === 'paypal' ? 'paypal' : '';
  if (!method) { e.push({ field: 'method', msg: '請選擇收款方式' }); return e; }

  if (s(d.account_holder).length < 2) e.push({ field: 'account_holder', msg: '請填完整的帳戶姓名(至少 2 字)' });

  if (method === 'bank') {
    const country = s(d.bank_country).toUpperCase();
    if (s(d.bank_name).length < 2) e.push({ field: 'bank_name', msg: '請填銀行名稱' });
    if (!/^[A-Za-z]{2}$/.test(country)) e.push({ field: 'bank_country', msg: '銀行所在國請填 2 碼國碼(台灣填 TW)' });

    const acct = s(d.account_number).replace(/[\s-]/g, '');
    if (!/^[A-Za-z0-9]{6,34}$/.test(acct)) e.push({ field: 'account_number', msg: '帳號格式不正確(去掉空格後 6–34 碼英數)' });

    if (country === 'TW') {
      // 台灣本地:必填 7 碼分行代碼(電匯用)
      if (!TW_BANKCODE.test(s(d.bank_code))) e.push({ field: 'bank_code', msg: '台灣匯款需填 7 碼銀行分行代碼(3碼銀行+4碼分行)' });
    } else {
      // 國際:必填 SWIFT/BIC
      if (!SWIFT.test(s(d.swift))) e.push({ field: 'swift', msg: 'SWIFT/BIC 格式不正確(8 或 11 碼英數)' });
    }
    // IBAN 選填,有填才驗
    if (s(d.iban) && !IBAN.test(s(d.iban).replace(/\s/g, ''))) e.push({ field: 'iban', msg: 'IBAN 格式不正確' });
  } else {
    if (!EMAIL.test(s(d.paypal_email))) e.push({ field: 'paypal_email', msg: 'PayPal 請填有效的 Email(不是數字)' });
  }

  // 稅務 = 台灣:驗證號 + 地址
  if (d.tax_location === 'TW') {
    const id = s(d.national_id);
    if (d.tw_resident) {
      // 居住者(本國籍身分證 / 外國籍居留證):1 英文 + 9 碼
      if (!TW_ID.test(id)) e.push({ field: 'national_id', msg: '身分證/居留證號格式不正確(1 英文字母 + 9 碼,共 10 碼)' });
    } else {
      // 非居住者:可能是護照,放寬但仍要有內容
      if (id.length < 5) e.push({ field: 'national_id', msg: '請填證件號碼(護照/居留證)' });
    }
    if (s(d.tax_address).length < 8) e.push({ field: 'tax_address', msg: '請填完整地址(縣市 + 區 + 路 + 號)' });
  }

  return e;
}

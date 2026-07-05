'use client';

import { useState } from 'react';
import { computeDeductions } from '@/lib/payout-policy';

/*
  共用「配音員收款資料 + 扣繳試算」元件 —— 按需(點了才)向 requireAdminOnly 的
  /api/admin/payout-details 解密 API 抓一位配音員的加密收款資料(AES-256-GCM)。
  收款帳戶 / 身分證 = 平台上最敏感個資,所以逐人解、不 bulk、只有 admin 開這一列才落地明文。

  同時被 /admin/payouts(分潤)與 /admin/payout-requests(請款單)兩頁重用。
  - payouts 頁:不帶 currency → 沿用舊行為(只在台灣稅籍時算 bank/TW 扣繳試算)。
  - payout-requests 頁:帶該筆請款單的 currency → 依「幣別 + 配音員填的收款方式/稅籍」
    推 method / bankCountry / taxLocation(對齊配音員在 /talent/earnings 看到的試算)。
*/

type Details = { region: string; payout_method: string; details: Record<string, unknown>; updated_at?: string };

export default function PayoutDetails({ talentId, gross, currency }: { talentId: string; gross: number; currency?: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'none' | 'error'>('idle');
  const [d, setD] = useState<Details | null>(null);
  const [err, setErr] = useState('');

  async function load() {
    setStatus('loading'); setErr('');
    try {
      const r = await fetch(`/api/admin/payout-details?talent_id=${encodeURIComponent(talentId)}`, { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) { setErr(j.error === 'payout_enc_unconfigured' ? '加密金鑰未設定 (Vercel env: PAYOUT_ENC_KEY)' : j.error === 'decrypt_failed' ? '解密失敗(金鑰不符?)' : (j.error || '讀取失敗')); setStatus('error'); return; }
      if (!j.found) { setStatus('none'); return; }
      setD({ region: j.region, payout_method: j.payout_method, details: j.details || {}, updated_at: j.updated_at });
      setStatus('done');
    } catch { setErr('讀取失敗'); setStatus('error'); }
  }

  const Row = ({ k, v }: { k: string; v?: string }) => v ? (
    <div className="flex gap-2"><span className="text-gray-500 w-24 shrink-0">{k}</span><span className="text-gray-800 font-mono break-all select-all">{v}</span></div>
  ) : null;

  if (status === 'idle') {
    return <button onClick={load} className="text-xs px-3 py-1 rounded-md bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors">查看收款資料</button>;
  }
  if (status === 'loading') return <span className="text-xs text-gray-500">讀取中…</span>;
  if (status === 'error') return <span className="text-xs text-red-600">{err}</span>;
  if (status === 'none') return <span className="text-xs text-gray-500">配音員尚未填寫收款資料。</span>;

  const x = d!.details as Record<string, unknown>;
  const twd = x.twd && typeof x.twd === 'object' ? x.twd as Record<string, string> : null;
  const usd = x.usd && typeof x.usd === 'object' ? x.usd as Record<string, string> : null;
  const t0 = (x.tax && typeof x.tax === 'object' ? x.tax : {}) as Record<string, unknown>;
  const taxLocation = t0.tax_location === 'TW' ? 'TW' : 'overseas';
  const twRes = t0.tw_resident === true;

  // 扣繳試算:
  //  - 帶 currency(請款單頁):對齊配音員 /talent/earnings 的推法 ——
  //      method      = USD 時看 usd.method(paypal/bank);TWD 一律 bank
  //      bankCountry = TWD → 'TW'(境內電匯),否則 'X'(國際)
  //      taxLocation = 只有「TWD 且稅籍在台」才扣台灣稅,其餘視為海外
  //  - 不帶 currency(分潤頁):沿用舊行為 —— 僅台灣稅籍時用 bank/TW 估。
  const cur = (currency || '').toUpperCase();
  let dd: ReturnType<typeof computeDeductions> | null = null;
  if (gross > 0) {
    if (cur) {
      const method = cur === 'USD' ? (usd?.method === 'paypal' ? 'paypal' : 'bank') : 'bank';
      const bankCountry = cur === 'TWD' ? 'TW' : 'X';
      const effTaxLoc = (cur === 'TWD' && taxLocation === 'TW') ? 'TW' : 'overseas';
      dd = computeDeductions({ gross, method, bankCountry, taxLocation: effTaxLoc, twResident: twRes });
    } else if (taxLocation === 'TW') {
      dd = computeDeductions({ gross, method: 'bank', bankCountry: 'X', taxLocation: 'TW', twResident: twRes });
    }
  }
  const curLabel = cur || '';

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3 text-xs space-y-1 max-w-md">
      {twd && (
        <div>
          <div className="font-medium text-violet-800 mb-0.5">台幣收款</div>
          <Row k="戶名" v={twd.account_holder} />
          <Row k="銀行" v={[twd.bank_name, twd.bank_branch].filter(Boolean).join(' ')} />
          <Row k="代碼" v={twd.bank_code} />
          <Row k="帳號" v={twd.account_number} />
        </div>
      )}
      {usd && (
        <div className={twd ? 'border-t border-violet-200 mt-1.5 pt-1.5' : ''}>
          <div className="font-medium text-violet-800 mb-0.5">美金收款 · {usd.method === 'paypal' ? 'PayPal' : '外幣帳戶'}</div>
          {usd.method === 'paypal' ? (
            <>
              <Row k="姓名/公司" v={usd.account_holder} />
              <Row k="PayPal" v={usd.paypal_email} />
              <p className="text-[11px] text-amber-700">付款前請向配音員索取 invoice。</p>
            </>
          ) : (
            <>
              <Row k="戶名" v={usd.account_holder} />
              <Row k="銀行" v={usd.bank_name} />
              <Row k="銀行地址" v={usd.bank_address} />
              <Row k="帳號" v={usd.account_number} />
              <Row k="SWIFT/BIC" v={usd.swift} />
              <Row k="IBAN" v={usd.iban} />
            </>
          )}
        </div>
      )}
      <div className="border-t border-violet-200 mt-1.5 pt-1.5">
        <Row k="稅務" v={taxLocation === 'TW' ? (twRes ? '台灣居住者(≥2萬才扣10%+2.11%)' : '台灣非居住者(扣20%)') : '海外(不扣台灣稅)'} />
        {taxLocation === 'TW' && <Row k="身分/居留證" v={t0.national_id as string} />}
        {taxLocation === 'TW' && <Row k="地址" v={t0.tax_address as string} />}
      </div>
      {dd && (
        <div className="border-t border-violet-200 mt-1.5 pt-1.5">
          <div className="text-violet-800 font-medium mb-0.5">扣繳試算(供參)</div>
          <Row k="請款額" v={`${curLabel ? curLabel + ' ' : ''}${gross}`} />
          {dd.tax > 0 && <Row k={twRes ? '扣繳稅 10%' : '扣繳稅 20%'} v={`-${dd.tax}`} />}
          {dd.nhi > 0 && <Row k="二代健保 2.11%" v={`-${dd.nhi}`} />}
          {dd.fee > 0 && <Row k={`手續費(${dd.feeNote})`} v={`-${dd.fee}`} />}
          <div className="flex gap-2 pt-1 mt-1 border-t border-violet-200/60">
            <span className="text-gray-500 w-24 shrink-0 font-medium">實付淨額</span>
            <span className="text-emerald-700 font-mono font-semibold select-all">{curLabel ? curLabel + ' ' : ''}{dd.net}</span>
          </div>
          <p className="text-[10px] text-gray-500 pt-1">稅/手續費供參、以會計與收款機構實際入帳為準。</p>
        </div>
      )}
    </div>
  );
}

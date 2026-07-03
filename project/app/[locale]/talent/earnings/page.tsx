'use client';

/*
  Talent earnings module — the talent's OWN payouts (real data from
  /api/talent/earnings, scoped to their session). Shows their share only; never
  the order's real total or internal cost.
*/

import { useEffect, useState, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { supabase } from '@/lib/supabase';
import { DollarSign, Loader2, CheckCircle2, Clock, ChevronDown } from 'lucide-react';
import { StatModule } from '@/components/dashboard/cards';
import { taxNotice, computeDeductions } from '@/lib/payout-policy';
import { validatePayout, type PayoutInput } from '@/lib/payout-validation';

type Earning = { id: string; order_type: string | null; commission_amount: number | null; status: string | null; created_at: string };
type Totals = { paid: number; pending: number; total: number };
type PayoutReq = { id: string; invoice_number: string; amount: number; currency: string; note: string | null; invoice_type: string; invoice_url: string | null; consent_at: string | null; status: string; created_at: string };

// 收款設定 — 配音員自己填(加密、受限表)。台幣戶與外幣戶是不同帳號,拆成台幣區/美金區,
// 稅務共用一份。至少填一種;請款選哪種幣別就要有對應那組。絕不給客戶看。
function PayoutSettings({ token, tx, locale, pending }: { token: string; tx: (a: string, b: string, c: string) => string; locale: string; pending: number }) {
  const [loaded, setLoaded] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [twdOn, setTwdOn] = useState(false);
  const [usdOn, setUsdOn] = useState(false);
  const [usdMethod, setUsdMethod] = useState<'bank' | 'paypal'>('bank');
  const [twd, setTwd] = useState<Record<string, string>>({});
  const [usd, setUsd] = useState<Record<string, string>>({});
  const [taxLoc, setTaxLoc] = useState<'TW' | 'overseas' | ''>('');
  const [twResident, setTwResident] = useState(false);
  const [tax, setTax] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const r = await fetch('/api/talent/payout-details', { headers: { Authorization: `Bearer ${token}` } });
        const j = await r.json();
        if (j.configured === false) setConfigured(false);
        const tw = j.twd && typeof j.twd === 'object' ? j.twd : null;
        const us = j.usd && typeof j.usd === 'object' ? j.usd : null;
        const tx0 = j.tax && typeof j.tax === 'object' ? j.tax : {};
        if (tw) { setTwdOn(true); setTwd(tw); }
        if (us) { setUsdOn(true); setUsd(us); setUsdMethod(us.method === 'paypal' ? 'paypal' : 'bank'); }
        setTaxLoc(tx0.tax_location || '');
        setTwResident(tx0.tw_resident === true);
        setTax({ national_id: tx0.national_id || '', tax_address: tx0.tax_address || '', tax_id: tx0.tax_id || '' });
        setCompleted(!!j.completed);
      } catch { /* leave empty */ }
      setLoaded(true);
    })();
  }, [token]);

  const setT = (k: string, v: string) => { setTwd((p) => ({ ...p, [k]: v })); setMsg(''); };
  const setU = (k: string, v: string) => { setUsd((p) => ({ ...p, [k]: v })); setMsg(''); };
  const setTx = (k: string, v: string) => { setTax((p) => ({ ...p, [k]: v })); setMsg(''); };
  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-amber-400/60';
  const lbl = 'block text-xs text-gray-300 mb-1';

  async function save() {
    setErr(''); setMsg('');
    const payload = {
      twd: twdOn ? twd : undefined,
      usd: usdOn ? { ...usd, method: usdMethod } : undefined,
      tax: { tax_location: taxLoc, tw_resident: twResident, national_id: tax.national_id || '', tax_address: tax.tax_address || '', tax_id: tax.tax_id || '' },
    };
    const errs = validatePayout({ twd: payload.twd, usd: payload.usd, tax_location: taxLoc, tw_resident: twResident, national_id: tax.national_id, tax_address: tax.tax_address } as PayoutInput);
    if (errs.length) { setErr(errs[0].msg); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/talent/payout-details', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!r.ok) {
        if (j.error === 'invalid' && j.fields?.length) setErr(j.fields[0].msg);
        else if (j.error === 'payout_enc_unconfigured') setErr(tx('收款系統維護中,請稍後再填。', '收款系统维护中,请稍后再填。', 'Payout setup is under maintenance — please try again later.'));
        else setErr(j.error || tx('儲存失敗', '保存失败', 'Save failed'));
      } else { setCompleted(true); setMsg(tx('✓ 已儲存收款資料', '✓ 已保存收款资料', '✓ Payout details saved')); }
    } catch { setErr(tx('儲存失敗', '保存失败', 'Save failed')); }
    finally { setBusy(false); }
  }

  if (!loaded) return null;

  const wrap = (inner: ReactNode) => (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 mb-8">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-white">{tx('收款設定', '收款设置', 'Payout details')}</h2>
        {completed
          ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-300 border border-green-500/30">{tx('已完成', '已完成', 'Complete')}</span>
          : <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">{tx('尚未填寫', '尚未填写', 'Not set')}</span>}
      </div>
      <p className="text-xs text-gray-300 mb-4">{tx('僅供 Onyx 付款用,加密保存', '仅供 Onyx 付款用,加密保存', 'For Onyx payments only — encrypted.')}</p>
      {inner}
      {(msg || err) && <p className={`text-xs mt-3 ${err ? 'text-red-400' : 'text-green-400'}`}>{err || msg}</p>}
    </div>
  );

  if (!configured) {
    return wrap(<p className="text-xs text-gray-300">{tx('收款設定即將開放,請稍後再回來填寫。', '收款设置即将开放,请稍后再回来填写。', 'Payout setup is coming online shortly — please check back soon.')}</p>);
  }

  const secTitle = 'text-xs font-semibold text-white';

  return wrap(
    <>
      {pending > 0 && !completed && (
        <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2 mb-4">{tx('您有待付款項 —— 請先完成收款設定,我們才能付款給您。', '您有待付款项 —— 请先完成收款设置,我们才能付款给您。', 'You have a pending payout — please complete this so we can pay you.')}</p>
      )}

      {/* 稅務(共用一份) */}
      <label className={lbl}>{tx('稅務所在地', '税务所在地', 'Tax residence')} *</label>
      <div className="flex gap-2 mb-3">
        {(['overseas', 'TW'] as const).map((t) => (
          <button key={t} type="button" onClick={() => { setTaxLoc(t); setMsg(''); }} className={`text-xs px-3 py-1.5 rounded-full border transition ${taxLoc === t ? 'bg-sky-500/20 border-sky-400/50 text-sky-200' : 'bg-white/5 border-white/10 text-gray-300 hover:text-white'}`}>
            {t === 'overseas' ? tx('海外(境外完成)', '海外(境外完成)', 'Overseas') : tx('台灣', '台湾', 'Taiwan')}
          </button>
        ))}
      </div>
      {taxLoc === 'TW' && (
        <div className="mb-3 space-y-3">
          <div>
            <label className={lbl}>{tx('你是台灣稅務居住者嗎?', '你是台湾税务居住者吗?', 'Taiwan tax resident?')} *</label>
            <p className="text-[11px] text-gray-300 mb-1.5">{tx('本國籍(有身分證),或外國籍持居留證且年度居留 ≥183 天 = 居住者。', '本国籍(有身份证),或外国籍持居留证且年度居留 ≥183 天 = 居住者。', 'Local citizen (with ID), or foreign national with an ARC residing ≥183 days = resident.')}</p>
            <div className="flex gap-2">
              {[true, false].map((v) => (
                <button key={String(v)} type="button" onClick={() => { setTwResident(v); setMsg(''); }} className={`text-xs px-3 py-1.5 rounded-full border transition ${twResident === v ? 'bg-sky-500/20 border-sky-400/50 text-sky-200' : 'bg-white/5 border-white/10 text-gray-300 hover:text-white'}`}>
                  {v ? tx('是,居住者', '是,居住者', 'Yes, resident') : tx('否,非居住者(<183天)', '否,非居住者(<183天)', 'No, non-resident')}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={lbl}>{tx('身分證 / 居留證號', '身份证 / 居留证号', 'National ID / ARC')} *</label><input className={inputCls} value={tax.national_id || ''} onChange={(e) => setTx('national_id', e.target.value)} placeholder="A123456789" /></div>
            <div><label className={lbl}>{tx('地址(扣繳憑單用)', '地址(扣缴凭单用)', 'Address (for withholding)')} *</label><input className={inputCls} value={tax.tax_address || ''} onChange={(e) => setTx('tax_address', e.target.value)} /></div>
          </div>
        </div>
      )}
      {taxLoc && <p className="text-[11px] text-sky-200/80 bg-sky-500/10 border border-sky-500/20 rounded-lg px-3 py-2 mb-4">{taxNotice({ taxLocation: taxLoc, twResident }, locale)}</p>}

      {taxLoc && (
        <div className="mb-4">
          <label className={lbl}>{tx('稅籍編號(選填)', '税籍编号(选填)', 'Tax ID (optional)')}</label>
          <input className={inputCls} value={tax.tax_id || ''} onChange={(e) => setTx('tax_id', e.target.value)} placeholder={tx('台灣個人可填身分證;海外填當地 Tax ID', '台湾个人可填身份证;海外填当地 Tax ID', 'Taiwan: national ID; overseas: local Tax ID')} />
          <p className="text-xs text-gray-300 mt-1">{tx('有填就會顯示在系統生成的發票上;不填則發票省略此欄。', '有填就会显示在系统生成的发票上;不填则发票省略此栏。', 'If provided, it appears on the generated invoice; otherwise it is omitted.')}</p>
        </div>
      )}

      {/* 台幣收款 */}
      <label className="flex items-center gap-2 mb-2 cursor-pointer"><input type="checkbox" className="accent-amber-500" checked={twdOn} onChange={(e) => { setTwdOn(e.target.checked); setMsg(''); }} /><span className={secTitle}>{tx('台幣收款(TWD)', '台币收款(TWD)', 'TWD payout')}</span></label>
      {twdOn && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 pl-6">
          <div className="sm:col-span-2"><label className={lbl}>{tx('戶名(法定)', '户名(法定)', 'Account holder')} *</label><input className={inputCls} value={twd.account_holder || ''} onChange={(e) => setT('account_holder', e.target.value)} /></div>
          <div><label className={lbl}>{tx('銀行名稱', '银行名称', 'Bank')} *</label><input className={inputCls} value={twd.bank_name || ''} onChange={(e) => setT('bank_name', e.target.value)} placeholder={tx('例如:國泰世華', '例如:国泰世华', 'e.g. Cathay United')} /></div>
          <div><label className={lbl}>{tx('分行', '分行', 'Branch')}</label><input className={inputCls} value={twd.bank_branch || ''} onChange={(e) => setT('bank_branch', e.target.value)} /></div>
          <div><label className={lbl}>{tx('銀行/分行代碼(3或7碼)', '银行/分行代码(3或7码)', 'Bank/branch code')} *</label><input className={inputCls} value={twd.bank_code || ''} onChange={(e) => setT('bank_code', e.target.value)} placeholder={tx('3或7碼', '3或7码', '3 or 7 digits')} /></div>
          <div><label className={lbl}>{tx('帳號', '账号', 'Account number')} *</label><input className={inputCls} value={twd.account_number || ''} onChange={(e) => setT('account_number', e.target.value)} /></div>
        </div>
      )}

      {/* 美金收款 */}
      <label className="flex items-center gap-2 mb-2 cursor-pointer"><input type="checkbox" className="accent-amber-500" checked={usdOn} onChange={(e) => { setUsdOn(e.target.checked); setMsg(''); }} /><span className={secTitle}>{tx('美金收款(USD)', '美金收款(USD)', 'USD payout')}</span></label>
      {usdOn && (
        <div className="mb-4 pl-6">
          <div className="flex gap-2 mb-3">
            {(['bank', 'paypal'] as const).map((m) => (
              <button key={m} type="button" onClick={() => { setUsdMethod(m); setMsg(''); }} className={`text-xs px-3 py-1.5 rounded-full border transition ${usdMethod === m ? 'bg-amber-500/20 border-amber-400/50 text-amber-200' : 'bg-white/5 border-white/10 text-gray-300 hover:text-white'}`}>
                {m === 'bank' ? tx('外幣銀行帳戶', '外币银行账户', 'Foreign-currency bank') : 'PayPal'}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><label className={lbl}>{tx('戶名 / 公司名(法定)', '户名 / 公司名(法定)', 'Account holder / company')} *</label><input className={inputCls} value={usd.account_holder || ''} onChange={(e) => setU('account_holder', e.target.value)} /></div>
            {usdMethod === 'bank' ? (
              <>
                <div><label className={lbl}>{tx('銀行名稱', '银行名称', 'Bank')} *</label><input className={inputCls} value={usd.bank_name || ''} onChange={(e) => setU('bank_name', e.target.value)} /></div>
                <div><label className={lbl}>{tx('帳號', '账号', 'Account number')} *</label><input className={inputCls} value={usd.account_number || ''} onChange={(e) => setU('account_number', e.target.value)} /></div>
                <div><label className={lbl}>SWIFT / BIC <span className="text-gray-400">{tx('(建議填)', '(建议填)', '(recommended)')}</span></label><input className={inputCls} value={usd.swift || ''} onChange={(e) => setU('swift', e.target.value)} placeholder="CHASUS33" /></div>
                <div><label className={lbl}>IBAN</label><input className={inputCls} value={usd.iban || ''} onChange={(e) => setU('iban', e.target.value)} /></div>
                <div className="sm:col-span-2"><label className={lbl}>{tx('銀行地址(建議填)', '银行地址(建议填)', 'Bank address (recommended)')}</label><input className={inputCls} value={usd.bank_address || ''} onChange={(e) => setU('bank_address', e.target.value)} placeholder={tx('部分國際電匯需要銀行地址', '部分国际电汇需要银行地址', 'Some international wires require the bank address')} /></div>
              </>
            ) : (
              <>
                <div><label className={lbl}>PayPal Email *</label><input className={inputCls} value={usd.paypal_email || ''} onChange={(e) => setU('paypal_email', e.target.value)} placeholder="you@example.com" /></div>
                <p className="sm:col-span-2 text-[11px] text-gray-300">{tx('PayPal 跨境約 5% 手續費由收款方負擔。', 'PayPal 跨境约 5% 手续费由收款方负担。', 'PayPal cross-border fee (~5%) is borne by the recipient.')}</p>
              </>
            )}
          </div>
        </div>
      )}

      <p className="text-[11px] text-gray-300 mb-3">{tx('※ 請至少填一種收款方式(台幣或美金);請款時選哪種幣別,就要有對應那組帳戶。', '※ 请至少填一种收款方式(台币或美金);请款时选哪种币别,就要有对应那组账户。', '※ Fill at least one (TWD or USD); the currency you request must have a matching account.')}</p>

      <button onClick={save} disabled={busy} className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold rounded-lg px-5 py-2 text-sm transition">
        {busy ? tx('儲存中…', '保存中…', 'Saving…') : tx('儲存收款資料', '保存收款资料', 'Save payout details')}
      </button>
    </>
  );
}

// 請款 — 配音員發起請款、系統生成發票、他同意+簽名上傳(或上傳自家發票)。
function PayoutRequest({ token, tx, pending }: { token: string; tx: (a: string, b: string, c: string) => string; pending: number }) {
  const [reqs, setReqs] = useState<PayoutReq[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [amount, setAmount] = useState(pending > 0 ? String(pending) : '');
  const [currency, setCurrency] = useState('USD');
  const [note, setNote] = useState('');
  const [feeInfo, setFeeInfo] = useState<{ usdMethod: string; taxLoc: 'TW' | 'overseas'; twResident: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    try {
      const r = await fetch('/api/talent/payout-request', { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      setReqs(Array.isArray(j.requests) ? j.requests : []);
    } catch { /* ignore */ }
    // 也載入收款方式 + 稅務,用來即時試算「扣手續費後實際到手」。
    try {
      const pd = await fetch('/api/talent/payout-details', { headers: { Authorization: `Bearer ${token}` } });
      const pj = await pd.json();
      setFeeInfo({ usdMethod: pj.usd?.method === 'paypal' ? 'paypal' : 'bank', taxLoc: pj.tax?.tax_location === 'TW' ? 'TW' : 'overseas', twResident: pj.tax?.tw_resident === true });
    } catch { /* ignore */ }
    setLoaded(true);
  }
  useEffect(() => { if (token) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  async function create() {
    setErr(''); setMsg('');
    if (!(Number(amount) > 0)) { setErr(tx('請填請款金額。', '请填请款金额。', 'Enter an amount.')); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/talent/payout-request', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ amount: Number(amount), currency, note }) });
      const j = await r.json();
      if (!r.ok) {
        if (j.error === 'payout_details_required') setErr(tx('請先完成上方「收款設定」再請款。', '请先完成上方「收款设置」再请款。', 'Please complete Payout details above first.'));
        else if (j.error === 'no_balance') setErr(tx('您目前沒有可請款的款項 —— 接到案子、或您的 AI 聲音被使用後才會有。', '您目前没有可请款的款项 —— 接到案子、或您的 AI 声音被使用后才会有。', 'You have no balance to withdraw yet — it appears after you take on work or your AI voice is used.'));
        else if (j.error === 'exceeds_balance') setErr(tx(`超過可請款餘額(US$${j.balance})。`, `超过可请款余额(US$${j.balance})。`, `Exceeds your available balance (US$${j.balance}).`));
        else setErr(j.error || tx('送出失敗', '送出失败', 'Failed'));
      } else { setMsg(tx('✓ 已發起請款,請到下方完成發票', '✓ 已发起请款,请到下方完成发票', '✓ Request created — finish the invoice below')); setNote(''); await load(); }
    } catch { setErr(tx('送出失敗', '送出失败', 'Failed')); }
    finally { setBusy(false); }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-amber-400/60';
  const lbl = 'block text-xs text-gray-300 mb-1';
  if (!loaded) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 mb-8">
      <h2 className="text-sm font-semibold text-white mb-1">{tx('請款', '请款', 'Request a payout')}</h2>
      <p className="text-xs text-gray-300 mb-4">{tx(`可請款餘額參考:US$${pending}。填金額 → 系統生成發票 → 您確認後簽名上傳(或上傳個人/公司發票)。`, `可请款余额参考:US$${pending}。填金额 → 系统生成发票 → 您确认后签名上传(或上传个人/公司发票)。`, `Pending balance ref: US$${pending}. Enter an amount → we generate an invoice → confirm, sign & upload (or upload your personal/company invoice).`)}</p>
      <p className="text-[11px] text-gray-300 mb-4">{tx('※ 款項每月結算,核准後約 30–45 天內撥付。', '※ 款项每月结算,核准后约 30–45 天内拨付。', '※ Payouts settle monthly — about 30–45 days after approval.')}</p>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
        <div><label className={lbl}>{tx('金額', '金额', 'Amount')} *</label><input type="number" min="0" className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div><label className={lbl}>{tx('幣別', '币别', 'Currency')}</label>
          <div className="relative">
            <select className={`${inputCls} appearance-none pr-9 cursor-pointer`} value={currency} onChange={(e) => setCurrency(e.target.value)}>{['USD', 'TWD'].map((c) => <option key={c} value={c} className="bg-zinc-900">{c}</option>)}</select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
        <div className="sm:col-span-2"><label className={lbl}>{tx('備註(選填)', '备注(选填)', 'Note (optional)')}</label><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </div>

      {Number(amount) > 0 && feeInfo && (() => {
        // 手續費由收款方負擔:USD 看收款方式(PayPal 5% / 電匯 US$20)、TWD 用台灣匯費 NT$30。
        // 台灣稅只在「TWD 請款 + 台灣稅務」時試算(避免跨幣別門檻誤判);其餘只算手續費。
        const method = currency === 'USD' ? (feeInfo.usdMethod === 'paypal' ? 'paypal' : 'bank') : 'bank';
        const bankCountry = currency === 'TWD' ? 'TW' : 'X';
        const taxLocation = (currency === 'TWD' && feeInfo.taxLoc === 'TW') ? 'TW' : 'overseas';
        const dd = computeDeductions({ gross: Number(amount), method, bankCountry, taxLocation, twResident: feeInfo.twResident });
        const c = currency; const n = (x: number) => x.toLocaleString('en-US', { maximumFractionDigits: 2 });
        return (
          <div className="text-xs text-gray-200 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2.5 mb-3 space-y-1">
            <p className="text-gray-300 pb-1">{tx('我們會全額支付您的請款金額;以下為「估算實收」—— 中途手續費由對方收款機構收取,非我們扣除。', '我们会全额支付您的请款金额;以下为「估算实收」—— 中途手续费由对方收款机构收取,非我们扣除。', 'We pay your full requested amount; below is an ESTIMATED net — fees are taken by the receiving institution, not by us.')}</p>
            <div className="flex justify-between"><span>{tx('請款金額(我們支付)', '请款金额(我们支付)', 'Requested (we pay)')}</span><span>{c} {n(Number(amount))}</span></div>
            {dd.tax > 0 && <div className="flex justify-between text-gray-300"><span>{tx('代扣所得稅', '代扣所得税', 'Tax withheld')}</span><span>− {c} {n(dd.tax)}</span></div>}
            {dd.nhi > 0 && <div className="flex justify-between text-gray-300"><span>{tx('二代健保', '二代健保', 'NHI')}</span><span>− {c} {n(dd.nhi)}</span></div>}
            <div className="flex justify-between text-gray-300"><span>{tx('預估手續費', '预估手续费', 'Est. fee')} <span className="text-gray-400">({dd.feeNote})</span></span><span>− {c} {n(dd.fee)}</span></div>
            <div className="flex justify-between font-semibold text-white pt-1 border-t border-white/10"><span>{tx('預估實收 ≈', '预估实收 ≈', 'Est. you receive ≈')}</span><span>{c} {n(dd.net)}</span></div>
            <p className="text-gray-400 pt-0.5 leading-relaxed">{tx('僅為預估參考、非保證金額。各國 PayPal 費率不同(可能另有匯率轉換費)、國際電匯中轉行費用不一、台灣匯費最多約 NT$30。實際到手以您的收款機構入帳為準。', '仅为预估参考、非保证金额。各国 PayPal 费率不同(可能另有汇率转换费)、国际电汇中转行费用不一、台湾汇费最多约 NT$30。实际到手以您的收款机构入账为准。', 'Estimate only, not guaranteed. PayPal rates vary by country (may add FX fees); intl-wire intermediary fees vary; TW wire is at most ~NT$30. Final amount per your receiving institution.')}</p>
          </div>
        );
      })()}

      <button onClick={create} disabled={busy} className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold rounded-lg px-5 py-2 text-sm transition">{busy ? tx('送出中…', '送出中…', 'Working…') : tx('發起請款', '发起请款', 'Create request')}</button>
      {(msg || err) && <p className={`text-xs mt-2 ${err ? 'text-red-400' : 'text-green-400'}`}>{err || msg}</p>}

      {reqs.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="text-xs font-semibold text-gray-300">{tx('我的請款單', '我的请款单', 'My requests')}</div>
          {reqs.map((r) => <RequestRow key={r.id} r={r} token={token} tx={tx} onChanged={load} />)}
        </div>
      )}
    </div>
  );
}

function RequestRow({ r, token, tx, onChanged }: { r: PayoutReq; token: string; tx: (a: string, b: string, c: string) => string; onChanged: () => void }) {
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const SL: Record<string, string> = { pending: tx('待完成發票', '待完成发票', 'Invoice pending'), invoice_uploaded: tx('已送出 · 待撥款', '已送出 · 待拨款', 'Submitted'), paid: tx('已撥款', '已拨款', 'Paid'), rejected: tx('已退回', '已退回', 'Rejected') };

  async function viewInvoice() {
    const res = await fetch(`/api/talent/invoice?id=${r.id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { setErr(tx('發票讀取失敗', '发票读取失败', 'Could not load invoice')); return; }
    const html = await res.text();
    window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank');
  }
  async function upload(file: File) {
    if (!consent) { setErr(tx('請先勾選「我同意以此開立發票」。', '请先勾选「我同意以此开立发票」。', 'Please tick consent first.')); return; }
    setErr(''); setBusy(true);
    try {
      const u = await fetch('/api/talent/invoice-upload', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ fileName: file.name }) });
      const uj = await u.json(); if (!u.ok) throw new Error(uj.error || 'upload prep failed');
      const { error } = await supabase.storage.from('casting').uploadToSignedUrl(uj.path, uj.token, file);
      if (error) throw new Error(error.message);
      const p = await fetch('/api/talent/payout-request', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: r.id, invoice_url: uj.publicUrl, consent: true }) });
      const pj = await p.json(); if (!p.ok) throw new Error(pj.error || 'save failed');
      onChanged();
    } catch (e) { setErr(e instanceof Error ? e.message : tx('上傳失敗', '上传失败', 'Upload failed')); }
    finally { setBusy(false); }
  }

  const paid = r.status === 'paid', done = r.status === 'invoice_uploaded' || paid;
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <span className="text-sm text-white font-medium">{r.currency} {r.amount}</span>
          <span className="text-[11px] text-gray-300 ml-2">{r.invoice_number}</span>
        </div>
        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${paid ? 'bg-green-500/15 text-green-300 border-green-500/30' : done ? 'bg-sky-500/15 text-sky-200 border-sky-500/30' : 'bg-amber-500/15 text-amber-300 border-amber-500/30'}`}>{SL[r.status] || r.status}</span>
      </div>
      {!done && (
        <div className="mt-3 space-y-2.5">
          <p className="text-xs text-gray-200">{tx('完成發票即可送出請款,以下兩種擇一:', '完成发票即可送出请款,以下两种择一:', 'Finish the invoice to submit — either way:')}</p>
          <ul className="text-xs text-gray-300 space-y-1">
            <li>{tx('・個人:用系統發票 —— 點下方「檢視 / 列印」,親筆簽名後上傳。', '・个人:用系统发票 —— 点下方「查看 / 打印」,亲笔签名后上传。', '· Individual: use the system invoice — view/print below, sign, then upload.')}</li>
            <li>{tx('・公司 / 有自己的發票:直接上傳貴公司(或個人)開立的發票,系統發票不用理會。', '・公司 / 有自己的发票:直接上传贵公司(或个人)开立的发票,系统发票不用理会。', '· Company / own invoice: upload your own; ignore the system one.')}</li>
          </ul>
          <button onClick={viewInvoice} className="text-xs text-amber-300 hover:underline">{tx('檢視 / 列印系統發票(供簽名)', '查看 / 打印系统发票(供签名)', 'View / print system invoice (to sign)')}</button>
          <label className="flex items-start gap-2 text-xs text-gray-300">
            <input type="checkbox" className="mt-0.5 accent-amber-500" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>{tx('我同意以此金額、以我(或我公司)名義開立此發票。', '我同意以此金额、以我(或我公司)名义开立此发票。', 'I agree to issue this invoice for this amount in my (or my company’s) name.')}</span>
          </label>
          <label className="inline-flex items-center gap-1.5 text-sm bg-amber-500/15 border border-amber-500/40 text-amber-200 rounded-lg px-4 py-2 cursor-pointer hover:bg-amber-500/25">
            {busy ? tx('上傳中…', '上传中…', 'Uploading…') : tx('上傳發票(簽名版 或 自家發票)', '上传发票(签名版 或 自家发票)', 'Upload invoice (signed system one or your own)')}
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*" className="hidden" disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
          <p className="text-xs text-gray-400">{tx('可接受 PDF 或圖檔。', '可接受 PDF 或图档。', 'PDF or image accepted.')}</p>
          {err && <p className="text-xs text-red-400">{err}</p>}
        </div>
      )}
      {done && r.invoice_url && <a href={r.invoice_url} target="_blank" rel="noreferrer" className="text-[11px] text-gray-300 hover:underline mt-1 inline-block">{tx('看已上傳發票', '看已上传发票', 'View uploaded invoice')}</a>}
    </div>
  );
}

export default function TalentEarningsPage() {
  const locale = useLocale();
  const isZhCN = locale === 'zh-CN';
  const isZh = locale.startsWith('zh');
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  const [state, setState] = useState<'loading' | 'unauth' | 'ready'>('loading');
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [totals, setTotals] = useState<Totals>({ paid: 0, pending: 0, total: 0 });
  const [token, setToken] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { setState('unauth'); return; }
      setToken(token);
      try {
        const r = await fetch('/api/talent/earnings', { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) { setState('unauth'); return; }
        const j = await r.json();
        setEarnings(Array.isArray(j.earnings) ? j.earnings : []);
        setTotals(j.totals || { paid: 0, pending: 0, total: 0 });
        setState('ready');
      } catch { setState('unauth'); }
    })();
  }, []);

  const money = (n: number) => `US$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const fmtDate = (s: string) => { try { return new Date(s).toLocaleDateString(); } catch { return s; } };
  const statusLabel = (s: string | null) =>
    s === 'paid' ? tx('已付款', '已付款', 'Paid') : s === 'pending' ? tx('待付款', '待付款', 'Pending') : (s || tx('處理中', '处理中', 'Processing'));

  if (state === 'loading') {
    return <main className="min-h-screen bg-black text-white flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></main>;
  }
  if (state === 'unauth') {
    return (
      <main className="min-h-screen bg-black text-white px-4 py-16">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-xl font-semibold mb-2">{tx('請先登入', '请先登录', 'Please sign in')}</h1>
          <p className="text-gray-300 text-sm mb-4">{tx('登入配音員帳號後即可查看收款。', '登录配音员账号后即可查看收款。', 'Sign in to your talent account to view earnings.')}</p>
          <Link href="/talent" className="text-amber-300 text-sm hover:text-amber-200">{tx('前往登入 →', '前往登录 →', 'Sign in →')}</Link>
        </div>
      </main>
    );
  }

  return (
    <div className="text-white p-6 lg:p-10">
      <div className="max-w-5xl">
        <p className="text-xs text-gray-300 uppercase tracking-widest mb-2 font-medium">{tx('配音員入口', '配音员入口', 'Talent portal')}</p>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><DollarSign className="w-7 h-7 text-amber-300" /> {tx('收款', '收款', 'Earnings')}</h1>
        <p className="text-sm text-gray-300 mt-1 mb-8">{tx('您透過 Onyx 接案/分潤所得,月結。', '您通过 Onyx 接案/分润所得,月结。', 'Your share from work and royalties through Onyx, settled monthly.')}</p>

        <PayoutSettings token={token} tx={tx} locale={locale} pending={totals.pending} />

        <PayoutRequest token={token} tx={tx} pending={totals.pending} />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <StatModule icon={DollarSign} label={tx('累計', '累计', 'Total')} value={money(totals.total)} />
          <StatModule icon={CheckCircle2} label={tx('已付款', '已付款', 'Paid')} value={money(totals.paid)} />
          <StatModule icon={Clock} label={tx('待付款', '待付款', 'Pending')} value={money(totals.pending)} />
        </div>

        {earnings.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center">
            <p className="text-gray-300 text-sm">{tx('目前還沒有收款紀錄。接到案子、或您的 AI 聲音被使用後,分潤會顯示在這裡。', '目前还没有收款记录。接到案子、或您的 AI 声音被使用后,分润会显示在这里。', 'No earnings yet. Your payouts will appear here once you take on work or your AI voice is used.')}</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/[0.03] text-gray-300 text-xs">
                  <th className="text-left font-medium px-4 py-2.5">{tx('日期', '日期', 'Date')}</th>
                  <th className="text-left font-medium px-4 py-2.5">{tx('類型', '类型', 'Type')}</th>
                  <th className="text-right font-medium px-4 py-2.5">{tx('金額', '金额', 'Amount')}</th>
                  <th className="text-right font-medium px-4 py-2.5">{tx('狀態', '状态', 'Status')}</th>
                </tr>
              </thead>
              <tbody>
                {earnings.map((e) => (
                  <tr key={e.id} className="border-t border-white/5">
                    <td className="px-4 py-3 text-gray-300">{fmtDate(e.created_at)}</td>
                    <td className="px-4 py-3 text-gray-300">{e.order_type || '—'}</td>
                    <td className="px-4 py-3 text-right text-white font-medium">{money(e.commission_amount || 0)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${e.status === 'paid' ? 'bg-green-500/15 text-green-300' : 'bg-amber-500/15 text-amber-300'}`}>{statusLabel(e.status)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

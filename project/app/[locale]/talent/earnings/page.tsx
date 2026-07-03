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
import { DollarSign, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { StatModule } from '@/components/dashboard/cards';
import { taxNotice } from '@/lib/payout-policy';

type Earning = { id: string; order_type: string | null; commission_amount: number | null; status: string | null; created_at: string };
type Totals = { paid: number; pending: number; total: number };

// 收款設定 — the talent fills in their own payout details (encrypted, restricted
// table). Organised by METHOD (bank / PayPal), not region; a tax-residence question
// drives the Taiwan withholding notice. Never shown to clients; only Onyx pays.
function PayoutSettings({ token, tx, locale, pending }: { token: string; tx: (a: string, b: string, c: string) => string; locale: string; pending: number }) {
  const [loaded, setLoaded] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [method, setMethod] = useState<'bank' | 'paypal' | ''>('');
  const [taxLoc, setTaxLoc] = useState<'TW' | 'overseas' | ''>('');
  const [twResident, setTwResident] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [f, setF] = useState<Record<string, string>>({});
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
        setMethod(j.method || '');
        setTaxLoc(j.tax_location || '');
        const dt = j.details && typeof j.details === 'object' ? j.details : {};
        setTwResident(dt.tw_resident === true);
        setF(dt);
        setCompleted(!!j.completed);
      } catch { /* leave empty */ }
      setLoaded(true);
    })();
  }, [token]);

  const set = (k: string, v: string) => { setF((p) => ({ ...p, [k]: v })); setMsg(''); };
  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-400/60';
  const lbl = 'block text-xs text-gray-400 mb-1';
  const isTWbank = (f.bank_country || '').trim().toUpperCase() === 'TW';

  async function save() {
    setErr(''); setMsg(''); setBusy(true);
    try {
      const details = { ...f, tax_location: taxLoc, tw_resident: twResident };
      const r = await fetch('/api/talent/payout-details', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ method, details }) });
      const j = await r.json();
      if (!r.ok) {
        if (j.error === 'incomplete') setErr(tx('請把必填欄位(標 *)補齊。', '请把必填栏位(标 *)补齐。', 'Please complete all required (*) fields.'));
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
      <p className="text-xs text-gray-500 mb-4">{tx('僅供 Onyx 付款用,加密保存', '仅供 Onyx 付款用,加密保存', 'For Onyx payments only — encrypted.')}</p>
      {inner}
      {(msg || err) && <p className={`text-xs mt-3 ${err ? 'text-red-400' : 'text-green-400'}`}>{err || msg}</p>}
    </div>
  );

  if (!configured) {
    return wrap(<p className="text-xs text-gray-400">{tx('收款設定即將開放,請稍後再回來填寫。', '收款设置即将开放,请稍后再回来填写。', 'Payout setup is coming online shortly — please check back soon.')}</p>);
  }

  return wrap(
    <>
      {pending > 0 && !completed && (
        <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2 mb-4">{tx('您有待付款項 —— 請先完成收款設定,我們才能付款給您。', '您有待付款项 —— 请先完成收款设置,我们才能付款给您。', 'You have a pending payout — please complete this so we can pay you.')}</p>
      )}

      <label className={lbl}>{tx('收款方式', '收款方式', 'Payment method')} *</label>
      <div className="flex gap-2 mb-4">
        {(['bank', 'paypal'] as const).map((m) => (
          <button key={m} type="button" onClick={() => { setMethod(m); setMsg(''); }} className={`text-xs px-3 py-1.5 rounded-full border transition ${method === m ? 'bg-amber-500/20 border-amber-400/50 text-amber-200' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>
            {m === 'bank' ? tx('銀行匯款', '银行汇款', 'Bank transfer') : 'PayPal'}
          </button>
        ))}
      </div>

      {method === 'bank' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="sm:col-span-2"><label className={lbl}>{tx('帳戶姓名(法定)', '账户姓名(法定)', 'Account holder (legal name)')} *</label><input className={inputCls} value={f.account_holder || ''} onChange={(e) => set('account_holder', e.target.value)} /></div>
          <div><label className={lbl}>{tx('銀行名稱', '银行名称', 'Bank name')} *</label><input className={inputCls} value={f.bank_name || ''} onChange={(e) => set('bank_name', e.target.value)} placeholder={tx('例如:國泰世華', '例如:国泰世华', 'e.g. Cathay United')} /></div>
          <div><label className={lbl}>{tx('銀行所在國(TW=台灣本地)', '银行所在国(TW=台湾本地)', 'Bank country (TW = local)')} *</label><input className={inputCls} value={f.bank_country || ''} onChange={(e) => set('bank_country', e.target.value)} placeholder="TW / US / TH…" /></div>
          <div><label className={lbl}>{tx('帳號', '账号', 'Account number')} *</label><input className={inputCls} value={f.account_number || ''} onChange={(e) => set('account_number', e.target.value)} /></div>
          <div><label className={lbl}>IBAN <span className="text-gray-600">{tx('(有才填)', '(有才填)', '(if any)')}</span></label><input className={inputCls} value={f.iban || ''} onChange={(e) => set('iban', e.target.value)} /></div>
          <div><label className={lbl}>SWIFT / BIC {isTWbank ? <span className="text-gray-600">{tx('(海外必填)', '(海外必填)', '(intl required)')}</span> : <span className="text-amber-400">*</span>}</label><input className={inputCls} value={f.swift || ''} onChange={(e) => set('swift', e.target.value)} /></div>
          <div><label className={lbl}>{tx('分行', '分行', 'Branch')}</label><input className={inputCls} value={f.bank_branch || ''} onChange={(e) => set('bank_branch', e.target.value)} /></div>
        </div>
      )}

      {method === 'paypal' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div><label className={lbl}>{tx('帳戶姓名 / 公司名(法定)', '账户姓名 / 公司名(法定)', 'Account holder / company (legal)')} *</label><input className={inputCls} value={f.account_holder || ''} onChange={(e) => set('account_holder', e.target.value)} /></div>
          <div><label className={lbl}>PayPal Email *</label><input className={inputCls} value={f.paypal_email || ''} onChange={(e) => set('paypal_email', e.target.value)} placeholder="you@example.com" /></div>
          <p className="sm:col-span-2 text-[11px] text-gray-500">{tx('每次付款前請提供 invoice(email 給我們);PayPal 跨境約 5% 手續費由收款方負擔。', '每次付款前请提供 invoice(email 给我们);PayPal 跨境约 5% 手续费由收款方负担。', 'Send us an invoice before each payment; the PayPal cross-border fee (~5%) is borne by the recipient.')}</p>
        </div>
      )}

      {method && (
        <>
          <label className={lbl}>{tx('稅務所在地', '税务所在地', 'Tax residence')} *</label>
          <div className="flex gap-2 mb-3">
            {(['overseas', 'TW'] as const).map((t) => (
              <button key={t} type="button" onClick={() => { setTaxLoc(t); setMsg(''); }} className={`text-xs px-3 py-1.5 rounded-full border transition ${taxLoc === t ? 'bg-sky-500/20 border-sky-400/50 text-sky-200' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>
                {t === 'overseas' ? tx('海外(境外完成)', '海外(境外完成)', 'Overseas (work outside Taiwan)') : tx('台灣', '台湾', 'Taiwan')}
              </button>
            ))}
          </div>

          {taxLoc === 'TW' && (
            <div className="mb-3 space-y-3">
              <div>
                <label className={lbl}>{tx('你是台灣稅務居住者嗎?', '你是台湾税务居住者吗?', 'Are you a Taiwan tax resident?')} *</label>
                <p className="text-[11px] text-gray-500 mb-1.5">{tx('本國籍(有身分證),或外國籍持居留證且年度居留 ≥183 天 = 居住者。', '本国籍(有身份证),或外国籍持居留证且年度居留 ≥183 天 = 居住者。', 'Local citizen (with ID), or a foreign national with an ARC residing ≥183 days = resident.')}</p>
                <div className="flex gap-2">
                  {[true, false].map((v) => (
                    <button key={String(v)} type="button" onClick={() => { setTwResident(v); setMsg(''); }} className={`text-xs px-3 py-1.5 rounded-full border transition ${twResident === v ? 'bg-sky-500/20 border-sky-400/50 text-sky-200' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>
                      {v ? tx('是,居住者', '是,居住者', 'Yes, resident') : tx('否,非居住者(<183天)', '否,非居住者(<183天)', 'No, non-resident (<183 days)')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className={lbl}>{tx('身分證 / 居留證號', '身份证 / 居留证号', 'National ID / ARC number')} *</label><input className={inputCls} value={f.national_id || ''} onChange={(e) => set('national_id', e.target.value)} placeholder="A123456789" /></div>
                <div><label className={lbl}>{tx('地址(扣繳憑單用)', '地址(扣缴凭单用)', 'Address (for withholding statement)')} *</label><input className={inputCls} value={f.tax_address || ''} onChange={(e) => set('tax_address', e.target.value)} /></div>
              </div>
            </div>
          )}

          {taxLoc && (
            <p className="text-[11px] text-sky-200/80 bg-sky-500/10 border border-sky-500/20 rounded-lg px-3 py-2 mb-4">{taxNotice({ taxLocation: taxLoc, twResident }, locale)}</p>
          )}

          <button onClick={save} disabled={busy} className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold rounded-lg px-5 py-2 text-sm transition">
            {busy ? tx('儲存中…', '保存中…', 'Saving…') : tx('儲存收款資料', '保存收款资料', 'Save payout details')}
          </button>
        </>
      )}
    </>
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
    return <main className="min-h-screen bg-black text-white flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-500" /></main>;
  }
  if (state === 'unauth') {
    return (
      <main className="min-h-screen bg-black text-white px-4 py-16">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-xl font-semibold mb-2">{tx('請先登入', '请先登录', 'Please sign in')}</h1>
          <p className="text-gray-400 text-sm mb-4">{tx('登入配音員帳號後即可查看收款。', '登录配音员账号后即可查看收款。', 'Sign in to your talent account to view earnings.')}</p>
          <Link href="/talent" className="text-amber-300 text-sm hover:text-amber-200">{tx('前往登入 →', '前往登录 →', 'Sign in →')}</Link>
        </div>
      </main>
    );
  }

  return (
    <div className="text-white p-6 lg:p-10">
      <div className="max-w-5xl">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-2 font-medium">{tx('配音員入口', '配音员入口', 'Talent portal')}</p>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><DollarSign className="w-7 h-7 text-amber-300" /> {tx('收款', '收款', 'Earnings')}</h1>
        <p className="text-sm text-gray-500 mt-1 mb-8">{tx('您透過 Onyx 接案/分潤所得,月結。', '您通过 Onyx 接案/分润所得,月结。', 'Your share from work and royalties through Onyx, settled monthly.')}</p>

        <PayoutSettings token={token} tx={tx} locale={locale} pending={totals.pending} />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <StatModule icon={DollarSign} label={tx('累計', '累计', 'Total')} value={money(totals.total)} />
          <StatModule icon={CheckCircle2} label={tx('已付款', '已付款', 'Paid')} value={money(totals.paid)} />
          <StatModule icon={Clock} label={tx('待付款', '待付款', 'Pending')} value={money(totals.pending)} />
        </div>

        {earnings.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center">
            <p className="text-gray-400 text-sm">{tx('目前還沒有收款紀錄。接到案子、或您的 AI 聲音被使用後,分潤會顯示在這裡。', '目前还没有收款记录。接到案子、或您的 AI 声音被使用后,分润会显示在这里。', 'No earnings yet. Your payouts will appear here once you take on work or your AI voice is used.')}</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/[0.03] text-gray-500 text-xs">
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
                    <td className="px-4 py-3 text-gray-400">{e.order_type || '—'}</td>
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

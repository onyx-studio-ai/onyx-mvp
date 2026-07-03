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

type Earning = { id: string; order_type: string | null; commission_amount: number | null; status: string | null; created_at: string };
type Totals = { paid: number; pending: number; total: number };

// 收款設定 — the talent fills in their own payout details (encrypted, restricted
// table). Taiwan = 勞務報酬/銀行匯款 (needs 身分證字號 for 扣繳); overseas = PayPal
// (they invoice us per payment). Never shown to clients; only Onyx pays from it.
function PayoutSettings({ token, tx, pending }: { token: string; tx: (a: string, b: string, c: string) => string; pending: number }) {
  const [loaded, setLoaded] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [region, setRegion] = useState<'TW' | 'overseas' | ''>('');
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
        setRegion(j.region || '');
        setCompleted(!!j.completed);
        setF(j.details && typeof j.details === 'object' ? j.details : {});
      } catch { /* leave empty */ }
      setLoaded(true);
    })();
  }, [token]);

  const set = (k: string, v: string) => { setF((p) => ({ ...p, [k]: v })); setMsg(''); };
  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-400/60';
  const lbl = 'block text-xs text-gray-400 mb-1';

  async function save() {
    setErr(''); setMsg(''); setBusy(true);
    try {
      const r = await fetch('/api/talent/payout-details', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ region, details: f }) });
      const j = await r.json();
      if (!r.ok) {
        if (j.error === 'incomplete') setErr(tx('請把必填欄位補齊。', '请把必填栏位补齐。', 'Please complete all required fields.'));
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
        <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">🔒 {tx('收款設定', '收款设置', 'Payout details')}</h2>
        {completed
          ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-300 border border-green-500/30">{tx('已完成', '已完成', 'Complete')}</span>
          : <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">{tx('尚未填寫', '尚未填写', 'Not set')}</span>}
      </div>
      <p className="text-xs text-gray-500 mb-4">{tx('僅供 Onyx 付款用,加密保存、絕不公開給客戶。', '仅供 Onyx 付款用,加密保存、绝不公开给客户。', 'For Onyx payments only — encrypted, never shown to clients.')}</p>
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
      <div className="flex gap-2 mb-4">
        {(['TW', 'overseas'] as const).map((rg) => (
          <button key={rg} type="button" onClick={() => { setRegion(rg); setMsg(''); }} className={`text-xs px-3 py-1.5 rounded-full border transition ${region === rg ? 'bg-amber-500/20 border-amber-400/50 text-amber-200' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>
            {rg === 'TW' ? tx('🇹🇼 台灣(勞務/銀行匯款)', '🇹🇼 台湾(劳务/银行汇款)', '🇹🇼 Taiwan (bank transfer)') : tx('🌐 國外(PayPal)', '🌐 国外(PayPal)', '🌐 Overseas (PayPal)')}
          </button>
        ))}
      </div>

      {region === 'TW' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={lbl}>{tx('法定姓名', '法定姓名', 'Legal name')} *</label><input className={inputCls} value={f.legal_name || ''} onChange={(e) => set('legal_name', e.target.value)} /></div>
          <div><label className={lbl}>{tx('身分證字號', '身份证号', 'National ID')} *</label><input className={inputCls} value={f.national_id || ''} onChange={(e) => set('national_id', e.target.value)} placeholder="A123456789" /></div>
          <div className="sm:col-span-2"><label className={lbl}>{tx('戶籍地址(扣繳憑單用)', '户籍地址(扣缴凭单用)', 'Registered address')} *</label><input className={inputCls} value={f.address || ''} onChange={(e) => set('address', e.target.value)} /></div>
          <div><label className={lbl}>{tx('銀行', '银行', 'Bank')} *</label><input className={inputCls} value={f.bank_name || ''} onChange={(e) => set('bank_name', e.target.value)} placeholder={tx('例如:國泰世華', '例如:国泰世华', 'e.g. Cathay United')} /></div>
          <div><label className={lbl}>{tx('分行', '分行', 'Branch')}</label><input className={inputCls} value={f.bank_branch || ''} onChange={(e) => set('bank_branch', e.target.value)} /></div>
          <div><label className={lbl}>{tx('戶名', '户名', 'Account name')} *</label><input className={inputCls} value={f.bank_account_name || ''} onChange={(e) => set('bank_account_name', e.target.value)} /></div>
          <div><label className={lbl}>{tx('帳號', '账号', 'Account number')} *</label><input className={inputCls} value={f.bank_account || ''} onChange={(e) => set('bank_account', e.target.value)} /></div>
        </div>
      )}

      {region === 'overseas' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={lbl}>{tx('法定姓名 / 公司名', '法定姓名 / 公司名', 'Legal / company name')} *</label><input className={inputCls} value={f.legal_name || ''} onChange={(e) => set('legal_name', e.target.value)} /></div>
          <div><label className={lbl}>PayPal Email *</label><input className={inputCls} value={f.paypal_email || ''} onChange={(e) => set('paypal_email', e.target.value)} placeholder="you@example.com" /></div>
          <p className="sm:col-span-2 text-[11px] text-gray-500">{tx('國外配音員:每次付款前請提供 invoice(email 給我們),我們以 PayPal 支付。', '国外配音员:每次付款前请提供 invoice(email 给我们),我们以 PayPal 支付。', 'Overseas talent: send us an invoice before each payment; we pay via PayPal.')}</p>
        </div>
      )}

      {region && (
        <button onClick={save} disabled={busy} className="mt-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold rounded-lg px-5 py-2 text-sm transition">
          {busy ? tx('儲存中…', '保存中…', 'Saving…') : tx('儲存收款資料', '保存收款资料', 'Save payout details')}
        </button>
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

        <PayoutSettings token={token} tx={tx} pending={totals.pending} />

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

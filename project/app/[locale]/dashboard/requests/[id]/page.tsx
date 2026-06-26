'use client';

/*
  Client request detail — the client opens their own /hire submission to see the
  full brief and EDIT it while it's still 審核中 (status='reviewing'). Once Onyx
  confirms (open/awarded) it turns read-only. Auth/chrome from the dashboard layout.
*/

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { supabase } from '@/lib/supabase';
import { caseCode } from '@/lib/casting';

const CURRENCIES = ['USD', 'TWD'];
const LANGS = ['中文 · 台灣國語', '中文 · 大陸普通話', '粵語 · 香港', '台語 · 台灣閩南語', '英文 · 美式', '英文 · 英式', '日語', '韓語', '其他'];
const input = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-400/60 [color-scheme:dark]';

type Brief = {
  id: string; brief_number: string; kind?: string | null; title?: string | null; content_type?: string | null;
  language?: string | null; status: string; budget?: string | null; budget_type?: string | null;
  media_scope?: string | null; territory?: string | null; license_term?: string | null; length?: string | null;
  audition_deadline?: string | null; deadline?: string | null; has_singing?: boolean | null;
  wants_director?: boolean | null; wants_live_session?: boolean | null; ref_audio_url?: string | null;
  brief: string; created_at: string;
};

export default function ClientRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  const [phase, setPhase] = useState<'loading' | 'notfound' | 'ready'>('loading');
  const [b, setB] = useState<Brief | null>(null);
  const [token, setToken] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  // edit fields
  const [title, setTitle] = useState('');
  const [briefText, setBriefText] = useState('');
  const [language, setLanguage] = useState('');
  const [cur, setCur] = useState('USD');
  const [amt, setAmt] = useState('');
  const [budgetType, setBudgetType] = useState('Up to');
  const [audDeadline, setAudDeadline] = useState('');
  const [deadline, setDeadline] = useState('');

  const hydrate = (bf: Brief) => {
    setTitle(bf.title || ''); setBriefText(bf.brief || ''); setLanguage(bf.language || '');
    const [c, ...rest] = String(bf.budget || '').trim().split(/\s+/);
    if (CURRENCIES.includes(c)) { setCur(c); setAmt(rest.join(' ')); } else { setAmt(bf.budget || ''); }
    setBudgetType(bf.budget_type || 'Up to');
    setAudDeadline(bf.audition_deadline || ''); setDeadline(bf.deadline || '');
  };

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const tk = data.session?.access_token;
    if (!tk) { setPhase('notfound'); return; }
    setToken(tk);
    const res = await fetch(`/api/client/requests/${id}`, { headers: { Authorization: `Bearer ${tk}` } });
    if (!res.ok) { setPhase('notfound'); return; }
    const j = await res.json().catch(() => ({}));
    if (!j.brief) { setPhase('notfound'); return; }
    setB(j.brief); hydrate(j.brief); setPhase('ready');
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    setMsg(''); setSaving(true);
    const res = await fetch(`/api/client/requests/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title, brief: briefText, language, budget: amt.trim() ? `${cur} ${amt.trim()}` : '', budget_type: budgetType, audition_deadline: audDeadline, deadline }),
    });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setMsg(j.error || tx('儲存失敗', '保存失败', 'Save failed')); return; }
    setB(j.brief); hydrate(j.brief); setEditing(false); setMsg(tx('已儲存 ✓', '已保存 ✓', 'Saved ✓'));
  }

  const wrap = (inner: React.ReactNode) => <div className="px-6 py-8 max-w-3xl mx-auto text-white">{inner}</div>;
  if (phase === 'loading') return wrap(<p className="text-gray-500 text-sm py-10">{tx('載入中…', '加载中…', 'Loading…')}</p>);
  if (phase === 'notfound' || !b) return wrap(<><p className="text-gray-400 text-sm py-10">{tx('找不到這筆需求。', '找不到这笔需求。', 'Request not found.')}</p><Link href="/dashboard/requests" className="text-amber-300 hover:underline text-sm">← {tx('回配音需求', '回配音需求', 'Back to requests')}</Link></>);

  const canEdit = b.status === 'reviewing';
  const row = (label: string, value: React.ReactNode) => value ? <div className="min-w-0"><span className="text-gray-500">{label} </span><span className="text-gray-200">{value}</span></div> : null;

  return wrap(
    <>
      <Link href="/dashboard/requests" className="text-xs text-gray-400 hover:text-white">← {tx('配音需求', '配音需求', 'Requests')}</Link>
      <div className="flex items-start justify-between gap-3 mt-3 mb-4">
        <div className="min-w-0">
          <p className="text-xs text-gray-500 font-mono">{b.kind === 'casting' ? caseCode(b) : b.brief_number}</p>
          <h1 className="text-2xl font-semibold mt-0.5">{b.title || `${b.content_type || tx('配音', '配音', 'Voiceover')}${tx('需求', '需求', ' request')}`}</h1>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full border whitespace-nowrap shrink-0 ${b.status === 'reviewing' ? 'bg-amber-500/15 text-amber-200 border-amber-500/30' : b.status === 'open' ? 'bg-green-500/15 text-green-200 border-green-500/30' : 'bg-white/10 text-gray-300 border-white/15'}`}>
          {b.status === 'reviewing' ? tx('審核中', '审核中', 'In review') : b.status === 'open' ? tx('徵選中', '征选中', 'Auditioning') : b.status}
        </span>
      </div>

      {!canEdit && <p className="text-xs text-gray-500 mb-4">{tx('此需求已進入處理,內容已鎖定。如需修改請聯絡 Onyx。', '此需求已进入处理,内容已锁定。如需修改请联系 Onyx。', 'This request is being handled and is locked. Contact Onyx to change it.')}</p>}

      {editing && canEdit ? (
        <div className="space-y-4 bg-white/[0.02] border border-white/10 rounded-2xl p-5">
          <label className="block"><span className="text-xs text-gray-400 mb-1 block">{tx('標題', '标题', 'Title')}</span><input className={input} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className="block"><span className="text-xs text-gray-400 mb-1 block">{tx('需求說明', '需求说明', 'Brief')} *</span><textarea className={`${input} min-h-[120px] resize-y`} value={briefText} onChange={(e) => setBriefText(e.target.value)} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="text-xs text-gray-400 mb-1 block">{tx('語言', '语言', 'Language')}</span>
              <select className={input} value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="" className="bg-zinc-900">{tx('請選擇', '请选择', 'Select')}</option>
                {LANGS.map((l) => <option key={l} value={l} className="bg-zinc-900">{l}</option>)}
              </select>
            </label>
            <label className="block"><span className="text-xs text-gray-400 mb-1 block">{tx('預算', '预算', 'Budget')}</span>
              <div className="flex gap-2">
                <select className={`${input} w-24`} value={budgetType} onChange={(e) => setBudgetType(e.target.value)}>
                  <option value="Up to" className="bg-zinc-900">{tx('上限', '上限', 'Up to')}</option>
                  <option value="Fixed" className="bg-zinc-900">{tx('固定', '固定', 'Fixed')}</option>
                </select>
                <select className={`${input} w-20`} value={cur} onChange={(e) => setCur(e.target.value)}>{CURRENCIES.map((c) => <option key={c} value={c} className="bg-zinc-900">{c}</option>)}</select>
                <input type="number" min="0" className={input} value={amt} onChange={(e) => setAmt(e.target.value)} placeholder={tx('金額', '金额', 'Amount')} />
              </div>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="text-xs text-gray-400 mb-1 block">{tx('試音截止', '试音截止', 'Audition deadline')}</span><input type="date" className={input} value={audDeadline} onChange={(e) => setAudDeadline(e.target.value)} /></label>
            <label className="block"><span className="text-xs text-gray-400 mb-1 block">{tx('交付截止', '交付截止', 'Delivery deadline')}</span><input type="date" className={input} value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label>
          </div>
          {msg && <p className="text-xs text-amber-300">{msg}</p>}
          <div className="flex gap-3">
            <button onClick={save} disabled={saving} className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold rounded-lg px-5 py-2 text-sm">{saving ? tx('儲存中…', '保存中…', 'Saving…') : tx('儲存', '保存', 'Save')}</button>
            <button onClick={() => { hydrate(b); setEditing(false); setMsg(''); }} className="bg-white/10 hover:bg-white/15 text-white rounded-lg px-5 py-2 text-sm">{tx('取消', '取消', 'Cancel')}</button>
          </div>
        </div>
      ) : (
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5">
          <p className="text-sm text-gray-200 whitespace-pre-wrap mb-4">{b.brief}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-1.5 text-sm">
            {row(tx('類型', '类型', 'Type'), b.content_type)}
            {row(tx('語言', '语言', 'Language'), b.language)}
            {row(tx('預算', '预算', 'Budget'), b.budget ? `${b.budget_type ? `${b.budget_type} ` : ''}${b.budget}` : null)}
            {row(tx('使用範圍', '使用范围', 'Usage'), b.media_scope)}
            {row(tx('地區', '地区', 'Territory'), b.territory)}
            {row(tx('授權', '授权', 'License'), b.license_term)}
            {row(tx('長度', '长度', 'Length'), b.length)}
            {row(tx('試音截止', '试音截止', 'Audition'), b.audition_deadline)}
            {row(tx('交付截止', '交付截止', 'Delivery'), b.deadline)}
            {b.has_singing && row(tx('含唱歌', '含唱歌', 'Singing'), tx('是', '是', 'Yes'))}
            {b.wants_director && row(tx('聲音導演', '声音导演', 'Director'), tx('是', '是', 'Yes'))}
            {b.wants_live_session && row(tx('線上監錄', '线上监录', 'Live session'), tx('是', '是', 'Yes'))}
            {b.ref_audio_url && row(tx('參考', '参考', 'Reference'), <a href={b.ref_audio_url} target="_blank" rel="noopener noreferrer" className="text-amber-300 hover:underline break-all">{b.ref_audio_url}</a>)}
          </div>
          {msg && <p className="text-xs text-amber-300 mt-3">{msg}</p>}
          {canEdit && <button onClick={() => setEditing(true)} className="mt-4 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg px-5 py-2 text-sm">{tx('編輯需求', '编辑需求', 'Edit request')}</button>}
        </div>
      )}
    </>
  );
}

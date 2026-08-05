'use client';

/*
  潛在名單(prospects)後台管理頁 —— Wing 看得到、控制得了這份線索池。
  搜尋 / 篩選(類型・狀態)/ 看往來紀錄(note,來自你的 Excel)/ 一鍵 suppress(永不寄)/
  看每人被邀次數 / 手動加人。發案邀請時另有「先預覽再送」流程,這頁是名單本身的掌控。
*/

import { useState, useEffect, useCallback } from 'react';

type Prospect = {
  id: string; email: string; name: string | null; kind: string; company: string | null;
  country: string | null; gender: string | null; languages: string[]; note: string | null;
  source: string | null; status: string; last_invited_at: string | null; invite_count: number;
};

const KIND_LABEL: Record<string, string> = { talent: '配音員', client: '客戶', proofreader: '校對' };
const STATUS_LABEL: Record<string, string> = { active: '可邀', suppressed: '永不寄', joined: '已入駐' };
const KIND_BADGE: Record<string, string> = {
  talent: 'bg-sky-100 text-sky-700 border-sky-200',
  client: 'bg-amber-100 text-amber-700 border-amber-200',
  proofreader: 'bg-violet-100 text-violet-700 border-violet-200',
};
const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700 border-green-200',
  suppressed: 'bg-gray-200 text-gray-600 border-gray-300',
  joined: 'bg-blue-100 text-blue-700 border-blue-200',
};

export default function ProspectsAdmin() {
  const [rows, setRows] = useState<Prospect[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const [busyId, setBusyId] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [add, setAdd] = useState({ email: '', name: '', kind: 'talent', company: '', note: '' });
  // 邀請:勾選名單 → 選案件 → 預覽 → 寄送
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [briefs, setBriefs] = useState<{ id: string; title: string; language: string; kind: string }[]>([]);
  const [caseId, setCaseId] = useState('');
  const [preview, setPreview] = useState<{ eligible: number; cooldown_excluded: number; sample: { name: string | null; email: string; lang: string }[] } | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const p = new URLSearchParams();
      if (q.trim()) p.set('q', q.trim());
      if (kind) p.set('kind', kind);
      if (status) p.set('status', status);
      const res = await fetch(`/api/admin/prospects?${p.toString()}`, { credentials: 'include' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || '載入失敗');
      setRows(j.prospects || []); setCounts(j.counts || {}); setTotal(j.total || 0);
    } catch (e) { setErr(e instanceof Error ? e.message : '載入失敗'); } finally { setLoading(false); }
  }, [q, kind, status]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  // 載入開放中的案件(選案件下拉用)
  useEffect(() => {
    fetch('/api/admin/prospects/invite', { credentials: 'include' })
      .then((r) => r.json()).then((j) => setBriefs(j.briefs || [])).catch(() => {});
  }, []);

  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const activeRows = rows.filter((r) => r.status === 'active');   // 只有可邀的能勾
  const allVisibleSel = activeRows.length > 0 && activeRows.every((r) => selected.has(r.id));
  const toggleSelAll = () => setSelected((s) => {
    const n = new Set(s);
    if (allVisibleSel) activeRows.forEach((r) => n.delete(r.id)); else activeRows.forEach((r) => n.add(r.id));
    return n;
  });

  async function doInvite(send: boolean) {
    if (!caseId) { alert('請先選一個案件'); return; }
    if (selected.size === 0) { alert('請先勾選要邀請的人'); return; }
    setInviteBusy(true);
    try {
      const res = await fetch('/api/admin/prospects/invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ brief_id: caseId, prospect_ids: [...selected], send }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || '失敗');
      if (send) {
        alert(`已寄出 ${j.count} 封邀請信。`);
        setSelected(new Set()); setPreview(null); load();
      } else {
        setPreview(j);
      }
    } catch (e) { alert(e instanceof Error ? e.message : '失敗'); } finally { setInviteBusy(false); }
  }

  async function setStatusFor(id: string, next: string) {
    setBusyId(id);
    try {
      const res = await fetch('/api/admin/prospects', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ id, status: next }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '更新失敗');
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: next } : r)));
      setCounts((c) => ({ ...c })); // 計數下次載入才精準,這裡先不動
    } catch (e) { alert(e instanceof Error ? e.message : '更新失敗'); } finally { setBusyId(''); }
  }

  async function addOne() {
    if (!/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(add.email.trim())) { alert('email 格式不對'); return; }
    const res = await fetch('/api/admin/prospects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(add) });
    if (!res.ok) { alert((await res.json().catch(() => ({}))).error || '新增失敗'); return; }
    setShowAdd(false); setAdd({ email: '', name: '', kind: 'talent', company: '', note: '' }); load();
  }

  const chip = (label: string, val: string, active: boolean, onClick: () => void) => (
    <button onClick={onClick} className={`text-xs px-3 py-1.5 rounded-full border transition ${active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>
      {label}{val ? ` ${val}` : ''}
    </button>
  );

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">潛在名單 Prospects</h1>
          <p className="text-sm text-gray-500 mt-1">從 email 整理來的客戶 / 配音員 / 校對線索池。往來紀錄來自你的名單,可搜尋、關掉不想寄的、手動加人。</p>
        </div>
        <button onClick={() => setShowAdd((s) => !s)} className="text-sm bg-gray-900 hover:bg-gray-700 text-white rounded-lg px-4 py-2 shrink-0">＋ 手動加人</button>
      </div>

      {/* 統計 */}
      <div className="flex flex-wrap gap-2 mb-4 text-xs">
        <span className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700">全部 {counts.all ?? 0}</span>
        <span className="px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700">配音員 {counts.talent ?? 0}</span>
        <span className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700">客戶 {counts.client ?? 0}</span>
        <span className="px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700">校對 {counts.proofreader ?? 0}</span>
        <span className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700">可邀 {counts.active ?? 0}</span>
        <span className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500">永不寄 {counts.suppressed ?? 0}</span>
        <span className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700">已入駐 {counts.joined ?? 0}</span>
      </div>

      {showAdd && (
        <div className="mb-4 border border-gray-200 rounded-xl p-4 bg-gray-50 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input placeholder="email(必填)" value={add.email} onChange={(e) => setAdd({ ...add, email: e.target.value })} className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
          <input placeholder="姓名 / 藝名" value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
          <select value={add.kind} onChange={(e) => setAdd({ ...add, kind: e.target.value })} className="border border-gray-300 rounded px-2 py-1.5 text-sm">
            <option value="talent">配音員</option><option value="client">客戶</option><option value="proofreader">校對</option>
          </select>
          <input placeholder="公司(客戶用)" value={add.company} onChange={(e) => setAdd({ ...add, company: e.target.value })} className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
          <input placeholder="備註 / 往來紀錄" value={add.note} onChange={(e) => setAdd({ ...add, note: e.target.value })} className="border border-gray-300 rounded px-2 py-1.5 text-sm sm:col-span-2" />
          <button onClick={addOne} className="text-sm bg-gray-900 text-white rounded-lg px-4 py-2 justify-self-start">加入名單</button>
        </div>
      )}

      {/* 搜尋 + 篩選 */}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋 姓名 / email / 公司 / 備註…" className="w-full sm:max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3" />
      <div className="flex flex-wrap gap-2 mb-5">
        {chip('全部類型', '', kind === '', () => setKind(''))}
        {chip('配音員', '', kind === 'talent', () => setKind('talent'))}
        {chip('客戶', '', kind === 'client', () => setKind('client'))}
        {chip('校對', '', kind === 'proofreader', () => setKind('proofreader'))}
        <span className="w-px bg-gray-200 mx-1" />
        {chip('全部狀態', '', status === '', () => setStatus(''))}
        {chip('可邀', '', status === 'active', () => setStatus('active'))}
        {chip('永不寄', '', status === 'suppressed', () => setStatus('suppressed'))}
        {chip('已入駐', '', status === 'joined', () => setStatus('joined'))}
      </div>

      {/* 邀請列:勾選 ≥1 人才出現。選案件 → 預覽 → 寄送。永不寄/已入駐不可勾。 */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-10 mb-3 border border-gray-900 rounded-xl bg-gray-900 text-white px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">已選 {selected.size} 人</span>
            <button onClick={() => { setSelected(new Set()); setPreview(null); }} className="text-xs text-gray-300 underline">清除</button>
            <span className="mx-1 opacity-40">→</span>
            <select value={caseId} onChange={(e) => { setCaseId(e.target.value); setPreview(null); }}
              className="text-sm bg-white text-gray-900 rounded-lg px-2 py-1.5 max-w-xs">
              <option value="">選一個案件…</option>
              {briefs.map((bf) => <option key={bf.id} value={bf.id}>{bf.title}{bf.language ? ` · ${bf.language}` : ''}</option>)}
            </select>
            <button disabled={inviteBusy || !caseId} onClick={() => doInvite(false)}
              className="text-sm bg-white/15 hover:bg-white/25 rounded-lg px-3 py-1.5 disabled:opacity-40">預覽</button>
            <button disabled={inviteBusy || !caseId || !preview} onClick={() => doInvite(true)}
              className="text-sm bg-[#6FCF97] text-black font-semibold rounded-lg px-3 py-1.5 disabled:opacity-40">
              {inviteBusy ? '處理中…' : '確認寄送'}</button>
          </div>
          {preview && (
            <p className="text-xs text-gray-200 mt-2">
              可寄 <b className="text-white">{preview.eligible}</b> 人{preview.cooldown_excluded > 0 ? `(冷卻期內已邀、排除 ${preview.cooldown_excluded} 人)` : ''}
              {preview.sample?.length ? ` · 例:${preview.sample.slice(0, 5).map((s) => s.name || s.email).join('、')}…` : ''}
              　—　語言自動配對(英/簡/繁)。確認無誤按「確認寄送」。
            </p>
          )}
        </div>
      )}

      {err && <p className="text-sm text-red-600 mb-3">{err}</p>}
      {loading ? <p className="text-sm text-gray-400 py-10 text-center">載入中…</p> : (
        <>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-400">顯示 {rows.length} 筆（共 {total}）</p>
            <button onClick={toggleSelAll} className="text-xs text-gray-600 hover:text-gray-900 underline">
              {allVisibleSel ? '取消全選' : '全選本頁(僅可邀)'}</button>
          </div>
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className={`border rounded-xl px-4 py-3 bg-white ${selected.has(r.id) ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSel(r.id)}
                    disabled={r.status !== 'active'} title={r.status !== 'active' ? '永不寄/已入駐不可邀' : ''}
                    className="mt-1 accent-gray-900 disabled:opacity-30" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{r.name || r.email}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${KIND_BADGE[r.kind] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>{KIND_LABEL[r.kind] || r.kind}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${STATUS_BADGE[r.status] || ''}`}>{STATUS_LABEL[r.status] || r.status}</span>
                      {r.company && <span className="text-xs text-gray-500">· {r.company}</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{r.email}{r.country ? ` · ${r.country}` : ''}{r.languages?.length ? ` · ${r.languages.join('、')}` : ''}</p>
                    {r.note && <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{r.note}</p>}
                    <p className="text-[11px] text-gray-400 mt-1">
                      來源 {r.source || '—'} · 被邀 {r.invite_count} 次{r.last_invited_at ? ` · 最近 ${new Date(r.last_invited_at).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {r.status !== 'suppressed'
                      ? <button disabled={busyId === r.id} onClick={() => setStatusFor(r.id, 'suppressed')} className="text-xs border border-gray-300 text-gray-600 rounded-lg px-2.5 py-1 hover:bg-gray-100 disabled:opacity-50">設為永不寄</button>
                      : <button disabled={busyId === r.id} onClick={() => setStatusFor(r.id, 'active')} className="text-xs border border-green-300 text-green-700 rounded-lg px-2.5 py-1 hover:bg-green-50 disabled:opacity-50">恢復可邀</button>}
                  </div>
                </div>
              </div>
            ))}
            {rows.length === 0 && <p className="text-sm text-gray-400 py-10 text-center">沒有符合的資料。</p>}
          </div>
        </>
      )}
    </div>
  );
}

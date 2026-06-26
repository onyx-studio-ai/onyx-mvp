'use client';

/*
  Edit an existing casting case — fields + per-role data, especially correcting a
  role's 台詞 (sample_line) one by one. Images are preserved. Saves via
  PATCH /api/admin/casting { id, edit: {...} } (no status change, no notify).
  Admin (cookie) auth, light theme.
*/

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';

type Role = { name?: string; gender?: string; age?: string; personality?: string; emotion?: string; speed?: string; sample_line?: string; is_lead?: boolean; image?: string };
const input = 'w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500';

export default function EditCasting() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [phase, setPhase] = useState<'loading' | 'notfound' | 'ready'>('loading');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [f, setF] = useState({ title: '', content_type: '', language: '', brief: '', rate_note: '', audition_deadline: '', recording_start: '', deadline: '', length: '', audition_script: '', base_revisions: '1', audition_cap: '5' });
  const [roles, setRoles] = useState<Role[]>([]);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const setRole = (i: number, k: keyof Role, v: string | boolean) => setRoles((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/casting?id=${encodeURIComponent(id)}`, { credentials: 'include' });
    if (!res.ok) { setPhase('notfound'); return; }
    const bf = (await res.json().catch(() => ({})))?.brief;
    if (!bf) { setPhase('notfound'); return; }
    setF({
      title: bf.title || '', content_type: bf.content_type || '', language: bf.language || '', brief: bf.brief || '',
      rate_note: bf.rate_note || '', audition_deadline: bf.audition_deadline || '', recording_start: bf.recording_start || '',
      deadline: bf.deadline || '', length: bf.length || '', audition_script: bf.audition_script || '',
      base_revisions: String(bf.base_revisions ?? 1), audition_cap: String(bf.audition_cap ?? 5),
    });
    setRoles(Array.isArray(bf.roles) ? bf.roles : []);
    setPhase('ready');
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    setMsg(''); setSaving(true);
    const res = await fetch('/api/admin/casting', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ id, edit: { ...f, base_revisions: Number(f.base_revisions) || 0, audition_cap: Number(f.audition_cap) || 5, roles } }),
    });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setMsg(j.error || '儲存失敗'); return; }
    setMsg('已儲存 ✓');
  }

  if (phase === 'loading') return <div className="p-8 text-gray-500 text-sm">載入中…</div>;
  if (phase === 'notfound') return <div className="p-8 text-gray-500 text-sm">找不到這個案件。<button onClick={() => router.push('/admin/marketplace')} className="text-blue-600 hover:underline ml-2">← 回案件</button></div>;

  return (
    <div className="p-6 max-w-3xl mx-auto text-gray-900">
      <button onClick={() => router.push('/admin/marketplace')} className="text-xs text-gray-500 hover:text-gray-800">← 回案件 · 發案</button>
      <h1 className="text-xl font-semibold mt-2 mb-1">編輯案件</h1>
      <p className="text-gray-500 text-sm mb-6">改完按「儲存」即時生效(不改狀態、不重新通知)。逐角色修正台詞,圖片保留。</p>

      <div className="space-y-3 bg-white border border-gray-200 rounded-xl p-5 mb-5">
        <label className="block"><span className="text-xs text-gray-600 mb-1 block">標題</span><input className={input} value={f.title} onChange={(e) => set('title', e.target.value)} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-xs text-gray-600 mb-1 block">語言</span><input className={input} value={f.language} onChange={(e) => set('language', e.target.value)} /></label>
          <label className="block"><span className="text-xs text-gray-600 mb-1 block">報酬</span><input className={input} value={f.rate_note} onChange={(e) => set('rate_note', e.target.value)} placeholder="例:NT$150 / 句" /></label>
        </div>
        <label className="block"><span className="text-xs text-gray-600 mb-1 block">案件說明</span><textarea className={`${input} min-h-[80px] resize-y`} value={f.brief} onChange={(e) => set('brief', e.target.value)} /></label>
        <div className="grid grid-cols-3 gap-3">
          <label className="block"><span className="text-xs text-gray-600 mb-1 block">試音截止</span><input className={input} value={f.audition_deadline} onChange={(e) => set('audition_deadline', e.target.value)} /></label>
          <label className="block"><span className="text-xs text-gray-600 mb-1 block">交付截止</span><input className={input} value={f.deadline} onChange={(e) => set('deadline', e.target.value)} /></label>
          <label className="block"><span className="text-xs text-gray-600 mb-1 block">規模</span><input className={input} value={f.length} onChange={(e) => set('length', e.target.value)} /></label>
        </div>
        <label className="block"><span className="text-xs text-gray-600 mb-1 block">試音方向 / 聲音方向(選填)</span><textarea className={`${input} min-h-[60px] resize-y`} value={f.audition_script} onChange={(e) => set('audition_script', e.target.value)} /></label>
      </div>

      {roles.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold">角色 · 逐角修正台詞</h2>
            <span className="text-xs text-gray-500">共 {roles.length} 角</span>
          </div>
          <div className="space-y-3">
            {roles.map((r, i) => (
              <div key={i} className="flex gap-3 bg-white border border-gray-200 rounded-xl p-4">
                <div className="w-16 shrink-0">
                  {r.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image} alt={r.name} className="w-16 h-16 rounded object-cover object-top border border-gray-200" />
                  ) : <div className="w-16 h-16 rounded border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-xl text-gray-400">🎭</div>}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="grid grid-cols-4 gap-2">
                    <input className={input} value={r.name || ''} onChange={(e) => setRole(i, 'name', e.target.value)} placeholder="角色名" />
                    <input className={input} value={r.gender || ''} onChange={(e) => setRole(i, 'gender', e.target.value)} placeholder="性別" />
                    <input className={input} value={r.age || ''} onChange={(e) => setRole(i, 'age', e.target.value)} placeholder="年齡" />
                    <label className="flex items-center gap-1.5 text-xs text-gray-600"><input type="checkbox" checked={!!r.is_lead} onChange={(e) => setRole(i, 'is_lead', e.target.checked)} /> 主角</label>
                  </div>
                  <input className={input} value={r.personality || ''} onChange={(e) => setRole(i, 'personality', e.target.value)} placeholder="性格 / 角色設定" />
                  <div className="grid grid-cols-2 gap-2">
                    <input className={input} value={r.emotion || ''} onChange={(e) => setRole(i, 'emotion', e.target.value)} placeholder="情緒" />
                    <input className={input} value={r.speed || ''} onChange={(e) => setRole(i, 'speed', e.target.value)} placeholder="語速" />
                  </div>
                  <label className="block">
                    <span className="text-[11px] text-green-700 font-medium">台詞(試音樣詞)</span>
                    <textarea className={`${input} min-h-[60px] resize-y mt-0.5`} value={r.sample_line || ''} onChange={(e) => setRole(i, 'sample_line', e.target.value)} placeholder="貼上正確台詞…" />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="sticky bottom-0 bg-white/95 border-t border-gray-200 -mx-6 px-6 py-3 mt-6 flex items-center gap-3">
        <button onClick={save} disabled={saving} className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-lg px-6 py-2 text-sm">{saving ? '儲存中…' : '儲存'}</button>
        <a href={`/casting/preview/${id}`} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 hover:text-gray-900">👁 預覽前台</a>
        {msg && <span className={`text-sm ${msg.includes('✓') ? 'text-green-700' : 'text-red-600'}`}>{msg}</span>}
      </div>
    </div>
  );
}

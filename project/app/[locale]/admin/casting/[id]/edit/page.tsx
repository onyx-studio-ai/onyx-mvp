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
import { supabase } from '@/lib/supabase';

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
  const [imgBusy, setImgBusy] = useState<number | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const setRole = (i: number, k: keyof Role, v: string | boolean) => setRoles((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  // ── Direct assignment (managed production): pick roles → assign to a talent
  // (existing or invite by email) with a fixed pay-per-role. Admin-only. ──
  const [talents, setTalents] = useState<{ id: string; name: string; email: string }[]>([]);
  const [pickRoles, setPickRoles] = useState<Set<string>>(new Set());
  const [assignMode, setAssignMode] = useState<'existing' | 'invite'>('existing');
  const [assignTalent, setAssignTalent] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [pay, setPay] = useState('');
  const [assigning, setAssigning] = useState(false);
  const togglePick = (name: string) => setPickRoles((s) => { const n = new Set(s); if (n.has(name)) n.delete(name); else n.add(name); return n; });

  useEffect(() => { fetch('/api/talents?type=VO').then((r) => (r.ok ? r.json() : { talents: [] })).then((d) => setTalents((Array.isArray(d?.talents) ? d.talents : Array.isArray(d) ? d : []).map((t: { id: string; name: string; email?: string }) => ({ id: t.id, name: t.name, email: t.email || '' })))).catch(() => {}); }, []);

  async function assign() {
    const names = [...pickRoles];
    if (!names.length) { setMsg('請先勾選要指派的角色'); return; }
    const payload: { brief_id: string; role_names: string[]; pay_per_role: number; talent_id?: string; invite?: { name: string; email: string } } = { brief_id: id, role_names: names, pay_per_role: Number(pay) || 0 };
    if (assignMode === 'existing') { if (!assignTalent) { setMsg('請選配音員'); return; } payload.talent_id = assignTalent; }
    else { if (!inviteEmail.trim()) { setMsg('請填邀請 email'); return; } payload.invite = { name: inviteName.trim(), email: inviteEmail.trim() }; }
    setAssigning(true); setMsg('');
    try {
      const res = await fetch('/api/admin/casting/assign', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(j.error || '指派失敗'); return; }
      setPickRoles(new Set()); setPay(''); setInviteName(''); setInviteEmail('');
      let m = `✓ 已指派 ${j.assigned} 個角色`;
      if (j.skipped?.length) m += `(跳過 ${j.skipped.length}:已指派過)`;
      if (j.setup_url) m += ` · 已寄設定密碼信給新配音員`;
      setMsg(m);
    } finally { setAssigning(false); }
  }

  async function uploadRoleImage(i: number, file: File) {
    setMsg(''); setImgBusy(i);
    try {
      const u = await fetch('/api/admin/casting/upload', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name }) });
      const uj = await u.json();
      if (!u.ok) throw new Error(uj.error || '上傳準備失敗');
      const { error } = await supabase.storage.from('casting').uploadToSignedUrl(uj.path, uj.token, file);
      if (error) throw new Error(error.message);
      setRole(i, 'image', uj.publicUrl);
    } catch (e) { setMsg(e instanceof Error ? e.message : '換圖失敗'); } finally { setImgBusy(null); }
  }

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
              <div key={i} className={`flex gap-3 bg-white border rounded-xl p-4 ${r.name && pickRoles.has(r.name) ? 'border-violet-400 ring-1 ring-violet-200' : 'border-gray-200'}`}>
                <label className="flex items-start pt-1" title={r.name ? '選取以指派' : '先填角色名才能指派'}>
                  <input type="checkbox" className="accent-violet-600" checked={!!r.name && pickRoles.has(r.name)} disabled={!r.name} onChange={() => r.name && togglePick(r.name)} />
                </label>
                <div className="w-16 shrink-0">
                  {r.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image} alt={r.name} className="w-16 h-16 rounded object-cover object-top border border-gray-200" />
                  ) : <div className="w-16 h-16 rounded border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-xl text-gray-400">🎭</div>}
                  <label className="block text-center mt-1">
                    <span className="text-[10px] text-blue-600 hover:underline cursor-pointer">{imgBusy === i ? '上傳中…' : '換圖'}</span>
                    <input type="file" accept="image/*" className="hidden" disabled={imgBusy === i}
                      onChange={(e) => { const file = e.target.files?.[0]; e.currentTarget.value = ''; if (file) uploadRoleImage(i, file); }} />
                  </label>
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

          <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50/60 p-4">
            <h2 className="text-base font-semibold mb-1">指派配音員(直接派工)</h2>
            <p className="text-xs text-gray-600 mb-3">勾選上方角色 → 選配音員(或邀請新人)→ 填每角派工價 → 指派。免試音、免付款,角色直接進配音員後台可錄。目前已選 <span className="font-semibold text-violet-700">{pickRoles.size}</span> 角。</p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex gap-1">
                {(['existing', 'invite'] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setAssignMode(m)} className={`text-xs px-3 py-1.5 rounded-full border ${assignMode === m ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-300'}`}>{m === 'existing' ? '選現有配音員' : '邀請新配音員'}</button>
                ))}
              </div>
              {assignMode === 'existing' ? (
                <label className="block"><span className="text-xs text-gray-600 mb-1 block">配音員</span>
                  <select className={`${input} min-w-[220px]`} value={assignTalent} onChange={(e) => setAssignTalent(e.target.value)}>
                    <option value="">— 選一位 —</option>
                    {talents.map((t) => <option key={t.id} value={t.id}>{t.name}{t.email ? ` (${t.email})` : ''}</option>)}
                  </select>
                </label>
              ) : (
                <>
                  <label className="block"><span className="text-xs text-gray-600 mb-1 block">姓名</span><input className={`${input} w-36`} value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="配音員姓名" /></label>
                  <label className="block"><span className="text-xs text-gray-600 mb-1 block">Email</span><input className={`${input} w-52`} value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@example.com" /></label>
                </>
              )}
              <label className="block"><span className="text-xs text-gray-600 mb-1 block">每角派工價</span><input type="number" className={`${input} w-28`} value={pay} onChange={(e) => setPay(e.target.value)} placeholder="NT$" /></label>
              <button onClick={assign} disabled={assigning || !pickRoles.size} className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold rounded-lg px-5 py-2 text-sm">{assigning ? '指派中…' : `指派選取的 ${pickRoles.size} 角`}</button>
            </div>
            {assignMode === 'invite' && <p className="text-[11px] text-gray-500 mt-2">邀請新人:會自動建帳號 + 寄設定密碼信;他登入後就看到被指派的角色,之後也能補完檔案送審成為正式配音員。</p>}
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

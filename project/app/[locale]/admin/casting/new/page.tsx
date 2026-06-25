'use client';

/*
  Admin "post a casting call" form (人聲試音案). Self-service posting — the poster
  fills roles, an online-only audition script, reference materials (links +
  files re-hosted on our `casting` bucket), recording logistics, rate. On submit
  the call goes live at /talent/opportunities. Internal tool (admin-cookie auth).
*/

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { supabase } from '@/lib/supabase';

type RefFile = { name: string; url: string };
const input = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-400/60';

export default function NewCasting() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState('中文 · 台灣國語');
  const [brief, setBrief] = useState('');
  const [rateNote, setRateNote] = useState('');
  const [baseRev, setBaseRev] = useState('1');
  const [auditionDeadline, setAuditionDeadline] = useState('');
  const [recordingStart, setRecordingStart] = useState('');
  const [methods, setMethods] = useState<Record<string, boolean>>({ home: false, studio: false, online: false });
  const [rolesText, setRolesText] = useState('');
  const [auditionScript, setAuditionScript] = useState('');
  const [refLinks, setRefLinks] = useState<string[]>(['']);
  const [refFiles, setRefFiles] = useState<RefFile[]>([]);
  const [fetchUrl, setFetchUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState<{ brief_number: string } | null>(null);

  function parseRoles() {
    return rolesText.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
      const p = line.split('|').map((s) => s.trim());
      let name = p[0] || '';
      const is_lead = /^[★*]/.test(name);
      name = name.replace(/^[★*]\s*/, '');
      return { name, gender: p[1] || '', age: p[2] || '', personality: p[3] || '', sample_line: p[4] || '', emotion: '', is_lead };
    }).filter((r) => r.name);
  }

  async function uploadFile(file: File) {
    setErr(''); setWorking('上傳中…');
    try {
      const u = await fetch('/api/admin/casting/upload', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name }) });
      const uj = await u.json();
      if (!u.ok) throw new Error(uj.error || '上傳準備失敗');
      const { error } = await supabase.storage.from('casting').uploadToSignedUrl(uj.path, uj.token, file);
      if (error) throw new Error(error.message);
      setRefFiles((f) => [...f, { name: file.name, url: uj.publicUrl }]);
    } catch (e) { setErr(e instanceof Error ? e.message : '上傳失敗'); } finally { setWorking(''); }
  }

  async function rehostUrl() {
    if (!fetchUrl.trim()) return;
    setErr(''); setWorking('抓取中…');
    try {
      const u = await fetch('/api/admin/casting/upload', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fetchUrl: fetchUrl.trim() }) });
      const uj = await u.json();
      if (!u.ok) throw new Error(uj.error || '抓取失敗');
      setRefFiles((f) => [...f, { name: uj.name || '參考檔', url: uj.publicUrl }]);
      setFetchUrl('');
    } catch (e) { setErr(e instanceof Error ? e.message : '抓取失敗'); } finally { setWorking(''); }
  }

  async function submit() {
    setErr('');
    if (!title.trim()) return setErr('請填標題');
    if (!brief.trim()) return setErr('請填案件說明');
    setBusy(true);
    const payload = {
      title, language, brief, rate_note: rateNote, base_revisions: Number(baseRev) || 0,
      audition_deadline: auditionDeadline, recording_start: recordingStart,
      recording_methods: Object.keys(methods).filter((k) => methods[k]),
      roles: parseRoles(), audition_script: auditionScript,
      reference_links: refLinks.map((l) => l.trim()).filter(Boolean), reference_files: refFiles,
    };
    const res = await fetch('/api/admin/casting', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(j.error || '發案失敗');
    setDone({ brief_number: j.brief_number });
  }

  if (done) {
    return (
      <main className="min-h-screen bg-black text-white px-4 py-16">
        <div className="max-w-xl mx-auto text-center">
          <h1 className="text-2xl font-semibold mb-2">✅ 案件已發布</h1>
          <p className="text-gray-400 mb-1">案號:{done.brief_number}</p>
          <p className="text-gray-500 text-sm mb-6">配音員登入後在「案件機會」就看得到了。</p>
          <button onClick={() => router.push('/talent/opportunities')} className="text-green-400 hover:underline text-sm mr-4">查看(配音員視角) →</button>
          <button onClick={() => location.reload()} className="text-gray-400 hover:underline text-sm">再發一個</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold">發案 · 人聲試音案</h1>
        <p className="text-gray-500 text-sm">填好後配音員會在「案件機會」看到並試音。</p>

        <Field label="標題 *"><input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例:遊戲角色配音 · 女王百貨" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="語言"><input className={input} value={language} onChange={(e) => setLanguage(e.target.value)} /></Field>
          <Field label="報酬說明"><input className={input} value={rateNote} onChange={(e) => setRateNote(e.target.value)} placeholder="例:¥65/句,含1次修改" /></Field>
        </div>
        <Field label="案件說明 *"><textarea className={`${input} min-h-[90px] resize-y`} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="全劇共 X 條台詞… 先試音,通過後正式錄。試音範圍…" /></Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="試音截止"><input className={input} value={auditionDeadline} onChange={(e) => setAuditionDeadline(e.target.value)} placeholder="6/30" /></Field>
          <Field label="預計開錄"><input className={input} value={recordingStart} onChange={(e) => setRecordingStart(e.target.value)} placeholder="7月初" /></Field>
          <Field label="含修改次數"><input type="number" min="0" className={input} value={baseRev} onChange={(e) => setBaseRev(e.target.value)} /></Field>
        </div>
        <Field label="錄音方式(可複選)">
          <div className="flex gap-4 text-sm">
            {([['home', '在家錄'], ['studio', '錄音室'], ['online', '線上監錄']] as const).map(([k, l]) => (
              <label key={k} className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={methods[k]} onChange={(e) => setMethods((m) => ({ ...m, [k]: e.target.checked }))} /> {l}
              </label>
            ))}
          </div>
        </Field>

        <Field label="試音角色(每行一個:★主角 | 性別 | 年齡 | 性格 | 台詞)">
          <textarea className={`${input} min-h-[120px] resize-y font-mono text-xs`} value={rolesText} onChange={(e) => setRolesText(e.target.value)}
            placeholder={'★顧冶 | 男 | 28 | 果斷 | 我從來不遲到…\n福爾森 | 男 | 35 | 理性 | 排除所有不可能的…'} />
        </Field>
        <Field label="試音稿(配音員只能線上看、不可下載)">
          <textarea className={`${input} min-h-[100px] resize-y`} value={auditionScript} onChange={(e) => setAuditionScript(e.target.value)} placeholder="貼上樣本台詞 / 方向說明…" />
        </Field>

        <Field label="參考素材 — 連結">
          {refLinks.map((l, i) => (
            <div key={i} className="flex gap-2 mb-1.5">
              <input className={input} value={l} onChange={(e) => setRefLinks((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))} placeholder="https://…(樣音 / 方向連結)" />
              <button onClick={() => setRefLinks((arr) => arr.filter((_, j) => j !== i))} className="text-gray-500 px-2">✕</button>
            </div>
          ))}
          <button onClick={() => setRefLinks((arr) => [...arr, ''])} className="text-xs text-sky-300 hover:underline">+ 再加一條連結</button>
        </Field>
        <Field label="參考素材 — 檔案(上傳 / 貼客戶直連自動抓進平台)">
          {refFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-gray-300 mb-1">
              <span className="truncate flex-1">📎 {f.name}</span>
              <button onClick={() => setRefFiles((arr) => arr.filter((_, j) => j !== i))} className="text-gray-500">✕</button>
            </div>
          ))}
          <input type="file" disabled={!!working} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
            className="block w-full text-xs text-gray-400 mb-2 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-white/10 file:text-white file:text-xs" />
          <div className="flex gap-2">
            <input className={input} value={fetchUrl} onChange={(e) => setFetchUrl(e.target.value)} placeholder="貼客戶的直接下載連結 → 自動抓進平台" />
            <button onClick={rehostUrl} disabled={!!working} className="text-xs bg-white/10 hover:bg-white/15 px-3 rounded-lg whitespace-nowrap">抓進來</button>
          </div>
        </Field>

        {working && <p className="text-xs text-gray-400">{working}</p>}
        {err && <p className="text-red-400 text-sm">{err}</p>}
        <button onClick={submit} disabled={busy || !!working} className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold rounded-lg px-5 py-2.5 text-sm">
          {busy ? '發布中…' : '發布案件'}
        </button>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-400 mb-1 block">{label}</span>
      {children}
    </label>
  );
}

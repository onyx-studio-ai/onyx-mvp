'use client';

/*
  Admin "post a casting call" form (人聲試音案). Self-service posting — the poster
  fills roles, an online-only audition script, reference materials (links +
  files re-hosted on our `casting` bucket), recording logistics, rate. On submit
  the call goes live at /talent/opportunities. Internal tool (admin-cookie auth).
  Light theme to match the admin shell.
*/

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { supabase } from '@/lib/supabase';

type RefFile = { name: string; url: string };
type ParsedRole = { name: string; gender?: string; age?: string; personality?: string; sample_line?: string; is_lead?: boolean; image?: string };
const input = 'w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500';
const SITE = 'https://www.onyxstudios.ai';

// Rate = currency + amount (USD / TWD lead; both optional, fill one or both).
const CCYS = ['TWD', 'USD', 'CNY', 'HKD', 'EUR', 'GBP', 'JPY', 'SGD'];
const CCY_SYM: Record<string, string> = { USD: 'US$', TWD: 'NT$', CNY: '¥', HKD: 'HK$', EUR: '€', GBP: '£', JPY: 'JP¥', SGD: 'S$' };
const fmtRate = (cur: string, amt: string) => `${CCY_SYM[cur] || cur + ' '}${amt.trim()}`;
const RATE_UNITS = ['句', '字', '分鐘', '小時', '整案'];

// 19 業界類別 → 對應的回應方式。roles = 分角色試音(遊戲/動畫/戲劇);
// general = 單一聲音,配音員用平台現有 demo 或上傳 demo + 報價(廣告/旁白等)。
const CATEGORIES: { label: string; mode: 'roles' | 'general' }[] = [
  { label: '廣告 Commercial', mode: 'general' },
  { label: '旁白 Narration', mode: 'general' },
  { label: '有聲書 Audiobook', mode: 'general' },
  { label: '工商簡介 Corporate', mode: 'general' },
  { label: '教育教學 E-Learning', mode: 'general' },
  { label: '紀錄片 Documentary', mode: 'general' },
  { label: '電視 TV', mode: 'general' },
  { label: '廣播電台 Radio', mode: 'general' },
  { label: '電影預告 Trailer', mode: 'general' },
  { label: '網路影片 Web Video', mode: 'general' },
  { label: 'Podcast', mode: 'general' },
  { label: '來電語音 IVR', mode: 'general' },
  { label: '語音助理 Voice Assistant', mode: 'general' },
  { label: '新聞播報 News', mode: 'general' },
  { label: '流行歌配唱 Pop Singing', mode: 'general' },
  { label: '遊戲 Video Game', mode: 'roles' },
  { label: '動畫 Animation', mode: 'roles' },
  { label: '戲劇·角色 Drama', mode: 'roles' },
  { label: '角色配唱 Character Singing', mode: 'roles' },
];

export default function NewCasting() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('遊戲 Video Game');
  const [mode, setMode] = useState<'roles' | 'general'>('roles');
  const [language, setLanguage] = useState('中文 · 台灣國語');
  const [brief, setBrief] = useState('');
  const [rateCur, setRateCur] = useState('TWD');
  const [rateAmt, setRateAmt] = useState('');
  const [rateUnit, setRateUnit] = useState('句');
  const [baseRev, setBaseRev] = useState('1');
  const [cap, setCap] = useState('5');
  const [auditionDeadline, setAuditionDeadline] = useState('');
  const [recordingStart, setRecordingStart] = useState('');
  const [methods, setMethods] = useState<Record<string, boolean>>({ home: false, studio: false, online: false });
  const [rolesText, setRolesText] = useState('');
  const [parsedRoles, setParsedRoles] = useState<ParsedRole[]>([]); // from xlsx (carries images)
  const [auditionScript, setAuditionScript] = useState('');
  const [refLinks, setRefLinks] = useState<string[]>(['']);
  const [refFiles, setRefFiles] = useState<RefFile[]>([]);
  const [fetchUrl, setFetchUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState<{ id: string; brief_number: string } | null>(null);
  const [inviteEmails, setInviteEmails] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  function pickCategory(label: string) {
    setCategory(label);
    const m = CATEGORIES.find((c) => c.label === label)?.mode;
    if (m) setMode(m); // category drives the default flow; toggle can still override
  }

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

  async function uploadXlsx(file: File) {
    setErr(''); setWorking('上傳中…');
    try {
      // A client xlsx with many images can be tens of MB — too big to POST through
      // a Vercel function (~4.5MB body cap). Upload straight to Supabase via a
      // signed URL, then parse by path (the route downloads it server-side).
      const up = await fetch('/api/admin/casting/upload', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name }) });
      const upj = await up.json();
      if (!up.ok) throw new Error(upj.error || '上傳準備失敗');
      const { error: upErr } = await supabase.storage.from('casting').uploadToSignedUrl(upj.path, upj.token, file);
      if (upErr) throw new Error(upErr.message);
      setWorking('解析中…');
      const u = await fetch('/api/admin/casting/parse-xlsx', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: upj.path }) });
      const uj = await u.json();
      if (!u.ok) throw new Error(uj.error || '解析失敗');
      const rs: ParsedRole[] = uj.roles || [];
      setParsedRoles(rs);
      // fill the editable textarea with the text version (images kept in parsedRoles, merged on submit by name)
      setRolesText(rs.map((r) => `${r.is_lead ? '★' : ''}${r.name} | ${r.gender || ''} | ${r.age || ''} | ${r.personality || ''} | ${r.sample_line || ''}`).join('\n'));
    } catch (e) { setErr(e instanceof Error ? e.message : '解析失敗'); } finally { setWorking(''); }
  }

  // text roles (editable) merged with xlsx-extracted images by name — exactly what publishes
  function mergedRoles(): ParsedRole[] {
    return parseRoles().map((r) => {
      const p = parsedRoles.find((pr) => pr.name === r.name);
      return p?.image ? { ...r, image: p.image } : r;
    });
  }
  // assemble the rate note from the structured currency/amount inputs (both optional)
  function buildRateNote() {
    return rateAmt.trim() ? `${fmtRate(rateCur, rateAmt)} / ${rateUnit}` : '';
  }
  function goPreview() {
    setErr('');
    if (!title.trim()) return setErr('請填標題');
    if (!brief.trim()) return setErr('請填案件說明');
    setPreviewing(true);
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }

  async function submit() {
    setErr('');
    setBusy(true);
    const roles = mode === 'general' ? [] : mergedRoles();
    const payload = {
      title, content_type: category, language, brief, rate_note: buildRateNote(), base_revisions: Number(baseRev) || 0, audition_cap: Number(cap) || 5,
      audition_deadline: auditionDeadline, recording_start: recordingStart,
      recording_methods: Object.keys(methods).filter((k) => methods[k]),
      roles, audition_script: auditionScript,
      reference_links: refLinks.map((l) => l.trim()).filter(Boolean), reference_files: refFiles,
    };
    const res = await fetch('/api/admin/casting', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(j.error || '發案失敗');
    setDone({ id: j.id, brief_number: j.brief_number });
  }

  async function invite() {
    if (!done || !inviteEmails.trim()) return;
    setInviteMsg(''); setInviting(true);
    const res = await fetch('/api/admin/casting/invite', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: done.id, emails: inviteEmails }) });
    setInviting(false);
    const j = await res.json().catch(() => ({}));
    setInviteMsg(res.ok ? `✅ 已寄出 ${j.invited} 封邀請(對方點連結即可免註冊試音)` : (j.error || '邀請失敗'));
    if (res.ok) setInviteEmails('');
  }

  if (done) {
    const joinLink = `${SITE}/casting/join/${done.id}`;
    return (
      <main className="min-h-screen px-4 py-16 text-gray-900">
        <div className="max-w-xl mx-auto text-center">
          <h1 className="text-2xl font-semibold mb-2">✅ 案件已發布</h1>
          <p className="text-gray-600 mb-1">案號:{done.brief_number}</p>
          <p className="text-gray-500 text-sm mb-6">已註冊的配音員在「案件機會」就看得到了。</p>

          {/* Shareable open link — paste anywhere (WeChat/LINE). Anyone opens, enters
              their email, auditions without registering, and can upgrade later. */}
          <div className="text-left bg-sky-50 border border-sky-200 rounded-xl p-4 mb-4">
            <p className="text-sm text-sky-800 mb-1">🔗 公開試音連結(給平台外的人)</p>
            <p className="text-xs text-gray-500 mb-2">把這條連結貼到微信 / LINE 群都可以。任何人點開 → 填 email → 免註冊直接試音,之後可升級成正式配音員。</p>
            <div className="flex gap-2">
              <input readOnly value={joinLink} className={`${input} text-xs`} onFocus={(e) => e.target.select()} />
              <button onClick={() => { navigator.clipboard?.writeText(joinLink); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                className="text-xs bg-gray-900 hover:bg-gray-700 text-white rounded-lg px-3 whitespace-nowrap">{copied ? '已複製 ✓' : '複製'}</button>
            </div>
          </div>

          <div className="text-left bg-white border border-gray-200 shadow-sm rounded-xl p-4 mb-6">
            <p className="text-sm text-green-700 mb-1">📨 指定 email 邀請(系統幫你寄)</p>
            <p className="text-xs text-gray-500 mb-2">貼上 email(每行一個或逗號分隔)。對方收到專屬連結 → 一鍵免註冊試音 → 隨時點同一連結回來補上傳。</p>
            <textarea className={`${input} min-h-[70px] resize-y`} value={inviteEmails} onChange={(e) => setInviteEmails(e.target.value)} placeholder={'a@example.com\nb@example.com'} />
            <button onClick={invite} disabled={inviting || !inviteEmails.trim()} className="mt-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-1.5 text-sm">{inviting ? '寄送中…' : '寄出邀請'}</button>
            {inviteMsg && <p className="text-xs text-gray-600 mt-2">{inviteMsg}</p>}
          </div>

          <button onClick={() => router.push('/talent/opportunities')} className="text-green-700 hover:underline text-sm mr-4">查看(配音員視角) →</button>
          <button onClick={() => location.reload()} className="text-gray-500 hover:underline text-sm">再發一個</button>
        </div>
      </main>
    );
  }

  if (previewing) {
    const rn = buildRateNote();
    const roles = mergedRoles();
    const methodList = Object.keys(methods).filter((k) => methods[k]);
    const methodLabel = (k: string) => (k === 'home' ? '在家錄' : k === 'studio' ? '錄音室' : k === 'online' ? '線上監錄' : k);
    return (
      <main className="min-h-screen px-4 py-12 text-gray-900">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">發佈前預覽</h1>
            <span className="text-xs text-gray-500">這就是配音員會看到的內容</span>
          </div>

          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 space-y-3">
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">試音案</span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{category}</span>
              {language && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{language}</span>}
              {rn && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">{rn}</span>}
              {methodList.map((m) => <span key={m} className="text-xs bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full">{methodLabel(m)}</span>)}
            </div>
            {brief && <p className="text-sm text-gray-800 whitespace-pre-wrap">{brief}</p>}
            {auditionScript && (
              <div>
                <p className="text-xs text-gray-500 mb-1">試音方向 / 聲音方向</p>
                <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded-lg p-3">{auditionScript}</div>
              </div>
            )}
            {(refFiles.length > 0 || refLinks.some((l) => l.trim())) && (
              <div>
                <p className="text-xs text-gray-500 mb-1">參考素材</p>
                {refFiles.map((f, i) => <div key={i} className="text-xs text-gray-600 truncate">📎 {f.name}</div>)}
                {refLinks.filter((l) => l.trim()).map((l, i) => <div key={i} className="text-xs text-sky-700 truncate">{l}</div>)}
              </div>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              {auditionDeadline && <span>試音截止 {auditionDeadline}</span>}
              {recordingStart && <span>預計開錄 {recordingStart}</span>}
              {Number(baseRev) > 0 && <span>含修改 {baseRev} 次</span>}
            </div>
            <p className="text-xs text-green-700">平台不抽成 —— 配音員報多少拿多少</p>

            <div className="border-t border-gray-200 pt-3">
              {mode === 'general' ? (
                <p className="text-sm text-gray-600">一般配音案:配音員用平台現有 demo 或上傳 demo + 報價回應(不分角色)。</p>
              ) : roles.length ? (
                <>
                  <p className="text-xs text-gray-500 mb-2">{roles.length} 個試音角色</p>
                  <div className="grid grid-cols-2 gap-2">
                    {roles.map((r, i) => (
                      <div key={i} className="flex gap-2 items-start bg-gray-50 border border-gray-200 rounded-lg p-2">
                        {r.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.image} alt={r.name} className="w-11 h-11 rounded object-cover shrink-0 border border-gray-200" />
                        ) : (
                          <div className="w-11 h-11 rounded shrink-0 border border-dashed border-gray-300 bg-gray-100 flex items-center justify-center text-[10px] text-gray-500">無圖</div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-900 truncate">{r.is_lead && <span className="text-amber-500">★</span>}{r.name} <span className="text-xs text-gray-500">{[r.gender, r.age].filter(Boolean).join('·')}</span></p>
                          {r.personality && <p className="text-xs text-gray-500 truncate">{r.personality}</p>}
                          {r.sample_line && <p className="text-xs text-gray-700 truncate">{r.sample_line}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-amber-700">⚠ 還沒有角色 —— 返回上傳 xlsx 或手動填角色。</p>
              )}
            </div>
          </div>

          {err && <p className="text-red-600 text-sm">{err}</p>}
          <div className="flex gap-3">
            <button onClick={() => setPreviewing(false)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-5 py-2.5 text-sm">← 返回修改</button>
            <button onClick={submit} disabled={busy} className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-lg px-5 py-2.5 text-sm">{busy ? '發布中…' : '✓ 確認發佈'}</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-12 text-gray-900">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold">發案 · 人聲試音案</h1>
        <p className="text-gray-500 text-sm">填好後先預覽,確認沒問題再發佈。</p>

        <Field label="標題 *"><input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例:遊戲角色配音 · 女王百貨" /></Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="類別">
            <select className={input} value={category} onChange={(e) => pickCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c.label} value={c.label}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="回應方式">
            <div className="flex gap-2">
              {([['roles', '角色試音(多角色)'], ['general', '一般(單一聲音)']] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setMode(k)}
                  className={`flex-1 rounded-lg px-2 py-2.5 text-xs border transition ${mode === k ? 'bg-green-100 border-green-500 text-green-800' : 'bg-white border-gray-300 text-gray-600 hover:text-gray-900'}`}>{l}</button>
              ))}
            </div>
          </Field>
        </div>
        <p className="text-xs text-gray-500 -mt-2">
          {mode === 'roles'
            ? '配音員分角色試音(遊戲 / 動畫 / 戲劇)。每個角色一張卡、可上傳角色圖片。'
            : '配音員用平台現有 demo 或上傳一段 demo + 報價即可,不需逐角色錄音(廣告 / 旁白 / 有聲書等)。'}
        </p>

        <Field label="語言"><input className={input} value={language} onChange={(e) => setLanguage(e.target.value)} /></Field>
        <Field label="報酬(客戶預算,給配音員看 · 台幣/美金二選一)">
          <div className="flex items-center gap-2">
            <select className={`${input} w-28`} value={rateCur} onChange={(e) => setRateCur(e.target.value)}>
              {CCYS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="number" min="0" className={input} value={rateAmt} onChange={(e) => setRateAmt(e.target.value)} placeholder="金額" />
            <span className="text-gray-500 text-sm">/</span>
            <select className={`${input} w-28`} value={rateUnit} onChange={(e) => setRateUnit(e.target.value)}>
              {RATE_UNITS.map((u) => <option key={u} value={u}>每{u}</option>)}
            </select>
          </div>
        </Field>
        <Field label="案件說明 *"><textarea className={`${input} min-h-[90px] resize-y`} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="全劇共 X 條台詞… 先試音,通過後正式錄。試音範圍…" /></Field>

        <div className="grid grid-cols-4 gap-3">
          <Field label="試音截止"><input className={input} value={auditionDeadline} onChange={(e) => setAuditionDeadline(e.target.value)} placeholder="6/30" /></Field>
          <Field label="預計開錄"><input className={input} value={recordingStart} onChange={(e) => setRecordingStart(e.target.value)} placeholder="7月初" /></Field>
          <Field label="含修改次數"><input type="number" min="0" className={input} value={baseRev} onChange={(e) => setBaseRev(e.target.value)} /></Field>
          <Field label="熱門門檻(人數提示)"><input type="number" min="1" className={input} value={cap} onChange={(e) => setCap(e.target.value)} /></Field>
        </div>
        <Field label="錄音方式(可複選)">
          <div className="flex gap-4 text-sm text-gray-700">
            {([['home', '在家錄'], ['studio', '錄音室'], ['online', '線上監錄']] as const).map(([k, l]) => (
              <label key={k} className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={methods[k]} onChange={(e) => setMethods((m) => ({ ...m, [k]: e.target.checked }))} /> {l}
              </label>
            ))}
          </div>
        </Field>

        {mode === 'roles' && <>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-700 mb-0.5">⚡ 推薦:上傳客戶 xlsx,自動帶入角色 + 角色圖片</p>
          <p className="text-xs text-gray-500 mb-2">系統解析角色名/性別/年齡/性格/台詞,並抽出角色圖片(配音員看長相幫助試音)。解析後可在下方編輯。沒有 xlsx 就手動填。</p>
          <input type="file" accept=".xlsx" disabled={!!working} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadXlsx(f); }}
            className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-green-100 file:text-green-700 file:text-xs" />
          {parsedRoles.length > 0 && (
            <p className="text-xs text-green-700 mt-2">✓ 解析到 {parsedRoles.length} 個角色({parsedRoles.filter((r) => r.image).length} 個有圖片)。下方有發佈前預覽。</p>
          )}
        </div>
        <Field label="試音角色(每行一個:★主角 | 性別 | 年齡 | 性格 | 台詞;上傳 xlsx 會自動填)">
          <textarea className={`${input} min-h-[120px] resize-y font-mono text-xs`} value={rolesText} onChange={(e) => setRolesText(e.target.value)}
            placeholder={'★顧冶 | 男 | 28 | 果斷 | 我從來不遲到…\n福爾森 | 男 | 35 | 理性 | 排除所有不可能的…'} />
        </Field>

        {/* 發佈前預覽 — 這就是按「發佈」會送出的角色(文字框 + xlsx 圖片合併後),讓你先確認有沒有漏 */}
        {rolesText.trim() && (() => {
          const preview: ParsedRole[] = parseRoles().map((r) => {
            const p = parsedRoles.find((pr) => pr.name === r.name);
            return p?.image ? { ...r, image: p.image } : r;
          });
          const withImg = preview.filter((r) => r.image).length;
          const noLine = preview.filter((r) => !r.sample_line).length;
          return (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <p className="text-sm text-gray-900">角色解析預覽 · 共 {preview.length} 個角色</p>
                <div className="flex gap-1.5 text-xs">
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{withImg} 有圖</span>
                  {preview.length - withImg > 0 && <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">{preview.length - withImg} 無圖</span>}
                  {noLine > 0 && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{noLine} 缺台詞</span>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {preview.map((r, i) => (
                  <div key={i} className="flex gap-2 items-start bg-white border border-gray-200 rounded-lg p-2">
                    {r.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.image} alt={r.name} className="w-11 h-11 rounded object-cover shrink-0 border border-gray-200" />
                    ) : (
                      <div className="w-11 h-11 rounded shrink-0 border border-dashed border-gray-300 bg-gray-100 flex items-center justify-center text-[10px] text-gray-500">無圖</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900 truncate">{r.is_lead && <span className="text-amber-500">★</span>}{r.name} <span className="text-xs text-gray-500">{[r.gender, r.age].filter(Boolean).join('·')}</span></p>
                      {r.personality && <p className="text-xs text-gray-500 truncate">{r.personality}</p>}
                      <p className={`text-xs truncate ${r.sample_line ? 'text-gray-700' : 'text-red-600'}`}>{r.sample_line || '⚠ 缺台詞'}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">無圖不影響發佈(配音員會看到灰底佔位)。這裡讓你確認角色數、圖片、台詞有沒有漏 —— 改上方文字框會即時更新。</p>
            </div>
          );
        })()}
        </>}
        <Field label="試音方向 / 聲音方向(選填,配音員只能線上看)">
          <textarea className={`${input} min-h-[100px] resize-y`} value={auditionScript} onChange={(e) => setAuditionScript(e.target.value)} placeholder="情緒、語速、聲音方向…(或共用樣詞)" />
        </Field>

        <Field label="參考素材 — 連結">
          {refLinks.map((l, i) => (
            <div key={i} className="flex gap-2 mb-1.5">
              <input className={input} value={l} onChange={(e) => setRefLinks((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))} placeholder="https://…(樣音 / 方向連結)" />
              <button onClick={() => setRefLinks((arr) => arr.filter((_, j) => j !== i))} className="text-gray-400 px-2">✕</button>
            </div>
          ))}
          <button onClick={() => setRefLinks((arr) => [...arr, ''])} className="text-xs text-sky-700 hover:underline">+ 再加一條連結</button>
        </Field>
        <Field label="參考素材 — 檔案(上傳 / 貼客戶直連自動抓進平台)">
          {refFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-gray-700 mb-1">
              <span className="truncate flex-1">📎 {f.name}</span>
              <button onClick={() => setRefFiles((arr) => arr.filter((_, j) => j !== i))} className="text-gray-400">✕</button>
            </div>
          ))}
          <input type="file" disabled={!!working} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
            className="block w-full text-xs text-gray-500 mb-2 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 file:text-xs" />
          <div className="flex gap-2">
            <input className={input} value={fetchUrl} onChange={(e) => setFetchUrl(e.target.value)} placeholder="貼客戶的直接下載連結 → 自動抓進平台" />
            <button onClick={rehostUrl} disabled={!!working} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 rounded-lg whitespace-nowrap">抓進來</button>
          </div>
        </Field>

        {working && <p className="text-xs text-gray-500">{working}</p>}
        {err && <p className="text-red-600 text-sm">{err}</p>}
        <button onClick={goPreview} disabled={busy || !!working} className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-lg px-5 py-2.5 text-sm">
          預覽 →
        </button>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-600 mb-1 block">{label}</span>
      {children}
    </label>
  );
}

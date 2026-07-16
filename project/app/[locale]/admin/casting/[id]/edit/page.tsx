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
import { LANGUAGES, langLabel } from '@/lib/languages';
import { CASE_TIMEZONES } from '@/lib/case-time';

type Role = { name?: string; gender?: string; age?: string; personality?: string; emotion?: string; speed?: string; sample_line?: string; is_lead?: boolean; image?: string };
const input = 'w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500';
// 與發案表單同一套選項(編輯頁補齊,讓幾乎全欄位可編)。
const USAGE_OPTS = ['', '遊戲內', '網路廣告', '電視廣告', '廣播', 'App / 軟體', '社群媒體', '簡報 / 企業內訓', '有聲書 / 平台', '全媒體(所有用途)', '其他'];
const TERRITORY_OPTS = ['', '台灣', '大陸', '港澳', '全球', '北美', '東南亞', '其他'];
const LICENSE_OPTS = ['', '一年', '兩年', '三年', '永久', '買斷', '專案限定'];
const STYLE_OPTS = ['', '對話自然', '旁白沉穩', '權威 / 正式', '溫暖', '活潑 / 年輕', '角色演繹', '不限', '其他'];
const AGE_OPTS = ['', '兒童', '青少年', '青年', '中年', '熟齡', '全年齡 / 不限', '其他'];
const VOICE_COUNTS = ['0', '1', '2', '3', '4', '5+'];
const countLabel = (v: string) => (v === '5+' ? '5 位以上' : `${v} 位`);
const buildGenderNeeds = (male: string, female: string) => [male !== '0' && `男聲 ${countLabel(male)}`, female !== '0' && `女聲 ${countLabel(female)}`].filter(Boolean).join('、');
const parseGenderNeeds = (s?: string | null) => { const t = String(s || ''); const m = /男[聲声]?\s*(\d)/.exec(t); const f = /女[聲声]?\s*(\d)/.exec(t); return { male: m ? m[1] : '0', female: f ? f[1] : '0' }; };
const optEl = (o: string) => <option key={o || '_'} value={o}>{o || '— 不指定 —'}</option>;
const optsWith = (opts: string[], val?: string) => (val && !opts.includes(val) ? [...opts, val] : opts);

export default function EditCasting() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [phase, setPhase] = useState<'loading' | 'notfound' | 'ready'>('loading');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [f, setF] = useState({ title: '', internal_client_note: '', content_type: '', language: '', brief: '', rate_note: '', audition_deadline: '', audition_deadline_time: '', recording_start: '', deadline: '', deadline_time: '', length: '', audition_script: '', base_revisions: '1', audition_cap: '5', accent: '', voice_style: '', voice_age: '', media_scope: '', territory: '', license_term: '', timezone: 'Asia/Taipei' });
  const [maleVoices, setMaleVoices] = useState('0');
  const [femaleVoices, setFemaleVoices] = useState('0');
  // 含唱歌 / 聲音導演 / 線上監錄 / 錄音方式 —— 之前只在發案表單有,編輯頁沒有,導致從客戶請求
  // 帶入時自動勾的(如含唱歌)在此關不掉。補上讓已發佈案件也能改。
  const [hasSinging, setHasSinging] = useState(false);
  const [wantsDirector, setWantsDirector] = useState(false);
  const [wantsLive, setWantsLive] = useState(false);
  const [recMethods, setRecMethods] = useState<Record<string, boolean>>({ home: false, studio: false, online: false });
  const [roles, setRoles] = useState<Role[]>([]);
  const [imgBusy, setImgBusy] = useState<number | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const setRole = (i: number, k: keyof Role, v: string | boolean) => setRoles((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  // ── Direct assignment (managed production): pick roles → assign to a talent
  // (existing or invite by email) with a fixed pay-per-role. Admin-only. ──
  const [talents, setTalents] = useState<{ id: string; name: string; email: string; active?: boolean; no?: number; realNames?: string[] }[]>([]);
  const [talentQ, setTalentQ] = useState('');   // 指派選人搜尋(名字/編號/信箱/真名)
  const [roleQ, setRoleQ] = useState('');       // 角色卡搜尋(遊戲案 50+ 角用)
  const [roleFilter, setRoleFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  // 本案試過音的人(含每人最低報價)—— 指派下拉置頂,選了自動帶報價當派工價。
  const [auditioned, setAuditioned] = useState<{ talent_id: string; name: string; amount?: number; currency?: string }[]>([]);
  // 已指派狀態:角色名 → 指派給誰/酬勞(後台看得到;前台只標「已徵得」不露名)。
  const [assignedRoles, setAssignedRoles] = useState<Record<string, { talent_name: string | null; talent_price?: number | null; pay_unit?: string | null; pay_rate?: number | null; status?: string | null }>>({});
  const [pickRoles, setPickRoles] = useState<Set<string>>(new Set());
  const [assignMode, setAssignMode] = useState<'existing' | 'invite'>('existing');
  const [assignTalent, setAssignTalent] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [pay, setPay] = useState('');
  const [payUnit, setPayUnit] = useState<'per_role' | 'per_line'>('per_role');   // 計價:每角色一口價 / 每句單價×句數(匯台詞時自動算)
  const [inviteLink, setInviteLink] = useState('');   // 邀請新配音員的設定連結(複製丟 LINE 用)
  const [inviteMsgText, setInviteMsgText] = useState('');   // 擬好的整段 LINE 邀請訊息(一鍵複製)
  const [linkCopied, setLinkCopied] = useState(false);
  const [msgCopied, setMsgCopied] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const togglePick = (name: string) => setPickRoles((s) => { const n = new Set(s); if (n.has(name)) n.delete(name); else n.add(name); return n; });

  // 全名冊走 admin 端點(含未上線的真人)。之前誤用公開 /api/talents —— 那個只回
  // voice_id 已驗證的 AI 聲音,下拉整排只剩 Onyx Alpha/Bravo/Delta(2026-07-15 Wing 抓到)。
  useEffect(() => {
    fetch('/api/admin/talents', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((all) => setTalents((Array.isArray(all) ? all : [])
        .filter((t: { type?: string; voice_id_status?: string }) => ['VO', 'voice_actor', 'Singer'].includes(t.type || '') && t.voice_id_status !== 'verified')
        .map((t: { id: string; name?: string; email?: string; is_active?: boolean; talent_no?: number; invite_names?: string[] }) => ({ id: t.id, name: t.name || '(未命名)', email: t.email || '', active: !!t.is_active, no: t.talent_no, realNames: t.invite_names || [] }))
        .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name))))
      .catch(() => {});
  }, []);

  async function assign() {
    const names = [...pickRoles];
    if (!names.length) { setMsg('請先勾選要指派的角色'); return; }
    const payload: { brief_id: string; role_names: string[]; pay_per_role: number; pay_unit: string; talent_id?: string; invite?: { name: string; email: string } } = { brief_id: id, role_names: names, pay_per_role: Number(pay) || 0, pay_unit: payUnit };
    if (assignMode === 'existing') { if (!assignTalent) { setMsg('請選配音員'); return; } payload.talent_id = assignTalent; }
    else { if (!inviteName.trim() && !inviteEmail.trim()) { setMsg('邀請至少填姓名(email 選填,用 LINE 丟連結即可)'); return; } payload.invite = { name: inviteName.trim(), email: inviteEmail.trim() }; }
    setAssigning(true); setMsg('');
    try {
      const res = await fetch('/api/admin/casting/assign', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(j.error || '指派失敗'); return; }
      setPickRoles(new Set()); setPay(''); setInviteName(''); setInviteEmail('');
      load();   // 重載 → 角色卡即時亮「✓ 已指派 · 誰」
      let m = `✓ 已指派 ${j.assigned} 個角色 —— 尚未通知配音員;稿件備妥後到「製作管理」按「發出通知」才會通知+開放查看`;
      if (j.skipped?.length) m += `(跳過 ${j.skipped.length}:已指派過)`;
      if (j.setup_url) {
        m += inviteEmail.trim() ? ` · 已寄設定密碼信` : ` · 邀請連結已產生(下方複製丟 LINE)`;
        setInviteLink(String(j.setup_url));
        // 擬好的 LINE 邀請訊息 —— Wing 一鍵複製整段貼給對方。
        const who = inviteName.trim() ? `${inviteName.trim()} 您好` : '您好';
        const loginLine = j.login_email && !String(j.login_email).endsWith('@invite.onyxstudios.ai')
          ? `\n您的登入帳號:${j.login_email}` : '';
        setInviteMsgText(
          `${who},這裡是 Onyx Studios 配音平台 🎙\n\n` +
          `我們已將《${f.title || '配音案'}》的 ${j.assigned} 個配音角色指派給您。\n\n` +
          `請點下方連結設定密碼開通帳號(24 小時內有效):\n${j.setup_url}\n` +
          `${loginLine}\n` +
          `開通帳號後請先等我們的開錄通知 —— 台詞定稿與參考音備妥後會再通知您,屆時「製作中」就會看到:角色台詞、參考音(可下載)、完成日;錄好直接在頁面上傳即可,請勿提前開錄。\n\n` +
          `如連結過期或有任何問題,直接回覆這則訊息就好。謝謝!`
        );
      }
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
    const j = await res.json().catch(() => ({}));
    const bf = j?.brief;
    if (!bf) { setPhase('notfound'); return; }
    // 本案試音者:每人取最低報價,指派下拉置頂 + 自動帶價。
    {
      const best = new Map<string, { talent_id: string; name: string; amount?: number; currency?: string }>();
      for (const q of (j.quotes || []) as { talent_id?: string; talent_name?: string; gross_amount?: number; currency?: string }[]) {
        if (!q.talent_id) continue;
        const cur = best.get(q.talent_id);
        if (!cur || (q.gross_amount != null && (cur.amount == null || q.gross_amount < cur.amount))) {
          best.set(q.talent_id, { talent_id: q.talent_id, name: q.talent_name || '(未命名)', amount: q.gross_amount ?? cur?.amount, currency: q.currency || cur?.currency });
        }
      }
      setAuditioned([...best.values()].sort((a, b) => a.name.localeCompare(b.name)));
    }
    setAssignedRoles(Object.fromEntries(((j.assigned || []) as { role_name?: string | null; talent_name?: string | null; talent_price?: number | null; pay_unit?: string | null; pay_rate?: number | null; status?: string | null }[])
      .filter((a) => a.role_name)
      .map((a) => [String(a.role_name), { talent_name: a.talent_name || null, talent_price: a.talent_price, pay_unit: a.pay_unit, pay_rate: a.pay_rate, status: a.status }])));
    setF({
      title: bf.title || '', internal_client_note: bf.internal_client_note || '', content_type: bf.content_type || '', language: bf.language || '', brief: bf.brief || '',
      rate_note: bf.rate_note || '', audition_deadline: bf.audition_deadline || '', audition_deadline_time: bf.audition_deadline_time || '', recording_start: bf.recording_start || '',
      deadline: bf.deadline || '', deadline_time: bf.deadline_time || '', length: bf.length || '', audition_script: bf.audition_script || '',
      timezone: bf.timezone || 'Asia/Taipei',
      base_revisions: String(bf.base_revisions ?? 1), audition_cap: String(bf.audition_cap ?? 5),
      accent: bf.accent || '', voice_style: bf.voice_style || '', voice_age: bf.voice_age || '',
      media_scope: bf.media_scope || '', territory: bf.territory || '', license_term: bf.license_term || '',
    });
    { const g = parseGenderNeeds(bf.gender_needs); setMaleVoices(g.male); setFemaleVoices(g.female); }
    setHasSinging(!!bf.has_singing); setWantsDirector(!!bf.wants_director); setWantsLive(!!bf.wants_live_session);
    setRecMethods({ home: false, studio: false, online: false, ...Object.fromEntries((Array.isArray(bf.recording_methods) ? bf.recording_methods : []).map((k: string) => [k, true])) });
    setRoles(Array.isArray(bf.roles) ? bf.roles : []);
    setPhase('ready');
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    setMsg(''); setSaving(true);
    const res = await fetch('/api/admin/casting', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ id, edit: { ...f, base_revisions: Number(f.base_revisions) || 0, audition_cap: Number(f.audition_cap) || 5, roles, has_singing: hasSinging, wants_director: wantsDirector, wants_live_session: wantsLive, recording_methods: Object.keys(recMethods).filter((k) => recMethods[k]), gender_needs: buildGenderNeeds(maleVoices, femaleVoices) } }),
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
        <label className="block"><span className="text-xs text-gray-600 mb-1 block">客戶(內部備註,配音員和前台都看不到)</span><input className={input} value={f.internal_client_note} onChange={(e) => set('internal_client_note', e.target.value)} placeholder="例:WeChat 客戶 王經理 · 上海XX網絡 · 微信ID xxx" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-xs text-gray-600 mb-1 block">語言</span>
            <select className={input} value={f.language} onChange={(e) => set('language', e.target.value)}>
              {f.language && !LANGUAGES.some((o) => o.v === f.language) && <option value={f.language}>{f.language}(舊值)</option>}
              {LANGUAGES.map((o) => <option key={o.v} value={o.v}>{o.tw}</option>)}
            </select>
          </label>
          <label className="block"><span className="text-xs text-gray-600 mb-1 block">報酬</span><input className={input} value={f.rate_note} onChange={(e) => set('rate_note', e.target.value)} placeholder="例:NT$150 / 句" /></label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className="block"><span className="text-xs text-gray-600 mb-1 block">類別</span><input className={input} value={f.content_type} onChange={(e) => set('content_type', e.target.value)} placeholder="例:旁白 Narration" /></label>
          <label className="block"><span className="text-xs text-gray-600 mb-1 block">需求 男聲</span><select className={input} value={maleVoices} onChange={(e) => setMaleVoices(e.target.value)}>{VOICE_COUNTS.map((v) => <option key={v} value={v}>{v === '0' ? '不指定' : countLabel(v)}</option>)}</select></label>
          <label className="block"><span className="text-xs text-gray-600 mb-1 block">需求 女聲</span><select className={input} value={femaleVoices} onChange={(e) => setFemaleVoices(e.target.value)}>{VOICE_COUNTS.map((v) => <option key={v} value={v}>{v === '0' ? '不指定' : countLabel(v)}</option>)}</select></label>
        </div>
        <label className="block"><span className="text-xs text-gray-600 mb-1 block">案件說明</span><textarea className={`${input} min-h-[80px] resize-y`} value={f.brief} onChange={(e) => set('brief', e.target.value)} /></label>
        <div className="grid grid-cols-3 gap-3">
          <label className="block"><span className="text-xs text-gray-600 mb-1 block">口音</span><select className={input} value={f.accent} onChange={(e) => set('accent', e.target.value)}>{optsWith(['', '中文 · 台灣國語', '中文 · 大陸普通話', '粵語', '台語', '英語', '日語', '不限', '其他'], f.accent).map(optEl)}</select></label>
          <label className="block"><span className="text-xs text-gray-600 mb-1 block">聲音風格</span><select className={input} value={f.voice_style} onChange={(e) => set('voice_style', e.target.value)}>{optsWith(STYLE_OPTS, f.voice_style).map(optEl)}</select></label>
          <label className="block"><span className="text-xs text-gray-600 mb-1 block">聲音年齡</span><select className={input} value={f.voice_age} onChange={(e) => set('voice_age', e.target.value)}>{optsWith(AGE_OPTS, f.voice_age).map(optEl)}</select></label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className="block"><span className="text-xs text-gray-600 mb-1 block">使用範圍</span><select className={input} value={f.media_scope} onChange={(e) => set('media_scope', e.target.value)}>{optsWith(USAGE_OPTS, f.media_scope).map(optEl)}</select></label>
          <label className="block"><span className="text-xs text-gray-600 mb-1 block">地區</span><select className={input} value={f.territory} onChange={(e) => set('territory', e.target.value)}>{optsWith(TERRITORY_OPTS, f.territory).map(optEl)}</select></label>
          <label className="block"><span className="text-xs text-gray-600 mb-1 block">授權期</span><select className={input} value={f.license_term} onChange={(e) => set('license_term', e.target.value)}>{optsWith(LICENSE_OPTS, f.license_term).map(optEl)}</select></label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className="block"><span className="text-xs text-gray-600 mb-1 block">試音截止(時間選填;不填=當天 23:59,案件時區)</span>
            <div className="flex gap-2">
              <input type="date" className={`${input} [color-scheme:light]`} value={f.audition_deadline} onChange={(e) => set('audition_deadline', e.target.value)} />
              <input type="time" className={`${input} [color-scheme:light] w-32`} value={f.audition_deadline_time} onChange={(e) => set('audition_deadline_time', e.target.value)} />
            </div></label>
          <label className="block"><span className="text-xs text-gray-600 mb-1 block">交付截止(時間選填)</span>
            <div className="flex gap-2">
              <input type="date" className={`${input} [color-scheme:light]`} value={f.deadline} onChange={(e) => set('deadline', e.target.value)} />
              <input type="time" className={`${input} [color-scheme:light] w-32`} value={f.deadline_time} onChange={(e) => set('deadline_time', e.target.value)} />
            </div></label>
          <label className="block"><span className="text-xs text-gray-600 mb-1 block">規模</span><input className={input} value={f.length} onChange={(e) => set('length', e.target.value)} /></label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className="block"><span className="text-xs text-gray-600 mb-1 block">預計開錄</span><input className={input} value={f.recording_start} onChange={(e) => set('recording_start', e.target.value)} placeholder="例:8月" /></label>
          <label className="block"><span className="text-xs text-gray-600 mb-1 block">案件時區(全案時間溝通以此為準)</span>
            <select className={input} value={f.timezone} onChange={(e) => set('timezone', e.target.value)}>
              {CASE_TIMEZONES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
            </select></label>
          <label className="block"><span className="text-xs text-gray-600 mb-1 block">含修改次數</span><input type="number" min={0} className={input} value={f.base_revisions} onChange={(e) => set('base_revisions', e.target.value)} /></label>
          <label className="block"><span className="text-xs text-gray-600 mb-1 block">熱門門檻(人數提示)</span><input type="number" min={1} className={input} value={f.audition_cap} onChange={(e) => set('audition_cap', e.target.value)} /></label>
        </div>
        <label className="block"><span className="text-xs text-gray-600 mb-1 block">試音方向 / 聲音方向(選填)</span><textarea className={`${input} min-h-[60px] resize-y`} value={f.audition_script} onChange={(e) => set('audition_script', e.target.value)} /></label>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-700 pt-1">
          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={hasSinging} onChange={(e) => setHasSinging(e.target.checked)} className="accent-amber-500" /> 含唱歌</label>
          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={wantsDirector} onChange={(e) => setWantsDirector(e.target.checked)} className="accent-amber-500" /> 需要聲音導演</label>
          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={wantsLive} onChange={(e) => setWantsLive(e.target.checked)} className="accent-amber-500" /> 線上監錄</label>
          <span className="text-gray-300">|</span>
          <span className="text-xs text-gray-500">錄音方式:</span>
          {([['home', '在家錄'], ['studio', '錄音室'], ['online', '線上']] as const).map(([k, label]) => (
            <label key={k} className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!recMethods[k]} onChange={(e) => setRecMethods((m) => ({ ...m, [k]: e.target.checked }))} className="accent-amber-500" /> {label}</label>
          ))}
        </div>
      </div>

      {roles.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold">角色 · 逐角修正台詞</h2>
            <span className="text-xs text-gray-500">共 {roles.length} 角</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            <input className={`${input} w-52`} value={roleQ} placeholder="搜角色名…" onChange={(e) => setRoleQ(e.target.value)} />
            {([['all', '全部'], ['unassigned', '未指派'], ['assigned', '已指派']] as const).map(([v, label]) => (
              <button key={v} type="button" onClick={() => setRoleFilter(v)} className={`text-xs px-3 py-1.5 rounded-full border ${roleFilter === v ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-300'}`}>{label}</button>
            ))}
            {(roleQ || roleFilter !== 'all') && <span className="text-xs text-gray-500">符合 {roles.filter((r) => (!roleQ || String(r.name || '').includes(roleQ.trim())) && (roleFilter === 'all' || (roleFilter === 'assigned') === !!(r.name && assignedRoles[r.name]))).length} 角</span>}
          </div>
          <div className="space-y-3">
            {roles.map((r, i) => ({ r, i })).filter(({ r }) =>
              (!roleQ || String(r.name || '').includes(roleQ.trim()))
              && (roleFilter === 'all' || (roleFilter === 'assigned') === !!(r.name && assignedRoles[r.name]))
            ).map(({ r, i }) => {
              const asg = r.name ? assignedRoles[r.name] : undefined;
              return (
              <div key={i} className={`relative flex gap-3 bg-white border rounded-xl p-4 ${asg ? 'border-green-300' : r.name && pickRoles.has(r.name) ? 'border-violet-400 ring-1 ring-violet-200' : 'border-gray-200'}`}>
                {asg && (
                  <span className="absolute top-2 right-2 whitespace-nowrap text-[11px] bg-green-100 text-green-800 border border-green-300 rounded-full px-2.5 py-0.5">
                    ✓ 已指派 · {asg.talent_name || '—'}{asg.pay_unit === 'per_line' && asg.pay_rate ? ` · ${asg.pay_rate}/句` : asg.talent_price ? ` · NT$${asg.talent_price}` : ''}
                  </span>
                )}
                <label className="flex items-start pt-1" title={asg ? `已指派給 ${asg.talent_name || ''}` : r.name ? '選取以指派' : '先填角色名才能指派'}>
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
            );})}
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
                <div className="block">
                  <span className="text-xs text-gray-600 mb-1 block">配音員(可搜名字/編號/信箱/真名;⭐試音者置頂)</span>
                  {(() => {
                    // 標示格式:名字(T-編號)· 信箱 · 真名 —— 同名(8 個 Ryan)也永遠分得開。
                    const label = (t: { name: string; email: string; active?: boolean; no?: number; realNames?: string[] }) =>
                      `${t.name}${t.no ? `(T-${t.no})` : ''} · ${t.email.split('@')[0]}${t.realNames?.length ? ` · 真名:${t.realNames.join('/')}` : ''}${t.active === false ? ' · 未上線' : ''}`;
                    const hit = (t: { name: string; email: string; no?: number; realNames?: string[] }) => {
                      const q = talentQ.trim().toLowerCase();
                      if (!q) return true;
                      return [t.name, t.email, t.no != null ? `t-${t.no}` : '', String(t.no ?? ''), ...(t.realNames || [])].some((v) => String(v).toLowerCase().includes(q));
                    };
                    const byId = new Map(talents.map((t) => [t.id, t]));
                    const audList = auditioned.filter((a) => hit(byId.get(a.talent_id) || { name: a.name, email: '' }));
                    const restList = talents.filter((t) => !auditioned.some((a) => a.talent_id === t.id) && hit(t));
                    const sel = byId.get(assignTalent);
                    return (
                      <>
                        <div className="flex gap-1.5 flex-wrap items-start">
                          <input className={`${input} w-40`} value={talentQ} placeholder="搜尋…" onChange={(e) => setTalentQ(e.target.value)} />
                          <select className={`${input} min-w-[300px] max-w-[420px]`} value={assignTalent} onChange={(e) => {
                            setAssignTalent(e.target.value);
                            const a = auditioned.find((x) => x.talent_id === e.target.value);
                            if (a?.amount != null) setPay(String(a.amount));   // 試音者 → 自動帶他的報價(可改)
                          }}>
                            <option value="">— 選一位({audList.length + restList.length})—</option>
                            {audList.length > 0 && (
                              <optgroup label={`⭐ 本案有試音(${audList.length})`}>
                                {audList.map((a) => { const t = byId.get(a.talent_id); return <option key={a.talent_id} value={a.talent_id}>{t ? label(t) : a.name}{a.amount != null ? ` — 報價 ${a.currency || ''}${a.amount}` : ''}</option>; })}
                              </optgroup>
                            )}
                            <optgroup label={`其他配音員(未試音,含未上線)(${restList.length})`}>
                              {restList.map((t) => <option key={t.id} value={t.id}>{label(t)}</option>)}
                            </optgroup>
                          </select>
                        </div>
                        {sel && (
                          <div className="mt-1.5 text-[11px] bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-1.5 text-violet-900">
                            即將指派給:<b>{sel.name}</b>{sel.no ? `(T-${sel.no})` : ''} · {sel.email}{sel.realNames?.length ? ` · 真名:${sel.realNames.join('/')}` : ''}{sel.active === false ? ' · 未上線' : ''}{auditioned.some((a) => a.talent_id === sel.id) ? ' · ⭐本案有試音' : ' · ⚠ 本案未試音'}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : (
                <>
                  <label className="block"><span className="text-xs text-gray-600 mb-1 block">姓名</span><input className={`${input} w-36`} value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="配音員姓名" /></label>
                  <label className="block"><span className="text-xs text-gray-600 mb-1 block">Email(選填 —— 用 LINE 丟連結可留空)</span><input className={`${input} w-52`} value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="留空=純用邀請連結" /></label>
                </>
              )}
              <label className="block"><span className="text-xs text-gray-600 mb-1 block">計價方式</span>
                <select className={`${input} w-32`} value={payUnit} onChange={(e) => setPayUnit(e.target.value as 'per_role' | 'per_line')}>
                  <option value="per_role">每角色一口價</option>
                  <option value="per_line">每句計價</option>
                </select>
              </label>
              <label className="block"><span className="text-xs text-gray-600 mb-1 block">{payUnit === 'per_line' ? '每句單價' : '每角派工價'}</span><input type="number" className={`${input} w-28`} value={pay} onChange={(e) => setPay(e.target.value)} placeholder="NT$" /></label>
              {payUnit === 'per_line' && <p className="text-[11px] text-violet-700 self-end pb-2.5">酬勞=單價×句數,匯入台詞表時自動算(例:150×10句=1,500)</p>}
              <button onClick={assign} disabled={assigning || !pickRoles.size} className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold rounded-lg px-5 py-2 text-sm">{assigning ? '指派中…' : `指派選取的 ${pickRoles.size} 角`}</button>
            </div>
            {assignMode === 'invite' && <p className="text-[11px] text-gray-500 mt-2">邀請新人:會自動建帳號 + 寄設定密碼信;他登入後就看到被指派的角色,之後也能補完檔案送審成為正式配音員。指派後下方會出現<span className="font-medium text-violet-700">邀請連結</span>,可直接複製丟 LINE。</p>}
            {inviteLink && (
              <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-3">
                <p className="text-xs font-medium text-violet-800 mb-1.5">邀請連結(用 LINE / 微信直接丟給他 —— 點開設定密碼就能看到被指派的角色;連結 24 小時內有效,過期再指派一次即可重發)</p>
                <div className="flex items-center gap-2 mb-2">
                  <input readOnly value={inviteLink} onFocus={(e) => e.target.select()}
                    className="flex-1 bg-white border border-violet-200 rounded px-2 py-1.5 text-xs text-gray-700 font-mono" />
                  <button onClick={() => { navigator.clipboard?.writeText(inviteLink); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 1500); }}
                    className="text-xs bg-white hover:bg-violet-100 text-violet-700 border border-violet-300 rounded px-3 py-1.5 whitespace-nowrap">{linkCopied ? '已複製 ✓' : '只複製連結'}</button>
                </div>
                {inviteMsgText && (
                  <>
                    <textarea readOnly value={inviteMsgText} onFocus={(e) => e.target.select()}
                      className="w-full bg-white border border-violet-200 rounded px-2.5 py-2 text-xs text-gray-700 min-h-[140px] resize-y mb-1.5" />
                    <button onClick={() => { navigator.clipboard?.writeText(inviteMsgText); setMsgCopied(true); setTimeout(() => setMsgCopied(false), 1500); }}
                      className="text-xs bg-violet-600 hover:bg-violet-500 text-white rounded px-4 py-1.5 whitespace-nowrap">{msgCopied ? '已複製 ✓ 直接貼 LINE' : '📋 複製整段 LINE 訊息'}</button>
                  </>
                )}
              </div>
            )}
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

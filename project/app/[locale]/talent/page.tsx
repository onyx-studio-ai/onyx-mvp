'use client';

/*
  Talent self-service profile — Spotify-style.

  Self-contained auth gate (inline email+password login). Once in, loads the
  talent's own DRAFT from /api/talent/me and lets them edit a photo, bio,
  languages, voice traits, specialties, categorized demos and contact/work
  details. Edits save to the draft and flip pending_review — nothing reaches the
  public roster until an admin republishes (draft/publish model).

  Rules enforced here (and again server-side):
  - Photo is cropped to a square + compressed to JPEG client-side before upload.
  - Demos are MP3-only, ≤ 3 min, grouped by category; max 2 per category except
    game characters (unlimited).
  - Every claimed language must have at least one demo in that language.
  Service classification (AI Voice / TTS / Proofreading) is Onyx-managed, shown
  read-only. Tri-lingual via the site-wide useLocale()+tx() idiom.
*/

import { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Camera, Plus, Trash2, CheckCircle2, Clock, Music2 } from 'lucide-react';
import {
  VOICE_TRAITS, USE_CASES, pickLabel, demoLimit, DEMO_UNLIMITED, DEMO_MAX_SECONDS, type DemoItem,
} from '@/lib/talent-taxonomy';

const LANG_OPTIONS = [
  { v: 'Chinese · Taiwan', tw: '中文 · 台灣', cn: '中文 · 台湾' },
  { v: 'Cantonese · Hong Kong', tw: '中文 · 香港粵語', cn: '中文 · 香港粤语' },
  { v: 'Mandarin · Mainland', tw: '中文 · 普通話 / 大陸', cn: '中文 · 普通话 / 大陆' },
  { v: 'Mandarin · Malaysia', tw: '中文 · 馬來西亞', cn: '中文 · 马来西亚' },
  { v: 'English · American', tw: '英文 · 美國', cn: '英文 · 美国' },
  { v: 'English · British', tw: '英文 · 英國', cn: '英文 · 英国' },
  { v: 'English · Australian', tw: '英文 · 澳洲', cn: '英文 · 澳洲' },
  { v: 'English · Indian', tw: '英文 · 印度', cn: '英文 · 印度' },
  { v: 'English · Singapore', tw: '英文 · 新加坡', cn: '英文 · 新加坡' },
  { v: 'Japanese', tw: '日文', cn: '日文' },
  { v: 'Korean', tw: '韓文', cn: '韩文' },
  { v: 'Taiwanese Hokkien', tw: '台語', cn: '台语' },
  { v: 'Hakka', tw: '客家話', cn: '客家话' },
  { v: 'Vietnamese', tw: '越南文', cn: '越南文' },
  { v: 'Indonesian', tw: '印尼文', cn: '印尼文' },
  { v: 'Thai', tw: '泰文', cn: '泰文' },
  { v: 'Malay', tw: '馬來文', cn: '马来文' },
  { v: 'Spanish', tw: '西班牙文', cn: '西班牙文' },
  { v: 'French · France', tw: '法文 · 法國', cn: '法文 · 法国' },
];
const GENDER_OPTIONS = [
  { v: 'Male', tw: '男', cn: '男' },
  { v: 'Female', tw: '女', cn: '女' },
  { v: 'Other', tw: '其他', cn: '其他' },
];
const SERVICE_TAGS = new Set(['AI Voice', 'TTS Data', 'Proofreading']);
const SERVICE_LABEL: Record<string, { tw: string; cn: string; en: string }> = {
  'AI Voice': { tw: 'AI 聲音', cn: 'AI 声音', en: 'AI Voice' },
  'TTS Data': { tw: 'TTS 訓練', cn: 'TTS 训练', en: 'TTS Data' },
  'Proofreading': { tw: '語音校對', cn: '语音校对', en: 'Proofreading' },
};

type Talent = {
  id: string; name: string; bio: string | null; languages: string[] | null;
  accent: string | null; gender: string | null; tags: string[] | null;
  voice_traits: string[] | null; specialties: string[] | null; demos: DemoItem[] | null;
  headshot_url: string | null; location: string | null; availability_note: string | null;
  credits: string | null; equipment: string | null; studio_partner: string | null;
  type: string; email: string | null; is_active: boolean; pending_review: boolean;
  liveness_status: string | null;
};
type ListField = 'voice_traits' | 'specialties';
type Form = {
  name: string; bio: string; accent: string; gender: string; location: string;
  availability_note: string; credits: string; equipment: string; studio_partner: string;
  languages: string[]; voice_traits: string[]; specialties: string[];
  headshot_url: string; demos: DemoItem[];
};

const inputCls =
  'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-400/60 transition';

// Center-crop to a square + downscale + JPEG compress, all client-side, so only
// one small uniform file ever hits storage.
function cropSquareJpeg(file: File, size = 512, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas unsupported'));
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('compression failed'))), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('could not read image')); };
    img.src = url;
  });
}
function audioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const a = document.createElement('audio');
    a.preload = 'metadata';
    a.onloadedmetadata = () => { resolve(a.duration || 0); URL.revokeObjectURL(a.src); };
    a.onerror = () => resolve(0);
    a.src = URL.createObjectURL(file);
  });
}

export default function TalentDashboard() {
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);
  const lbl = (o: { v: string; tw: string; cn: string }) => (isZhCN ? o.cn : isZh ? o.tw : o.v);
  const langLabel = (v: string) => { const o = LANG_OPTIONS.find((x) => x.v === v); return o ? lbl(o) : v; };

  const [phase, setPhase] = useState<'loading' | 'login' | 'dashboard' | 'notalent'>('loading');
  const [token, setToken] = useState('');
  const [t, setT] = useState<Talent | null>(null);
  const [form, setForm] = useState<Form>({
    name: '', bio: '', accent: '', gender: '', location: '', availability_note: '', credits: '',
    equipment: '', studio_partner: '', languages: [], voice_traits: [], specialties: [], headshot_url: '', demos: [],
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [langQ, setLangQ] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState('');
  const [uploadingCat, setUploadingCat] = useState('');
  const [uploadErr, setUploadErr] = useState('');

  const loadProfile = useCallback(async (accessToken: string) => {
    setToken(accessToken);
    const res = await fetch('/api/talent/me', { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.status === 404) return setPhase('notalent');
    if (!res.ok) return setPhase('login');
    const { talent } = (await res.json()) as { talent: Talent };
    setT(talent);
    setForm({
      name: talent.name || '', bio: talent.bio || '', accent: talent.accent || '', gender: talent.gender || '',
      location: talent.location || '', availability_note: talent.availability_note || '', credits: talent.credits || '',
      equipment: talent.equipment || '', studio_partner: talent.studio_partner || '',
      languages: Array.isArray(talent.languages) ? talent.languages : [],
      voice_traits: Array.isArray(talent.voice_traits) ? talent.voice_traits : [],
      specialties: Array.isArray(talent.specialties) ? talent.specialties : [],
      headshot_url: talent.headshot_url || '',
      demos: Array.isArray(talent.demos) ? talent.demos : [],
    });
    setPhase('dashboard');
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) await loadProfile(data.session.access_token);
      else setPhase('login');
    })();
  }, [loadProfile]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setLoginErr('');
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error || !data.session) {
      setLoginErr(tx('帳號或密碼錯誤,請再試一次。', '账号或密码错误,请再试一次。', 'Incorrect email or password. Please try again.'));
      return;
    }
    await loadProfile(data.session.access_token);
  }

  // Languages missing a demo — blocks save (the "can't claim what we can't hear" rule).
  const demoLangs = new Set(form.demos.map((d) => d.language).filter(Boolean));
  const langsMissingDemo = form.languages.filter((l) => !demoLangs.has(l));

  async function handleSave() {
    if (langsMissingDemo.length > 0) {
      setSaveErr(tx(
        `這些語言還沒有對應的 demo,請先上傳:${langsMissingDemo.map(langLabel).join('、')}`,
        `这些语言还没有对应的 demo,请先上传:${langsMissingDemo.map(langLabel).join('、')}`,
        `These languages need a demo first: ${langsMissingDemo.map(langLabel).join(', ')}`,
      ));
      return;
    }
    setBusy(true); setSaved(false); setSaveErr('');
    const res = await fetch('/api/talent/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: form.name, bio: form.bio, accent: form.accent, gender: form.gender, location: form.location,
        availability_note: form.availability_note, credits: form.credits, equipment: form.equipment,
        studio_partner: form.studio_partner, languages: form.languages, voice_traits: form.voice_traits,
        specialties: form.specialties, headshot_url: form.headshot_url, demos: form.demos,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      if (j.error === 'language_without_demo') {
        setSaveErr(tx(
          `這些語言還沒有對應的 demo:${(j.languages || []).map(langLabel).join('、')}`,
          `这些语言还没有对应的 demo:${(j.languages || []).map(langLabel).join('、')}`,
          `These languages need a demo: ${(j.languages || []).map(langLabel).join(', ')}`,
        ));
      } else {
        setSaveErr(j.error || tx('儲存失敗,請稍後再試。', '保存失败,请稍后再试。', 'Save failed. Please try again.'));
      }
      return;
    }
    const { talent } = await res.json();
    setT((prev) => (prev ? { ...prev, ...talent } : prev));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleLogout() { await supabase.auth.signOut(); setT(null); setPhase('login'); }

  async function handlePhoto(file: File) {
    setPhotoErr(''); setPhotoBusy(true);
    try {
      const blob = await cropSquareJpeg(file);
      const res = await fetch('/api/talent/photo-upload-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: '{}',
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'upload prep failed');
      const up = await supabase.storage.from('talent-photos').uploadToSignedUrl(j.path, j.token, blob, { contentType: 'image/jpeg' });
      if (up.error) throw new Error(up.error.message);
      setForm((f) => ({ ...f, headshot_url: j.publicUrl }));
    } catch (e) {
      setPhotoErr(e instanceof Error ? e.message : tx('上傳失敗', '上传失败', 'Upload failed'));
    } finally { setPhotoBusy(false); }
  }

  async function handleDemoUpload(file: File, categoryKey: string) {
    setUploadErr('');
    if (!/\.mp3$/i.test(file.name)) { setUploadErr(tx('只接受 MP3 檔', '只接受 MP3 文件', 'MP3 files only')); return; }
    const count = form.demos.filter((d) => d.category === categoryKey).length;
    if (count >= demoLimit(categoryKey)) { setUploadErr(tx(`這類最多 ${demoLimit(categoryKey)} 個`, `这类最多 ${demoLimit(categoryKey)} 个`, `Max ${demoLimit(categoryKey)} in this category`)); return; }
    const secs = await audioDuration(file);
    if (secs > DEMO_MAX_SECONDS + 1) { setUploadErr(tx('單檔不可超過 3 分鐘', '单档不可超过 3 分钟', 'Each demo must be under 3 minutes')); return; }
    setUploadingCat(categoryKey);
    try {
      const res = await fetch('/api/talent/demo-upload-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fileName: file.name }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'upload prep failed');
      const up = await supabase.storage.from('talent-demos').uploadToSignedUrl(j.path, j.token, file);
      if (up.error) throw new Error(up.error.message);
      setForm((f) => ({
        ...f,
        demos: [...f.demos, { category: categoryKey, name: file.name.replace(/\.mp3$/i, ''), url: j.publicUrl, language: f.languages[0] || '', seconds: Math.round(secs) }],
      }));
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : tx('上傳失敗', '上传失败', 'Upload failed'));
    } finally { setUploadingCat(''); }
  }

  const updateDemo = (url: string, patch: Partial<DemoItem>) =>
    setForm((f) => ({ ...f, demos: f.demos.map((d) => (d.url === url ? { ...d, ...patch } : d)) }));
  const removeDemo = (url: string) => setForm((f) => ({ ...f, demos: f.demos.filter((d) => d.url !== url) }));
  const toggleList = (field: ListField, key: string) =>
    setForm((f) => ({ ...f, [field]: f[field].includes(key) ? f[field].filter((x) => x !== key) : [...f[field], key] }));
  const addLang = (v: string) => { if (v && !form.languages.includes(v)) setForm((f) => ({ ...f, languages: [...f.languages, v] })); setLangQ(''); };
  const removeLang = (v: string) => setForm((f) => ({ ...f, languages: f.languages.filter((x) => x !== v) }));

  // -------- render --------
  const shell = (inner: React.ReactNode, wide = false) => (
    <main className="min-h-screen bg-black text-white px-4 py-12">
      <div className={`${wide ? 'max-w-3xl' : 'max-w-sm'} mx-auto`}>{inner}</div>
    </main>
  );

  if (phase === 'loading') return shell(<p className="text-gray-500 text-sm text-center py-20">{tx('載入中…', '加载中…', 'Loading…')}</p>);

  if (phase === 'notalent') return shell(
    <div className="text-center py-16">
      <h1 className="text-xl font-semibold mb-3">{tx('這裡是配音員後台', '这里是配音员后台', 'Talent area')}</h1>
      <p className="text-gray-400 text-sm mb-6">{tx('此登入帳號尚未連結配音員檔案。如有疑問,請聯絡 hello@onyxstudios.ai。', '此登录账号尚未关联配音员资料。如有疑问,请联系 hello@onyxstudios.ai。', 'This account is not linked to a talent profile. If you think this is a mistake, contact hello@onyxstudios.ai.')}</p>
      <button onClick={handleLogout} className="text-sm text-amber-400 hover:underline">{tx('登出', '登出', 'Sign out')}</button>
    </div>
  );

  if (phase === 'login') return shell(
    <div className="pt-8">
      <h1 className="text-2xl font-semibold mb-1">{tx('配音員後台', '配音员后台', 'Talent Dashboard')}</h1>
      <p className="text-gray-400 text-sm mb-8">{tx('登入以管理您的個人檔案。', '登录以管理您的个人资料。', 'Sign in to manage your profile.')}</p>
      <form onSubmit={handleLogin} className="space-y-3">
        <input type="email" className={inputCls} placeholder={tx('電子郵件', '电子邮件', 'Email')} value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" className={inputCls} placeholder={tx('密碼', '密码', 'Password')} value={password} onChange={(e) => setPassword(e.target.value)} required />
        {loginErr && <p className="text-red-400 text-xs">{loginErr}</p>}
        <button type="submit" disabled={busy} className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold rounded-lg py-2.5 text-sm transition">
          {busy ? tx('登入中…', '登录中…', 'Signing in…') : tx('登入', '登录', 'Sign in')}
        </button>
      </form>
      <p className="text-gray-500 text-xs mt-6 leading-relaxed">{tx('第一次登入?請點開我們寄給您的「設定密碼」信件設定密碼。忘記密碼也可由該流程重設。', '第一次登录?请打开我们发送给您的「设置密码」邮件设置密码。忘记密码也可由该流程重置。', 'First time? Open the “Set Password” email we sent you to create your password. Forgot it? Use the same flow to reset.')}</p>
    </div>
  );

  // ---- dashboard ----
  const serviceTags = (Array.isArray(t?.tags) ? t!.tags : []).filter((x) => SERVICE_TAGS.has(x));
  const langMatches = langQ.trim()
    ? LANG_OPTIONS.filter((o) => !form.languages.includes(o.v) && lbl(o).toLowerCase().includes(langQ.trim().toLowerCase()))
    : [];
  const canAddCustom = !!langQ.trim() && !LANG_OPTIONS.some((o) => lbl(o) === langQ.trim()) && !form.languages.includes(langQ.trim());

  const statusBadge = !t?.is_active
    ? { cls: 'bg-amber-500/15 text-amber-300', icon: <Clock className="w-3.5 h-3.5" />, text: tx('審核中 · 尚未公開', '审核中 · 尚未公开', 'In review · not public yet') }
    : t?.pending_review
      ? { cls: 'bg-amber-500/15 text-amber-300', icon: <Clock className="w-3.5 h-3.5" />, text: tx('已上線 · 有修改待審核', '已上线 · 有修改待审核', 'Live · changes pending review') }
      : { cls: 'bg-emerald-500/15 text-emerald-300', icon: <CheckCircle2 className="w-3.5 h-3.5" />, text: tx('已上線', '已上线', 'Live on roster') };

  const livenessBadge = t?.liveness_status === 'verified'
    ? { cls: 'bg-emerald-500/15 text-emerald-300', text: tx('✓ 真人已驗證', '✓ 真人已验证', '✓ Human verified') }
    : t?.liveness_status === 'sent' || t?.liveness_status === 'submitted'
      ? { cls: 'bg-sky-500/15 text-sky-300', text: tx('真人驗證進行中', '真人验证进行中', 'Verification in progress') }
      : null;

  const sectionCls = 'bg-white/[0.02] border border-white/10 rounded-2xl p-5';
  const labelCls = 'block text-sm font-semibold text-gray-200 mb-2';

  return shell(
    <>
      {/* Spotify-style header */}
      <div className="flex items-end gap-5 mb-6">
        <div className="relative w-28 h-28 rounded-2xl overflow-hidden bg-zinc-800 shrink-0">
          {form.headshot_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.headshot_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600 text-3xl font-semibold">{(form.name || '?').charAt(0).toUpperCase()}</div>
          )}
          <label className={`absolute inset-x-0 bottom-0 py-1.5 text-center text-[11px] cursor-pointer bg-black/55 hover:bg-black/70 transition ${photoBusy ? 'opacity-60' : ''}`}>
            <input type="file" accept="image/*" className="hidden" disabled={photoBusy} onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ''; if (f) handlePhoto(f); }} />
            <Camera className="w-3 h-3 inline -mt-0.5 mr-1" />{photoBusy ? tx('上傳中…', '上传中…', 'Uploading…') : tx('換照片', '换照片', 'Photo')}
          </label>
        </div>
        <div className="flex-1 min-w-0 pb-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full ${statusBadge.cls}`}>{statusBadge.icon}{statusBadge.text}</span>
            {livenessBadge && <span className={`text-[11px] px-2.5 py-1 rounded-full ${livenessBadge.cls}`}>{livenessBadge.text}</span>}
          </div>
          <input className="w-full bg-transparent text-2xl font-bold focus:outline-none focus:border-b focus:border-white/20 pb-0.5" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={tx('顯示名稱', '显示名称', 'Display name')} />
          <p className="text-xs text-gray-500 mt-1.5">{t?.email}</p>
        </div>
      </div>
      {photoErr && <p className="text-red-400 text-xs mb-3 -mt-2">{photoErr}</p>}

      <p className="text-xs text-gray-500 mb-5">{tx('編輯後按「儲存變更」會送出審核;通過後才會更新到公開頁面。', '编辑后按「保存更改」会送出审核;通过后才会更新到公开页面。', 'Changes go to review when you save — they go public after approval.')}</p>

      <div className="space-y-4">
        {/* Bio */}
        <div className={sectionCls}>
          <label className={labelCls}>{tx('個人簡介', '个人简介', 'Bio')}</label>
          <textarea className={`${inputCls} min-h-[100px] resize-y`} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder={tx('用您的語言寫即可,上線時我們會翻成其他語言。例如:溫暖知性的女聲,擅長廣告與旁白…', '用您的语言写即可,上线时我们会翻成其他语言。例如:温暖知性的女声,擅长广告与旁白…', 'Write in your own language — we translate it at publish. e.g. Warm, articulate voice, great for ads and narration…')} />
        </div>

        {/* Voice traits + specialties */}
        <div className={sectionCls}>
          <label className={labelCls}>{tx('聲線特質', '声线特质', 'Voice traits')}</label>
          <div className="flex flex-wrap gap-2 mb-5">
            {VOICE_TRAITS.map((o) => {
              const on = form.voice_traits.includes(o.key);
              return <button key={o.key} type="button" onClick={() => toggleList('voice_traits', o.key)} className={`text-xs px-3 py-1.5 rounded-full border transition ${on ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>{pickLabel(o, locale)}</button>;
            })}
          </div>
          <label className={labelCls}>{tx('專長類型', '专长类型', 'Specialties')}</label>
          <div className="flex flex-wrap gap-2">
            {USE_CASES.map((o) => {
              const on = form.specialties.includes(o.key);
              return <button key={o.key} type="button" onClick={() => toggleList('specialties', o.key)} className={`text-xs px-3 py-1.5 rounded-full border transition ${on ? 'bg-violet-500/20 border-violet-400/40 text-violet-200' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>{pickLabel(o, locale)}</button>;
            })}
          </div>
        </div>

        {/* Languages */}
        <div className={sectionCls}>
          <label className={labelCls}>{tx('可配語言與口音', '可配语言与口音', 'Languages & accents')}</label>
          <p className="text-xs text-gray-500 mb-2.5">{tx('每個語言都要有一段該語言的 demo 才能掛上。', '每个语言都要有一段该语言的 demo 才能挂上。', 'Each language needs at least one demo in it.')}</p>
          {form.languages.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {form.languages.map((v) => {
                const ok = demoLangs.has(v);
                return (
                  <span key={v} className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${ok ? 'bg-amber-500/15 text-amber-200' : 'bg-red-500/15 text-red-300'}`}>
                    {langLabel(v)}{!ok && <span className="text-[10px]">{tx('缺 demo', '缺 demo', 'needs demo')}</span>}
                    <button onClick={() => removeLang(v)} className="opacity-70 hover:opacity-100" aria-label="remove">×</button>
                  </span>
                );
              })}
            </div>
          )}
          <input className={inputCls} value={langQ} onChange={(e) => setLangQ(e.target.value)} placeholder={tx('搜尋語言或口音…', '搜寻语言或口音…', 'Search a language or accent…')} />
          {(langMatches.length > 0 || canAddCustom) && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {langMatches.slice(0, 8).map((o) => <button key={o.v} onClick={() => addLang(o.v)} className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-2.5 py-1 transition">+ {lbl(o)}</button>)}
              {canAddCustom && <button onClick={() => addLang(langQ.trim())} className="text-xs bg-white/5 hover:bg-white/10 border border-dashed border-white/20 rounded-full px-2.5 py-1 transition">+ “{langQ.trim()}”</button>}
            </div>
          )}
        </div>

        {/* Demos by category */}
        <div className={sectionCls}>
          <label className={labelCls}>{tx('試聽 demo', '试听 demo', 'Demos')}</label>
          <p className="text-xs text-gray-500 mb-3">{tx('只收 MP3,單檔 3 分鐘內(建議 1 分鐘)。建議純人聲最清晰;可有音樂襯底,但請避免過大或破音的配樂。', '只收 MP3,单档 3 分钟内(建议 1 分钟)。建议纯人声最清晰;可有音乐衬底,但请避免过大或破音的配乐。', 'MP3 only, under 3 min (1 min ideal). Clean voice-only is clearest; light music is fine, but avoid loud or clipping backing tracks.')}</p>
          {uploadErr && <p className="text-red-400 text-xs mb-2">{uploadErr}</p>}
          <div className="space-y-4">
            {USE_CASES.map((c) => {
              const items = form.demos.filter((d) => d.category === c.key);
              const unlimited = DEMO_UNLIMITED.has(c.key);
              const atLimit = !unlimited && items.length >= demoLimit(c.key);
              if (items.length === 0 && atLimit) return null;
              return (
                <div key={c.key}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-gray-300">{pickLabel(c, locale)}</span>
                    <span className="text-[11px] text-gray-600">{unlimited ? tx('不限', '不限', 'unlimited') : `${items.length} / ${demoLimit(c.key)}`}</span>
                  </div>
                  {items.length > 0 && (
                    <div className="space-y-2 mb-2">
                      {items.map((d) => (
                        <div key={d.url} className="bg-white/5 rounded-lg p-2.5">
                          <div className="flex items-center gap-2 mb-2">
                            <Music2 className="w-4 h-4 text-amber-400 shrink-0" />
                            <input className="flex-1 min-w-0 bg-transparent text-sm text-gray-200 focus:outline-none border-b border-transparent focus:border-white/20" value={d.name} onChange={(e) => updateDemo(d.url, { name: e.target.value })} placeholder={c.key === 'game' ? tx('角色名,例如:冷酷反派', '角色名,例如:冷酷反派', 'Character, e.g. Cold villain') : tx('demo 名稱', 'demo 名称', 'Demo name')} />
                            <select className="bg-zinc-900 text-xs text-gray-300 rounded px-1.5 py-1 border border-white/10 max-w-[40%]" value={d.language || ''} onChange={(e) => updateDemo(d.url, { language: e.target.value })}>
                              <option value="" className="bg-zinc-900">{tx('語言', '语言', 'Language')}</option>
                              {form.languages.map((l) => <option key={l} value={l} className="bg-zinc-900">{langLabel(l)}</option>)}
                            </select>
                            <button onClick={() => removeDemo(d.url)} className="text-gray-500 hover:text-red-400 shrink-0" aria-label="remove"><Trash2 className="w-4 h-4" /></button>
                          </div>
                          <audio controls src={d.url} className="w-full h-8" />
                        </div>
                      ))}
                    </div>
                  )}
                  {!atLimit && (
                    <label className={`inline-flex items-center gap-1.5 text-xs cursor-pointer ${uploadingCat === c.key ? 'text-gray-500' : 'text-amber-400 hover:text-amber-300'}`}>
                      <input type="file" accept=".mp3,audio/mpeg" className="hidden" disabled={!!uploadingCat} onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ''; if (f) handleDemoUpload(f, c.key); }} />
                      <Plus className="w-3.5 h-3.5" />{uploadingCat === c.key ? tx('上傳中…', '上传中…', 'Uploading…') : tx('上傳 demo', '上传 demo', 'Upload demo')}
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Details */}
        <div className={sectionCls}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelCls}>{tx('性別', '性别', 'Gender')}</label>
              <select className={inputCls} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="" className="bg-black">{tx('未指定', '未指定', 'Unspecified')}</option>
                {GENDER_OPTIONS.map((o) => <option key={o.v} value={o.v} className="bg-black">{lbl(o)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>{tx('所在地', '所在地', 'Location')}</label>
              <input className={inputCls} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder={tx('例如:台灣 台北', '例如:台湾 台北', 'e.g. Taipei, Taiwan')} />
            </div>
          </div>
          <div className="mb-4">
            <label className={labelCls}>{tx('合作單位 / 經歷', '合作单位 / 经历', 'Clients & experience')}</label>
            <textarea className={`${inputCls} min-h-[70px] resize-y`} value={form.credits} onChange={(e) => setForm({ ...form, credits: e.target.value })} placeholder={tx('合作過的品牌、代表作…', '合作过的品牌、代表作…', 'Brands you’ve worked with, notable projects…')} />
          </div>
          <div className="mb-4">
            <label className={labelCls}>{tx('可工作時段(參考)', '可工作时段(参考)', 'Availability (for reference)')}</label>
            <input className={inputCls} value={form.availability_note} onChange={(e) => setForm({ ...form, availability_note: e.target.value })} placeholder={tx('例如:平日晚上 7 點後不接、週末可', '例如:平日晚上 7 点后不接、周末可', 'e.g. Not after 7pm weekdays; weekends OK')} />
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className={labelCls}>{tx('錄音器材', '录音器材', 'Recording equipment')} <span className="font-normal text-gray-600">· {tx('選填', '选填', 'optional')}</span></label>
              <input className={inputCls} value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value })} placeholder={tx('例如:Neumann TLM103 + Apollo Twin', '例如:Neumann TLM103 + Apollo Twin', 'e.g. Neumann TLM103 + Apollo Twin')} />
            </div>
            <div>
              <label className={labelCls}>{tx('專業錄音室 / 錄音師合作', '专业录音室 / 录音师合作', 'Pro studio / engineer')} <span className="font-normal text-gray-600">· {tx('選填', '选填', 'optional')}</span></label>
              <input className={inputCls} value={form.studio_partner} onChange={(e) => setForm({ ...form, studio_partner: e.target.value })} placeholder={tx('有可配合的專業錄音室嗎?', '有可配合的专业录音室吗?', 'A pro studio you can record at for live sessions?')} />
            </div>
            <div>
              <label className={labelCls}>{tx('口音 / 風格', '口音 / 风格', 'Accent / style')} <span className="font-normal text-gray-600">· {tx('選填', '选填', 'optional')}</span></label>
              <input className={inputCls} value={form.accent} onChange={(e) => setForm({ ...form, accent: e.target.value })} placeholder={tx('選填', '选填', 'Optional')} />
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3 pt-1">
          <button onClick={handleSave} disabled={busy || photoBusy || !!uploadingCat} className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold rounded-lg px-5 py-2.5 text-sm transition">
            {busy ? tx('儲存中…', '保存中…', 'Saving…') : tx('儲存變更', '保存更改', 'Save changes')}
          </button>
          {saved && <span className="text-emerald-400 text-sm">{tx('✓ 已送出審核', '✓ 已送出审核', '✓ Sent for review')}</span>}
          {saveErr && <span className="text-red-400 text-sm">{saveErr}</span>}
        </div>

        {/* Service classification — read-only */}
        {serviceTags.length > 0 && (
          <div className={sectionCls}>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">{tx('服務類型 · 由 Onyx 管理', '服务类型 · 由 Onyx 管理', 'Services — managed by Onyx')}</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {serviceTags.map((tag) => <span key={tag} className="text-xs bg-sky-500/15 border border-sky-400/20 text-sky-200 px-2.5 py-1 rounded-full">{tx(SERVICE_LABEL[tag]?.tw || tag, SERVICE_LABEL[tag]?.cn || tag, SERVICE_LABEL[tag]?.en || tag)}</span>)}
            </div>
            <p className="text-[11px] text-gray-600">{tx('想調整服務範圍?請聯絡 hello@onyxstudios.ai。', '想调整服务范围?请联系 hello@onyxstudios.ai。', 'Want to change these? Contact hello@onyxstudios.ai.')}</p>
          </div>
        )}

        <div className="pt-2 pb-8 text-center">
          <Link href="/talents" className="text-xs text-gray-500 hover:text-gray-300 transition">{tx('查看公開人才庫 →', '查看公开人才库 →', 'View public roster →')}</Link>
        </div>
      </div>
    </>,
    true,
  );
}

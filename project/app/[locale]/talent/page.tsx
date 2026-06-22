'use client';

/*
  Talent self-service profile — Spotify-style.

  Everything is chosen from dropdowns/chips (not free-typed) so the data stays
  standardized + filterable: language is a language+accent pair, location is a
  country, availability is preset chips, credits are split into clients/awards/
  notable works (these feed search later). Edits save to the draft and flip
  pending_review — nothing reaches the public roster until an admin republishes.

  Rules (enforced here + server-side): photo cropped to square JPEG client-side;
  demos MP3-only ≤3min, max 2/category except game (unlimited); every claimed
  language must have a demo in it. Service classification (AI/TTS/Proofreading)
  is Onyx-managed, read-only.
*/

import { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Camera, Plus, Trash2, CheckCircle2, Clock, Music2 } from 'lucide-react';
import {
  VOICE_TRAITS, USE_CASES, TRAIT_KEYS, USE_CASE_KEYS, BASE_LANGUAGES, AVAILABILITY, COUNTRIES,
  pickLabel, formatLangEntry, baseLangLabel, accentLabel, accentOptionsFor, demoLimit, DEMO_UNLIMITED, DEMO_MAX_SECONDS, type DemoItem,
} from '@/lib/talent-taxonomy';

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
  gender: string | null; tags: string[] | null;
  voice_traits: string[] | null; specialties: string[] | null; demos: DemoItem[] | null;
  headshot_url: string | null; location: string | null; availability_note: string | null;
  clients: string | null; awards: string | null; notable_works: string | null; special_skills: string | null;
  equipment: string | null; studio_partner: string | null;
  type: string; email: string | null; is_active: boolean; pending_review: boolean;
  liveness_status: string | null;
};
type ListField = 'voice_traits' | 'specialties' | 'availability';
type Form = {
  name: string; bio: string; gender: string; location: string; studio_partner: string;
  equipment: string; clients: string; awards: string; notable_works: string; special_skills: string;
  availability: string[]; languages: string[]; voice_traits: string[]; specialties: string[];
  headshot_url: string; demos: DemoItem[];
};

const inputCls =
  'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-400/60 transition';

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

  const [phase, setPhase] = useState<'loading' | 'login' | 'dashboard' | 'notalent'>('loading');
  const [token, setToken] = useState('');
  const [t, setT] = useState<Talent | null>(null);
  const [form, setForm] = useState<Form>({
    name: '', bio: '', gender: '', location: '', studio_partner: '', equipment: '',
    clients: '', awards: '', notable_works: '', special_skills: '', availability: [], languages: [], voice_traits: [], specialties: [], headshot_url: '', demos: [],
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [langPick, setLangPick] = useState('');
  const [langQ, setLangQ] = useState('');
  const [accentPick, setAccentPick] = useState('native');
  const [accentCustom, setAccentCustom] = useState('');
  const [traitCustom, setTraitCustom] = useState('');
  const [specCustom, setSpecCustom] = useState('');
  const [addCat, setAddCat] = useState('');
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
      name: talent.name || '', bio: talent.bio || '', gender: talent.gender || '',
      location: talent.location || '', studio_partner: talent.studio_partner || '', equipment: talent.equipment || '',
      clients: talent.clients || '', awards: talent.awards || '', notable_works: talent.notable_works || '', special_skills: talent.special_skills || '',
      availability: (talent.availability_note || '').split(',').map((s) => s.trim()).filter(Boolean),
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

  const demoLangs = new Set(form.demos.map((d) => d.language).filter(Boolean));
  const langsMissingDemo = form.languages.filter((l) => !demoLangs.has(l));

  async function handleSave() {
    if (langsMissingDemo.length > 0) {
      setSaveErr(tx(
        `這些語言還沒有對應的 demo,請先上傳:${langsMissingDemo.map((l) => formatLangEntry(l, locale)).join('、')}`,
        `这些语言还没有对应的 demo,请先上传:${langsMissingDemo.map((l) => formatLangEntry(l, locale)).join('、')}`,
        `These languages need a demo first: ${langsMissingDemo.map((l) => formatLangEntry(l, locale)).join(', ')}`,
      ));
      return;
    }
    setBusy(true); setSaved(false); setSaveErr('');
    const res = await fetch('/api/talent/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: form.name, bio: form.bio, gender: form.gender, location: form.location,
        availability_note: form.availability.join(','), studio_partner: form.studio_partner, equipment: form.equipment,
        clients: form.clients, awards: form.awards, notable_works: form.notable_works, special_skills: form.special_skills,
        languages: form.languages, voice_traits: form.voice_traits, specialties: form.specialties,
        headshot_url: form.headshot_url, demos: form.demos,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      if (j.error === 'language_without_demo') {
        setSaveErr(tx(
          `這些語言還沒有對應的 demo:${(j.languages || []).map((l: string) => formatLangEntry(l, locale)).join('、')}`,
          `这些语言还没有对应的 demo:${(j.languages || []).map((l: string) => formatLangEntry(l, locale)).join('、')}`,
          `These languages need a demo: ${(j.languages || []).map((l: string) => formatLangEntry(l, locale)).join(', ')}`,
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
    if (!categoryKey) { setUploadErr(tx('請先選擇類別', '请先选择类别', 'Pick a category first')); return; }
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
  const addCustom = (field: 'voice_traits' | 'specialties', val: string) => {
    const v = val.trim();
    if (!v) return;
    setForm((f) => (f[field].includes(v) ? f : { ...f, [field]: [...f[field], v] }));
    if (field === 'voice_traits') setTraitCustom(''); else setSpecCustom('');
  };
  const removeFromList = (field: 'voice_traits' | 'specialties', val: string) =>
    setForm((f) => ({ ...f, [field]: f[field].filter((x) => x !== val) }));
  const addLang = () => {
    if (!langPick) return;
    const accent = accentPick === '__other__' ? (accentCustom.replace(/\//g, ' ').trim() || 'native') : (accentPick || 'native');
    const entry = `${langPick.replace(/\//g, ' ').trim()}/${accent}`;
    if (!form.languages.includes(entry)) setForm((f) => ({ ...f, languages: [...f.languages, entry] }));
    setLangPick(''); setLangQ(''); setAccentPick('native'); setAccentCustom('');
  };
  const removeLang = (v: string) => setForm((f) => ({ ...f, languages: f.languages.filter((x) => x !== v) }));

  // -------- render --------
  const shell = (inner: React.ReactNode, wide = false) => (
    <main className="min-h-screen bg-black text-white px-4 py-8">
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
  const sortedCountries = [...COUNTRIES].sort((a, b) => pickLabel(a, locale).localeCompare(pickLabel(b, locale)));
  const lq = langQ.trim().toLowerCase();
  const langMatches = lq ? BASE_LANGUAGES.filter((o) => pickLabel(o, locale).toLowerCase().includes(lq) || o.en.toLowerCase().includes(lq)) : [];
  const canAddCustomLang = !!lq && !BASE_LANGUAGES.some((o) => pickLabel(o, locale).toLowerCase() === lq || o.en.toLowerCase() === lq);
  const demosByCat = USE_CASES.map((c) => ({ c, items: form.demos.filter((d) => d.category === c.key) })).filter((g) => g.items.length > 0);

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

  // No boxes/borders around sections — just spacing, like the approved mockup.
  const sectionCls = '';
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

      <p className="text-xs text-gray-500 mb-5">{tx('您的修改會先送審 —— 我們聽過 demo、確認資料後才會公開到前台;通過或需要調整都會 email 通知您。', '您的修改会先送审 —— 我们听过 demo、确认资料后才会公开到前台;通过或需要调整都会 email 通知您。', 'Your changes go to review first — we listen to the demos and check your details before they go public. We’ll email you when approved, or if anything needs a tweak.')}</p>

      <div className="space-y-8">
        {/* Bio */}
        <div className={sectionCls}>
          <label className={labelCls}>{tx('個人簡介', '个人简介', 'Bio')}</label>
          <textarea className={`${inputCls} min-h-[100px] resize-y`} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder={tx('用您的語言寫即可,上線時我們會翻成其他語言。例如:溫暖知性的女聲,擅長廣告與旁白…', '用您的语言写即可,上线时我们会翻成其他语言。例如:温暖知性的女声,擅长广告与旁白…', 'Write in your own language — we translate it at publish. e.g. Warm, articulate voice, great for ads and narration…')} />
        </div>

        {/* Voice traits + specialties */}
        <div className={sectionCls}>
          <label className={labelCls}>{tx('聲線特質', '声线特质', 'Voice traits')}</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {VOICE_TRAITS.map((o) => {
              const on = form.voice_traits.includes(o.key);
              return <button key={o.key} type="button" onClick={() => toggleList('voice_traits', o.key)} className={`text-xs px-3 py-1.5 rounded-full border transition ${on ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>{pickLabel(o, locale)}</button>;
            })}
            {form.voice_traits.filter((x) => !TRAIT_KEYS.has(x)).map((x) => (
              <span key={x} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200">{x}<button onClick={() => removeFromList('voice_traits', x)} className="opacity-70 hover:opacity-100" aria-label="remove">×</button></span>
            ))}
          </div>
          <div className="flex gap-2 mb-5">
            <input className={inputCls} value={traitCustom} onChange={(e) => setTraitCustom(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom('voice_traits', traitCustom); } }} placeholder={tx('其他特質,例如:沙啞、童聲', '其他特质,例如:沙哑、童声', 'Other trait, e.g. Raspy, Childlike')} />
            <button type="button" onClick={() => addCustom('voice_traits', traitCustom)} className="shrink-0 text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-4 transition">{tx('加入', '加入', 'Add')}</button>
          </div>

          <label className={labelCls}>{tx('專長類型', '专长类型', 'Specialties')}</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {USE_CASES.map((o) => {
              const on = form.specialties.includes(o.key);
              return <button key={o.key} type="button" onClick={() => toggleList('specialties', o.key)} className={`text-xs px-3 py-1.5 rounded-full border transition ${on ? 'bg-violet-500/20 border-violet-400/40 text-violet-200' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>{pickLabel(o, locale)}</button>;
            })}
            {form.specialties.filter((x) => !USE_CASE_KEYS.has(x)).map((x) => (
              <span key={x} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-violet-500/20 border border-violet-400/40 text-violet-200">{x}<button onClick={() => removeFromList('specialties', x)} className="opacity-70 hover:opacity-100" aria-label="remove">×</button></span>
            ))}
          </div>
          <div className="flex gap-2">
            <input className={inputCls} value={specCustom} onChange={(e) => setSpecCustom(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom('specialties', specCustom); } }} placeholder={tx('其他專長,例如:ASMR、有聲漫畫', '其他专长,例如:ASMR、有声漫画', 'Other specialty, e.g. ASMR')} />
            <button type="button" onClick={() => addCustom('specialties', specCustom)} className="shrink-0 text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-4 transition">{tx('加入', '加入', 'Add')}</button>
          </div>
        </div>

        {/* Special skills / impressions */}
        <div className={sectionCls}>
          <label className={labelCls}>{tx('特殊技能 / 模仿', '特殊技能 / 模仿', 'Special skills & impressions')} <span className="font-normal text-gray-600">· {tx('選填', '选填', 'optional')}</span></label>
          <textarea className={`${inputCls} min-h-[70px] resize-y`} value={form.special_skills} onChange={(e) => setForm({ ...form, special_skills: e.target.value })} placeholder={tx('例如:模仿名人/卡通角色、口技、方言、會唱歌、Rap…', '例如:模仿名人/卡通角色、口技、方言、会唱歌、Rap…', 'e.g. Celebrity/character impressions, beatbox, dialects, singing, rap…')} />
        </div>

        {/* Languages — searchable language + accent, with custom fallback */}
        <div className={sectionCls}>
          <label className={labelCls}>{tx('可配語言與口音', '可配语言与口音', 'Languages & accents')}</label>
          <p className="text-xs text-gray-500 mb-2.5">{tx('搜尋語言(中/英),選口音;找不到可直接輸入。每個語言都要有一段該語言的 demo 才能掛上。', '搜寻语言(中/英),选口音;找不到可直接输入。每个语言都要有一段该语言的 demo 才能挂上。', 'Search a language (any name), pick an accent; type your own if not listed. Each needs a demo in it.')}</p>
          {form.languages.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {form.languages.map((v) => {
                const ok = demoLangs.has(v);
                return (
                  <span key={v} className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${ok ? 'bg-amber-500/15 text-amber-200' : 'bg-red-500/15 text-red-300'}`}>
                    {formatLangEntry(v, locale)}{!ok && <span className="text-[10px]">{tx('缺 demo', '缺 demo', 'needs demo')}</span>}
                    <button onClick={() => removeLang(v)} className="opacity-70 hover:opacity-100" aria-label="remove">×</button>
                  </span>
                );
              })}
            </div>
          )}
          {!langPick ? (
            <div>
              <input className={inputCls} value={langQ} onChange={(e) => setLangQ(e.target.value)} placeholder={tx('搜尋語言,例如:葡萄牙文 / Tagalog', '搜寻语言,例如:葡萄牙文 / Tagalog', 'Search a language, e.g. Portuguese / Tagalog')} />
              {(langMatches.length > 0 || canAddCustomLang) && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {langMatches.slice(0, 12).map((o) => <button key={o.key} onClick={() => { setLangPick(o.key); setLangQ(''); setAccentPick('native'); setAccentCustom(''); }} className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-2.5 py-1 transition">+ {pickLabel(o, locale)}</button>)}
                  {canAddCustomLang && <button onClick={() => { setLangPick(langQ.trim()); setLangQ(''); setAccentPick('native'); setAccentCustom(''); }} className="text-xs bg-white/5 hover:bg-white/10 border border-dashed border-white/20 rounded-full px-2.5 py-1 transition">{tx('其他', '其他', 'Other')}:“{langQ.trim()}”</button>}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="inline-flex items-center gap-1.5 text-sm bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-gray-200">{baseLangLabel(langPick, locale)}<button onClick={() => setLangPick('')} className="text-gray-400 hover:text-white" aria-label="change">×</button></span>
              <select className={`${inputCls} flex-1 min-w-[120px]`} value={accentPick} onChange={(e) => setAccentPick(e.target.value)}>
                {accentOptionsFor(langPick).map((k) => <option key={k} value={k} className="bg-zinc-900">{accentLabel(k, locale)}</option>)}
                <option value="__other__" className="bg-zinc-900">{tx('其他(自填)', '其他(自填)', 'Other (type)')}</option>
              </select>
              {accentPick === '__other__' && (
                <input className={`${inputCls} flex-1 min-w-[120px]`} value={accentCustom} onChange={(e) => setAccentCustom(e.target.value)} placeholder={tx('口音,例如:韓國口音', '口音,例如:韩国口音', 'Accent, e.g. Korean')} />
              )}
              <button type="button" onClick={addLang} className="shrink-0 text-sm bg-amber-500/90 hover:bg-amber-400 text-black font-medium rounded-lg px-4 transition">{tx('加入', '加入', 'Add')}</button>
            </div>
          )}
        </div>

        {/* Demos — collapsed: only categories with demos, plus one add control */}
        <div className={sectionCls}>
          <label className={labelCls}>{tx('試聽 demo', '试听 demo', 'Demos')}</label>
          <p className="text-xs text-gray-500 mb-3">{tx('只收 MP3,單檔 3 分鐘內(建議 1 分鐘)。建議純人聲最清晰;可有音樂襯底,但請避免過大或破音的配樂。', '只收 MP3,单档 3 分钟内(建议 1 分钟)。建议纯人声最清晰;可有音乐衬底,但请避免过大或破音的配乐。', 'MP3 only, under 3 min (1 min ideal). Clean voice-only is clearest; light music is fine, but avoid loud or clipping backing tracks.')}</p>
          {uploadErr && <p className="text-red-400 text-xs mb-2">{uploadErr}</p>}

          {demosByCat.length > 0 && (
            <div className="space-y-4 mb-4">
              {demosByCat.map(({ c, items }) => (
                <div key={c.key}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-gray-300">{pickLabel(c, locale)}</span>
                    <span className="text-[11px] text-gray-600">{DEMO_UNLIMITED.has(c.key) ? tx('不限', '不限', 'unlimited') : `${items.length} / ${demoLimit(c.key)}`}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((d) => (
                      <div key={d.url} className="bg-white/5 rounded-lg p-2.5">
                        <div className="flex items-center gap-2 mb-2">
                          <Music2 className="w-4 h-4 text-amber-400 shrink-0" />
                          <input className="flex-1 min-w-0 bg-transparent text-sm text-gray-200 focus:outline-none border-b border-transparent focus:border-white/20" value={d.name} onChange={(e) => updateDemo(d.url, { name: e.target.value })} placeholder={c.key === 'game' ? tx('角色名,例如:冷酷反派', '角色名,例如:冷酷反派', 'Character, e.g. Cold villain') : tx('demo 名稱', 'demo 名称', 'Demo name')} />
                          <select className="bg-zinc-900 text-xs text-gray-300 rounded px-1.5 py-1 border border-white/10 max-w-[42%]" value={d.language || ''} onChange={(e) => updateDemo(d.url, { language: e.target.value })}>
                            <option value="" className="bg-zinc-900">{tx('語言', '语言', 'Language')}</option>
                            {form.languages.map((l) => <option key={l} value={l} className="bg-zinc-900">{formatLangEntry(l, locale)}</option>)}
                          </select>
                          <button onClick={() => removeDemo(d.url)} className="text-gray-500 hover:text-red-400 shrink-0" aria-label="remove"><Trash2 className="w-4 h-4" /></button>
                        </div>
                        <audio controls src={d.url} className="w-full h-8" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add-demo control: pick category, then upload */}
          <div className="flex flex-wrap gap-2 items-center">
            <select className={`${inputCls} flex-1 min-w-[140px]`} value={addCat} onChange={(e) => setAddCat(e.target.value)}>
              <option value="" className="bg-zinc-900">{tx('選類別…', '选类别…', 'Choose category…')}</option>
              {USE_CASES.map((c) => {
                const count = form.demos.filter((d) => d.category === c.key).length;
                const unlimited = DEMO_UNLIMITED.has(c.key);
                const full = !unlimited && count >= demoLimit(c.key);
                return <option key={c.key} value={c.key} disabled={full} className="bg-zinc-900">{pickLabel(c, locale)}{unlimited ? tx('(不限)', '(不限)', ' (unlimited)') : ` (${count}/${demoLimit(c.key)})`}{full ? tx(' 已滿', ' 已满', ' full') : ''}</option>;
              })}
            </select>
            <label className={`shrink-0 inline-flex items-center gap-1.5 text-sm rounded-lg px-4 py-2.5 cursor-pointer transition ${!addCat || uploadingCat ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-amber-500/90 hover:bg-amber-400 text-black font-medium'}`}>
              <input type="file" accept=".mp3,audio/mpeg" className="hidden" disabled={!addCat || !!uploadingCat} onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ''; if (f) handleDemoUpload(f, addCat); }} />
              <Plus className="w-3.5 h-3.5" />{uploadingCat ? tx('上傳中…', '上传中…', 'Uploading…') : tx('上傳 demo', '上传 demo', 'Upload demo')}
            </label>
          </div>
        </div>

        {/* Basics: gender + location */}
        <div className={sectionCls}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{tx('性別', '性别', 'Gender')}</label>
              <select className={inputCls} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="" className="bg-black">{tx('未指定', '未指定', 'Unspecified')}</option>
                {GENDER_OPTIONS.map((o) => <option key={o.v} value={o.v} className="bg-black">{lbl(o)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>{tx('所在地', '所在地', 'Location')}</label>
              <select className={inputCls} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}>
                <option value="" className="bg-zinc-900">{tx('選擇國家 / 地區', '选择国家 / 地区', 'Select country')}</option>
                {sortedCountries.map((o) => <option key={o.key} value={o.key} className="bg-zinc-900">{pickLabel(o, locale)}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Availability */}
        <div className={sectionCls}>
          <label className={labelCls}>{tx('可工作時段', '可工作时段', 'Availability')} <span className="font-normal text-gray-500">· {tx('參考,逐案仍會再確認', '参考,逐案仍会再确认', 'reference; confirmed per project')}</span></label>
          <div className="flex flex-wrap gap-2">
            {AVAILABILITY.map((o) => {
              const on = form.availability.includes(o.key);
              return <button key={o.key} type="button" onClick={() => toggleList('availability', o.key)} className={`text-xs px-3 py-1.5 rounded-full border transition ${on ? 'bg-amber-500/20 border-amber-400/40 text-amber-200' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>{pickLabel(o, locale)}</button>;
            })}
          </div>
        </div>

        {/* Credits — structured for search */}
        <div className={sectionCls}>
          <div className="mb-4">
            <label className={labelCls}>{tx('合作品牌 / 客戶', '合作品牌 / 客户', 'Clients & brands')}</label>
            <input className={inputCls} value={form.clients} onChange={(e) => setForm({ ...form, clients: e.target.value })} placeholder={tx('例如:可口可樂、台積電、Netflix(用、分隔)', '例如:可口可乐、台积电、Netflix(用、分隔)', 'e.g. Coca-Cola, TSMC, Netflix (comma-separated)')} />
          </div>
          <div className="mb-4">
            <label className={labelCls}>{tx('代表作', '代表作', 'Notable work')}</label>
            <textarea className={`${inputCls} min-h-[70px] resize-y`} value={form.notable_works} onChange={(e) => setForm({ ...form, notable_works: e.target.value })} placeholder={tx('最具代表性的作品…', '最具代表性的作品…', 'Your most notable projects…')} />
          </div>
          <div>
            <label className={labelCls}>{tx('獎項', '奖项', 'Awards')} <span className="font-normal text-gray-600">· {tx('選填', '选填', 'optional')}</span></label>
            <input className={inputCls} value={form.awards} onChange={(e) => setForm({ ...form, awards: e.target.value })} placeholder={tx('得過的獎項…', '得过的奖项…', 'Awards you’ve won…')} />
          </div>
        </div>

        {/* Studio / equipment */}
        <div className={sectionCls}>
          <div className="mb-4">
            <label className={labelCls}>{tx('配合的專業錄音室(網址)', '合作的专业录音室(网址)', 'Partner studio (link)')} <span className="font-normal text-gray-600">· {tx('選填', '选填', 'optional')}</span></label>
            <input type="url" className={inputCls} value={form.studio_partner} onChange={(e) => setForm({ ...form, studio_partner: e.target.value })} placeholder="https://…" />
          </div>
          <div>
            <label className={labelCls}>{tx('錄音器材', '录音器材', 'Recording equipment')} <span className="font-normal text-gray-600">· {tx('選填', '选填', 'optional')}</span></label>
            <input className={inputCls} value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value })} placeholder={tx('例如:Neumann TLM103 + Apollo Twin', '例如:Neumann TLM103 + Apollo Twin', 'e.g. Neumann TLM103 + Apollo Twin')} />
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3 pt-1">
          <button onClick={handleSave} disabled={busy || photoBusy || !!uploadingCat} className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold rounded-lg px-5 py-2.5 text-sm transition">
            {busy ? tx('送出中…', '提交中…', 'Submitting…') : tx('儲存並送審', '保存并送审', 'Save & submit for review')}
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

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
import { authedFetch } from '@/lib/authed-fetch';
import Turnstile from '@/components/Turnstile';
import TelegramConnect from '@/components/talent/TelegramConnect';
import LineConnect from '@/components/talent/LineConnect';
import { Camera, Plus, Trash2, CheckCircle2, Clock, Music2, Star, LayoutDashboard, Share, Heart } from 'lucide-react';
import {
  VOICE_TRAITS, USE_CASES, TRAIT_KEYS, USE_CASE_KEYS, BASE_LANGUAGES, AVAILABILITY, COUNTRIES, VOICE_AGES, TURNAROUNDS, turnaroundLabel,
  pickLabel, formatLangEntry, baseLangLabel, accentLabel, accentOptionsFor, demoLimit, DEMO_UNLIMITED, DEMO_MAX_SECONDS, type DemoItem,
} from '@/lib/talent-taxonomy';

const GENDER_OPTIONS = [
  { v: 'Male', tw: '男', cn: '男' },
  { v: 'Female', tw: '女', cn: '女' },
  { v: 'Other', tw: '其他', cn: '其他' },
];
// Per-category demo name hints — the category already gives context (demos are
// grouped under it), so the name stays short: a brand for ads, a character for
// games, a topic for narration. Keeps everyone's naming consistent.
const DEMO_NAME_HINT: Record<string, { tw: string; cn: string; en: string }> = {
  commercial:  { tw: '品牌名,例如:LINDOR、LEGO', cn: '品牌名,例如:LINDOR、LEGO', en: 'Brand, e.g. LINDOR, LEGO' },
  narration:   { tw: '主題,例如:企業形象片', cn: '主题,例如:企业形象片', en: 'Topic, e.g. Corporate film' },
  audiobook:   { tw: '書名 / 類型', cn: '书名 / 类型', en: 'Title / genre' },
  corporate:   { tw: '公司 / 主題', cn: '公司 / 主题', en: 'Company / topic' },
  elearning:   { tw: '課程主題', cn: '课程主题', en: 'Course topic' },
  documentary: { tw: '主題', cn: '主题', en: 'Topic' },
  game:        { tw: '角色名,例如:冷酷反派', cn: '角色名,例如:冷酷反派', en: 'Character, e.g. Cold villain' },
  animation:   { tw: '角色 / 作品', cn: '角色 / 作品', en: 'Character / title' },
  drama:       { tw: '角色 / 劇名', cn: '角色 / 剧名', en: 'Role / title' },
  podcast:     { tw: '節目 / 主題', cn: '节目 / 主题', en: 'Show / topic' },
  news:        { tw: '類型', cn: '类型', en: 'Type' },
  ivr:         { tw: '用途', cn: '用途', en: 'Use case' },
};

const SERVICE_TAGS = new Set(['AI Voice', 'TTS Data', 'Proofreading']);
const SERVICE_LABEL: Record<string, { tw: string; cn: string; en: string }> = {
  'AI Voice': { tw: 'AI 聲音', cn: 'AI 声音', en: 'AI Voice' },
  'TTS Data': { tw: 'TTS 訓練', cn: 'TTS 训练', en: 'TTS Data' },
  'Proofreading': { tw: '語音校對', cn: '语音校对', en: 'Proofreading' },
};

type Talent = {
  id: string; name: string; english_name: string | null; bio: string | null; languages: string[] | null;
  gender: string | null; tags: string[] | null;
  voice_traits: string[] | null; specialties: string[] | null; voice_ages: string[] | null; demos: DemoItem[] | null;
  headshot_url: string | null; location: string | null; availability_note: string | null;
  clients: string | null; awards: string | null; notable_works: string | null; special_skills: string | null;
  equipment: string | null; studio_partner: string | null; portfolio_url: string | null;
  turnaround: string | null; years_experience: number | null; native_languages: string[] | null;
  coop_accept_jobs?: boolean; coop_open_buyout?: boolean; coop_ai_clone?: boolean; coop_ai_training?: boolean;
  coop_proofread?: boolean; coop_voice_director?: boolean; low_price_data_optin?: boolean;
  expected_rates?: Record<string, unknown> | null;
  type: string; email: string | null; is_active: boolean; pending_review: boolean;
  liveness_status: string | null;
};
const COOP_KEYS = ['coop_accept_jobs', 'coop_open_buyout', 'coop_ai_clone', 'coop_ai_training', 'coop_proofread', 'coop_voice_director', 'low_price_data_optin'] as const;
type CoopKey = typeof COOP_KEYS[number];
type ListField = 'voice_traits' | 'specialties' | 'availability' | 'voice_ages';
type Form = {
  name: string; english_name: string; bio: string; gender: string; location: string; studio_partner: string; portfolio_url: string;
  equipment: string; clients: string; awards: string; notable_works: string; special_skills: string;
  turnaround: string; years_experience: string; native_languages: string[];
  availability: string[]; languages: string[]; voice_traits: string[]; specialties: string[]; voice_ages: string[];
  headshot_url: string; demos: DemoItem[];
  coop: Record<CoopKey, boolean>;
  rates: { currency: string; tts_hourly: string; narration_min: string; ad_spot: string; game_role: string; min_charge: string; note: string };
};
const EMPTY_COOP: Record<CoopKey, boolean> = { coop_accept_jobs: true, coop_open_buyout: false, coop_ai_clone: false, coop_ai_training: false, coop_proofread: false, coop_voice_director: false, low_price_data_optin: false };
const EMPTY_RATES = { currency: 'TWD', tts_hourly: '', narration_min: '', ad_spot: '', game_role: '', min_charge: '', note: '' };
// Build the expected_rates JSON to store: numbers where parseable, currency/note as
// strings; drop empties so a blank form saves null (not a bag of empty keys).
function buildRates(r: Form['rates']): Record<string, string | number> | null {
  const out: Record<string, string | number> = {};
  for (const k of ['tts_hourly', 'narration_min', 'ad_spot', 'game_role', 'min_charge'] as const) {
    const n = Number(r[k]); if (r[k].trim() && Number.isFinite(n) && n >= 0) out[k] = n;
  }
  if (r.note.trim()) out.note = r.note.trim();
  if (Object.keys(out).length) out.currency = r.currency || 'TWD';
  return Object.keys(out).length ? out : null;
}
const COOP_OPTIONS: { key: CoopKey; zh: string; cn: string; en: string; zhd: string; cnd: string; end: string }[] = [
  { key: 'coop_accept_jobs', zh: '接案配音', cn: '接案配音', en: 'Take voice jobs', zhd: '願意接一般配音案', cnd: '愿意接一般配音案', end: 'Open to regular VO work' },
  { key: 'coop_open_buyout', zh: '開放聲音買斷', cn: '开放声音买断', en: 'Open to buyout', zhd: '接受一次性買斷授權', cnd: '接受一次性买断授权', end: 'Accept full buyout licensing' },
  { key: 'coop_ai_clone', zh: '製作為 AI 聲音', cn: '制作为 AI 声音', en: 'AI voice clone', zhd: '同意將你的聲音做成 AI(會用到你的聲音)', cnd: '同意将你的声音做成 AI(会用到你的声音)', end: 'Allow an AI clone made from your voice' },
  { key: 'coop_ai_training', zh: '錄製 AI 訓練素材', cn: '录制 AI 训练素材', en: 'Record AI training data', zhd: '只錄訓練資料,不會拿你的聲音上線', cnd: '只录训练资料,不会拿你的声音上线', end: 'Record training material only — your voice isn’t published' },
  { key: 'coop_proofread', zh: '校稿 / 潤稿', cn: '校稿 / 润稿', en: 'Proofreading', zhd: '願意接文字校對 / 潤稿', cnd: '愿意接文字校对 / 润稿', end: 'Open to script proofreading / polishing' },
  { key: 'coop_voice_director', zh: '配音指導', cn: '配音指导', en: 'Voice directing', zhd: '能帶其他配音員(表演 / 情緒 / 交付)', cnd: '能带其他配音员(表演 / 情绪 / 交付)', end: 'Can direct other talents (performance/emotion/delivery)' },
  { key: 'low_price_data_optin', zh: '低價資料採集案', cn: '低价资料采集案', en: 'Low-price data gigs', zhd: '願意收到低價數據採集案資訊', cnd: '愿意收到低价数据采集案信息', end: 'OK to receive low-price data-collection offers' },
];
const RATE_FIELDS: { key: 'tts_hourly' | 'narration_min' | 'ad_spot' | 'game_role' | 'min_charge'; zh: string; cn: string; en: string }[] = [
  { key: 'tts_hourly', zh: 'TTS(每完成小時)', cn: 'TTS(每完成小时)', en: 'TTS (per finished hr)' },
  { key: 'narration_min', zh: '旁白(每完成分鐘)', cn: '旁白(每完成分钟)', en: 'Narration (per finished min)' },
  { key: 'ad_spot', zh: '廣告(每支)', cn: '广告(每支)', en: 'Ad (per spot)' },
  { key: 'game_role', zh: '遊戲角色(每角色)', cn: '游戏角色(每角色)', en: 'Game character (per role)' },
  { key: 'min_charge', zh: '單案最低', cn: '单案最低', en: 'Minimum per job' },
];

const inputCls =
  'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-300 focus:outline-none focus:border-amber-400/60 transition';

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
  const namePh = (k: string) => { const h = DEMO_NAME_HINT[k]; return h ? pickLabel(h, locale) : tx('簡短名稱', '简短名称', 'Short label'); };

  const [phase, setPhase] = useState<'loading' | 'login' | 'dashboard' | 'notalent'>('loading');
  const [t, setT] = useState<Talent | null>(null);
  const [form, setForm] = useState<Form>({
    name: '', english_name: '', bio: '', gender: '', location: '', studio_partner: '', portfolio_url: '', equipment: '',
    clients: '', awards: '', notable_works: '', special_skills: '', turnaround: '', years_experience: '', native_languages: [],
    availability: [], languages: [], voice_traits: [], specialties: [], voice_ages: [], headshot_url: '', demos: [],
    coop: { ...EMPTY_COOP }, rates: { ...EMPTY_RATES },
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [saveErr, setSaveErr] = useState('');
  const [isClient, setIsClient] = useState(false); // dual-role: also has client orders
  const [favoriteCount, setFavoriteCount] = useState(0); // 幾位客戶收藏了我(只顯示數量,不顯示是誰)
  const [langPick, setLangPick] = useState('');
  const [langQ, setLangQ] = useState('');
  const [accentPick, setAccentPick] = useState('native');
  const [accentCustom, setAccentCustom] = useState('');
  const [langErr, setLangErr] = useState('');
  const [traitCustom, setTraitCustom] = useState('');
  const [specCustom, setSpecCustom] = useState('');
  const [addCat, setAddCat] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const [uploadingCat, setUploadingCat] = useState('');
  const [uploadErr, setUploadErr] = useState('');

  const loadProfile = useCallback(async () => {
    const res = await authedFetch('/api/talent/me');
    if (res.status === 404) return setPhase('notalent');
    if (!res.ok) return setPhase('login');
    const { talent, isClient: alsoClient, favoriteCount: favs } = (await res.json()) as { talent: Talent; isClient?: boolean; favoriteCount?: number };
    setIsClient(!!alsoClient);
    setFavoriteCount(typeof favs === 'number' ? favs : 0);
    setT(talent);
    setForm({
      name: talent.name || '', english_name: talent.english_name || '', bio: talent.bio || '', gender: talent.gender || '',
      location: talent.location || '', studio_partner: talent.studio_partner || '', portfolio_url: talent.portfolio_url || '', equipment: talent.equipment || '',
      clients: talent.clients || '', awards: talent.awards || '', notable_works: talent.notable_works || '', special_skills: talent.special_skills || '',
      turnaround: talent.turnaround || '', years_experience: talent.years_experience != null ? String(talent.years_experience) : '',
      native_languages: Array.isArray(talent.native_languages) ? talent.native_languages : [],
      availability: (talent.availability_note || '').split(',').map((s) => s.trim()).filter(Boolean),
      languages: Array.isArray(talent.languages) ? talent.languages : [],
      voice_traits: Array.isArray(talent.voice_traits) ? talent.voice_traits : [],
      specialties: Array.isArray(talent.specialties) ? talent.specialties : [],
      voice_ages: Array.isArray(talent.voice_ages) ? talent.voice_ages : [],
      headshot_url: talent.headshot_url || '',
      demos: Array.isArray(talent.demos) ? talent.demos : [],
      coop: {
        coop_accept_jobs: talent.coop_accept_jobs !== false,
        coop_open_buyout: !!talent.coop_open_buyout,
        coop_ai_clone: !!talent.coop_ai_clone,
        coop_ai_training: !!talent.coop_ai_training,
        coop_proofread: !!talent.coop_proofread,
        coop_voice_director: !!talent.coop_voice_director,
        low_price_data_optin: !!talent.low_price_data_optin,
      },
      rates: {
        currency: (talent.expected_rates?.currency as string) || 'TWD',
        tts_hourly: talent.expected_rates?.tts_hourly != null ? String(talent.expected_rates.tts_hourly) : '',
        narration_min: talent.expected_rates?.narration_min != null ? String(talent.expected_rates.narration_min) : '',
        ad_spot: talent.expected_rates?.ad_spot != null ? String(talent.expected_rates.ad_spot) : '',
        game_role: talent.expected_rates?.game_role != null ? String(talent.expected_rates.game_role) : '',
        min_charge: talent.expected_rates?.min_charge != null ? String(talent.expected_rates.min_charge) : '',
        note: (talent.expected_rates?.note as string) || '',
      },
    });
    setPhase('dashboard');
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) await loadProfile();
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
    await loadProfile();
  }

  // Self-serve: resend a fresh set-password / reset link (the old one expires in
  // ~1h, so first-time talents often hit an expired link). Reuses /api/auth/reset-password.
  async function handleResend() {
    setLoginErr(''); setResetMsg('');
    if (!email.trim()) { setLoginErr(tx('請先輸入您的電子郵件。', '请先输入您的电子邮件。', 'Enter your email first.')); return; }
    if (!captchaToken) { setLoginErr(tx('請先完成人機驗證。', '请先完成人机验证。', 'Please complete the verification first.')); return; }
    setResetBusy(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), locale, turnstileToken: captchaToken }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'failed'); }
      setResetMsg(tx('已重寄設定密碼信,請至信箱點開連結(請盡快,連結有時效)。', '已重寄设置密码邮件,请至邮箱点开链接(请尽快,链接有时效)。', 'A fresh set-password email is on its way — open the link soon (it expires).'));
    } catch {
      setLoginErr(tx('寄送失敗,請稍後再試或聯絡我們。', '发送失败,请稍后再试或联系我们。', 'Could not send — try again later or contact us.'));
    } finally { setResetBusy(false); }
  }

  const demoLangs = new Set(form.demos.map((d) => d.language).filter(Boolean));
  const langsMissingDemo = form.languages.filter((l) => !demoLangs.has(l));

  async function handleSave(submit: boolean) {
    // The language-needs-a-demo rule only blocks SUBMIT — drafts save freely.
    if (submit && langsMissingDemo.length > 0) {
      setSaveErr(tx(
        `這些語言還沒有對應的 demo,請先上傳:${langsMissingDemo.map((l) => formatLangEntry(l, locale)).join('、')}`,
        `这些语言还没有对应的 demo,请先上传:${langsMissingDemo.map((l) => formatLangEntry(l, locale)).join('、')}`,
        `These languages need a demo first: ${langsMissingDemo.map((l) => formatLangEntry(l, locale)).join(', ')}`,
      ));
      return;
    }
    setBusy(true); setSavedMsg(''); setSaveErr('');
    const res = await authedFetch('/api/talent/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submit,
        name: form.name, english_name: form.english_name, bio: form.bio, gender: form.gender, location: form.location,
        availability_note: form.availability.join(','), studio_partner: form.studio_partner, portfolio_url: form.portfolio_url, equipment: form.equipment,
        clients: form.clients, awards: form.awards, notable_works: form.notable_works, special_skills: form.special_skills,
        turnaround: form.turnaround, years_experience: form.years_experience ? parseInt(form.years_experience, 10) : null,
        native_languages: form.native_languages,
        languages: form.languages, voice_traits: form.voice_traits, specialties: form.specialties, voice_ages: form.voice_ages,
        headshot_url: form.headshot_url, demos: form.demos,
        ...form.coop, expected_rates: buildRates(form.rates),
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
      } else if (j.error === 'demo_without_language') {
        setSaveErr(tx('每段 demo 都要標示語言(紅框那欄)才能送審。', '每段 demo 都要标示语言(红框那栏)才能送审。', 'Every demo must have a language set (the red field) before submitting.'));
      } else if (j.error === 'incomplete_profile') {
        const L = (k: string) => ({
          demo: tx('至少一段 demo', '至少一段 demo', 'at least one demo'),
          languages: tx('語言', '语言', 'a language'),
          voice_traits: tx('聲線', '声线', 'voice traits'),
          specialties: tx('專長', '专长', 'specialties'),
        }[k] || k);
        const items = (j.missing || []).map(L).join(tx('、', '、', ', '));
        setSaveErr(tx(`送審前請先補齊:${items}。可以先「儲存草稿」,補好再送審。`, `送审前请先补齐:${items}。可以先「保存草稿」,补好再送审。`, `Please complete these before submitting: ${items}. You can save a draft and submit once done.`));
      } else {
        setSaveErr(j.error || tx('儲存失敗,請稍後再試。', '保存失败,请稍后再试。', 'Save failed. Please try again.'));
      }
      return;
    }
    const { talent } = await res.json();
    setT((prev) => (prev ? { ...prev, ...talent } : prev));
    setSavedMsg(submit ? tx('✓ 已送出審核', '✓ 已送出审核', '✓ Submitted for review') : tx('✓ 已儲存草稿', '✓ 已保存草稿', '✓ Draft saved'));
    setTimeout(() => setSavedMsg(''), 3000);
  }

  async function handleLogout() { await supabase.auth.signOut(); setT(null); setPhase('login'); }

  async function handlePhoto(file: File) {
    setPhotoErr(''); setPhotoBusy(true);
    try {
      const blob = await cropSquareJpeg(file);
      const res = await authedFetch('/api/talent/photo-upload-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
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
      const res = await authedFetch('/api/talent/demo-upload-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
  // The first demo in the array is the "primary" that previews on the roster card.
  const setPrimaryDemo = (url: string) => setForm((f) => {
    const d = f.demos.find((x) => x.url === url);
    if (!d || f.demos[0]?.url === url) return f;
    return { ...f, demos: [d, ...f.demos.filter((x) => x.url !== url)] };
  });
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
    // Languages with regional variants (Mandarin, English, Spanish…) MUST have a
    // specific accent — "國語" alone is too broad. Force a real choice.
    const hasRegional = accentOptionsFor(langPick).length > 1;
    if (hasRegional && (!accentPick || accentPick === 'native')) {
      setLangErr(tx(`「${baseLangLabel(langPick, locale)}」請選擇口音`, `「${baseLangLabel(langPick, locale)}」请选择口音`, `Please pick an accent for ${baseLangLabel(langPick, locale)}`));
      return;
    }
    const accent = accentPick === '__other__' ? (accentCustom.replace(/\//g, ' ').trim() || 'native') : (accentPick || 'native');
    const entry = `${langPick.replace(/\//g, ' ').trim()}/${accent}`;
    if (!form.languages.includes(entry)) setForm((f) => ({ ...f, languages: [...f.languages, entry] }));
    setLangPick(''); setLangQ(''); setAccentPick('native'); setAccentCustom(''); setLangErr('');
  };
  const removeLang = (v: string) => setForm((f) => ({ ...f, languages: f.languages.filter((x) => x !== v) }));

  // -------- render --------
  // wide = the signed-in profile view → left-aligned like the client dashboard
  // (the talent layout supplies the sidebar offset + top padding). Narrow = the
  // login / pre-chrome states → stay centered full-screen.
  const shell = (inner: React.ReactNode, wide = false) => (
    wide ? (
      <div className="text-white p-6 lg:p-10"><div className="max-w-5xl">{inner}</div></div>
    ) : (
      <main className="min-h-screen bg-black text-white px-4 py-8"><div className="max-w-sm mx-auto">{inner}</div></main>
    )
  );

  if (phase === 'loading') return shell(<p className="text-gray-300 text-sm text-center py-20">{tx('載入中…', '加载中…', 'Loading…')}</p>);

  if (phase === 'notalent') return shell(
    <div className="text-center py-16">
      <h1 className="text-xl font-semibold mb-3">{tx('這裡是配音員後台', '这里是配音员后台', 'Talent area')}</h1>
      <p className="text-gray-300 text-sm mb-6">{tx('此登入帳號尚未連結配音員檔案。如有疑問,請聯絡 hello@onyxstudios.ai。', '此登录账号尚未关联配音员资料。如有疑问,请联系 hello@onyxstudios.ai。', 'This account is not linked to a talent profile. If you think this is a mistake, contact hello@onyxstudios.ai.')}</p>
      <button onClick={handleLogout} className="text-sm text-amber-400 hover:underline">{tx('登出', '登出', 'Sign out')}</button>
    </div>
  );

  if (phase === 'login') return shell(
    <div className="pt-8">
      <h1 className="text-2xl font-semibold mb-1">{tx('配音員後台', '配音员后台', 'Talent Dashboard')}</h1>
      <p className="text-gray-300 text-sm mb-8">{tx('登入以管理您的個人檔案。', '登录以管理您的个人资料。', 'Sign in to manage your profile.')}</p>
      <form onSubmit={handleLogin} className="space-y-3">
        <input type="email" className={inputCls} placeholder={tx('電子郵件', '电子邮件', 'Email')} value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" className={inputCls} placeholder={tx('密碼', '密码', 'Password')} value={password} onChange={(e) => setPassword(e.target.value)} required />
        {loginErr && <p className="text-red-400 text-xs">{loginErr}</p>}
        <button type="submit" disabled={busy} className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold rounded-lg py-2.5 text-sm transition">
          {busy ? tx('登入中…', '登录中…', 'Signing in…') : tx('登入', '登录', 'Sign in')}
        </button>
      </form>
      <div className="mt-3 space-y-2">
        <Turnstile onToken={setCaptchaToken} />
        <button type="button" onClick={handleResend} disabled={resetBusy}
          className="block text-xs text-amber-400 hover:underline disabled:opacity-50">
          {resetBusy ? tx('寄送中…', '发送中…', 'Sending…') : tx('忘記密碼 / 連結過期?重寄設定密碼信', '忘记密码 / 链接过期?重寄设置密码邮件', 'Forgot password / link expired? Resend set-password email')}
        </button>
      </div>
      {resetMsg && <p className="text-green-400 text-xs mt-2">{resetMsg}</p>}
      <p className="text-gray-300 text-xs mt-6 leading-relaxed">{tx('第一次登入?請點開我們寄給您的「設定密碼」信件設定密碼。連結若過期,點上方「重寄」即可拿到新的。', '第一次登录?请打开我们发送给您的「设置密码」邮件设置密码。链接若过期,点上方「重寄」即可拿到新的。', 'First time? Open the “Set Password” email we sent you. If the link expired, tap “Resend” above for a fresh one.')}</p>
    </div>
  );

  // ---- dashboard ----
  const serviceTags = (Array.isArray(t?.tags) ? t!.tags : []).filter((x) => SERVICE_TAGS.has(x));
  const sortedCountries = [...COUNTRIES].sort((a, b) => pickLabel(a, locale).localeCompare(pickLabel(b, locale)));
  const lq = langQ.trim().toLowerCase();
  const langMatches = lq ? BASE_LANGUAGES.filter((o) => pickLabel(o, locale).toLowerCase().includes(lq) || o.en.toLowerCase().includes(lq)) : [];
  const canAddCustomLang = !!lq && !BASE_LANGUAGES.some((o) => pickLabel(o, locale).toLowerCase() === lq || o.en.toLowerCase() === lq);
  const demosByCat = USE_CASES.map((c) => ({ c, items: form.demos.filter((d) => d.category === c.key) })).filter((g) => g.items.length > 0);

  const statusBadge = t?.is_active
    ? (t?.pending_review
        ? { cls: 'bg-amber-500/15 text-amber-300', icon: <Clock className="w-3.5 h-3.5" />, text: tx('已上線 · 修改待審核', '已上线 · 修改待审核', 'Live · changes pending review') }
        : { cls: 'bg-emerald-500/15 text-emerald-300', icon: <CheckCircle2 className="w-3.5 h-3.5" />, text: tx('已上線', '已上线', 'Live on roster') })
    : (t?.pending_review
        ? { cls: 'bg-amber-500/15 text-amber-300', icon: <Clock className="w-3.5 h-3.5" />, text: tx('審核中 · 尚未公開', '审核中 · 尚未公开', 'In review · not public yet') }
        : { cls: 'bg-white/10 text-gray-300', icon: <Clock className="w-3.5 h-3.5" />, text: tx('草稿 · 尚未送審', '草稿 · 尚未送审', 'Draft · not submitted') });

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
      {/* Dual-role only: this account also has client orders → switch to the buyer
          dashboard. A pure talent never sees this. */}
      {isClient && (
        <Link
          href={`${locale === 'en' ? '' : `/${locale}`}/dashboard`}
          className="inline-flex items-center gap-1.5 text-xs text-gray-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-full px-3 py-1.5 mb-5 transition"
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          {tx('前往客戶後台', '前往客户后台', 'Go to client dashboard')}
        </Link>
      )}
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
            {/* 收藏數:只顯示「有多少人收藏」的數量,不顯示是誰(客戶隱私)。0 人時不顯示。 */}
            {favoriteCount > 0 && (
              <span
                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-300"
                title={tx('已收藏你聲音的客戶數', '已收藏你声音的客户数', 'Clients who saved your voice')}
              >
                <Heart className="w-3.5 h-3.5" />
                {favoriteCount}
              </span>
            )}
            {t?.is_active && t?.id && (
              <button type="button" onClick={async () => {
                const link = `${window.location.origin}${locale === 'en' ? '' : `/${locale}`}/talents/${t.id}`;
                const nav = navigator as Navigator & { share?: (d: { title?: string; url: string }) => Promise<void> };
                if (nav.share) { try { await nav.share({ title: `${form.name || 'Onyx'} · Onyx Studios`, url: link }); return; } catch { /* cancelled */ } }
                try { await navigator.clipboard.writeText(link); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); } catch { /* blocked */ }
              }}
                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-white/10 text-gray-300 hover:bg-white/15 transition">
                <Share className="w-3 h-3" /> {shareCopied ? tx('已複製連結 ✓', '已复制链接 ✓', 'Copied ✓') : tx('分享主頁', '分享主页', 'Share profile')}
              </button>
            )}
            <LineConnect tx={tx} />
            <TelegramConnect tx={tx} />
          </div>
          <input className="w-full bg-transparent text-2xl font-bold focus:outline-none focus:border-b focus:border-white/20 pb-0.5" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={tx('顯示名稱', '显示名称', 'Display name')} />
          <input className="w-full bg-transparent text-sm text-gray-300 focus:outline-none focus:border-b focus:border-white/20 pb-0.5 mt-1" value={form.english_name} onChange={(e) => setForm({ ...form, english_name: e.target.value })} placeholder={tx('英文 / 羅馬拼音名(選填,英文頁顯示)', '英文 / 罗马拼音名(选填,英文页显示)', 'English / Romanized name (optional, shown on English site)')} />
          <p className="text-xs text-gray-300 mt-1.5">{t?.email}</p>
        </div>
      </div>
      {photoErr && <p className="text-red-400 text-xs mb-3 -mt-2">{photoErr}</p>}

      <p className="text-xs text-gray-300 mb-5">{tx('隨時可「儲存草稿」,不會送審;填好後再按「送出審核」。我們聽過 demo、確認資料才會公開到前台,通過或需調整都會 email 通知您。', '随时可「保存草稿」,不会送审;填好后再按「提交审核」。我们听过 demo、确认资料才会公开到前台,通过或需调整都会 email 通知您。', 'Save a draft anytime — it isn’t reviewed. When you’re ready, hit Submit for review. We check your demos and details before going public, and email you on approval or if anything needs a tweak.')}</p>

      <div className="space-y-8">
        {/* Bio */}
        <div className={sectionCls}>
          <label className={labelCls}>{tx('個人簡介', '个人简介', 'Bio')}</label>
          <p className="text-xs text-amber-300/80 mb-2">{tx('請勿填寫連結或個人聯絡資訊(電話、Email、社群)—— 系統會自動移除。請只描述您的聲音與專長。', '请勿填写链接或个人联系信息(电话、Email、社群)—— 系统会自动移除。请只描述您的声音与专长。', 'No links or personal contact info (phone, email, socials) — they’re removed automatically. Describe your voice and strengths only.')}</p>
          <textarea className={`${inputCls} min-h-[100px] resize-y`} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder={tx('用您的語言寫即可,上線時我們會翻成其他語言。例如:溫暖知性的女聲,擅長廣告與旁白…', '用您的语言写即可,上线时我们会翻成其他语言。例如:温暖知性的女声,擅长广告与旁白…', 'Write in your own language — we translate it at publish. e.g. Warm, articulate voice, great for ads and narration…')} />
        </div>

        {/* Experience & turnaround */}
        <div className={sectionCls}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{tx('配音年資', '配音年资', 'Years of experience')}</label>
              <input type="number" min="0" max="80" className={inputCls} value={form.years_experience} onChange={(e) => setForm({ ...form, years_experience: e.target.value })} placeholder={tx('例如:8', '例如:8', 'e.g. 8')} />
            </div>
            <div>
              <label className={labelCls}>{tx('交期', '交期', 'Turnaround')}</label>
              <select className={inputCls} value={form.turnaround} onChange={(e) => setForm({ ...form, turnaround: e.target.value })}>
                <option value="" className="bg-zinc-900">{tx('— 選擇 —', '— 选择 —', '— Select —')}</option>
                {TURNAROUNDS.map((o) => <option key={o.key} value={o.key} className="bg-zinc-900">{turnaroundLabel(o.key, locale)}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Voice traits + specialties */}
        <div className={sectionCls}>
          <label className={labelCls}>{tx('聲線特質', '声线特质', 'Voice traits')}</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {VOICE_TRAITS.map((o) => {
              const on = form.voice_traits.includes(o.key);
              return <button key={o.key} type="button" onClick={() => toggleList('voice_traits', o.key)} className={`text-xs px-3 py-1.5 rounded-full border transition ${on ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200' : 'bg-white/5 border-white/10 text-gray-300 hover:text-white'}`}>{pickLabel(o, locale)}</button>;
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
              return <button key={o.key} type="button" onClick={() => toggleList('specialties', o.key)} className={`text-xs px-3 py-1.5 rounded-full border transition ${on ? 'bg-violet-500/20 border-violet-400/40 text-violet-200' : 'bg-white/5 border-white/10 text-gray-300 hover:text-white'}`}>{pickLabel(o, locale)}</button>;
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
          <label className={labelCls}>{tx('特殊技能 / 模仿', '特殊技能 / 模仿', 'Special skills & impressions')} <span className="font-normal text-gray-400">· {tx('選填', '选填', 'optional')}</span></label>
          <textarea className={`${inputCls} min-h-[70px] resize-y`} value={form.special_skills} onChange={(e) => setForm({ ...form, special_skills: e.target.value })} placeholder={tx('例如:模仿名人/卡通角色、口技、方言、會唱歌、Rap…', '例如:模仿名人/卡通角色、口技、方言、会唱歌、Rap…', 'e.g. Celebrity/character impressions, beatbox, dialects, singing, rap…')} />
        </div>

        {/* Languages — searchable language + accent, with custom fallback */}
        <div className={sectionCls}>
          <label className={labelCls}>{tx('可配語言與口音', '可配语言与口音', 'Languages & accents')}</label>
          <p className="text-xs text-gray-300 mb-2.5">{tx('搜尋語言(中/英),選口音;找不到可直接輸入。每個語言都要有一段該語言的 demo 才能掛上。', '搜寻语言(中/英),选口音;找不到可直接输入。每个语言都要有一段该语言的 demo 才能挂上。', 'Search a language (any name), pick an accent; type your own if not listed. Each needs a demo in it.')}</p>
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
          {form.languages.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-300 mb-1.5">{tx('哪些是母語?點選標記(客戶頁會標「母語」)', '哪些是母语?点选标记(客户页会标「母语」)', 'Which are native? Tap to mark (shown as “Native” on your profile)')}</p>
              <div className="flex flex-wrap gap-2">
                {form.languages.map((v) => {
                  const isNative = form.native_languages.includes(v);
                  return (
                    <button key={v} type="button" onClick={() => setForm((f) => ({ ...f, native_languages: isNative ? f.native_languages.filter((x) => x !== v) : [...f.native_languages, v] }))}
                      className={`text-xs px-2.5 py-1 rounded-full border transition ${isNative ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40' : 'bg-white/5 text-gray-300 border-white/10 hover:border-white/30'}`}>
                      {formatLangEntry(v, locale)}{isNative ? ' ✓' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {!langPick ? (
            <div>
              <input className={inputCls} value={langQ} onChange={(e) => setLangQ(e.target.value)} placeholder={tx('搜尋語言,例如:葡萄牙文 / Tagalog', '搜寻语言,例如:葡萄牙文 / Tagalog', 'Search a language, e.g. Portuguese / Tagalog')} />
              {(langMatches.length > 0 || canAddCustomLang) && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {langMatches.slice(0, 12).map((o) => <button key={o.key} onClick={() => { setLangPick(o.key); setLangQ(''); setAccentPick(accentOptionsFor(o.key).length > 1 ? '' : 'native'); setAccentCustom(''); setLangErr(''); }} className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-2.5 py-1 transition">+ {pickLabel(o, locale)}</button>)}
                  {canAddCustomLang && <button onClick={() => { setLangPick(langQ.trim()); setLangQ(''); setAccentPick('native'); setAccentCustom(''); setLangErr(''); }} className="text-xs bg-white/5 hover:bg-white/10 border border-dashed border-white/20 rounded-full px-2.5 py-1 transition">{tx('其他', '其他', 'Other')}:“{langQ.trim()}”</button>}
                </div>
              )}
            </div>
          ) : (
            <>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="inline-flex items-center gap-1.5 text-sm bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-gray-200">{baseLangLabel(langPick, locale)}<button onClick={() => setLangPick('')} className="text-gray-300 hover:text-white" aria-label="change">×</button></span>
              {(() => {
                const opts = accentOptionsFor(langPick);
                const hasRegional = opts.length > 1; // more than just 'native' → must pick a region
                return (
                  <select className={`${inputCls} flex-1 min-w-[120px]`} value={accentPick} onChange={(e) => { setAccentPick(e.target.value); setLangErr(''); }}>
                    {hasRegional && <option value="" className="bg-zinc-900">{tx('— 請選擇口音 —', '— 请选择口音 —', '— Select accent —')}</option>}
                    {opts.filter((k) => !hasRegional || k !== 'native').map((k) => <option key={k} value={k} className="bg-zinc-900">{accentLabel(k, locale)}</option>)}
                    <option value="__other__" className="bg-zinc-900">{tx('其他(自填)', '其他(自填)', 'Other (type)')}</option>
                  </select>
                );
              })()}
              {accentPick === '__other__' && (
                <input className={`${inputCls} flex-1 min-w-[120px]`} value={accentCustom} onChange={(e) => setAccentCustom(e.target.value)} placeholder={tx('口音,例如:韓國口音', '口音,例如:韩国口音', 'Accent, e.g. Korean')} />
              )}
              <button type="button" onClick={addLang} className="shrink-0 text-sm bg-amber-500/90 hover:bg-amber-400 text-black font-medium rounded-lg px-4 transition">{tx('加入', '加入', 'Add')}</button>
            </div>
            {langErr && <p className="text-xs text-red-400 mt-1.5">{langErr}</p>}
            </>
          )}
        </div>

        {/* Demos — collapsed: only categories with demos, plus one add control */}
        <div className={sectionCls}>
          <label className={labelCls}>{tx('試聽 demo', '试听 demo', 'Demos')}</label>
          <p className="text-xs text-gray-300 mb-3">{tx('只收 MP3,單檔 3 分鐘內(建議 1 分鐘)。建議純人聲最清晰;可有音樂襯底,但請避免過大或破音的配樂。命名簡短就好 —— 廣告填品牌名、角色填角色名。點 ★ 設「主打」,它會在人才庫卡片上播放。', '只收 MP3,单档 3 分钟内(建议 1 分钟)。建议纯人声最清晰;可有音乐衬底,但请避免过大或破音的配乐。命名简短就好 —— 广告填品牌名、角色填角色名。点 ★ 设「主打」,它会在人才库卡片上播放。', 'MP3 only, under 3 min (1 min ideal). Clean voice-only is clearest; light music is fine, but avoid loud or clipping backing tracks. Keep names short — a brand for ads, a character for games. Tap ★ to set a primary demo — it previews on your roster card.')}</p>
          {uploadErr && <p className="text-red-400 text-xs mb-2">{uploadErr}</p>}

          {demosByCat.length > 0 && (
            <div className="space-y-4 mb-4">
              {demosByCat.map(({ c, items }) => (
                <div key={c.key}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-gray-300">{pickLabel(c, locale)}</span>
                    <span className="text-[11px] text-gray-400">{DEMO_UNLIMITED.has(c.key) ? tx('不限', '不限', 'unlimited') : `${items.length} / ${demoLimit(c.key)}`}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((d) => (
                      <div key={d.url} className="bg-white/5 rounded-lg p-2.5">
                        <div className="flex items-center gap-2 mb-2">
                          <Music2 className="w-4 h-4 text-amber-400 shrink-0" />
                          <input className="flex-1 min-w-0 bg-transparent text-sm text-gray-200 focus:outline-none border-b border-transparent focus:border-white/20" value={d.name} onChange={(e) => updateDemo(d.url, { name: e.target.value })} placeholder={namePh(c.key)} />
                          <select className={`bg-zinc-900 text-xs text-gray-300 rounded px-1.5 py-1 border max-w-[34%] ${d.language ? 'border-white/10' : 'border-red-500/60'}`} value={d.language || ''} onChange={(e) => updateDemo(d.url, { language: e.target.value })}>
                            <option value="" className="bg-zinc-900">{tx('選語言*', '选语言*', 'Language*')}</option>
                            {form.languages.map((l) => <option key={l} value={l} className="bg-zinc-900">{formatLangEntry(l, locale)}</option>)}
                          </select>
                          {form.demos[0]?.url === d.url ? (
                            <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] text-amber-300 bg-amber-500/15 rounded-full px-2 py-0.5"><Star className="w-3 h-3 fill-amber-300" />{tx('主打', '主打', 'Primary')}</span>
                          ) : (
                            <button onClick={() => setPrimaryDemo(d.url)} title={tx('設為主打(在卡片播放)', '设为主打(在卡片播放)', 'Set as primary (plays on card)')} className="text-gray-300 hover:text-amber-300 shrink-0" aria-label="set primary"><Star className="w-4 h-4" /></button>
                          )}
                          <button onClick={() => removeDemo(d.url)} className="text-gray-300 hover:text-red-400 shrink-0" aria-label="remove"><Trash2 className="w-4 h-4" /></button>
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
            <label className={`shrink-0 inline-flex items-center gap-1.5 text-sm rounded-lg px-4 py-2.5 cursor-pointer transition ${!addCat || uploadingCat ? 'bg-white/5 text-gray-300 cursor-not-allowed' : 'bg-amber-500/90 hover:bg-amber-400 text-black font-medium'}`}>
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
          <div className="mt-4">
            <label className={labelCls}>{tx('聲音年齡', '声音年龄', 'Voice age')} <span className="font-normal text-gray-300">· {tx('可複選', '可复选', 'multi-select')}</span></label>
            <div className="flex flex-wrap gap-2">
              {VOICE_AGES.map((o) => {
                const on = form.voice_ages.includes(o.key);
                return <button key={o.key} type="button" onClick={() => toggleList('voice_ages', o.key)} className={`text-xs px-3 py-1.5 rounded-full border transition ${on ? 'bg-amber-500/20 border-amber-400/40 text-amber-200' : 'bg-white/5 border-white/10 text-gray-300 hover:text-white'}`}>{pickLabel(o, locale)}</button>;
              })}
            </div>
          </div>
        </div>

        {/* Availability */}
        <div className={sectionCls}>
          <label className={labelCls}>{tx('可工作時段', '可工作时段', 'Availability')} <span className="font-normal text-gray-300">· {tx('參考,逐案仍會再確認', '参考,逐案仍会再确认', 'reference; confirmed per project')}</span></label>
          <div className="flex flex-wrap gap-2">
            {AVAILABILITY.map((o) => {
              const on = form.availability.includes(o.key);
              return <button key={o.key} type="button" onClick={() => toggleList('availability', o.key)} className={`text-xs px-3 py-1.5 rounded-full border transition ${on ? 'bg-amber-500/20 border-amber-400/40 text-amber-200' : 'bg-white/5 border-white/10 text-gray-300 hover:text-white'}`}>{pickLabel(o, locale)}</button>;
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
            <textarea className={`${inputCls} min-h-[90px] resize-y`} value={form.notable_works} onChange={(e) => setForm({ ...form, notable_works: e.target.value })} placeholder={tx('一行一個,作品 + 媒介/角色,例如:\nLINDOR 農曆新年電視廣告\n《XX》有聲書全集旁白\n《某遊戲》主角配音', '一行一个,作品 + 媒介/角色,例如:\nLINDOR 农历新年电视广告\n《XX》有声书全集旁白\n《某游戏》主角配音', 'One per line — work + medium/role, e.g.\nLINDOR Lunar New Year TV ad\nNarrator, “XX” audiobook series\nLead role, “Some Game”')} />
          </div>
          <div>
            <label className={labelCls}>{tx('獎項', '奖项', 'Awards')} <span className="font-normal text-gray-400">· {tx('選填', '选填', 'optional')}</span></label>
            <input className={inputCls} value={form.awards} onChange={(e) => setForm({ ...form, awards: e.target.value })} placeholder={tx('得過的獎項…', '得过的奖项…', 'Awards you’ve won…')} />
          </div>
        </div>

        {/* Studio / equipment */}
        <div className={sectionCls}>
          <div className="mb-4">
            <label className={labelCls}>{tx('配合的專業錄音室(網址)', '合作的专业录音室(网址)', 'Partner studio (link)')} <span className="font-normal text-gray-400">· {tx('選填', '选填', 'optional')}</span></label>
            <input type="url" className={inputCls} value={form.studio_partner} onChange={(e) => setForm({ ...form, studio_partner: e.target.value })} placeholder="https://…" />
          </div>
          <div>
            <label className={labelCls}>{tx('錄音器材', '录音器材', 'Recording equipment')} <span className="font-normal text-gray-400">· {tx('選填', '选填', 'optional')}</span></label>
            <input className={inputCls} value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value })} placeholder={tx('例如:Neumann TLM103 + Apollo Twin', '例如:Neumann TLM103 + Apollo Twin', 'e.g. Neumann TLM103 + Apollo Twin')} />
          </div>
          <div className="mt-4">
            <label className={labelCls}>{tx('網站 / 作品集連結', '网站 / 作品集链接', 'Website / portfolio link')} <span className="font-normal text-gray-300">· {tx('只給 Onyx 內部參考,不會公開給客戶', '只给 Onyx 内部参考,不会公开给客户', 'internal only — never shown to clients')}</span></label>
            <input type="url" className={inputCls} value={form.portfolio_url} onChange={(e) => setForm({ ...form, portfolio_url: e.target.value })} placeholder="https://…" />
          </div>
        </div>

        {/* Cooperation opt-ins — internal only, never shown to clients */}
        <div className={sectionCls}>
          <label className={labelCls}>{tx('合作意願', '合作意愿', 'What work you’re open to')} <span className="font-normal text-gray-300">· {tx('只給 Onyx 內部參考,不會公開', '只给 Onyx 内部参考,不会公开', 'internal only — never shown to clients')}</span></label>
          <p className="text-xs text-gray-300 mb-3">{tx('勾選你願意承接的類型,我們才會把對的案子發給你。隨時可改。', '勾选你愿意承接的类型,我们才会把对的案子发给你。随时可改。', 'Tick what you’ll take on, so we only send you the right jobs. Change anytime.')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {COOP_OPTIONS.map((o) => {
              const on = form.coop[o.key];
              return (
                <button key={o.key} type="button" onClick={() => setForm((f) => ({ ...f, coop: { ...f.coop, [o.key]: !f.coop[o.key] } }))}
                  className={`flex items-start gap-2.5 text-left rounded-lg border px-3 py-2.5 transition ${on ? 'bg-emerald-500/15 border-emerald-400/40' : 'bg-white/5 border-white/10 hover:border-white/25'}`}>
                  <span className={`mt-0.5 w-4 h-4 shrink-0 rounded border flex items-center justify-center text-[10px] font-bold ${on ? 'bg-emerald-400 border-emerald-400 text-black' : 'border-white/30 text-transparent'}`}>✓</span>
                  <span>
                    <span className={`block text-sm font-medium ${on ? 'text-emerald-100' : 'text-gray-200'}`}>{tx(o.zh, o.cn, o.en)}</span>
                    <span className="block text-xs text-gray-300">{tx(o.zhd, o.cnd, o.end)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Expected rates — internal reference, optional, negotiated per project */}
        <div className={sectionCls}>
          <label className={labelCls}>{tx('期望報價', '期望报价', 'Your rate expectations')} <span className="font-normal text-gray-300">· {tx('選填 · 內部參考,不公開,逐案仍會談', '选填 · 内部参考,不公开,逐案仍会谈', 'optional · internal reference, negotiated per project')}</span></label>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-gray-300">{tx('幣別', '币别', 'Currency')}</span>
            <select className="bg-zinc-900 text-sm text-gray-200 rounded-lg px-2.5 py-1.5 border border-white/10" value={form.rates.currency} onChange={(e) => setForm((f) => ({ ...f, rates: { ...f.rates, currency: e.target.value } }))}>
              {['TWD', 'USD'].map((c) => <option key={c} value={c} className="bg-zinc-900">{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {RATE_FIELDS.map((rf) => (
              <div key={rf.key}>
                <label className="block text-xs text-gray-300 mb-1">{tx(rf.zh, rf.cn, rf.en)}</label>
                <input type="number" min="0" className={inputCls} value={form.rates[rf.key]} onChange={(e) => setForm((f) => ({ ...f, rates: { ...f.rates, [rf.key]: e.target.value } }))} placeholder={form.rates.currency} />
              </div>
            ))}
          </div>
          <div className="mt-3">
            <label className="block text-xs text-gray-300 mb-1">{tx('補充說明', '补充说明', 'Notes')}</label>
            <input className={inputCls} value={form.rates.note} onChange={(e) => setForm((f) => ({ ...f, rates: { ...f.rates, note: e.target.value } }))} placeholder={tx('例如:買斷 ×2、急件 +30%…', '例如:买断 ×2、急件 +30%…', 'e.g. buyout ×2, rush +30%…')} />
          </div>
        </div>

        {/* Save draft vs submit for review */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button onClick={() => handleSave(false)} disabled={busy || photoBusy || !!uploadingCat} className="bg-white/10 hover:bg-white/15 disabled:opacity-50 text-white font-medium rounded-lg px-5 py-2.5 text-sm transition">
            {tx('儲存草稿', '保存草稿', 'Save draft')}
          </button>
          <button onClick={() => handleSave(true)} disabled={busy || photoBusy || !!uploadingCat} className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold rounded-lg px-5 py-2.5 text-sm transition">
            {busy ? tx('處理中…', '处理中…', 'Working…') : tx('送出審核', '提交审核', 'Submit for review')}
          </button>
          {savedMsg && <span className="text-emerald-400 text-sm">{savedMsg}</span>}
          {saveErr && <span className="text-red-400 text-sm">{saveErr}</span>}
        </div>

        {/* Service classification — read-only */}
        {serviceTags.length > 0 && (
          <div className={sectionCls}>
            <p className="text-xs text-gray-300 uppercase tracking-widest mb-3">{tx('服務類型 · 由 Onyx 管理', '服务类型 · 由 Onyx 管理', 'Services — managed by Onyx')}</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {serviceTags.map((tag) => <span key={tag} className="text-xs bg-sky-500/15 border border-sky-400/20 text-sky-200 px-2.5 py-1 rounded-full">{tx(SERVICE_LABEL[tag]?.tw || tag, SERVICE_LABEL[tag]?.cn || tag, SERVICE_LABEL[tag]?.en || tag)}</span>)}
            </div>
            <p className="text-[11px] text-gray-400">{tx('想調整服務範圍?請聯絡 hello@onyxstudios.ai。', '想调整服务范围?请联系 hello@onyxstudios.ai。', 'Want to change these? Contact hello@onyxstudios.ai.')}</p>
          </div>
        )}

        <div className="pt-2 pb-8 text-center">
          <Link href="/talents" className="text-xs text-gray-300 hover:text-gray-300 transition">{tx('查看公開人才庫 →', '查看公开人才库 →', 'View public roster →')}</Link>
        </div>
      </div>
    </>,
    true,
  );
}

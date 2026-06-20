'use client';

/*
  Talent self-service dashboard (Phase 3).

  Self-contained auth gate: if not logged in, shows an inline email+password
  login (no dependency on the client /auth routing). Once logged in, loads the
  talent's own profile from /api/talent/me (scoped to their auth_user_id) and
  lets them edit the high-value personal fields — name, bio, languages, accent,
  gender. Service classification, demos and pricing are read-only here (managed
  by Onyx); demo self-upload is a planned follow-up.

  Tri-lingual via the same useLocale()+tx() idiom used across the site.
*/

import { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

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

type Demo = { name?: string; url?: string };
type Talent = {
  id: string;
  name: string;
  bio: string | null;
  languages: string[] | null;
  accent: string | null;
  gender: string | null;
  tags: string[] | null;
  demo_urls: Demo[] | null;
  type: string;
  email: string | null;
  is_active: boolean;
};
type Form = { name: string; bio: string; accent: string; gender: string; languages: string[] };

const inputCls =
  'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-400/60 transition';

export default function TalentDashboard() {
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);
  const lbl = (o: { v: string; tw: string; cn: string }) => (isZhCN ? o.cn : isZh ? o.tw : o.v);
  const langLabel = (v: string) => {
    const o = LANG_OPTIONS.find((x) => x.v === v);
    return o ? lbl(o) : v;
  };

  const [phase, setPhase] = useState<'loading' | 'login' | 'dashboard' | 'notalent'>('loading');
  const [token, setToken] = useState('');
  const [t, setT] = useState<Talent | null>(null);
  const [form, setForm] = useState<Form>({ name: '', bio: '', accent: '', gender: '', languages: [] });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [langQ, setLangQ] = useState('');

  const loadProfile = useCallback(async (accessToken: string) => {
    setToken(accessToken);
    const res = await fetch('/api/talent/me', { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.status === 404) return setPhase('notalent');
    if (!res.ok) return setPhase('login');
    const { talent } = (await res.json()) as { talent: Talent };
    setT(talent);
    setForm({
      name: talent.name || '',
      bio: talent.bio || '',
      accent: talent.accent || '',
      gender: talent.gender || '',
      languages: Array.isArray(talent.languages) ? talent.languages : [],
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
    setBusy(true);
    setLoginErr('');
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error || !data.session) {
      setLoginErr(tx('帳號或密碼錯誤,請再試一次。', '账号或密码错误,请再试一次。', 'Incorrect email or password. Please try again.'));
      return;
    }
    await loadProfile(data.session.access_token);
  }

  async function handleSave() {
    setBusy(true);
    setSaved(false);
    setSaveErr('');
    const res = await fetch('/api/talent/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setSaveErr(j.error || tx('儲存失敗,請稍後再試。', '保存失败,请稍后再试。', 'Save failed. Please try again.'));
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setT(null);
    setPhase('login');
  }

  const addLang = (v: string) => {
    if (v && !form.languages.includes(v)) setForm((f) => ({ ...f, languages: [...f.languages, v] }));
    setLangQ('');
  };
  const removeLang = (v: string) => setForm((f) => ({ ...f, languages: f.languages.filter((x) => x !== v) }));

  // -------- render --------
  const shell = (inner: React.ReactNode) => (
    <main className="min-h-screen bg-black text-white px-4 py-16">
      <div className="max-w-2xl mx-auto">{inner}</div>
    </main>
  );

  if (phase === 'loading') {
    return shell(<p className="text-gray-500 text-sm text-center py-20">{tx('載入中…', '加载中…', 'Loading…')}</p>);
  }

  if (phase === 'notalent') {
    return shell(
      <div className="text-center py-16">
        <h1 className="text-xl font-semibold mb-3">{tx('這裡是配音員後台', '这里是配音员后台', 'Talent area')}</h1>
        <p className="text-gray-400 text-sm mb-6">
          {tx(
            '此登入帳號尚未連結配音員檔案。如有疑問,請聯絡 hello@onyxstudios.ai。',
            '此登录账号尚未关联配音员资料。如有疑问,请联系 hello@onyxstudios.ai。',
            'This account is not linked to a talent profile. If you think this is a mistake, contact hello@onyxstudios.ai.'
          )}
        </p>
        <button onClick={handleLogout} className="text-sm text-green-400 hover:underline">
          {tx('登出', '登出', 'Sign out')}
        </button>
      </div>
    );
  }

  if (phase === 'login') {
    return shell(
      <div className="max-w-sm mx-auto pt-8">
        <h1 className="text-2xl font-semibold mb-1">{tx('配音員後台', '配音员后台', 'Talent Dashboard')}</h1>
        <p className="text-gray-400 text-sm mb-8">
          {tx('登入以管理您的個人檔案。', '登录以管理您的个人资料。', 'Sign in to manage your profile.')}
        </p>
        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="email"
            className={inputCls}
            placeholder={tx('電子郵件', '电子邮件', 'Email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className={inputCls}
            placeholder={tx('密碼', '密码', 'Password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {loginErr && <p className="text-red-400 text-xs">{loginErr}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold rounded-lg py-2.5 text-sm transition"
          >
            {busy ? tx('登入中…', '登录中…', 'Signing in…') : tx('登入', '登录', 'Sign in')}
          </button>
        </form>
        <p className="text-gray-500 text-xs mt-6 leading-relaxed">
          {tx(
            '第一次登入?請點開我們寄給您的「設定密碼」信件設定密碼。忘記密碼也可由該流程重設。',
            '第一次登录?请打开我们发送给您的「设置密码」邮件设置密码。忘记密码也可由该流程重置。',
            'First time? Open the “Set Password” email we sent you to create your password. Forgot it? Use the same flow to reset.'
          )}
        </p>
      </div>
    );
  }

  // dashboard
  const tags = Array.isArray(t?.tags) ? t!.tags : [];
  const demos = Array.isArray(t?.demo_urls) ? t!.demo_urls : [];
  const langMatches = langQ.trim()
    ? LANG_OPTIONS.filter((o) => !form.languages.includes(o.v) && lbl(o).toLowerCase().includes(langQ.trim().toLowerCase()))
    : [];
  const canAddCustom = !!langQ.trim() && !LANG_OPTIONS.some((o) => lbl(o) === langQ.trim()) && !form.languages.includes(langQ.trim());

  return shell(
    <>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">{tx('我的檔案', '我的资料', 'My Profile')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t?.email}</p>
        </div>
        <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-white transition">
          {tx('登出', '登出', 'Sign out')}
        </button>
      </div>

      <div className="mb-6 flex items-center gap-2 text-xs">
        <span
          className={`px-2.5 py-1 rounded-full ${t?.is_active ? 'bg-green-500/15 text-green-300' : 'bg-amber-500/15 text-amber-300'}`}
        >
          {t?.is_active ? tx('● 已上線', '● 已上线', '● Live on roster') : tx('● 審核中', '● 审核中', '● Pending')}
        </span>
        <Link href="/talents" className="text-gray-500 hover:text-gray-300 transition">
          {tx('查看人才庫 →', '查看人才库 →', 'View roster →')}
        </Link>
      </div>

      <div className="space-y-5 bg-white/[0.02] border border-white/10 rounded-2xl p-6">
        <div>
          <label className="block text-sm text-gray-300 mb-1.5">{tx('顯示名稱', '显示名称', 'Display name')}</label>
          <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1.5">
            {tx('個人簡介', '个人简介', 'Bio')}
            <span className="text-gray-500"> · {tx('聲音給人的感覺、專長、經歷', '声音给人的感觉、专长、经历', 'Your voice, specialties, experience')}</span>
          </label>
          <textarea
            className={`${inputCls} min-h-[110px] resize-y`}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder={tx('例如:溫暖知性的女聲,擅長廣告與旁白…', '例如:温暖知性的女声,擅长广告与旁白…', 'e.g. Warm, articulate female voice — great for ads and narration…')}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1.5">{tx('語言與口音', '语言与口音', 'Languages & accents')}</label>
          {form.languages.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {form.languages.map((v) => (
                <span key={v} className="inline-flex items-center gap-1.5 bg-green-500/15 text-green-200 text-xs px-2.5 py-1 rounded-full">
                  {langLabel(v)}
                  <button onClick={() => removeLang(v)} className="text-green-300/70 hover:text-white" aria-label="remove">
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            className={inputCls}
            value={langQ}
            onChange={(e) => setLangQ(e.target.value)}
            placeholder={tx('搜尋語言或口音…', '搜寻语言或口音…', 'Search a language or accent…')}
          />
          {(langMatches.length > 0 || canAddCustom) && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {langMatches.slice(0, 8).map((o) => (
                <button key={o.v} onClick={() => addLang(o.v)} className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-2.5 py-1 transition">
                  + {lbl(o)}
                </button>
              ))}
              {canAddCustom && (
                <button onClick={() => addLang(langQ.trim())} className="text-xs bg-white/5 hover:bg-white/10 border border-dashed border-white/20 rounded-full px-2.5 py-1 transition">
                  + “{langQ.trim()}”
                </button>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">{tx('性別', '性别', 'Gender')}</label>
            <select className={inputCls} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="" className="bg-black">
                {tx('未指定', '未指定', 'Unspecified')}
              </option>
              {GENDER_OPTIONS.map((o) => (
                <option key={o.v} value={o.v} className="bg-black">
                  {lbl(o)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">{tx('口音 / 風格', '口音 / 风格', 'Accent / style')}</label>
            <input className={inputCls} value={form.accent} onChange={(e) => setForm({ ...form, accent: e.target.value })} placeholder={tx('選填', '选填', 'Optional')} />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={busy}
            className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold rounded-lg px-5 py-2.5 text-sm transition"
          >
            {busy ? tx('儲存中…', '保存中…', 'Saving…') : tx('儲存變更', '保存更改', 'Save changes')}
          </button>
          {saved && <span className="text-green-400 text-sm">{tx('✓ 已儲存', '✓ 已保存', '✓ Saved')}</span>}
          {saveErr && <span className="text-red-400 text-sm">{saveErr}</span>}
        </div>
      </div>

      {/* Read-only: managed by Onyx */}
      {(tags.length > 0 || demos.length > 0) && (
        <div className="mt-6 bg-white/[0.02] border border-white/10 rounded-2xl p-6">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">
            {tx('由 Onyx 管理(如需調整請聯絡我們)', '由 Onyx 管理(如需调整请联系我们)', 'Managed by Onyx — contact us to change')}
          </p>
          {tags.length > 0 && (
            <div className="mb-4">
              <p className="text-sm text-gray-400 mb-2">{tx('服務類型 / 標籤', '服务类型 / 标签', 'Services / tags')}</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag, i) => (
                  <span key={i} className="text-xs bg-white/5 border border-white/10 text-gray-300 px-2.5 py-1 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          {demos.length > 0 && (
            <div>
              <p className="text-sm text-gray-400 mb-2">{tx('試聽檔', '试听档', 'Demos')}</p>
              <div className="space-y-2">
                {demos.map((d, i) => (
                  <div key={i}>
                    <p className="text-xs text-gray-500 mb-1">{d.name || `Demo ${i + 1}`}</p>
                    {d.url && /^https?:\/\//.test(d.url) && <audio controls src={d.url} className="w-full h-9" />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

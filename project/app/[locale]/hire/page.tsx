'use client';

/*
  Phase 2 (MVP) — client "find a voice / post a brief" form.
  VO/配音 work only (no TTS / data-collection — those go through Onyx directly).
  No login: a guest leaves their email. Submit emails the brief to Onyx for
  MANUAL matching + a confirmation to the client. No DB table yet (added when we
  automate matching). Tri-lingual via useLocale()+tx().
*/

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { Check } from 'lucide-react';

// VO categories only — never TTS / data-collection (those are Onyx-direct).
const CATEGORIES = [
  { v: 'Commercial', tw: '廣告', cn: '广告' },
  { v: 'Narration', tw: '旁白', cn: '旁白' },
  { v: 'Audiobook', tw: '有聲書', cn: '有声书' },
  { v: 'Corporate', tw: '工商簡介', cn: '工商简介' },
  { v: 'E-Learning', tw: '教育教學', cn: '教育教学' },
  { v: 'Documentary', tw: '紀錄片', cn: '纪录片' },
  { v: 'TV / Radio', tw: '電視 / 廣播', cn: '电视 / 广播' },
  { v: 'Web Video', tw: '網路影片', cn: '网络视频' },
  { v: 'Podcast', tw: 'Podcast', cn: '播客' },
  { v: 'IVR / Phone', tw: '來電語音 / IVR', cn: '来电语音 / IVR' },
  { v: 'Game / Animation', tw: '遊戲 / 動畫', cn: '游戏 / 动画' },
];

const inputCls =
  'w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm focus:border-amber-500 focus:outline-none placeholder:text-gray-600';

export default function Hire() {
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);
  const L: 'tw' | 'cn' | 'en' = isZhCN ? 'cn' : isZh ? 'tw' : 'en';
  const catLabel = (o: { v: string; tw: string; cn: string }) => (L === 'en' ? o.v : o[L]);

  const [form, setForm] = useState({ name: '', company: '', email: '', language: '', length: '', budget: '', deadline: '', brief: '' });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const [cats, setCats] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const toggleCat = (v: string) => setCats((c) => (c.includes(v) ? c.filter((x) => x !== v) : [...c, v]));

  const submit = async () => {
    setError('');
    if (!form.email || !emailOk) { setError(tx('請填寫有效的 Email', '请填写有效的 Email', 'Please enter a valid email')); return; }
    if (!form.brief.trim()) { setError(tx('請簡述您的需求', '请简述您的需求', 'Please describe your project')); return; }
    setSubmitting(true);
    try {
      const r = await fetch('/api/hire', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, categories: cats, locale }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || tx('送出失敗,請重試', '送出失败,请重试', 'Submission failed — please try again'));
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : tx('發生錯誤,請重試', '发生错误,请重试', 'Something went wrong'));
    } finally { setSubmitting(false); }
  };

  if (done) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-amber-500 flex items-center justify-center mx-auto mb-5"><Check className="w-8 h-8 text-black" /></div>
          <h1 className="text-2xl font-bold mb-2">{tx('需求已送出!', '需求已送出!', 'Brief received!')}</h1>
          <p className="text-gray-400 text-sm leading-relaxed">{tx('我們已收到您的需求,團隊會盡快為您挑選合適的配音員並與您聯繫報價。', '我们已收到您的需求,团队会尽快为您挑选合适的配音员并与您联系报价。', 'We’ve received your brief — our team will shortlist suitable voices and get back to you with a quote shortly.')}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 pt-28 pb-16">
        <p className="text-xs tracking-[0.25em] uppercase text-amber-300 mb-2">{tx('ONYX · 找配音', 'ONYX · 找配音', 'ONYX · Find a voice')}</p>
        <h1 className="text-3xl font-bold mb-2">{tx('告訴我們您的配音需求', '告诉我们您的配音需求', 'Tell us about your voiceover project')}</h1>
        <p className="text-gray-400 text-sm mb-8">{tx('填好需求,我們會為您挑選合適的配音員並回覆報價。約 2 分鐘。', '填好需求,我们会为您挑选合适的配音员并回复报价。约 2 分钟。', 'Share your brief and we’ll match you with the right voice and quote it. About 2 minutes.')}</p>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm text-gray-200 mb-1">{tx('您的稱呼', '您的称呼', 'Your name')}</label><input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
            <div><label className="block text-sm text-gray-200 mb-1">{tx('公司 / 品牌', '公司 / 品牌', 'Company / brand')} <span className="text-xs text-gray-500">{tx('選填', '选填', 'Optional')}</span></label><input className={inputCls} value={form.company} onChange={(e) => set('company', e.target.value)} /></div>
          </div>
          <div><label className="block text-sm text-gray-200 mb-1">Email <span className="text-red-400">＊</span></label><input className={inputCls} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder={tx('我們會將報價回覆到這裡', '我们会将报价回复到这里', 'We’ll send the quote here')} /></div>

          <div>
            <label className="block text-sm text-gray-200 mb-1">{tx('案件類型', '案件类型', 'Project type')} <span className="text-xs text-gray-500">{tx('可多選', '可多选', 'Multi-select')}</span></label>
            <div>{CATEGORIES.map((c) => (
              <button key={c.v} type="button" onClick={() => toggleCat(c.v)}
                className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm border transition-all mr-2 mb-2 ${cats.includes(c.v) ? 'bg-amber-500/15 text-amber-300 border-amber-500/40' : 'bg-zinc-900 text-gray-400 border-zinc-700 hover:border-zinc-500'}`}>
                {catLabel(c)}
              </button>
            ))}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm text-gray-200 mb-1">{tx('語言 / 口音', '语言 / 口音', 'Language / accent')}</label><input className={inputCls} value={form.language} onChange={(e) => set('language', e.target.value)} placeholder={tx('例:中文台灣 / 英文美國', '例:中文台湾 / 英文美国', 'e.g. Chinese (TW) / English (US)')} /></div>
            <div><label className="block text-sm text-gray-200 mb-1">{tx('長度 / 字數', '长度 / 字数', 'Length / word count')}</label><input className={inputCls} value={form.length} onChange={(e) => set('length', e.target.value)} placeholder={tx('例:30 秒 / 約 200 字', '例:30 秒 / 约 200 字', 'e.g. 30 sec / ~200 words')} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm text-gray-200 mb-1">{tx('預算', '预算', 'Budget')} <span className="text-xs text-gray-500">{tx('選填', '选填', 'Optional')}</span></label><input className={inputCls} value={form.budget} onChange={(e) => set('budget', e.target.value)} placeholder={tx('有預算範圍最好媒合', '有预算范围最好媒合', 'A range helps us match')} /></div>
            <div><label className="block text-sm text-gray-200 mb-1">{tx('截止日', '截止日', 'Deadline')} <span className="text-xs text-gray-500">{tx('選填', '选填', 'Optional')}</span></label><input className={inputCls} value={form.deadline} onChange={(e) => set('deadline', e.target.value)} placeholder={tx('例:6/30 前', '例:6/30 前', 'e.g. by 6/30')} /></div>
          </div>
          <div><label className="block text-sm text-gray-200 mb-1">{tx('需求說明 / 稿件', '需求说明 / 稿件', 'Brief / script')} <span className="text-red-400">＊</span></label><textarea className={`${inputCls} min-h-[120px] resize-y`} value={form.brief} onChange={(e) => set('brief', e.target.value)} placeholder={tx('用途、語氣、參考、稿件內容…越清楚我們越好媒合。', '用途、语气、参考、稿件内容…越清楚我们越好媒合。', 'Use case, tone, references, the script… the clearer, the better we can match.')} /></div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="button" disabled={submitting} onClick={submit}
            className="w-full py-3 rounded-xl bg-amber-500 text-black font-medium flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
            <Check className="w-4 h-4" /> {submitting ? tx('送出中…', '送出中…', 'Submitting…') : tx('送出需求', '送出需求', 'Submit brief')}
          </button>
          <p className="text-center text-xs text-gray-500">{tx('送出後我們會盡快與您聯繫並提供報價。', '送出后我们会尽快与您联系并提供报价。', 'We’ll be in touch with a quote shortly.')}</p>
        </div>
      </div>
    </main>
  );
}

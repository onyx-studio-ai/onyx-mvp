'use client';

/*
  Client "find a voice / post a brief" form — HUMAN voiceover only.
  Separates content type (single-select) from media/territory/license (the
  pricing-critical dimensions). AI / TTS / training-data intent is routed out to
  the right studio instead of submitting a human brief. Tri-lingual.
*/

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { Check } from 'lucide-react';

type Opt = { v: string; tw: string; cn: string };

// Content type — what it IS (single-select). Media is captured separately.
const CONTENT_TYPES: Opt[] = [
  { v: 'Commercial', tw: '廣告', cn: '广告' },
  { v: 'Narration', tw: '旁白 / 解說', cn: '旁白 / 解说' },
  { v: 'Audiobook', tw: '有聲書', cn: '有声书' },
  { v: 'Corporate', tw: '企業簡介 / 形象', cn: '企业简介 / 形象' },
  { v: 'E-Learning', tw: '教育 / 課程', cn: '教育 / 课程' },
  { v: 'Game', tw: '遊戲', cn: '游戏' },
  { v: 'Animation', tw: '動畫 / 卡通', cn: '动画 / 卡通' },
  { v: 'Film / Drama', tw: '戲劇 / 影視', cn: '戏剧 / 影视' },
  { v: 'Documentary', tw: '紀錄片', cn: '纪录片' },
  { v: 'Podcast', tw: 'Podcast / 訪談', cn: '播客 / 访谈' },
  { v: 'IVR', tw: '電話語音 (IVR)', cn: '电话语音 (IVR)' },
  { v: 'Other', tw: '其他', cn: '其他' },
];
// Selecting an AI option routes the client to the right studio (this form is human-only).
const AI_TYPES = [
  { v: 'AI Voice / TTS', tw: 'AI 配音 / TTS', cn: 'AI 配音 / TTS', to: '/voice', s: { tw: '配音工作室', cn: '配音工作室', en: 'Voice Studio' } },
  { v: 'AI Training Data', tw: 'AI 訓練資料', cn: 'AI 训练资料', to: '/data', s: { tw: '數據工作室', cn: '数据工作室', en: 'Data Studio' } },
];
// Where it plays (single-select) — the big pricing lever.
const MEDIA: Opt[] = [
  { v: 'TV (Broadcast)', tw: '單一電視', cn: '单一电视' },
  { v: 'Radio (Broadcast)', tw: '單一廣播', cn: '单一广播' },
  { v: 'All Digital', tw: '全數位媒體', cn: '全数字媒体' },
  { v: 'All Media (TV + Digital)', tw: '全媒體(電視+數位)', cn: '全媒体(电视+数字)' },
];
const TERRITORY: Opt[] = [
  { v: 'Global', tw: '全球', cn: '全球' },
  { v: 'Single region', tw: '單一地區(台灣)', cn: '单一地区(台湾)' },
  { v: 'Other', tw: '其他指定', cn: '其他指定' },
];
const LICENSE: Opt[] = [
  { v: '1 year', tw: '一年', cn: '一年' },
  { v: '3 years', tw: '三年', cn: '三年' },
  { v: '5 years', tw: '五年', cn: '五年' },
  { v: 'Perpetual / Buyout', tw: '永久 / 買斷', cn: '永久 / 买断' },
  { v: 'Not sure', tw: '其他 / 不確定', cn: '其他 / 不确定' },
];
const SCRIPT_STATUS: Opt[] = [
  { v: 'Final script ready', tw: '已有完整稿件', cn: '已有完整稿件' },
  { v: 'Direction only', tw: '有方向,細節可討論', cn: '有方向,细节可讨论' },
  { v: 'No script — match by demo', tw: '沒稿,聽既有 demo 抓 feel', cn: '没稿,听既有 demo 抓 feel' },
];

const inputCls =
  'w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm focus:border-amber-500 focus:outline-none placeholder:text-gray-600';

export default function Hire() {
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);
  const L: 'tw' | 'cn' | 'en' = isZhCN ? 'cn' : isZh ? 'tw' : 'en';
  const lbl = (o: Opt) => (L === 'en' ? o.v : o[L]);
  const localePath = (p: string) => (locale === 'en' ? p : `/${locale}${p}`);

  const [form, setForm] = useState({ name: '', company: '', email: '', language: '', length: '', budget: '', deadline: '', auditionDeadline: '', refUrl: '', brief: '' });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const [contentType, setContentType] = useState('');
  const [hasSinging, setHasSinging] = useState(false);
  const [wantsDirector, setWantsDirector] = useState(false);
  const [wantsLiveSession, setWantsLiveSession] = useState(false);
  const [media, setMedia] = useState('');
  const [territory, setTerritory] = useState('');
  const [license, setLicense] = useState('');
  const [scriptStatus, setScriptStatus] = useState('');
  const [redirect, setRedirect] = useState<{ to: string; label: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);

  const pickContent = (v: string) => { setRedirect(null); setContentType(v); };
  const pickAi = (a: (typeof AI_TYPES)[number]) => {
    setContentType('');
    setRedirect({ to: localePath(a.to), label: L === 'en' ? a.s.en : a.s[L] });
  };

  const Select = ({ value, onChange, opts, placeholder }: { value: string; onChange: (v: string) => void; opts: Opt[]; placeholder: string }) => (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="" className="bg-zinc-900">{placeholder}</option>
      {opts.map((o) => <option key={o.v} value={o.v} className="bg-zinc-900">{lbl(o)}</option>)}
    </select>
  );

  const submit = async () => {
    setError('');
    if (!form.email || !emailOk) return setError(tx('請填寫有效的 Email', '请填写有效的 Email', 'Please enter a valid email'));
    if (!contentType) return setError(tx('請選擇案件類型', '请选择案件类型', 'Please choose a project type'));
    if (!form.brief.trim()) return setError(tx('請簡述您的需求', '请简述您的需求', 'Please describe your project'));
    setSubmitting(true);
    try {
      const r = await fetch('/api/hire', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          content_type: contentType,
          categories: contentType ? [contentType] : [],
          has_singing: hasSinging,
          media_scope: media,
          territory,
          license_term: license,
          script_status: scriptStatus,
          ref_audio_url: form.refUrl,
          audition_deadline: form.auditionDeadline,
          wants_director: wantsDirector,
          wants_live_session: wantsLiveSession,
          locale,
        }),
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

  const pill = (active: boolean) =>
    `inline-flex items-center px-3 py-1.5 rounded-lg text-sm border transition-all mr-2 mb-2 ${active ? 'bg-amber-500/15 text-amber-300 border-amber-500/40' : 'bg-zinc-900 text-gray-400 border-zinc-700 hover:border-zinc-500'}`;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 pt-28 pb-16">
        <p className="text-xs tracking-[0.25em] uppercase text-amber-300 mb-2">{tx('ONYX · 找配音', 'ONYX · 找配音', 'ONYX · Find a voice')}</p>
        <h1 className="text-3xl font-bold mb-2">{tx('告訴我們您的配音需求', '告诉我们您的配音需求', 'Tell us about your voiceover project')}</h1>
        <p className="text-gray-400 text-sm mb-3">{tx('填好需求,我們會為您挑選合適的配音員並回覆報價。約 2 分鐘。', '填好需求,我们会为您挑选合适的配音员并回复报价。约 2 分钟。', 'Share your brief and we’ll match you with the right voice and quote it. About 2 minutes.')}</p>
        <p className="text-xs text-gray-500 mb-8">{tx('這裡是真人配音發案。需要 AI 配音 / TTS 或 AI 訓練資料?在「案件類型」選對應項,我們帶你去對的工作室。', '这里是真人配音发案。需要 AI 配音 / TTS 或 AI 训练资料?在「案件类型」选对应项,我们带你去对的工作室。', 'This is for human voiceover. Need AI / TTS or AI training data? Pick it under “Project type” and we’ll point you to the right studio.')}</p>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm text-gray-200 mb-1">{tx('您的稱呼', '您的称呼', 'Your name')}</label><input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
            <div><label className="block text-sm text-gray-200 mb-1">{tx('公司 / 品牌', '公司 / 品牌', 'Company / brand')} <span className="text-xs text-gray-500">{tx('選填', '选填', 'Optional')}</span></label><input className={inputCls} value={form.company} onChange={(e) => set('company', e.target.value)} /></div>
          </div>
          <div><label className="block text-sm text-gray-200 mb-1">Email <span className="text-red-400">＊</span></label><input className={inputCls} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder={tx('我們會將報價回覆到這裡', '我们会将报价回复到这里', 'We’ll send the quote here')} /></div>

          <div>
            <label className="block text-sm text-gray-200 mb-1">{tx('案件類型', '案件类型', 'Project type')} <span className="text-red-400">＊</span> <span className="text-xs text-gray-500">{tx('單選', '单选', 'Choose one')}</span></label>
            <div>{CONTENT_TYPES.map((c) => (
              <button key={c.v} type="button" onClick={() => pickContent(c.v)} className={pill(contentType === c.v)}>{lbl(c)}</button>
            ))}</div>
            <div className="mt-1">
              <span className="text-xs text-gray-500 mr-2">{tx('以下由我們直接製作:', '以下由我们直接制作:', 'Handled by us directly:')}</span>
              {AI_TYPES.map((a) => (
                <button key={a.v} type="button" onClick={() => pickAi(a)} className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm border transition-all mr-2 mb-2 bg-zinc-900 text-sky-300/80 border-sky-700/40 hover:border-sky-500`}>{L === 'en' ? a.v : a[L]} →</button>
              ))}
            </div>
            {contentType && ['Game', 'Animation', 'Film / Drama'].includes(contentType) && (
              <label className="mt-1 inline-flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input type="checkbox" checked={hasSinging} onChange={(e) => setHasSinging(e.target.checked)} className="accent-amber-500" />
                {tx('含唱歌 / 需要演唱', '含唱歌 / 需要演唱', 'Includes singing')}
              </label>
            )}
          </div>

          {redirect ? (
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/[0.06] p-5 text-center">
              <p className="text-sm text-gray-100 mb-1">{tx('這類需求由我們直接製作', '这类需求由我们直接制作', 'This is produced by us directly')}</p>
              <p className="text-xs text-gray-400 mb-4">{tx('不走真人配音發案,請前往對應的工作室。', '不走真人配音发案,请前往对应的工作室。', 'It doesn’t go through human-voice briefs — head to the right studio.')}</p>
              <a href={redirect.to} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-sky-500 text-black font-medium text-sm">{tx('前往', '前往', 'Go to')} {redirect.label} →</a>
              <div><button type="button" onClick={() => setRedirect(null)} className="text-xs text-gray-500 mt-3 hover:text-gray-300">{tx('← 返回真人配音發案', '← 返回真人配音发案', '← Back to human voiceover')}</button></div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-gray-200 mb-1">{tx('播放媒體', '播放媒体', 'Media')} <span className="text-xs text-gray-500">{tx('選填', '选填', 'Optional')}</span></label><Select value={media} onChange={setMedia} opts={MEDIA} placeholder={tx('在哪裡播放?', '在哪里播放?', 'Where does it play?')} /></div>
                <div><label className="block text-sm text-gray-200 mb-1">{tx('播放地區', '播放地区', 'Territory')} <span className="text-xs text-gray-500">{tx('選填', '选填', 'Optional')}</span></label><Select value={territory} onChange={setTerritory} opts={TERRITORY} placeholder={tx('全球或單一地區?', '全球或单一地区?', 'Global or single region?')} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-gray-200 mb-1">{tx('授權期間', '授权期间', 'License term')} <span className="text-xs text-gray-500">{tx('選填', '选填', 'Optional')}</span></label><Select value={license} onChange={setLicense} opts={LICENSE} placeholder={tx('使用多久?', '使用多久?', 'How long?')} /></div>
                <div><label className="block text-sm text-gray-200 mb-1">{tx('稿件狀態', '稿件状态', 'Script status')} <span className="text-xs text-gray-500">{tx('選填', '选填', 'Optional')}</span></label><Select value={scriptStatus} onChange={setScriptStatus} opts={SCRIPT_STATUS} placeholder={tx('有稿件嗎?', '有稿件吗?', 'Got a script?')} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-gray-200 mb-1">{tx('語言 / 口音', '语言 / 口音', 'Language / accent')}</label><input className={inputCls} value={form.language} onChange={(e) => set('language', e.target.value)} placeholder={tx('例:中文台灣 / 英文美國', '例:中文台湾 / 英文美国', 'e.g. Chinese (TW) / English (US)')} /></div>
                <div><label className="block text-sm text-gray-200 mb-1">{tx('長度 / 字數', '长度 / 字数', 'Length / word count')}</label><input className={inputCls} value={form.length} onChange={(e) => set('length', e.target.value)} placeholder={tx('例:30 秒 / 約 200 字', '例:30 秒 / 约 200 字', 'e.g. 30 sec / ~200 words')} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-gray-200 mb-1">{tx('試音 / Demo 截止', '试音 / Demo 截止', 'Audition / demo deadline')} <span className="text-xs text-gray-500">{tx('選填', '选填', 'Optional')}</span></label><input className={inputCls} value={form.auditionDeadline} onChange={(e) => set('auditionDeadline', e.target.value)} placeholder={tx('例:6/15 前收試音', '例:6/15 前收试音', 'e.g. auditions by 6/15')} /></div>
                <div><label className="block text-sm text-gray-200 mb-1">{tx('完成 / 交付截止', '完成 / 交付截止', 'Delivery deadline')} <span className="text-xs text-gray-500">{tx('選填', '选填', 'Optional')}</span></label><input className={inputCls} value={form.deadline} onChange={(e) => set('deadline', e.target.value)} placeholder={tx('例:6/30 前交件', '例:6/30 前交件', 'e.g. final by 6/30')} /></div>
              </div>
              <div>
                <label className="block text-sm text-gray-200 mb-1">{tx('錄製需求', '录制需求', 'Recording options')} <span className="text-xs text-gray-500">{tx('選填 · 加值', '选填 · 加值', 'Optional · add-on')}</span></label>
                <div className="flex flex-wrap gap-x-5 gap-y-2 mt-1">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-300 cursor-pointer"><input type="checkbox" checked={wantsDirector} onChange={(e) => setWantsDirector(e.target.checked)} className="accent-amber-500" />{tx('需要聲音導演(現場指導語氣、節奏)', '需要声音导演(现场指导语气、节奏)', 'Voice director (live coaching of tone & pacing)')}</label>
                  <label className="inline-flex items-center gap-2 text-sm text-gray-300 cursor-pointer"><input type="checkbox" checked={wantsLiveSession} onChange={(e) => setWantsLiveSession(e.target.checked)} className="accent-amber-500" />{tx('線上同步指導錄音(您可線上即時加入)', '线上同步指导录音(您可线上即时加入)', 'Live online session (join to direct in real time)')}</label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-gray-200 mb-1">{tx('預算', '预算', 'Budget')} <span className="text-xs text-gray-500">{tx('選填', '选填', 'Optional')}</span></label><input className={inputCls} value={form.budget} onChange={(e) => set('budget', e.target.value)} placeholder={tx('有預算範圍最好媒合', '有预算范围最好媒合', 'A range helps us match')} /></div>
                <div><label className="block text-sm text-gray-200 mb-1">{tx('參考聲音(連結)', '参考声音(链接)', 'Reference voice (link)')} <span className="text-xs text-gray-500">{tx('選填', '选填', 'Optional')}</span></label><input className={inputCls} value={form.refUrl} onChange={(e) => set('refUrl', e.target.value)} placeholder={tx('貼您喜歡的聲音 / 參考 demo 連結', '贴您喜欢的声音 / 参考 demo 链接', 'Link to a voice / demo you like')} /></div>
              </div>
              <div><label className="block text-sm text-gray-200 mb-1">{tx('需求說明 / 稿件', '需求说明 / 稿件', 'Brief / script')} <span className="text-red-400">＊</span></label><textarea className={`${inputCls} min-h-[120px] resize-y`} value={form.brief} onChange={(e) => set('brief', e.target.value)} placeholder={tx('用途、語氣、參考、稿件內容…越清楚我們越好媒合。', '用途、语气、参考、稿件内容…越清楚我们越好媒合。', 'Use case, tone, references, the script… the clearer, the better we can match.')} /></div>

              {error && <p className="text-sm text-red-400">{error}</p>}
              <button type="button" disabled={submitting} onClick={submit} className="w-full py-3 rounded-xl bg-amber-500 text-black font-medium flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                <Check className="w-4 h-4" /> {submitting ? tx('送出中…', '送出中…', 'Submitting…') : tx('送出需求', '送出需求', 'Submit brief')}
              </button>
              <p className="text-center text-xs text-gray-500">{tx('送出後我們會盡快與您聯繫並提供報價。', '送出后我们会尽快与您联系并提供报价。', 'We’ll be in touch with a quote shortly.')}</p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

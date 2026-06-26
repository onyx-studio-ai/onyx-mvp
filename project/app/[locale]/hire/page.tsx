'use client';

/*
  Client "find a voice / post a brief" form — HUMAN voiceover only.
  Separates content type (single-select) from media/territory/license (the
  pricing-critical dimensions). AI / TTS / training-data intent is routed out to
  the right studio instead of submitting a human brief. Tri-lingual.

  Field model (2026-06): language + optional accent (free-text fallback, like the
  talent application), voices-needed + gender composition, a script the client can
  paste OR upload (audition vs final), length by minutes or words, and recording
  add-ons (voice director / live session / local studio by region). Script status
  is no longer collected. UI styling is intentionally left as-is for now — the
  brief is to get every field right first.
*/

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Opt = { v: string; tw: string; cn: string };
type Opt3 = { v: string; tw: string; cn: string; en: string };

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
// Base language (accent captured separately, below). The world has too many
// languages to enumerate — "Other" lets the client type their own.
const LANGUAGES: Opt3[] = [
  { v: 'Chinese (Mandarin)', tw: '中文(國語 / 普通話)', cn: '中文(国语 / 普通话)', en: 'Chinese (Mandarin)' },
  { v: 'Cantonese', tw: '粵語', cn: '粤语', en: 'Cantonese' },
  { v: 'Taiwanese Hokkien', tw: '台語(閩南語)', cn: '台语(闽南语)', en: 'Taiwanese Hokkien' },
  { v: 'English', tw: '英文', cn: '英文', en: 'English' },
  { v: 'Japanese', tw: '日語', cn: '日语', en: 'Japanese' },
  { v: 'Korean', tw: '韓語', cn: '韩语', en: 'Korean' },
  { v: 'Spanish', tw: '西班牙語', cn: '西班牙语', en: 'Spanish' },
  { v: 'French', tw: '法語', cn: '法语', en: 'French' },
  { v: 'German', tw: '德語', cn: '德语', en: 'German' },
  { v: 'Portuguese', tw: '葡萄牙語', cn: '葡萄牙语', en: 'Portuguese' },
  { v: 'Italian', tw: '義大利語', cn: '意大利语', en: 'Italian' },
  { v: 'Russian', tw: '俄語', cn: '俄语', en: 'Russian' },
  { v: 'Arabic', tw: '阿拉伯語', cn: '阿拉伯语', en: 'Arabic' },
  { v: 'Thai', tw: '泰語', cn: '泰语', en: 'Thai' },
  { v: 'Vietnamese', tw: '越南語', cn: '越南语', en: 'Vietnamese' },
  { v: 'Indonesian', tw: '印尼語', cn: '印尼语', en: 'Indonesian' },
  { v: 'Malay', tw: '馬來語', cn: '马来语', en: 'Malay' },
  { v: 'Hindi', tw: '印地語', cn: '印地语', en: 'Hindi' },
  { v: '__other__', tw: '其他(自行填寫)', cn: '其他(自行填写)', en: 'Other (type it)' },
];
// Accent — optional, but always offered. "None / no preference" and a free-text
// "Other" cover the long tail (there are far too many accents to list).
const ACCENTS: Opt3[] = [
  { v: '__none__', tw: '不指定', cn: '不指定', en: 'No preference' },
  { v: 'Taiwan', tw: '台灣腔', cn: '台湾腔', en: 'Taiwan' },
  { v: 'Mainland', tw: '大陸 / 普通話', cn: '大陆 / 普通话', en: 'Mainland' },
  { v: 'Hong Kong', tw: '香港', cn: '香港', en: 'Hong Kong' },
  { v: 'Malaysia Chinese', tw: '馬來西亞華語', cn: '马来西亚华语', en: 'Malaysian Chinese' },
  { v: 'American', tw: '美式', cn: '美式', en: 'American' },
  { v: 'British', tw: '英式', cn: '英式', en: 'British' },
  { v: 'Australian', tw: '澳洲', cn: '澳洲', en: 'Australian' },
  { v: 'Indian', tw: '印度', cn: '印度', en: 'Indian' },
  { v: 'Singapore', tw: '新加坡', cn: '新加坡', en: 'Singaporean' },
  { v: 'Canadian', tw: '加拿大', cn: '加拿大', en: 'Canadian' },
  { v: '__other__', tw: '其他(自行填寫)', cn: '其他(自行填写)', en: 'Other (type it)' },
];
const VOICES_NEEDED: Opt3[] = [
  { v: '1', tw: '1 位', cn: '1 位', en: '1 voice' },
  { v: '2', tw: '2 位', cn: '2 位', en: '2 voices' },
  { v: '3+', tw: '3 位以上', cn: '3 位以上', en: '3 or more' },
];
const GENDER_NEEDS: Opt3[] = [
  { v: 'Any', tw: '不限', cn: '不限', en: 'No preference' },
  { v: 'Male', tw: '限男聲', cn: '限男声', en: 'Male only' },
  { v: 'Female', tw: '限女聲', cn: '限女声', en: 'Female only' },
  { v: 'Mixed', tw: '男女皆需', cn: '男女皆需', en: 'Both' },
  { v: '__other__', tw: '自訂組成', cn: '自订组成', en: 'Custom mix' },
];
const LENGTH_UNITS: Opt3[] = [
  { v: 'minutes', tw: '分鐘', cn: '分钟', en: 'minutes' },
  { v: 'words', tw: '字數', cn: '字数', en: 'words' },
];
const SCRIPT_TYPES: Opt3[] = [
  { v: 'audition', tw: '試音稿', cn: '试音稿', en: 'Audition script' },
  { v: 'final', tw: '正式稿', cn: '正式稿', en: 'Final script' },
];
const STUDIO_REGIONS: Opt3[] = [
  { v: 'Taiwan', tw: '台灣', cn: '台湾', en: 'Taiwan' },
  { v: 'Mainland China', tw: '中國大陸', cn: '中国大陆', en: 'Mainland China' },
  { v: 'Hong Kong', tw: '香港', cn: '香港', en: 'Hong Kong' },
  { v: 'USA', tw: '美國', cn: '美国', en: 'USA' },
  { v: 'UK', tw: '英國', cn: '英国', en: 'UK' },
  { v: '__other__', tw: '其他(自行填寫)', cn: '其他(自行填写)', en: 'Other (type it)' },
];
const CURRENCIES = ['USD', 'TWD'];
const SCRIPT_EXT = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'pages', 'md'];
// Role-based content types — these get the per-character casting role sheet.
const ROLE_TYPES = ['Game', 'Animation', 'Film / Drama'];

const inputCls =
  'w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-amber-500/60 focus:outline-none placeholder:text-gray-600';

export default function Hire() {
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);
  const L: 'tw' | 'cn' | 'en' = isZhCN ? 'cn' : isZh ? 'tw' : 'en';
  const lbl = (o: Opt) => (L === 'en' ? o.v : o[L]);
  const lbl3 = (o: Opt3) => (L === 'en' ? o.en : o[L]);
  const localePath = (p: string) => (locale === 'en' ? p : `/${locale}${p}`);

  const [form, setForm] = useState({ title: '', name: '', company: '', email: '', length: '', budget: '', deadline: '', auditionDeadline: '', refUrl: '', brief: '' });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const [budgetCurrency, setBudgetCurrency] = useState('USD');
  const [contentType, setContentType] = useState('');
  const [hasSinging, setHasSinging] = useState(false);
  const [wantsDirector, setWantsDirector] = useState(false);
  const [wantsLiveSession, setWantsLiveSession] = useState(false);
  const [budgetType, setBudgetType] = useState('Up to');
  const [liveSessionTool, setLiveSessionTool] = useState('');
  const [liveSessionOther, setLiveSessionOther] = useState('');
  const [media, setMedia] = useState('');
  const [territory, setTerritory] = useState('');
  const [license, setLicense] = useState('');
  // language + accent (free-text fallback)
  const [language, setLanguage] = useState('');
  const [languageOther, setLanguageOther] = useState('');
  const [accent, setAccent] = useState('');
  const [accentOther, setAccentOther] = useState('');
  // length unit, voices + gender
  const [lengthUnit, setLengthUnit] = useState('minutes');
  const [voicesNeeded, setVoicesNeeded] = useState('1');
  const [genderNeeds, setGenderNeeds] = useState('Any');
  const [genderOther, setGenderOther] = useState('');
  // script: type + paste/upload
  const [scriptType, setScriptType] = useState('audition');
  const [scriptMode, setScriptMode] = useState<'paste' | 'upload'>('paste');
  const [scriptText, setScriptText] = useState('');
  const [scriptFileUrl, setScriptFileUrl] = useState('');
  const [scriptFileName, setScriptFileName] = useState('');
  const [scriptUploading, setScriptUploading] = useState(false);
  // role sheet (game / drama / animation only)
  const [rolesFileUrl, setRolesFileUrl] = useState('');
  const [rolesFileName, setRolesFileName] = useState('');
  const [rolesUploading, setRolesUploading] = useState(false);
  // local studio add-on
  const [wantsLocalStudio, setWantsLocalStudio] = useState(false);
  const [studioRegion, setStudioRegion] = useState('');
  const [studioRegionOther, setStudioRegionOther] = useState('');

  const [redirect, setRedirect] = useState<{ to: string; label: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  // Tailored entry: arriving from the "100% Live Studio" pricing card (?from=live-studio)
  // pre-selects the live online session and hides the AI-routing options (they already chose human).
  const [isLiveStudio, setIsLiveStudio] = useState(false);
  // Arriving from a talent profile's "Enquire" — pre-fills the requested talent;
  // the rest of the brief is still required.
  const [requestedTalent, setRequestedTalent] = useState('');
  const [requestedTalentId, setRequestedTalentId] = useState('');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('from') === 'live-studio') { setIsLiveStudio(true); setWantsLiveSession(true); }
    const t = sp.get('talent'); if (t) setRequestedTalent(t);
    const tid = sp.get('talentId'); if (tid) setRequestedTalentId(tid);
  }, []);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  // a real link must start with http(s):// and have a domain — blocks "123" / "fdf"
  const refUrlOk = !form.refUrl.trim() || /^https?:\/\/[^\s.]+\.[^\s]{2,}/i.test(form.refUrl.trim());

  const pickContent = (v: string) => { setRedirect(null); setContentType(v); };
  const pickAi = (a: (typeof AI_TYPES)[number]) => {
    setContentType('');
    setRedirect({ to: localePath(a.to), label: L === 'en' ? a.s.en : a.s[L] });
  };

  // Resolve an option to its stored label, honouring the free-text "Other".
  const resolve3 = (val: string, other: string, opts: Opt3[]) => {
    if (!val || val === '__none__') return '';
    if (val === '__other__') return other.trim();
    const o = opts.find((x) => x.v === val);
    return o ? lbl3(o) : val;
  };

  async function uploadScript(file: File) {
    setError('');
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!SCRIPT_EXT.includes(ext)) { setError(tx('稿件檔案格式不支援(pdf / doc / docx / txt / rtf 等)', '稿件档案格式不支持(pdf / doc / docx / txt / rtf 等)', 'Unsupported script file type (pdf / doc / docx / txt / rtf …)')); return; }
    if (file.size > 25 * 1024 * 1024) { setError(tx('稿件檔案請勿超過 25MB', '稿件档案请勿超过 25MB', 'Script file must be under 25MB')); return; }
    setScriptUploading(true);
    try {
      const u = await fetch('/api/hire/script-upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name }) });
      const uj = await u.json().catch(() => ({}));
      if (!u.ok) throw new Error(uj.error || 'upload prep failed');
      const { error: upErr } = await supabase.storage.from('casting').uploadToSignedUrl(uj.path, uj.token, file);
      if (upErr) throw new Error(upErr.message);
      setScriptFileUrl(uj.publicUrl); setScriptFileName(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : tx('稿件上傳失敗,請重試', '稿件上传失败,请重试', 'Script upload failed — please try again'));
    } finally { setScriptUploading(false); }
  }

  async function uploadRolesFile(file: File) {
    setError('');
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) { setError(tx('請上傳 Excel(xlsx)角色表', '请上传 Excel(xlsx)角色表', 'Please upload an Excel (xlsx) role sheet')); return; }
    if (file.size > 25 * 1024 * 1024) { setError(tx('角色表請勿超過 25MB', '角色表请勿超过 25MB', 'Role sheet must be under 25MB')); return; }
    setRolesUploading(true);
    try {
      const u = await fetch('/api/hire/script-upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name }) });
      const uj = await u.json().catch(() => ({}));
      if (!u.ok) throw new Error(uj.error || 'upload prep failed');
      const { error: upErr } = await supabase.storage.from('casting').uploadToSignedUrl(uj.path, uj.token, file);
      if (upErr) throw new Error(upErr.message);
      setRolesFileUrl(uj.publicUrl); setRolesFileName(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : tx('角色表上傳失敗,請重試', '角色表上传失败,请重试', 'Role sheet upload failed — please try again'));
    } finally { setRolesUploading(false); }
  }

  // Single-select rendered as pills to match the music/data brief design.
  const Select = ({ value, onChange, opts }: { value: string; onChange: (v: string) => void; opts: Opt[]; placeholder?: string }) => (
    <div className="flex flex-wrap">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm border transition mr-2 mb-2 ${value === o.v ? 'bg-amber-500 text-black border-amber-500' : 'bg-white/5 text-gray-300 border-white/10 hover:border-white/30'}`}
        >{lbl(o)}</button>
      ))}
    </div>
  );

  const submit = async () => {
    setError('');
    if (!form.email || !emailOk) return setError(tx('請填寫有效的 Email', '请填写有效的 Email', 'Please enter a valid email'));
    if (!contentType) return setError(tx('請選擇案件類型', '请选择案件类型', 'Please choose a project type'));
    if (!media) return setError(tx('請選擇播放媒體', '请选择播放媒体', 'Please choose the media'));
    if (!territory) return setError(tx('請選擇播放地區', '请选择播放地区', 'Please choose the territory'));
    if (!license) return setError(tx('請選擇授權期間', '请选择授权期间', 'Please choose the license term'));
    if (!language) return setError(tx('請選擇語言', '请选择语言', 'Please choose the language'));
    if (language === '__other__' && !languageOther.trim()) return setError(tx('請填寫語言', '请填写语言', 'Please specify the language'));
    if (accent === '__other__' && !accentOther.trim()) return setError(tx('請填寫口音', '请填写口音', 'Please specify the accent'));
    if (genderNeeds === '__other__' && !genderOther.trim()) return setError(tx('請填寫聲音性別組成', '请填写声音性别组成', 'Please specify the gender composition'));
    if (wantsLocalStudio && !studioRegion) return setError(tx('請選擇當地錄音室地區', '请选择当地录音室地区', 'Please choose the local studio region'));
    if (wantsLocalStudio && studioRegion === '__other__' && !studioRegionOther.trim()) return setError(tx('請填寫當地錄音室地區', '请填写当地录音室地区', 'Please specify the local studio region'));
    if (!form.budget.trim()) return setError(tx('請填預算金額', '请填预算金额', 'Please enter a budget amount'));
    if (!refUrlOk) return setError(tx('參考連結格式不正確,請貼完整網址(http(s)://…)或留空', '参考链接格式不正确,请贴完整网址(http(s)://…)或留空', 'Reference link must be a full URL (http(s)://…) or left blank'));
    if (scriptUploading) return setError(tx('稿件仍在上傳中,請稍候', '稿件仍在上传中,请稍候', 'Script is still uploading — please wait'));
    if (!form.brief.trim()) return setError(tx('請簡述您的需求', '请简述您的需求', 'Please describe your project'));

    const resolvedLanguage = resolve3(language, languageOther, LANGUAGES);
    const resolvedAccent = resolve3(accent, accentOther, ACCENTS);
    const resolvedGender = resolve3(genderNeeds, genderOther, GENDER_NEEDS);
    const resolvedRegion = wantsLocalStudio ? resolve3(studioRegion, studioRegionOther, STUDIO_REGIONS) : '';
    const unitLabel = lbl3(LENGTH_UNITS.find((u) => u.v === lengthUnit) || LENGTH_UNITS[0]);
    const resolvedLength = form.length.trim() ? `${form.length.trim()} ${unitLabel}` : '';
    const hasScript = scriptMode === 'paste' ? !!scriptText.trim() : !!scriptFileUrl;

    setSubmitting(true);
    try {
      const r = await fetch('/api/hire', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          title: form.title,
          language: resolvedLanguage,
          accent: resolvedAccent,
          length: resolvedLength,
          voices_needed: voicesNeeded,
          gender_needs: resolvedGender,
          // budget carries its currency so the admin sees e.g. "Up to USD 500"
          budget: `${budgetCurrency} ${form.budget.trim()}`,
          budget_currency: budgetCurrency,
          brief: requestedTalent ? `${tx('指定配音員', '指定配音员', 'Requested talent')}: ${requestedTalent}\n\n${form.brief}` : form.brief,
          requested_talent: requestedTalent,
          requested_talent_id: requestedTalentId,
          content_type: contentType,
          categories: contentType ? [contentType] : [],
          has_singing: hasSinging,
          media_scope: media,
          territory,
          license_term: license,
          // script (paste OR upload), typed as audition / final
          script_type: hasScript ? scriptType : '',
          script_text: scriptMode === 'paste' ? scriptText.trim() : '',
          script_file_url: scriptMode === 'upload' ? scriptFileUrl : '',
          roles_file_url: ROLE_TYPES.includes(contentType) ? rolesFileUrl : '',
          ref_audio_url: form.refUrl,
          audition_deadline: form.auditionDeadline,
          wants_director: wantsDirector,
          wants_live_session: wantsLiveSession,
          live_session_tool: wantsLiveSession ? (liveSessionTool === 'Other' ? liveSessionOther : liveSessionTool) : '',
          local_studio_region: resolvedRegion,
          budget_type: budgetType,
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
    `inline-flex items-center px-3 py-1.5 rounded-full text-sm border transition mr-2 mb-2 ${active ? 'bg-amber-500 text-black border-amber-500' : 'bg-white/5 text-gray-300 border-white/10 hover:border-white/30'}`;

  const NativeSelect = ({ value, onChange, opts, placeholder }: { value: string; onChange: (v: string) => void; opts: Opt3[]; placeholder: string }) => (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="" className="bg-zinc-900">{placeholder}</option>
      {opts.map((o) => <option key={o.v} value={o.v} className="bg-zinc-900">{lbl3(o)}</option>)}
    </select>
  );

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-4 pt-28 pb-16">
        <p className="text-xs tracking-[0.25em] uppercase text-amber-300 mb-2">{tx('ONYX · 找配音', 'ONYX · 找配音', 'ONYX · Find a voice')}</p>
        <h1 className="text-3xl font-bold mb-2">{tx('告訴我們您的配音需求', '告诉我们您的配音需求', 'Tell us about your voiceover project')}</h1>
        <p className="text-gray-400 text-sm mb-3">{tx('填好需求,我們會為您挑選合適的配音員並回覆報價。', '填好需求,我们会为您挑选合适的配音员并回复报价。', 'Share your brief and we’ll match you with the right voice and quote it.')}</p>
        {isLiveStudio ? (
          <div className="mb-8 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3">
            <p className="text-sm font-semibold text-amber-300">{tx('100% 真人錄音室 · 全真人現場錄製', '100% 真人录音室 · 全真人现场录制', '100% Live Studio · fully human, live-recorded')}</p>
            <p className="text-xs text-gray-400 mt-0.5">{tx('已為您預選「線上同步指導錄音」。填好需求,我們會回覆客製報價。', '已为您预选「线上同步指导录音」。填好需求,我们会回复客制报价。', 'Live online session is pre-selected. Share your brief and we’ll reply with a custom quote.')}</p>
          </div>
        ) : (
          <p className="text-xs text-gray-500 mb-8">{tx('這裡是真人配音發案。需要 AI 配音 / TTS 或 AI 訓練資料?在「案件類型」選對應項,我們帶你去對的工作室。', '这里是真人配音发案。需要 AI 配音 / TTS 或 AI 训练资料?在「案件类型」选对应项,我们带你去对的工作室。', 'This is for human voiceover. Need AI / TTS or AI training data? Pick it under “Project type” and we’ll point you to the right studio.')}</p>
        )}

        {requestedTalent && (
          <div className="mb-8 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-300">{tx('指定配音員:', '指定配音员:', 'Requested talent:')} {requestedTalent}</p>
              <p className="text-xs text-gray-400 mt-0.5">{tx('已為您指定這位配音員。請補齊以下需求,我們會據此回覆報價。', '已为您指定这位配音员。请补齐以下需求,我们会据此回复报价。', 'This talent is attached to your enquiry. Fill in the brief below and we’ll quote accordingly.')}</p>
            </div>
            <button type="button" onClick={() => { setRequestedTalent(''); setRequestedTalentId(''); }} className="shrink-0 text-xs text-gray-400 hover:text-white">{tx('移除', '移除', 'Remove')}</button>
          </div>
        )}

        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-semibold mb-2">{tx('您的稱呼', '您的称呼', 'Your name')}</label><input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
            <div><label className="block text-sm font-semibold mb-2">{tx('公司 / 品牌', '公司 / 品牌', 'Company / brand')} <span className="text-xs text-gray-500">{tx('選填', '选填', 'Optional')}</span></label><input className={inputCls} value={form.company} onChange={(e) => set('company', e.target.value)} /></div>
          </div>
          <div><label className="block text-sm font-semibold mb-2">Email <span className="text-red-400">＊</span></label><input className={inputCls} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder={tx('我們會將報價回覆到這裡', '我们会将报价回复到这里', 'We’ll send the quote here')} /></div>

          <div><label className="block text-sm font-semibold mb-2">{tx('案件標題', '案件标题', 'Project title')} <span className="text-xs text-gray-500">{tx('選填', '选填', 'Optional')}</span></label><input className={inputCls} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder={tx('例:手機遊戲角色配音', '例:手机游戏角色配音', 'e.g. Mobile game character voiceover')} /></div>

          <div>
            <label className="block text-sm font-semibold mb-2">{tx('案件類型', '案件类型', 'Project type')} <span className="text-red-400">＊</span> <span className="text-xs text-gray-500">{tx('單選', '单选', 'Choose one')}</span></label>
            <div>{CONTENT_TYPES.map((c) => (
              <button key={c.v} type="button" onClick={() => pickContent(c.v)} className={pill(contentType === c.v)}>{lbl(c)}</button>
            ))}</div>
            {!isLiveStudio && (
              <div className="mt-1">
                <span className="text-xs text-gray-500 mr-2">{tx('以下由我們直接製作:', '以下由我们直接制作:', 'Handled by us directly:')}</span>
                {AI_TYPES.map((a) => (
                  <button key={a.v} type="button" onClick={() => pickAi(a)} className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm border transition-all mr-2 mb-2 bg-zinc-900 text-sky-300/80 border-sky-700/40 hover:border-sky-500`}>{L === 'en' ? a.v : a[L]} →</button>
                ))}
              </div>
            )}
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
              <div><label className="block text-sm font-semibold mb-2">{tx('播放媒體', '播放媒体', 'Media')} <span className="text-red-400">＊</span></label><Select value={media} onChange={setMedia} opts={MEDIA} /></div>
              <div><label className="block text-sm font-semibold mb-2">{tx('播放地區', '播放地区', 'Territory')} <span className="text-red-400">＊</span></label><Select value={territory} onChange={setTerritory} opts={TERRITORY} /></div>
              <div><label className="block text-sm font-semibold mb-2">{tx('授權期間', '授权期间', 'License term')} <span className="text-red-400">＊</span></label><Select value={license} onChange={setLicense} opts={LICENSE} /></div>

              {/* Language + accent (accent optional; free-text fallback for both) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">{tx('語言', '语言', 'Language')} <span className="text-red-400">＊</span></label>
                  <NativeSelect value={language} onChange={setLanguage} opts={LANGUAGES} placeholder={tx('請選擇語言', '请选择语言', 'Select a language')} />
                  {language === '__other__' && <input className={`${inputCls} mt-2`} value={languageOther} onChange={(e) => setLanguageOther(e.target.value)} placeholder={tx('請填寫語言', '请填写语言', 'Type the language')} />}
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">{tx('口音', '口音', 'Accent')} <span className="text-xs text-gray-500">{tx('選填', '选填', 'Optional')}</span></label>
                  <NativeSelect value={accent} onChange={setAccent} opts={ACCENTS} placeholder={tx('不指定', '不指定', 'No preference')} />
                  {accent === '__other__' && <input className={`${inputCls} mt-2`} value={accentOther} onChange={(e) => setAccentOther(e.target.value)} placeholder={tx('請填寫口音', '请填写口音', 'Type the accent')} />}
                </div>
              </div>

              {/* Voices needed + gender composition */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">{tx('需要幾位配音員', '需要几位配音员', 'How many voices')}</label>
                  <NativeSelect value={voicesNeeded} onChange={setVoicesNeeded} opts={VOICES_NEEDED} placeholder={tx('請選擇', '请选择', 'Select')} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">{tx('聲音性別', '声音性别', 'Voice gender')}</label>
                  <NativeSelect value={genderNeeds} onChange={setGenderNeeds} opts={GENDER_NEEDS} placeholder={tx('不限', '不限', 'No preference')} />
                  {genderNeeds === '__other__' && <input className={`${inputCls} mt-2`} value={genderOther} onChange={(e) => setGenderOther(e.target.value)} placeholder={tx('例:2 男 1 女', '例:2 男 1 女', 'e.g. 2 male, 1 female')} />}
                </div>
              </div>

              {/* Length by minutes OR words */}
              <div>
                <label className="block text-sm font-semibold mb-2">{tx('長度', '长度', 'Length')} <span className="text-xs text-gray-500">{tx('選填', '选填', 'Optional')}</span></label>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" className={`${inputCls} flex-1`} value={form.length} onChange={(e) => set('length', e.target.value)} placeholder={tx('數量', '数量', 'Amount')} />
                  <div className="flex">
                    {LENGTH_UNITS.map((u) => (
                      <button key={u.v} type="button" onClick={() => setLengthUnit(u.v)} className={pill(lengthUnit === u.v)}>{lbl3(u)}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Script — paste OR upload, audition vs final */}
              <div>
                <label className="block text-sm font-semibold mb-2">{tx('稿件', '稿件', 'Script')} <span className="text-xs text-gray-500">{tx('選填', '选填', 'Optional')}</span></label>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{tx('稿件類型', '稿件类型', 'Type')}</span>
                    {SCRIPT_TYPES.map((s) => (
                      <button key={s.v} type="button" onClick={() => setScriptType(s.v)} className={pill(scriptType === s.v)}>{lbl3(s)}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{tx('提供方式', '提供方式', 'Provide via')}</span>
                    <button type="button" onClick={() => setScriptMode('paste')} className={pill(scriptMode === 'paste')}>{tx('貼上文字', '贴上文字', 'Paste text')}</button>
                    <button type="button" onClick={() => setScriptMode('upload')} className={pill(scriptMode === 'upload')}>{tx('上傳檔案', '上传档案', 'Upload file')}</button>
                  </div>
                </div>
                {scriptMode === 'paste' ? (
                  <textarea className={`${inputCls} min-h-[120px] resize-y`} value={scriptText} onChange={(e) => setScriptText(e.target.value)} placeholder={tx('將稿件內容貼在這裡', '将稿件内容贴在这里', 'Paste the script here')} />
                ) : (
                  <div>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-200 cursor-pointer bg-white/5 border border-white/10 rounded-lg px-3 py-2 hover:border-white/30">
                      {scriptUploading ? tx('上傳中…', '上传中…', 'Uploading…') : tx('選擇稿件檔案', '选择稿件档案', 'Choose a script file')}
                      <input type="file" accept=".pdf,.doc,.docx,.txt,.rtf,.odt,.pages,.md" className="hidden" disabled={scriptUploading} onChange={(e) => e.target.files?.[0] && uploadScript(e.target.files[0])} />
                    </label>
                    {scriptFileName && <span className="ml-3 text-xs text-emerald-300">✓ {scriptFileName}</span>}
                    <p className="text-xs text-gray-500 mt-1.5">{tx('支援 pdf / doc / docx / txt / rtf,單檔 25MB 內。', '支持 pdf / doc / docx / txt / rtf,单档 25MB 内。', 'pdf / doc / docx / txt / rtf, up to 25MB.')}</p>
                  </div>
                )}
              </div>

              {/* Role sheet — only for role-based content (game / drama / animation) */}
              {ROLE_TYPES.includes(contentType) && (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.05] px-4 py-3.5">
                  <label className="block text-sm font-semibold mb-1">{tx('角色表', '角色表', 'Character roster')} <span className="text-xs text-gray-500">{tx('選填 · 多角色建議填寫', '选填 · 多角色建议填写', 'Optional · recommended for multiple roles')}</span></label>
                  <p className="text-xs text-gray-400 mb-3">{tx('下載範本,每個角色填一列(角色名、性別、聲音年齡、試音台詞為必填),填好上傳;我們會精準帶入每個角色的試音。', '下载范本,每个角色填一列(角色名、性别、声音年龄、试音台词为必填),填好上传;我们会精准带入每个角色的试音。', 'Download the template, one row per character (name, gender, voice age, audition line required), then upload it — we’ll import each role precisely.')}</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <a href="/api/hire/role-template" className="inline-flex items-center gap-1.5 text-sm bg-white/10 border border-white/15 rounded-lg px-3 py-2 hover:bg-white/15 transition">⬇ {tx('下載角色表範本', '下载角色表范本', 'Download template')}</a>
                    <label className="inline-flex items-center gap-1.5 text-sm bg-amber-500/15 border border-amber-500/40 text-amber-200 rounded-lg px-3 py-2 cursor-pointer hover:bg-amber-500/25 transition">
                      {rolesUploading ? tx('上傳中…', '上传中…', 'Uploading…') : tx('⬆ 上傳填好的角色表', '⬆ 上传填好的角色表', '⬆ Upload filled sheet')}
                      <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={rolesUploading} onChange={(e) => e.target.files?.[0] && uploadRolesFile(e.target.files[0])} />
                    </label>
                    {rolesFileName && <span className="text-xs text-emerald-300">✓ {rolesFileName}</span>}
                  </div>
                </div>
              )}

              {/* Timeline — both optional, an estimate that gives buffer */}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-semibold mb-2">{tx('試音截止日', '试音截止日', 'Audition deadline')} <span className="text-xs text-gray-500">{tx('選填', '选填', 'Optional')}</span></label><input className={`${inputCls} [color-scheme:dark]`} type="date" value={form.auditionDeadline} onChange={(e) => set('auditionDeadline', e.target.value)} /></div>
                <div><label className="block text-sm font-semibold mb-2">{tx('預計完成日', '预计完成日', 'Estimated delivery date')} <span className="text-xs text-gray-500">{tx('選填', '选填', 'Optional')}</span></label><input className={`${inputCls} [color-scheme:dark]`} type="date" value={form.deadline} onChange={(e) => set('deadline', e.target.value)} /></div>
              </div>

              {/* Recording add-ons */}
              <div>
                <label className="block text-sm font-semibold mb-2">{tx('錄製需求', '录制需求', 'Recording options')} <span className="text-xs text-gray-500">{tx('選填 · 加值服務', '选填 · 加值服务', 'Optional · add-on')}</span></label>
                <div className="flex flex-col gap-2 mt-1">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-300 cursor-pointer"><input type="checkbox" checked={wantsDirector} onChange={(e) => setWantsDirector(e.target.checked)} className="accent-amber-500" />{tx('需要聲音導演(現場指導語氣、節奏)', '需要声音导演(现场指导语气、节奏)', 'Voice director (live coaching of tone & pacing)')}</label>
                  <label className="inline-flex items-center gap-2 text-sm text-gray-300 cursor-pointer"><input type="checkbox" checked={wantsLiveSession} onChange={(e) => setWantsLiveSession(e.target.checked)} className="accent-amber-500" />{tx('線上同步指導錄音(您可線上即時加入)', '线上同步指导录音(您可线上即时加入)', 'Live online session (join to direct in real time)')}</label>
                  <label className="inline-flex items-center gap-2 text-sm text-gray-300 cursor-pointer"><input type="checkbox" checked={wantsLocalStudio} onChange={(e) => setWantsLocalStudio(e.target.checked)} className="accent-amber-500" />{tx('當地實體錄音室(指定地區)', '当地实体录音室(指定地区)', 'Local recording studio (by region)')}</label>
                </div>
                {wantsLiveSession && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-400">{tx('偏好平台', '偏好平台', 'Preferred tool')}</span>
                    {['Zoom', 'Google Meet', 'Source-Connect', 'Other'].map((tool) => (
                      <button key={tool} type="button" onClick={() => setLiveSessionTool(tool)} className={pill(liveSessionTool === tool)}>{tool === 'Other' ? tx('其他', '其他', 'Other') : tool}</button>
                    ))}
                    {liveSessionTool === 'Other' && <input className={`${inputCls} flex-1 min-w-[140px] mb-2`} value={liveSessionOther} onChange={(e) => setLiveSessionOther(e.target.value)} placeholder={tx('自行填寫平台', '自行填写平台', 'Specify tool')} />}
                  </div>
                )}
                {wantsLocalStudio && (
                  <div className="mt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-gray-400">{tx('錄音室地區', '录音室地区', 'Studio region')}</span>
                      <div className="flex flex-wrap">
                        {STUDIO_REGIONS.map((rg) => (
                          <button key={rg.v} type="button" onClick={() => setStudioRegion(rg.v)} className={pill(studioRegion === rg.v)}>{lbl3(rg)}</button>
                        ))}
                      </div>
                      {studioRegion === '__other__' && <input className={`${inputCls} flex-1 min-w-[140px] mb-2`} value={studioRegionOther} onChange={(e) => setStudioRegionOther(e.target.value)} placeholder={tx('請填寫地區', '请填写地区', 'Type the region')} />}
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">{tx('我們將視該地區的合作資源安排;若暫無在地資源,會回覆您其他可行方案。', '我们将视该地区的合作资源安排;若暂无在地资源,会回复您其他可行方案。', 'Subject to our studio partners in that region; if none is available we’ll reply with alternatives.')}</p>
                  </div>
                )}
              </div>

              {/* Budget */}
              <div>
                <label className="block text-sm font-semibold mb-2">{tx('預算', '预算', 'Budget')} <span className="text-red-400">＊</span></label>
                <div className="flex flex-wrap items-center gap-2">
                  {([{ v: 'Up to', tw: '預算上限', cn: '预算上限' }, { v: 'Fixed', tw: '固定預算', cn: '固定预算' }] as Opt[]).map((o) => (
                    <button key={o.v} type="button" onClick={() => setBudgetType(o.v)} className={pill(budgetType === o.v)}>{lbl(o)}</button>
                  ))}
                  <select className={`${inputCls} w-24`} value={budgetCurrency} onChange={(e) => setBudgetCurrency(e.target.value)}>
                    {CURRENCIES.map((c) => <option key={c} value={c} className="bg-zinc-900">{c}</option>)}
                  </select>
                  <input type="number" min="0" className={`${inputCls} flex-1 min-w-[140px] mb-2`} value={form.budget} onChange={(e) => set('budget', e.target.value)} placeholder={tx('金額', '金额', 'Amount')} />
                </div>
              </div>

              <div><label className="block text-sm font-semibold mb-2">{tx('參考聲音(連結)', '参考声音(链接)', 'Reference voice (link)')} <span className="text-xs text-gray-500">{tx('選填', '选填', 'Optional')}</span></label><input className={`${inputCls} ${form.refUrl && !refUrlOk ? 'border-red-500/60' : ''}`} value={form.refUrl} onChange={(e) => set('refUrl', e.target.value)} placeholder={tx('貼完整網址,例:https://…', '贴完整网址,例:https://…', 'Full URL, e.g. https://…')} />{form.refUrl && !refUrlOk && <p className="text-xs text-red-400 mt-1">{tx('請貼完整連結(http(s)://…)', '请贴完整链接(http(s)://…)', 'Enter a full URL (http(s)://…)')}</p>}</div>

              <div><label className="block text-sm font-semibold mb-2">{tx('需求說明', '需求说明', 'Brief')} <span className="text-red-400">＊</span></label><textarea className={`${inputCls} min-h-[120px] resize-y`} value={form.brief} onChange={(e) => set('brief', e.target.value)} placeholder={tx('用途、語氣風格、參考方向、其他想法… 越清楚我們越好媒合。(稿件請填在上方「稿件」欄)', '用途、语气风格、参考方向、其他想法… 越清楚我们越好媒合。(稿件请填在上方「稿件」栏)', 'Use case, tone & style, references, any other thoughts… the clearer, the better we can match. (Put the actual script in the “Script” field above.)')} /></div>

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

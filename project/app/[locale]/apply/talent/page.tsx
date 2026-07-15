'use client';

/*
  Independent NEW talent-onboarding form — lives at /apply/talent and is its
  OWN form (Wing's decision: SEPARATE from /apply/voice, never merged).
  Tri-lingual (zh-TW / zh-CN / en-US) via the same useLocale()+tx() idiom as
  app/[locale]/page.tsx. Option lists store ENGLISH canonical values (`v`) to
  stay consistent with /apply/voice + filterable casting data; only the labels
  are localized. Reuses /api/apply/upload-url + /api/apply/submit.
  New DB columns (display_name, messaging_contacts, coop_*, low_price_data_optin,
  excluded_countries, coop_proofread) come from migration 20260619000000.
  coop_voice_director added in migration 20260623120000.
*/

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { Check, X, Plus, ArrowRight, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { LANGUAGES } from '@/lib/languages';
import { useFormDraft, DraftBanner } from '@/lib/use-form-draft';

const STEPS = [
  { tw: '基本資料', cn: '基本资料', en: 'Basics' },
  { tw: '您的聲音', cn: '您的声音', en: 'Your voice' },
  { tw: '錄音環境', cn: '录音环境', en: 'Recording' },
  { tw: '合作意願', cn: '合作意愿', en: 'Collaboration' },
  { tw: '作品', cn: '作品', en: 'Demo' },
  { tw: '同意', cn: '同意', en: 'Consent' },
];

// 語言用全平台唯一標準清單(lib/languages),別再另存一份 → 值才不會分岔。
const LANG_OPTIONS = LANGUAGES;
const CATEGORIES = [
  { v: 'Commercial', tw: '廣告', cn: '广告' },
  { v: 'Narration', tw: '旁白', cn: '旁白' },
  { v: 'Audiobook', tw: '有聲書', cn: '有声书' },
  { v: 'Corporate', tw: '工商簡介', cn: '工商简介' },
  { v: 'E-Learning', tw: '教育教學', cn: '教育教学' },
  { v: 'Documentary', tw: '紀錄片', cn: '纪录片' },
  { v: 'TV', tw: '電視', cn: '电视' },
  { v: 'Radio', tw: '廣播電台', cn: '广播电台' },
  { v: 'Movie Trailer', tw: '電影預告', cn: '电影预告' },
  { v: 'Web Video', tw: '網路影片', cn: '网络视频' },
  { v: 'Podcast', tw: 'Podcast', cn: '播客' },
  { v: 'IVR / Phone System', tw: '來電語音 / IVR', cn: '来电语音 / IVR' },
  { v: 'Voice Assistant', tw: '語音助理', cn: '语音助理' },
  { v: 'News', tw: '新聞播報', cn: '新闻播报' },
  { v: 'Video Game', tw: '遊戲', cn: '游戏' },
  { v: 'Animation / Character', tw: '動畫', cn: '动画' },
  { v: 'Drama / Character', tw: '戲劇 · 角色配音', cn: '戏剧 · 角色配音' },
  { v: 'Pop Singing', tw: '流行歌配唱', cn: '流行歌配唱' },
  { v: 'Character Singing', tw: '角色配唱', cn: '角色配唱' },
];
const FEELS = [
  { v: 'Warm', tw: '溫暖', cn: '温暖' },
  { v: 'Calm', tw: '沉穩', cn: '沉稳' },
  { v: 'Energetic', tw: '活潑', cn: '活泼' },
  { v: 'Friendly', tw: '親切', cn: '亲切' },
  { v: 'Smooth', tw: '磁性', cn: '磁性' },
  { v: 'Authoritative', tw: '自信', cn: '自信' },
  { v: 'Bright', tw: '年輕', cn: '年轻' },
  { v: 'Deep', tw: '成熟', cn: '成熟' },
];
const ENVS = [
  { v: 'Professional Studio', tw: '有專業錄音室', cn: '有专业录音棚', en: 'I have a professional studio' },
  { v: 'Home Studio', tw: '有安靜的居家錄音空間', cn: '有安静的居家录音空间', en: 'I have a quiet home setup' },
  { v: '', tw: '目前沒有,需要協助', cn: '目前没有,需要协助', en: "Not yet — I'd need help" },
];
const AGES = [
  { v: 'Youth', tw: '青年', cn: '青年' },
  { v: 'Young Adult', tw: '輕熟齡', cn: '轻熟龄' },
  { v: 'Middle-aged', tw: '中年', cn: '中年' },
  { v: 'Mature', tw: '成熟 / 年長', cn: '成熟 / 年长' },
];
const GENDERS = [
  { v: 'Male', tw: '男', cn: '男' },
  { v: 'Female', tw: '女', cn: '女' },
  { v: 'Non-binary', tw: '其他 / 不透露', cn: '其他 / 不透露', en: 'Other / prefer not to say' },
];
const COOP = [
  { key: 'jobs',
    tw: { t: '① 承接配音案件', d: '當有合適案件時,我們會主動通知您,是否承接由您決定。案件完成後即可獲得酬勞,平台收取 20% 服務費。' },
    cn: { t: '① 承接配音案件', d: '当有合适案件时,我们会主动通知您,是否承接由您决定。案件完成后即可获得酬劳,平台收取 20% 服务费。' },
    en: { t: '① Accept voiceover work', d: 'When a suitable project arises, we will notify you; whether to accept is entirely your decision. You receive payment on completion, and the platform retains a 20% service fee.' } },
  { key: 'buyout',
    tw: { t: '② 開放聲音買斷', d: '客戶可一次性買斷特定一段錄音的使用權,僅限該段聲音、屬非獨家授權,您仍可自由承接其他案件。' },
    cn: { t: '② 开放声音买断', d: '客户可一次性买断特定一段录音的使用权,仅限该段声音、属非独家授权,您仍可自由承接其他案件。' },
    en: { t: '② Allow voice buyouts', d: 'A client may acquire full rights to a specific recording in a one-time buyout — limited to that audio and non-exclusive. You remain free to take on other work.' } },
  { key: 'aiClone',
    tw: { t: '③ 將聲音製作為 AI(會使用您的聲音)', d: '客戶以您的聲音建立 AI 語音,屬非獨家授權,您仍可錄製其他 TTS 或配音案件。實際執行前將另行簽署授權書。' },
    cn: { t: '③ 将声音制作为 AI(会使用您的声音)', d: '客户以您的声音建立 AI 语音,属非独家授权,您仍可录制其他 TTS 或配音案件。实际执行前将另行签署授权书。' },
    en: { t: '③ Develop an AI voice from your voice (uses your voice)', d: 'A client builds an AI voice based on your voice, under a non-exclusive licence; you may still record other TTS or voiceover work. A separate licence agreement is signed before any project proceeds.' } },
  { key: 'aiTrain',
    tw: { t: '④ 錄製 AI 訓練素材(不會使用您的聲音)', d: '依指示錄製語句或對話作為訓練素材;您的聲音不會被複製,也不會對外呈現。' },
    cn: { t: '④ 录制 AI 训练素材(不会使用您的声音)', d: '依指示录制语句或对话作为训练素材;您的声音不会被复制,也不会对外呈现。' },
    en: { t: '④ Record AI training data (does not use your voice)', d: 'You record sentences or dialogue as training material; your voice is neither cloned nor made public.' } },
  { key: 'proofread',
    tw: { t: '⑤ 語音校對', d: '聆聽指定音檔,標示唸錯或讀錯之處,並提供正確讀音(含同音字判讀)。一般可快速完成,內容較長者(約 30 秒以上)需較多時間。僅於有需求時邀約,費用依長度另行議定。' },
    cn: { t: '⑤ 语音校对', d: '聆听指定音档,标示念错或读错之处,并提供正确读音(含同音字判读)。一般可快速完成,内容较长者(约 30 秒以上)需较多时间。仅于有需求时邀约,费用依长度另行议定。' },
    en: { t: '⑤ Audio proofreading', d: 'Listen to a supplied recording, flag mispronounced or misread words, and provide the correct reading (including homophones). Usually quick; longer pieces (30s+) require more time. Engaged on a per-project basis, with fees agreed by length.' } },
  { key: 'voiceDirector',
    tw: { t: '⑥ 擔任聲音導演', d: '若您有聲音導演經驗 —— 於錄音現場指導其他配音員的表演、咬字、節奏與情緒,我們有相關案件時可邀請您擔任聲音導演。費用依案件另行議定。' },
    cn: { t: '⑥ 担任声音导演', d: '若您有声音导演经验 —— 于录音现场指导其他配音员的表演、咬字、节奏与情绪,我们有相关案件时可邀请您担任声音导演。费用依案件另行议定。' },
    en: { t: '⑥ Voice directing', d: 'If you have experience as a voice director — guiding other talents on performance, delivery, pacing and emotion during a session — we may invite you to direct when such projects come up. Fees agreed per project.' } },
] as const;

const inputCls =
  'w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm focus:border-amber-500 focus:outline-none placeholder:text-gray-600';

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border transition-all mr-2 mb-2 ${
        active ? 'bg-amber-500/15 text-amber-300 border-amber-500/40' : 'bg-zinc-900 text-gray-400 border-zinc-700 hover:border-zinc-500'
      }`}>
      {children}
    </button>
  );
}

function Label({ children, hint, req }: { children: React.ReactNode; hint?: string; req?: boolean }) {
  return (
    <label className="block text-sm text-gray-200 mb-1">
      {children}{req && <span className="text-red-400 ml-0.5">＊</span>} {hint && <span className="text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

export default function TalentApply() {
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);
  const L: 'tw' | 'cn' | 'en' = isZhCN ? 'cn' : isZh ? 'tw' : 'en';
  // option label: localized field, falling back to canonical `v` (English)
  const lbl = (o: { v: string; tw: string; cn: string; en?: string }) => o[L] ?? o.v;
  const langLabel = (v: string) => { const o = LANG_OPTIONS.find((x) => x.v === v); return o ? lbl(o) : v; };

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    display_name: '', english_name: '', full_name: '', email: '', phone: '',
    msg_line: '', msg_whatsapp: '', msg_telegram: '',
    gender: '', age_range: '',
    years_experience: '', turnaround: '',
    microphone_model: '', excluded_countries: '',
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const [langs, setLangs] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [cats, setCats] = useState<string[]>([]);
  const [feels, setFeels] = useState<string[]>([]);
  const [feelQ, setFeelQ] = useState('');
  const [env, setEnv] = useState<string | null>(null);
  const [coop, setCoop] = useState({ jobs: true, buyout: false, aiClone: false, aiTrain: false, proofread: false, voiceDirector: false });
  const [lowData, setLowData] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [agreeOwn, setAgreeOwn] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [doneNo, setDoneNo] = useState<string | null>(null);

  // Email verification (stateless OTP via /api/apply/email-code)
  const [emailVerified, setEmailVerified] = useState(false);
  const [codeMeta, setCodeMeta] = useState<{ token: string; exp: number } | null>(null);
  // OTP proof kept after a successful verify so submit can re-prove it server-side
  // (verifyCode clears codeMeta/code on success, so we must stash it separately).
  const [otpProof, setOtpProof] = useState<{ code: string; token: string; exp: number } | null>(null);
  const [code, setCode] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeMsg, setCodeMsg] = useState('');
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);

  // 表單自動草稿(檔案與 email 驗證狀態不入草稿:File 無法序列化、OTP 有時效)
  const draft = useFormDraft('apply-talent', { step, form, langs, cats, feels, env, coop, lowData }, (d) => {
    setStep(d.step ?? 0); setForm((f) => ({ ...f, ...(d.form || {}) }));
    setLangs(d.langs || []); setCats(d.cats || []); setFeels(d.feels || []);
    setEnv(d.env ?? null); if (d.coop) setCoop(d.coop); setLowData(!!d.lowData);
  });

  const onEmailChange = (v: string) => { set('email', v); setEmailVerified(false); setCodeMeta(null); setOtpProof(null); setCode(''); setCodeMsg(''); };

  const sendCode = async () => {
    setCodeBusy(true); setCodeMsg('');
    try {
      const r = await fetch('/api/apply/email-code', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', email: form.email, locale }),
      });
      const j = await r.json();
      if (!r.ok) {
        if (j.error === 'already_member' || j.error === 'already_applied') {
          setCodeMsg(tx('這個 Email 已註冊 / 申請過,不需重新申請。請至 onyxstudios.ai/talent 登入(忘記密碼可用「重寄設定密碼信」)。', '这个 Email 已注册 / 申请过,不需重新申请。请至 onyxstudios.ai/talent 登录(忘记密码可用「重寄设置密码邮件」)。', 'This email has already registered / applied — no need to re-apply. Please sign in at onyxstudios.ai/talent (use “resend set-password” if you forgot your password).'));
          return;
        }
        if (j.error === 'too_soon') { setCodeMsg(tx('剛剛才寄出驗證碼,請稍等一分鐘再重寄。', '刚刚才寄出验证码,请稍等一分钟再重寄。', 'A code was just sent — please wait a minute before resending.')); return; }
        if (j.error === 'rate_limited') { setCodeMsg(tx('嘗試次數過多,請稍後再試。', '尝试次数过多,请稍后再试。', 'Too many attempts — please try again later.')); return; }
        throw new Error(j.error || tx('寄送失敗', '发送失败', 'Failed to send'));
      }
      setCodeMeta({ token: j.token, exp: j.exp });
      setCodeMsg(tx('驗證碼已寄到你的 Email', '验证码已寄到你的 Email', 'Code sent to your email'));
    } catch (e) { setCodeMsg(e instanceof Error ? e.message : tx('寄送失敗', '发送失败', 'Failed to send')); }
    finally { setCodeBusy(false); }
  };

  const verifyCode = async () => {
    if (!codeMeta) return;
    setCodeBusy(true); setCodeMsg('');
    try {
      const r = await fetch('/api/apply/email-code', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', email: form.email, code, token: codeMeta.token, exp: codeMeta.exp }),
      });
      const j = await r.json();
      if (j.ok) {
        // Stash the proof (code+token+exp) so submit can re-verify it server-side.
        setOtpProof({ code, token: codeMeta.token, exp: codeMeta.exp });
        setEmailVerified(true); setCodeMeta(null); setCodeMsg('');
      }
      else setCodeMsg(j.expired ? tx('驗證碼已過期,請重新傳送', '验证码已过期,请重新发送', 'Code expired — please resend') : tx('驗證碼不正確', '验证码不正确', 'Incorrect code'));
    } catch (e) { setCodeMsg(e instanceof Error ? e.message : tx('驗證失敗', '验证失败', 'Verification failed')); }
    finally { setCodeBusy(false); }
  };

  const toggleIn = (arr: string[], setA: (v: string[]) => void, v: string) =>
    setA(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const trimmed = q.trim();
  const matches = trimmed ? LANG_OPTIONS.filter((o) => !langs.includes(o.v) && lbl(o).includes(trimmed)) : [];
  const canAddCustom = !!trimmed && !LANG_OPTIONS.some((o) => lbl(o) === trimmed) && !langs.includes(trimmed);
  const addLang = (v: string) => { if (!langs.includes(v)) setLangs([...langs, v]); setQ(''); };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; setFileError('');
    if (!f) { setFile(null); return; }
    // 只收專業音檔,擋 m4a(iPhone/Mac 錄音預設)等,當業餘過濾器(Wing 2026-07-06)。
    const ok = ['wav', 'wave', 'mp3', 'aiff', 'aif', 'aac', 'ogg', 'flac'].some((x) => f.name.toLowerCase().endsWith('.' + x));
    if (!ok) { setFileError(tx('只接受 WAV / MP3 / AIFF / AAC / OGG / FLAC 專業音檔;不收手機錄音(m4a)。請以專業設備錄製,或轉檔後再上傳。', '只接受 WAV / MP3 / AIFF / AAC / OGG / FLAC 专业音档;不收手机录音(m4a)。请以专业设备录制,或转档后再上传。', 'Only professional audio (WAV / MP3 / AIFF / AAC / OGG / FLAC) is accepted — phone recordings (m4a) are not. Please use professional equipment, or convert the file first.')); setFile(null); return; }
    if (f.size > 50 * 1024 * 1024) { setFileError(tx('檔案請小於 50MB', '档案请小于 50MB', 'File must be under 50 MB')); setFile(null); return; }
    setFile(f);
  };

  const handleSubmit = async () => {
    setError('');
    for (let s = 0; s < STEPS.length - 1; s++) { const e = stepError(s); if (e) { setError(e); setStep(s); return; } }
    if (!agreeOwn || !agreeTerms) { setError(tx('請勾選下方兩項聲明與同意', '请勾选下方两项声明与同意', 'Please tick both statements below')); return; }
    setSubmitting(true);
    try {
      let fileUrl = '', fileName = '', fileSize = 0;
      if (file) {
        const safe = (form.display_name || form.full_name).replace(/\s+/g, '');
        fileName = `${safe || 'talent'}_demo.${file.name.split('.').pop()}`;
        const urlRes = await fetch('/api/apply/upload-url', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName, role: 'Voice' }),
        });
        const urlJson = await urlRes.json();
        if (!urlRes.ok) throw new Error(urlJson.error || tx('上傳準備失敗,請重試', '上传准备失败,请重试', 'Upload prep failed — please try again'));
        const { error: upErr } = await supabase.storage
          .from('talent-submissions')
          .uploadToSignedUrl(urlJson.path, urlJson.token, file);
        if (upErr) throw new Error(`${tx('上傳失敗', '上传失败', 'Upload failed')}: ${upErr.message}`);
        fileUrl = urlJson.path as string; fileSize = file.size;
      }

      const payload = {
        role_type: 'VO',
        locale,
        full_name: form.full_name,
        display_name: form.display_name,
        english_name: form.english_name,
        email: form.email,
        phone: form.phone,
        country: '',
        messaging_contacts: { line: form.msg_line, whatsapp: form.msg_whatsapp, telegram: form.msg_telegram },
        gender: form.gender,
        age_range: form.age_range,
        years_experience: form.years_experience ? parseInt(form.years_experience, 10) : null,
        turnaround: form.turnaround || null,
        languages: langs,
        specialties: cats,
        voice_types: feels,
        recording_environment: env ?? '',
        microphone_model: form.microphone_model,
        coop_accept_jobs: coop.jobs,
        coop_open_buyout: coop.buyout,
        coop_ai_clone: coop.aiClone,
        coop_ai_training: coop.aiTrain,
        coop_proofread: coop.proofread,
        coop_voice_director: coop.voiceDirector,
        low_price_data_optin: lowData,
        excluded_countries: form.excluded_countries ? [form.excluded_countries] : [],
        consent_data_processing: agreeTerms,
        consent_terms: agreeOwn,
        consent_moral_rights: agreeOwn,
        consent_voice_id: false,
        consent_age_verified: agreeTerms,
        consent_legal_agreement: agreeTerms,
        fileUrl, fileName, fileSize,
        // OTP 證明 —— 後端用同一套 HMAC 重驗這個 email 真的通過驗證(不信前端布林)
        otpCode: otpProof?.code ?? '',
        otpToken: otpProof?.token ?? '',
        otpExp: otpProof?.exp ?? 0,
      };

      const res = await fetch('/api/apply/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tx('送出失敗,請重試', '送出失败,请重试', 'Submission failed — please try again'));
      draft.clear();
      setDoneNo(data.application_number || tx('已送出', '已送出', 'Submitted'));
    } catch (e) {
      setError(e instanceof Error ? e.message : tx('發生錯誤,請重試', '发生错误,请重试', 'Something went wrong — please try again'));
    } finally {
      setSubmitting(false);
    }
  };

  // Per-step required-field check. Returns an error message, or '' if the step is OK.
  const stepError = (s: number): string => {
    if (s === 0) {
      if (!form.display_name || !form.full_name || !form.email) return tx('請填寫顯示名稱、真實姓名與 Email', '请填写显示名称、真实姓名与 Email', 'Please fill in your display name, legal name and email');
      if (!emailVerified) return tx('請先完成 Email 驗證', '请先完成 Email 验证', 'Please verify your email first');
    }
    if (s === 1) {
      if (!form.gender) return tx('請選擇性別', '请选择性别', 'Please select a gender');
      if (langs.length === 0) return tx('「可配語言與口音」請至少選 1 項', '「可配语言与口音」请至少选 1 项', 'Please select at least one language / accent');
      if (cats.length === 0) return tx('「能接的案件類型」請至少選 1 項', '「能接的案件类型」请至少选 1 项', 'Please select at least one job type');
    }
    if (s === 2 && env === null) return tx('請選擇您目前的錄音環境', '请选择您目前的录音环境', 'Please select your recording setup');
    if (s === 2 && !form.microphone_model.trim()) return tx('請填寫您的麥克風 / 錄音設備', '请填写您的麦克风 / 录音设备', 'Please enter your microphone / recording gear');
    if (s === 3 && !Object.values(coop).some(Boolean)) return tx('「合作意願」請至少選 1 項', '「合作意愿」请至少选 1 项', 'Please select at least one way to collaborate');
    if (s === 4 && !file) return tx('請上傳一段 demo 音檔', '请上传一段 demo 音档', 'Please upload a demo file');
    return '';
  };

  // Navigate to a step; going forward requires all earlier steps to pass.
  const goTo = (target: number) => {
    for (let k = 0; k < target; k++) { const e = stepError(k); if (e) { setError(e); setStep(k); return; } }
    setError('');
    setStep(target);
  };

  if (doneNo) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-amber-500 flex items-center justify-center mx-auto mb-5"><Check className="w-8 h-8 text-black" /></div>
          <h1 className="text-2xl font-bold mb-2">{tx('報名完成!', '报名完成!', 'Application received!')}</h1>
          <p className="text-gray-400 text-sm">{tx('你的報名編號:', '你的报名编号:', 'Your application number: ')}<span className="text-amber-300">{doneNo}</span></p>
          <p className="text-gray-500 text-xs mt-4 leading-relaxed">{tx('我們已收到你的資料,確認信會寄到你的 Email。有合適的案子會主動通知你。', '我们已收到你的资料,确认信会寄到你的 Email。有合适的案子会主动通知你。', "We've got your details — a confirmation email is on its way. We'll reach out when a fitting job comes up.")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 pt-28 pb-12">
        <p className="text-xs tracking-widest text-gray-400 mb-1">{tx('ONYX · 配音員報名', 'ONYX · 配音员报名', 'ONYX · Voice Talent Application')}</p>
        <h1 className="text-2xl font-bold mb-1">{tx('歡迎加入 Onyx 配音陣容', '欢迎加入 Onyx 配音阵容', 'Join the Onyx voice roster')}</h1>
        <p className="text-sm text-gray-400 mb-1">{tx('請完整填寫以下資料,約需 2 分鐘。', '请完整填写以下资料,约需 2 分钟。', 'Please complete the form below — it takes about 2 minutes.')}</p>
        <p className="text-xs text-gray-500 mb-8">{tx('標示 ＊ 為必填項目,其餘皆為選填。', '标示 ＊ 为必填项目,其余皆为选填。', 'Fields marked ＊ are required; all others are optional.')}</p>

        <DraftBanner draft={draft} tx={tx} />

        <div className="flex gap-1.5 mb-8">
          {STEPS.map((s, i) => (
            <button key={s.en} type="button" onClick={() => goTo(i)}
              className={`flex-1 text-[11px] py-1.5 rounded-md border transition-all ${
                i === step ? 'bg-amber-500 text-black border-amber-500' : i < step ? 'bg-zinc-800 text-gray-300 border-zinc-700' : 'bg-zinc-900 text-gray-500 border-zinc-800'
              }`}>
              {i + 1} {s[L]}
            </button>
          ))}
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 min-h-[340px]">
          {step === 0 && (
            <div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label req hint={tx('公開', '公开', 'Public')}>{tx('顯示名稱', '显示名称', 'Display name')}</Label><input className={inputCls} value={form.display_name} onChange={(e) => set('display_name', e.target.value)} placeholder={tx('客戶端顯示的名稱', '客户端显示的名称', 'Shown to clients')} /></div>
                <div><Label req hint={tx('不公開', '不公开', 'Private')}>{tx('真實姓名', '真实姓名', 'Legal name')}</Label><input className={inputCls} value={form.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder={tx('合約/付款用', '合约/付款用', 'For contracts & payment')} /></div>
              </div>
              <p className="text-xs text-amber-300/80 mt-2">{tx('「顯示名稱」會公開,請勿放電話、連結或個人聯絡資訊 —— 聯絡方式請填下方專屬欄位(僅供我們聯繫、不公開)。', '「显示名称」会公开,请勿放电话、链接或个人联系信息 —— 联系方式请填下方专属栏位(仅供我们联系、不公开)。', 'Your display name is public — no phone, links or contact info there. Put contact details in the dedicated fields below (private, only for us to reach you).')}</p>
              <div className="mt-4">
                <Label hint={tx('選填,英文頁顯示', '选填,英文页显示', 'Optional')}>{tx('英文 / 羅馬拼音名', '英文 / 罗马拼音名', 'English / Romanized name')}</Label>
                <input className={inputCls} value={form.english_name} onChange={(e) => set('english_name', e.target.value)} placeholder={tx('例如:Jason Wang(英文頁會用,留空則顯示原名)', '例如:Jason Wang(英文页会用,留空则显示原名)', 'e.g. Jason Wang — used on the English site; blank shows your original name')} />
              </div>
              <div className="mt-4">
                <Label req>Email {emailVerified && <span className="text-emerald-400 text-xs">✓ {tx('已驗證', '已验证', 'Verified')}</span>}</Label>
                <div className="flex gap-2">
                  <input className={inputCls} type="email" value={form.email} onChange={(e) => onEmailChange(e.target.value)} disabled={emailVerified} placeholder={tx('案件通知將寄送至此', '案件通知将寄送至此', 'Job notifications are sent here')} />
                  {!emailVerified && (
                    <button type="button" onClick={sendCode} disabled={!emailOk || codeBusy}
                      className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-600 text-xs text-amber-300 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed">
                      {codeMeta ? tx('重新傳送', '重新发送', 'Resend') : tx('傳送驗證碼', '发送验证码', 'Send code')}
                    </button>
                  )}
                </div>
                {codeMeta && !emailVerified && (
                  <div className="flex gap-2 mt-2">
                    <input className={inputCls} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder={tx('輸入 6 位驗證碼', '输入 6 位验证码', 'Enter 6-digit code')} />
                    <button type="button" onClick={verifyCode} disabled={code.length !== 6 || codeBusy}
                      className="px-4 py-2 rounded-lg bg-amber-500 text-black text-xs font-medium whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed">
                      {tx('確認', '确认', 'Verify')}
                    </button>
                  </div>
                )}
                {codeMsg && <p className="text-xs mt-1.5 text-gray-400">{codeMsg}</p>}
              </div>
              <div className="mt-4"><Label hint={tx('只留存', '只留存', 'Stored only')}>{tx('手機', '手机', 'Phone')}</Label><input className={inputCls} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+886 …" /></div>
              <div className="mt-4">
                <Label hint={tx('選填,填任一即可', '选填,填任一即可', 'Optional — any one is fine')}>{tx('通訊軟體 ID', '通讯软体 ID', 'Messaging ID')}</Label>
                <div className="grid grid-cols-3 gap-2">
                  <input className={inputCls} placeholder="Line ID" value={form.msg_line} onChange={(e) => set('msg_line', e.target.value)} />
                  <input className={inputCls} placeholder={tx('WhatsApp 號碼', 'WhatsApp 号码', 'WhatsApp number')} value={form.msg_whatsapp} onChange={(e) => set('msg_whatsapp', e.target.value)} />
                  <input className={inputCls} placeholder={tx('Telegram @用戶名', 'Telegram @用户名', 'Telegram @username')} value={form.msg_telegram} onChange={(e) => set('msg_telegram', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label req>{tx('性別', '性别', 'Gender')}</Label>
                  <select className={inputCls} value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                    <option value="">{tx('— 選擇 —', '— 选择 —', '— Select —')}</option>
                    {GENDERS.map((g) => <option key={g.v} value={g.v}>{lbl(g)}</option>)}
                  </select>
                </div>
                <div><Label hint={tx('聲音聽起來的年齡', '声音听起来的年龄', 'How your voice sounds')}>{tx('年齡感', '年龄感', 'Voice age')}</Label>
                  <select className={inputCls} value={form.age_range} onChange={(e) => set('age_range', e.target.value)}>
                    <option value="">{tx('— 選擇 —', '— 选择 —', '— Select —')}</option>
                    {AGES.map((a) => <option key={a.v} value={a.v}>{lbl(a)}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div><Label hint={tx('精確年數', '精确年数', 'exact number')}>{tx('配音年資', '配音年资', 'Years of experience')}</Label>
                  <input className={inputCls} type="number" min="0" max="80" value={form.years_experience} onChange={(e) => set('years_experience', e.target.value)} placeholder={tx('例如:8', '例如:8', 'e.g. 8')} /></div>
                <div><Label hint={tx('一般交件時間', '一般交件时间', 'typical delivery')}>{tx('交期', '交期', 'Turnaround')}</Label>
                  <select className={inputCls} value={form.turnaround} onChange={(e) => set('turnaround', e.target.value)}>
                    <option value="">{tx('— 選擇 —', '— 选择 —', '— Select —')}</option>
                    <option value="24h">{tx('24 小時內', '24 小时内', 'Within 24h')}</option>
                    <option value="1-2d">{tx('1–2 天', '1–2 天', '1–2 days')}</option>
                    <option value="3-5d">{tx('3–5 天', '3–5 天', '3–5 days')}</option>
                    <option value="1w">{tx('1 週以上', '1 周以上', '1 week+')}</option>
                    <option value="flexible">{tx('視專案而定', '视项目而定', 'Depends on project')}</option>
                  </select></div>
              </div>
              <div className="mt-4">
                <Label req hint={tx('至少 1 項;可搜尋或自訂', '至少 1 项;可搜寻或自订', 'At least 1; search or add your own')}>{tx('可配語言與口音', '可配语言与口音', 'Languages & accents')}</Label>
                <div className="mb-2">{langs.map((v) => (<Chip key={v} active onClick={() => setLangs(langs.filter((x) => x !== v))}>{langLabel(v)} <X className="w-3 h-3" /></Chip>))}</div>
                <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx('搜尋語言或口音…', '搜寻语言或口音…', 'Search a language or accent…')} />
                {trimmed && (
                  <div className="mt-1.5 border border-zinc-700 rounded-lg p-1 bg-zinc-900">
                    {matches.map((m) => (<button key={m.v} type="button" onClick={() => addLang(m.v)} className="block w-full text-left px-2.5 py-1.5 text-sm text-gray-200 rounded-md hover:bg-zinc-800">{lbl(m)}</button>))}
                    {canAddCustom && (<button type="button" onClick={() => addLang(trimmed)} className="block w-full text-left px-2.5 py-1.5 text-sm text-amber-300 rounded-md hover:bg-zinc-800"><Plus className="w-3.5 h-3.5 inline -mt-0.5" /> {tx('新增', '新增', 'Add')}「{trimmed}」</button>)}
                    {matches.length === 0 && !canAddCustom && <p className="px-2.5 py-1.5 text-sm text-gray-500">{tx('換個關鍵字', '换个关键字', 'Try another keyword')}</p>}
                  </div>
                )}
              </div>
              <div className="mt-4"><Label req hint={tx('至少 1 項,可複選', '至少 1 项,可复选', 'At least 1; multi-select')}>{tx('能接的案件類型', '能接的案件类型', 'Job types you take')}</Label><div>{CATEGORIES.map((c) => <Chip key={c.v} active={cats.includes(c.v)} onClick={() => toggleIn(cats, setCats, c.v)}>{lbl(c)}</Chip>)}</div></div>
              <div className="mt-4">
                <Label hint={tx('複選,可自填', '复选,可自填', 'Multi-select; add your own')}>{tx('聲音給人的感覺', '声音给人的感觉', 'How your voice feels')}</Label>
                <div>
                  {FEELS.map((f) => <Chip key={f.v} active={feels.includes(f.v)} onClick={() => toggleIn(feels, setFeels, f.v)}>{lbl(f)}</Chip>)}
                  {feels.filter((f) => !FEELS.some((o) => o.v === f)).map((f) => <Chip key={f} active onClick={() => setFeels(feels.filter((x) => x !== f))}>{f} <X className="w-3 h-3" /></Chip>)}
                </div>
                <input className={inputCls} value={feelQ} onChange={(e) => setFeelQ(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const v = feelQ.trim(); if (v && !feels.includes(v)) setFeels([...feels, v]); setFeelQ(''); } }}
                  placeholder={tx('其他?自己打,按 Enter 新增', '其他?自己打,按 Enter 新增', 'Other? Type it and press Enter')} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="text-xs text-gray-400 leading-relaxed mb-4">{tx('高品質案件(尤其 AI 語音)需要乾淨、無雜訊的錄音。台灣與香港的配音員,Onyx 可協助安排錄音室。', '高品质案件(尤其 AI 语音)需要干净、无杂讯的录音。台湾与香港的配音员,Onyx 可协助安排录音室。', 'High-quality projects — particularly AI voice — require clean, noise-free recordings. For talents in Taiwan and Hong Kong, Onyx can help arrange studio access.')}</p>
              <Label req>{tx('您目前的錄音環境', '您目前的录音环境', 'Your current recording setup')}</Label>
              <div className="mb-4">{ENVS.map((e) => <Chip key={e.v || 'none'} active={env === e.v} onClick={() => setEnv(e.v)}>{lbl(e)}</Chip>)}</div>
              <Label req>{tx('麥克風 / 錄音設備', '麦克风 / 录音设备', 'Microphone / recording gear')}</Label>
              <input className={inputCls} value={form.microphone_model} onChange={(e) => set('microphone_model', e.target.value)} placeholder={tx('例:Rode NT1 + Focusrite 2i2', '例:Rode NT1 + Focusrite 2i2', 'e.g. Rode NT1 + Focusrite 2i2')} />
              <p className="text-xs text-amber-300/90 leading-relaxed mt-4 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2">{tx('如上傳 DEMO 使用手機錄音、或有明顯雜訊 / 回音者,有機會會被駁回申請。', '如上传 DEMO 使用手机录音、或有明显杂讯 / 回音者,有机会会被驳回申请。', 'Demos recorded on a phone, or with noticeable noise / echo, may lead to your application being declined.')}</p>
            </div>
          )}

          {step === 3 && (
            <div>
              <p className="text-sm text-gray-300 mb-1">{tx('您希望以哪些方式與我們合作?', '您希望以哪些方式与我们合作?', 'In what ways would you like to work with us?')}</p>
              <p className="text-xs text-gray-500 mb-4">{tx('請至少選擇一項,可複選。', '请至少选择一项,可复选。', 'Select at least one; you may choose several.')}</p>
              {COOP.map((c) => {
                const on = (coop as Record<string, boolean>)[c.key];
                const t = c[L];
                return (
                  <div key={c.key} onClick={() => setCoop({ ...coop, [c.key]: !on })}
                    className={`p-3.5 rounded-xl border cursor-pointer mb-2 transition-all ${on ? 'bg-amber-500/10 border-amber-500/40' : 'bg-zinc-900 border-zinc-700 hover:border-zinc-500'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border ${on ? 'bg-amber-500 border-amber-500' : 'border-zinc-600 bg-zinc-800'}`}>{on && <Check className="w-3.5 h-3.5 text-black" />}</div>
                      <div><p className="text-sm font-medium text-white">{t.t}</p><p className="text-xs text-gray-400 leading-relaxed mt-1">{t.d}</p></div>
                    </div>
                  </div>
                );
              })}
              <div onClick={() => setLowData(!lowData)} className={`p-3 rounded-lg border cursor-pointer mt-1 mb-4 text-sm flex items-start gap-2.5 ${lowData ? 'bg-zinc-800 border-zinc-600 text-gray-200' : 'bg-zinc-900 border-zinc-700 text-gray-400'}`}>
                <div className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border ${lowData ? 'bg-amber-500 border-amber-500' : 'border-zinc-600'}`}>{lowData && <Check className="w-3 h-3 text-black" />}</div>
                <span>{tx('此外:是否願意收到以手機錄製的「語音數據採集案」相關資訊?', '此外:是否愿意收到以手机录制的「语音数据采集案」相关资讯?', 'In addition: would you like to receive information about phone-recorded voice data-collection projects?')}</span>
              </div>
              <Label hint={tx('選填', '选填', 'Optional')}>{tx('是否有不承接案件的國家 / 地區?', '是否有不承接案件的国家 / 地区?', 'Any countries or regions you do not work with?')}</Label>
              <input className={inputCls} value={form.excluded_countries} onChange={(e) => set('excluded_countries', e.target.value)} placeholder={tx('(選填)', '(选填)', '(optional)')} />
            </div>
          )}

          {step === 4 && (
            <div>
              <p className="text-xs text-gray-400 leading-relaxed mb-4">{tx('請上傳一段個人配音 demo,供我們了解您的錄音品質。建議優先提供以專業設備、於專業環境錄製的純人聲樣本(無需配樂或其他效果);如需保護權益,可自行加註浮水印。若暫無上述錄音條件,提供一般 demo 亦可。僅接受 WAV / MP3 / AIFF / AAC / OGG / FLAC 專業音檔 —— 不接受手機錄音(m4a),請以專業設備錄製或轉檔後上傳。單檔請勿超過 50MB。', '请上传一段个人配音 demo,供我们了解您的录音品质。建议优先提供以专业设备、于专业环境录制的纯人声样本(无需配乐或其他效果);如需保护权益,可自行加注浮水印。若暂无上述录音条件,提供一般 demo 亦可。仅接受 WAV / MP3 / AIFF / AAC / OGG / FLAC 专业音档 —— 不接受手机录音(m4a),请以专业设备录制或转档后上传。单档请勿超过 50MB。', 'Please upload a voiceover demo so we can assess your recording quality. A clean, voice-only sample recorded with professional equipment in a professional setting is preferred (no background music or effects); you may add a watermark to protect your work if you wish. If such a setup is not currently available, a standard demo is also acceptable. Professional audio only — WAV / MP3 / AIFF / AAC / OGG / FLAC (no phone m4a recordings; use pro gear or convert first). Up to 50MB per file.')}</p>
              <label className="flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed border-zinc-600 text-sm text-gray-300 cursor-pointer hover:border-amber-500 w-fit">
                <Upload className="w-4 h-4" /> {file ? tx('更換檔案', '更换档案', 'Replace file') : tx('選擇 demo 檔案', '选择 demo 档案', 'Choose a demo file')}
                <input type="file" accept=".wav,.wave,.mp3,.aiff,.aif,.aac,.ogg,.flac,audio/wav,audio/x-wav,audio/mpeg,audio/aiff,audio/x-aiff,audio/aac,audio/ogg,audio/flac" className="hidden" onChange={handleFile} />
              </label>
              {file && <p className="text-xs text-amber-300 mt-2">{tx('已選:', '已选:', 'Selected: ')}{file.name}（{Math.round(file.size / 1024)} KB）</p>}
              {fileError && <p className="text-xs text-red-400 mt-2">{fileError}</p>}
            </div>
          )}

          {step === 5 && (
            <div>
              <div onClick={() => setAgreeOwn(!agreeOwn)} className="flex gap-2.5 text-sm text-gray-300 mb-3 cursor-pointer">
                <div className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border ${agreeOwn ? 'bg-amber-500 border-amber-500' : 'border-zinc-600 bg-zinc-800'}`}>{agreeOwn && <Check className="w-3.5 h-3.5 text-black" />}</div>
                {tx('本人確認所上傳之聲音樣本為本人錄製,並擁有合法授權使用之權利。', '本人确认所上传之声音样本为本人录制,并拥有合法授权使用之权利。', 'I confirm that the audio I have uploaded was recorded by me and that I hold the rights to license it.')}
              </div>
              <div onClick={() => setAgreeTerms(!agreeTerms)} className="flex gap-2.5 text-sm text-gray-300 mb-6 cursor-pointer">
                <div className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border ${agreeTerms ? 'bg-amber-500 border-amber-500' : 'border-zinc-600 bg-zinc-800'}`}>{agreeTerms && <Check className="w-3.5 h-3.5 text-black" />}</div>
                <span onClick={(e) => e.stopPropagation()}>
                  {tx('本人已閱讀並同意', '本人已阅读并同意', 'I have read and agree to the')} <a href={`/${locale}/legal/terms`} target="_blank" className="text-amber-300 underline">{tx('平台合作條款', '平台合作条款', 'Platform Terms')}</a> {tx('與', '与', 'and')} <a href={`/${locale}/legal/privacy`} target="_blank" className="text-amber-300 underline">{tx('隱私政策', '隐私政策', 'Privacy Policy')}</a>{tx('。', '。', '.')}
                </span>
              </div>
              {!emailVerified && <p className="text-xs text-amber-400/80 mb-3">{tx('提醒:送出前請先於「基本資料」完成 Email 驗證。', '提醒:送出前请先于「基本资料」完成 Email 验证。', 'Note: please verify your email under “Basics” before submitting.')}</p>}
              <button type="button" disabled={submitting || !agreeOwn || !agreeTerms || !emailVerified} onClick={handleSubmit}
                className="w-full py-3 rounded-xl bg-amber-500 text-black font-medium flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                <Check className="w-4 h-4" /> {submitting ? tx('送出中…', '送出中…', 'Submitting…') : tx('完成,送出報名', '完成,送出报名', 'Finish & submit')}
              </button>
              <p className="text-center text-xs text-gray-500 mt-3 leading-relaxed">{tx('送出後我們將盡快審核,並以 Email 通知後續。收款資料(銀行帳戶 / 證件)將於您首次承接付費案件時再行提供。', '送出后我们将尽快审核,并以 Email 通知后续。收款资料(银行账户 / 证件)将于您首次承接付费案件时再行提供。', 'After you submit, we will review your application and notify you by email. Banking and identification details are collected when you take on your first paid project.')}</p>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-400 mt-4 text-center">{error}</p>}
        <div className="flex justify-between mt-6">
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} className={`px-4 py-2 rounded-lg border border-zinc-700 text-sm text-gray-300 ${step === 0 ? 'invisible' : ''}`}>{tx('上一步', '上一步', 'Back')}</button>
          {step < STEPS.length - 1 && (
            <button type="button" onClick={() => goTo(step + 1)} className="px-5 py-2 rounded-lg bg-amber-500 text-black text-sm font-medium flex items-center gap-1.5">{tx('下一步', '下一步', 'Next')} <ArrowRight className="w-4 h-4" /></button>
          )}
        </div>
      </div>
    </div>
  );
}

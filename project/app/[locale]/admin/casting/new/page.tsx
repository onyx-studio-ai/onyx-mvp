'use client';

/*
  Admin "post a casting call" form (人聲試音案). Self-service posting — the poster
  fills roles, an online-only audition script, reference materials (links +
  files re-hosted on our `casting` bucket), recording logistics, rate. On submit
  the call goes live at /talent/opportunities. Internal tool (admin-cookie auth).
  Light theme to match the admin shell.
*/

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { supabase } from '@/lib/supabase';
import { caseCode } from '@/lib/casting';
import { LANGUAGES, langLabel } from '@/lib/languages';
import { useFormDraft, DraftBanner } from '@/lib/use-form-draft';
import { CASE_TIMEZONES, tzLabel } from '@/lib/case-time';
import { mediaToMp3, needsMp3Convert } from '@/lib/media-to-mp3';

type RefFile = { name: string; url: string };
type ParsedRole = { name: string; weight?: string; gender?: string; age?: string; timbre?: string; personality?: string; emotion?: string; speed?: string; volume?: string; note?: string; sample_line?: string; is_lead?: boolean; image?: string };
const input = 'w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500';
const SITE = 'https://www.onyxstudios.ai';

// Rate = currency + amount (USD / TWD lead; both optional, fill one or both).
const CCYS = ['TWD', 'USD'];
const CCY_SYM: Record<string, string> = { USD: 'US$', TWD: 'NT$', CNY: '¥', HKD: 'HK$', EUR: '€', GBP: '£', JPY: 'JP¥', SGD: 'S$' };
const fmtRate = (cur: string, amt: string) => `${CCY_SYM[cur] || cur + ' '}${amt.trim()}`;
const RATE_UNITS = ['整案', '句', '字', '分鐘', '小時']; // 整案 first — the common default
// dropdowns for case data — '' = 不指定(留白,前台不顯示);有值(含「不限/全媒體/全年齡」)就顯示
const USAGE_OPTS = ['', '遊戲內', '網路廣告', '電視廣告', '廣播', 'App / 軟體', '社群媒體', '簡報 / 企業內訓', '有聲書 / 平台', '全媒體(所有用途)', '其他'];
const TERRITORY_OPTS = ['', '台灣', '大陸', '港澳', '全球', '北美', '東南亞', '其他'];
const LICENSE_OPTS = ['', '一年', '兩年', '三年', '永久', '買斷', '專案限定'];
const ACCENT_OPTS = ['', '中文 · 台灣國語', '中文 · 大陸普通話', '粵語', '台語', '英語', '日語', '不限', '其他'];
const STYLE_OPTS = ['', '對話自然', '旁白沉穩', '權威 / 正式', '溫暖', '活潑 / 年輕', '角色演繹', '不限', '其他'];
const AGE_OPTS = ['', '兒童', '青少年', '青年', '中年', '熟齡', '全年齡 / 不限', '其他'];
// 需求人數(依性別)—— 與客戶端 /hire 同一套,配音員/admin 用點的不用打字。
const VOICE_COUNTS = ['0', '1', '2', '3', '4', '5+'];
const countLabel = (v: string) => (v === '5+' ? '5 位以上' : `${v} 位`);
// 兩個下拉組成「男聲 N 位、女聲 M 位」(0 的性別略過);與 /hire hire:381-384 一致。
function buildGenderNeeds(male: string, female: string) {
  const parts: string[] = [];
  if (male !== '0') parts.push(`男聲 ${countLabel(male)}`);
  if (female !== '0') parts.push(`女聲 ${countLabel(female)}`);
  return parts.join('、');
}
const voicesTotal = (male: string, female: string) => (male === '5+' ? 5 : Number(male) || 0) + (female === '5+' ? 5 : Number(female) || 0);

// 語言比對正規化 —— 報名者的語言存的是英文正規值(如 'Chinese · Taiwan'),案件語言常是
// 中文字(如 '中文 · 台灣國語'),直接比子字串會跨語言比不到(這是「符合語系全部 0 人」的
// 根因)。把兩邊都轉成同一組語言鍵(家族 zh/en… + 地區 zh-tw/zh-cn/yue/nan…)再比。
const langKeys = (s: string): string[] => {
  const t = (s || '').toLowerCase();
  const has = (...xs: string[]) => xs.some((x) => t.includes(x));
  const k = new Set<string>();
  if (has('cantonese', '粵', '粤', '廣東', '广东', '香港', 'hong kong')) k.add('yue');
  if (has('hokkien', '閩南', '闽南', '台語', '台语', 'taigi')) k.add('nan');
  if (has('mandarin', 'chinese', '中文', '國語', '国语', '華語', '华语', '普通話', '普通话')) {
    k.add('zh');
    if (has('taiwan', '台灣', '台湾', '臺灣')) k.add('zh-tw');
    if (has('mainland', '大陸', '大陆', '中國', '中国', 'prc', '普通話', '普通话')) k.add('zh-cn');
    if (has('malaysia', '馬來', '马来')) k.add('zh-my');
  }
  if (has('english', '英文', '英語', '英语')) k.add('en');
  if (has('japanese', '日文', '日語', '日语')) k.add('ja');
  if (has('korean', '韓', '韩')) k.add('ko');
  return [...k];
};
// 地區/方言鍵(比家族更具體);案件若指定了它,配對就要求對得上該地區,避免大陸腔被選進台灣案。
const isSpecificKey = (key: string) => key.includes('-') || key === 'yue' || key === 'nan';
// 性別正規化成 male/female('' = 不明);先判 female 因為 'female' 內含 'male'。
const normGender = (v: unknown): '' | 'male' | 'female' => {
  const s = String(v || '').toLowerCase();
  if (s.includes('female') || s.includes('女')) return 'female';
  if (s.includes('male') || s.includes('男')) return 'male';
  return '';
};
// 反解析匯入字串(如「男聲 1 位、女聲 2 位」)回男/女下拉值,匯入客戶案時用。
function parseGenderNeeds(s?: string | null): { male: string; female: string } {
  const t = String(s || '');
  const m = /男[聲声]?\s*(\d)/.exec(t); const f = /女[聲声]?\s*(\d)/.exec(t);
  return { male: m ? m[1] : '0', female: f ? f[1] : '0' };
}
const optEl = (o: string) => <option key={o || '_'} value={o}>{o || '— 不指定 —'}</option>;
// include an imported value as a selectable option even if it's not in the standard
// list — so a client's free-text value (e.g. 香港 / 2年 / All Media) shows + persists.
const optsWith = (opts: string[], val?: string) => (val && !opts.includes(val) ? [...opts, val] : opts);

// 19 業界類別 → 對應的回應方式。roles = 分角色試音(遊戲/動畫/戲劇);
// general = 單一聲音,配音員依案件說明/試音稿錄製試音上傳 + 報價(廣告/旁白/TTS 等)。
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
  // Client-side AI/TTS engagement (voice becomes an AI model for a CLIENT). Picking
  // this reveals the clone/training sub-type + gates the case to opted-in talents.
  { label: 'TTS / AI 語音', mode: 'general' },
];
// The one category that flags a case as client-side AI/TTS (drives ai_type + consent gate).
const AI_CATEGORY = 'TTS / AI 語音';

// /hire content_type (English key) → casting category label, so a client request
// lands on the right category + mode instead of the 遊戲 default.
const CT_MAP: Record<string, string> = {
  Commercial: '廣告 Commercial', Narration: '旁白 Narration', Audiobook: '有聲書 Audiobook',
  Corporate: '工商簡介 Corporate', 'E-Learning': '教育教學 E-Learning', Documentary: '紀錄片 Documentary',
  Podcast: 'Podcast', IVR: '來電語音 IVR', Game: '遊戲 Video Game', Animation: '動畫 Animation',
  'Film / Drama': '戲劇·角色 Drama',
};
function resolveCategory(ct?: string): string {
  if (!ct) return '';
  if (CT_MAP[ct]) return CT_MAP[ct];
  const exact = CATEGORIES.find((c) => c.label === ct); if (exact) return exact.label;
  const fuzzy = CATEGORIES.find((c) => c.label.includes(ct) || ct.includes(c.label));
  return fuzzy ? fuzzy.label : '';
}

export default function NewCastingPage() {
  return <Suspense fallback={<main className="min-h-screen px-4 py-16 text-gray-500 text-sm">載入中…</main>}><NewCasting /></Suspense>;
}

function NewCasting() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [clientNote, setClientNote] = useState('');   // 內部客戶備註:這案是誰的(只給後台看)
  const [category, setCategory] = useState('遊戲 Video Game');
  const [mode, setMode] = useState<'roles' | 'general'>('roles');
  const [language, setLanguage] = useState('Mandarin · Taiwan');
  const [langOpen, setLangOpen] = useState(false);   // 語言可搜尋下拉
  const [langQ, setLangQ] = useState('');
  // 需求人數(男/女)—— 用下拉點選,送出組成 gender_needs 字串 + voices_needed 數字。
  const [maleVoices, setMaleVoices] = useState('0');
  const [femaleVoices, setFemaleVoices] = useState('0');
  // 客戶端有、後台原本不能設的旗標(補上)。線上監錄已由「錄音方式」的 online 涵蓋,不重複。
  const [hasSinging, setHasSinging] = useState(false);
  const [wantsDirector, setWantsDirector] = useState(false);
  const [brief, setBrief] = useState('');
  const [rateCur, setRateCur] = useState('TWD');
  const [rateAmt, setRateAmt] = useState('');
  const [rateUnit, setRateUnit] = useState('整案');
  // Voices-style data fields (most reuse existing brief columns)
  const [scale, setScale] = useState('');        // length: 句數/字數/秒數/時數
  const [deadline, setDeadline] = useState('');  // delivery deadline (vs audition)
  const [deadlineTime, setDeadlineTime] = useState('');           // 交付截止時間 HH:mm(選填)
  const [auditionDeadlineTime, setAuditionDeadlineTime] = useState('');   // 試音截止時間 HH:mm(選填)
  const [caseTz, setCaseTz] = useState('Asia/Taipei');            // 案件時區:全案時間以它為準
  const [mediaScope, setMediaScope] = useState(''); // usage: where it plays
  const [territory, setTerritory] = useState('');   // territory
  const [licenseTerm, setLicenseTerm] = useState(''); // license term
  const [accent, setAccent] = useState('');
  const [voiceStyle, setVoiceStyle] = useState('');
  const [voiceAge, setVoiceAge] = useState('');
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
  const [done, setDone] = useState<{ id: string; brief_number: string; notified?: number } | null>(null);
  const [inviteEmails, setInviteEmails] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [notify] = useState(true); // legacy fallback flag (picker drives invites now)
  // AI / TTS case (client-side): the talent's voice becomes an AI model for a CLIENT
  // (not Onyx's own training). '' = ordinary casting; 'clone' = 聲音製成AI(用到本人聲音,
  // filters coop_ai_clone); 'training' = AI 訓練素材(不用本人聲音, filters coop_ai_training).
  const [aiType, setAiType] = useState<'' | 'clone' | 'training'>('');
  // Publish-time talent picker. Normal cases invite ONLY online (vetted) talents
  // (the gate). AI cases are open to anyone who opted into AI — vetted or not —
  // so `active` (= online vetted VO) is tracked per talent to apply the right gate.
  const [roster, setRoster] = useState<{ id: string; name: string; langs: string; gender: '' | 'male' | 'female'; active: boolean; aiClone: boolean; aiTrain: boolean }[]>([]);
  const [rosterErr, setRosterErr] = useState('');
  const [selTalents, setSelTalents] = useState<Set<string>>(new Set());
  const [userEditedSel, setUserEditedSel] = useState(false);
  const [langOnly, setLangOnly] = useState(true);
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const [talentSearch, setTalentSearch] = useState('');
  // AI cases invite from talent_applications (everyone who filled the form + opted
  // into AI) via免註冊 magic-link — includes people not yet approved/online. Selected
  // by email (they may have no talents account). Default = all selected.
  const [aiPool, setAiPool] = useState<{ email: string; name: string; langs: string; gender: '' | 'male' | 'female' }[]>([]);
  const [selEmails, setSelEmails] = useState<Set<string>>(new Set());
  const [userEditedEmails, setUserEditedEmails] = useState(false);
  const [aiPoolErr, setAiPoolErr] = useState('');
  // 指定邀請(可含未上線):按名字點名任何已核准的人,系統用它存的 email 寄免註冊試音連結。
  const [directory, setDirectory] = useState<{ id: string; name: string; email: string; active: boolean; gender: '' | 'male' | 'female' }[]>([]);
  const [pinned, setPinned] = useState<{ email: string; name: string; active: boolean }[]>([]);
  const [pinQ, setPinQ] = useState('');
  const [pinOpen, setPinOpen] = useState(false);
  // When opened as /admin/casting/new?from=<id> we're completing a client request:
  // pre-fill from their brief, show who asked + their budget, and publish IN PLACE.
  const search = useSearchParams();
  const [fromId, setFromId] = useState('');
  const [fromClient, setFromClient] = useState<{ name?: string; company?: string; email?: string; budget?: string; budget_type?: string; has_singing?: boolean; wants_director?: boolean; wants_live_session?: boolean; gender_needs?: string; requested_talent?: string; local_studio_region?: string; script_file_url?: string } | null>(null);

  // 自動草稿:打到一半關頁不再全丟(送出成功才清)。從客戶請求帶入(?from=)時停用,以帶入為準。
  const draft = useFormDraft('casting-new', {
    title, category, mode, language, maleVoices, femaleVoices, hasSinging, wantsDirector, brief,
    rateCur, rateAmt, rateUnit, scale, deadline, mediaScope, territory, licenseTerm, accent,
    voiceStyle, voiceAge, baseRev, cap, auditionDeadline, recordingStart, methods, rolesText,
    parsedRoles, auditionScript, refLinks, refFiles, aiType, clientNote, deadlineTime, auditionDeadlineTime, caseTz,
  }, (d) => {
    setDeadlineTime(d.deadlineTime || ''); setAuditionDeadlineTime(d.auditionDeadlineTime || ''); setCaseTz(d.caseTz || 'Asia/Taipei');
    setTitle(d.title); setCategory(d.category); setMode(d.mode); setLanguage(d.language); setClientNote(d.clientNote || '');
    setMaleVoices(d.maleVoices); setFemaleVoices(d.femaleVoices); setHasSinging(d.hasSinging); setWantsDirector(d.wantsDirector);
    setBrief(d.brief); setRateCur(d.rateCur); setRateAmt(d.rateAmt); setRateUnit(d.rateUnit); setScale(d.scale);
    setDeadline(d.deadline); setMediaScope(d.mediaScope); setTerritory(d.territory); setLicenseTerm(d.licenseTerm);
    setAccent(d.accent); setVoiceStyle(d.voiceStyle); setVoiceAge(d.voiceAge); setBaseRev(d.baseRev); setCap(d.cap);
    setAuditionDeadline(d.auditionDeadline); setRecordingStart(d.recordingStart); setMethods(d.methods);
    setRolesText(d.rolesText); setParsedRoles(d.parsedRoles); setAuditionScript(d.auditionScript);
    setRefLinks(d.refLinks?.length ? d.refLinks : ['']); setRefFiles(d.refFiles || []); setAiType(d.aiType);
  }, !search?.get('from'));

  function pickCategory(label: string) {
    setCategory(label);
    const m = CATEGORIES.find((c) => c.label === label)?.mode;
    if (m) setMode(m); // category drives the default flow; toggle can still override
    // TTS / AI category drives the AI sub-type: default to 'clone' (聲音變AI) on
    // entry, keep an existing sub-type, and clear it when a non-AI category is picked.
    setAiType((prev) => (label === AI_CATEGORY ? (prev || 'clone') : ''));
  }

  useEffect(() => {
    const id = search.get('from');
    if (!id) return;
    (async () => {
      const res = await fetch(`/api/admin/casting?id=${encodeURIComponent(id)}`, { credentials: 'include' });
      if (!res.ok) return;
      const bf = (await res.json().catch(() => ({})))?.brief;
      if (!bf) return;
      setFromId(id);
      setFromClient({ name: bf.client_name, company: bf.company, email: bf.client_email, budget: bf.budget, budget_type: bf.budget_type, has_singing: bf.has_singing, wants_director: bf.wants_director, wants_live_session: bf.wants_live_session, gender_needs: bf.gender_needs, requested_talent: bf.requested_talent, local_studio_region: bf.local_studio_region, script_file_url: bf.script_file_url });
      if (bf.title) setTitle(bf.title);
      // 從客戶請求發佈:客戶身分自動帶進內部備註,發完不會忘記這案是誰的
      if (bf.internal_client_note) setClientNote(bf.internal_client_note);
      else if (bf.client_name || bf.client_email) setClientNote([bf.client_name, bf.company, bf.client_email].filter(Boolean).join(' · '));
      { const cat = resolveCategory(bf.content_type); if (cat) pickCategory(cat); }
      if (bf.language) setLanguage(bf.language);
      if (bf.gender_needs) { const g = parseGenderNeeds(bf.gender_needs); setMaleVoices(g.male); setFemaleVoices(g.female); }
      if (bf.has_singing) setHasSinging(true);
      if (bf.wants_director) setWantsDirector(true);
      if (bf.brief) setBrief(bf.brief);
      // carry the client's values straight in — the selects render any non-standard
      // value too (optsWith), so nothing is silently dropped or overwritten on publish.
      if (bf.media_scope) setMediaScope(bf.media_scope);
      if (bf.territory) setTerritory(bf.territory);
      if (bf.license_term) setLicenseTerm(bf.license_term);
      if (bf.accent) setAccent(bf.accent);
      if (bf.voice_style) setVoiceStyle(bf.voice_style);
      if (bf.voice_age) setVoiceAge(bf.voice_age);
      if (bf.length) setScale(bf.length);
      if (bf.deadline) setDeadline(bf.deadline);
      if (bf.deadline_time) setDeadlineTime(bf.deadline_time);
      if (bf.audition_deadline) setAuditionDeadline(bf.audition_deadline);
      if (bf.audition_deadline_time) setAuditionDeadlineTime(bf.audition_deadline_time);
      if (bf.timezone) setCaseTz(bf.timezone);
      if (bf.recording_start) setRecordingStart(bf.recording_start);
      // client budget → seed the 報酬 (currency + amount) as a starting point Onyx can adjust.
      if (bf.budget) {
        const cur = /USD|TWD/i.exec(String(bf.budget)); if (cur) setRateCur(cur[0].toUpperCase());
        const amt = String(bf.budget).replace(/[^\d.]/g, ''); if (amt) setRateAmt(amt);
      }
      if (bf.budget_unit && RATE_UNITS.includes(bf.budget_unit)) setRateUnit(bf.budget_unit);
      // the client's pasted script seeds the shared audition lines; their reference
      // link carries into the 參考連結 field so talents see it.
      if (bf.script_text) setAuditionScript(bf.script_text);
      const clientLinks = (Array.isArray(bf.reference_links) && bf.reference_links.length ? bf.reference_links : (bf.ref_audio_url ? [bf.ref_audio_url] : [])).map((x: unknown) => String(x).trim()).filter(Boolean);
      if (clientLinks.length) setRefLinks((arr) => { const merged = [...clientLinks, ...arr.filter((x) => x.trim() && !clientLinks.includes(x.trim()))]; return merged.length ? merged : ['']; });
      if (bf.wants_live_session) setMethods((m) => ({ ...m, online: true }));
      if (Array.isArray(bf.recording_methods) && bf.recording_methods.length) setMethods((m) => ({ ...m, ...Object.fromEntries((bf.recording_methods as string[]).map((k) => [k, true])) }));
      // Auto-import the client's uploaded role sheet (game/drama/animation), so the
      // admin doesn't re-upload. keep=true preserves the original on the brief.
      if (typeof bf.roles_file_url === 'string' && bf.roles_file_url.includes('/casting/')) {
        const path = decodeURIComponent(bf.roles_file_url.split('/casting/')[1] || '');
        if (path) {
          setWorking('帶入客戶角色表…');
          try {
            const pr = await fetch('/api/admin/casting/parse-xlsx', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, keep: true }) });
            const pj = await pr.json().catch(() => ({}));
            if (pr.ok && Array.isArray(pj.roles) && pj.roles.length) {
              const rs: ParsedRole[] = pj.roles;
              setParsedRoles(rs);
              setRolesText(rs.map((r) => `${r.is_lead ? '★' : ''}${r.name} | ${r.gender || ''} | ${r.age || ''} | ${r.personality || ''} | ${r.sample_line || ''}`).join('\n'));
            }
          } catch { /* best-effort — admin can still upload manually */ } finally { setWorking(''); }
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Load the roster of ONLINE (vetted) talents for the publish-time invite picker.
  useEffect(() => {
    (async () => {
      const r = await fetch('/api/admin/talents', { credentials: 'include' }).catch(() => null);
      if (!r || !r.ok) { setRosterErr('無法載入配音員名單,請重新整理。'); return; }
      const all = await r.json().catch(() => []);
      const asText = (v: unknown) => (Array.isArray(v) ? v.join(' ') : String(v || ''));
      const isVettedVO = (t: { is_active?: boolean; type?: string }) => !!t.is_active && ['voice_actor', 'VO', 'Singer'].includes(t.type || '');
      const list = (Array.isArray(all) ? all : [])
        // Vetted online voice actors (normal-case pool) + anyone who opted into AI
        // (AI cases don't require vetting — a general person who accepts AI qualifies).
        .filter((t: { is_active?: boolean; type?: string; coop_ai_clone?: boolean; coop_ai_training?: boolean }) => isVettedVO(t) || t.coop_ai_clone || t.coop_ai_training)
        .map((t: { id: string; name?: string; languages?: unknown; native_languages?: unknown; gender?: unknown; is_active?: boolean; type?: string; coop_ai_clone?: boolean; coop_ai_training?: boolean }) => ({ id: t.id, name: t.name || '(未命名)', langs: `${asText(t.languages)} ${asText(t.native_languages)}`.trim(), gender: normGender(t.gender), active: isVettedVO(t), aiClone: !!t.coop_ai_clone, aiTrain: !!t.coop_ai_training }))
        .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
      setRoster(list);
      // 全通訊錄(含未上線,只要有 email)供「指定邀請」按名字搜。
      setDirectory((Array.isArray(all) ? all : [])
        .filter((t: { email?: string }) => !!t.email)
        .map((t: { id: string; name?: string; email?: string; gender?: unknown; is_active?: boolean; type?: string }) => ({ id: t.id, name: t.name || '(未命名)', email: String(t.email), active: isVettedVO(t), gender: normGender(t.gender) }))
        .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)));
    })();
  }, []);

  // AI case → load the invite pool = applicants who opted into the matching consent
  // (talent_applications ∪ talents, incl. not-yet-approved). Default selection is
  // handled by the effect below (matching-language), not here.
  useEffect(() => {
    setUserEditedEmails(false);
    if (!aiType) { setAiPool([]); setSelEmails(new Set()); setAiPoolErr(''); return; }
    (async () => {
      setAiPoolErr('');
      const r = await fetch(`/api/admin/casting/ai-applicants?type=${aiType}`, { credentials: 'include' }).catch(() => null);
      if (!r || !r.ok) { setAiPoolErr('無法載入報名者名單,請重新整理。'); setAiPool([]); return; }
      const j = await r.json().catch(() => ({}));
      const raw: { email: string; name: string; langs: string; gender?: unknown }[] = Array.isArray(j.applicants) ? j.applicants : [];
      setAiPool(raw.map((p) => ({ email: p.email, name: p.name, langs: p.langs, gender: normGender(p.gender) })));
    })();
  }, [aiType]);

  // Default AI selection = applicants who MATCH the case language (inviting someone
  // who doesn't speak it is useless) — until the admin edits the picker. Re-runs as
  // the pool loads / the case language changes.
  useEffect(() => {
    if (!aiType || userEditedEmails || aiPool.length === 0) return;
    setSelEmails(new Set(aiPool.filter(matchesLang).map((p) => p.email)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiPool, language, aiType, userEditedEmails]);

  // language match for the picker (best-effort default pre-check) — normalize both
  // sides via langKeys so a Chinese case language matches English-canonical applicant
  // languages. If the case names a region/dialect, require that specific key.
  const caseKeys = langKeys(language);
  const caseSpecific = caseKeys.filter(isSpecificKey);
  const matchesLang = (t: { langs: string }) => {
    const a = langKeys(t.langs);
    if (caseKeys.length === 0 || a.length === 0) return false;
    return (caseSpecific.length ? caseSpecific : caseKeys).some((key) => a.includes(key));
  };
  const matchesGender = (t: { gender: '' | 'male' | 'female' }) => genderFilter === 'all' || t.gender === genderFilter;
  // AI picker's currently-visible list (語系 + 性別 + 搜尋),供「全選目前清單」與清單共用。
  const aiShown = aiPool
    .filter((p) => (langOnly ? matchesLang(p) : true))
    .filter(matchesGender)
    .filter((p) => { const q = talentSearch.trim().toLowerCase(); return !q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.langs.toLowerCase().includes(q); });
  const reqName = (fromClient?.requested_talent || '').trim().toLowerCase();
  const isRequested = (t: { name: string }) => !!reqName && (t.name.toLowerCase() === reqName || reqName.includes(t.name.toLowerCase()));
  // For an AI case, a talent must have opted into the matching consent (聲音變AI /
  // 訓練素材). Non-AI cases have no such gate → everyone qualifies.
  const consents = (t: { aiClone: boolean; aiTrain: boolean }) => (aiType === 'clone' ? t.aiClone : aiType === 'training' ? t.aiTrain : true);
  // Who's eligible to be invited: normal cases → online vetted VOs only (the gate);
  // AI cases → anyone who opted into the matching consent (vetted or not).
  const eligible = (t: { active: boolean; aiClone: boolean; aiTrain: boolean }) => (aiType ? consents(t) : t.active);
  // Normal picker's currently-visible list (eligible + 語系 + 性別 + 搜尋;指定的人置頂),
  // 供「全選目前清單」與清單共用。
  const rosterShown = roster
    .filter(eligible)
    .filter((t) => (langOnly ? matchesLang(t) || isRequested(t) : true))
    .filter(matchesGender)
    .filter((t) => { const q = talentSearch.trim().toLowerCase(); return !q || t.name.toLowerCase().includes(q) || t.langs.toLowerCase().includes(q); })
    .sort((a, b) => (isRequested(b) ? 1 : 0) - (isRequested(a) ? 1 : 0));

  // Default selection = matching-language + the requested talent, until the admin
  // manually edits the picker, gated by eligibility. Re-runs as language / client
  // info / ai_type arrives (async import).
  useEffect(() => {
    if (userEditedSel || roster.length === 0) return;
    const sel = new Set<string>();
    for (const t of roster) if ((matchesLang(t) || isRequested(t)) && eligible(t)) sel.add(t.id);
    setSelTalents(sel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster, language, fromClient, userEditedSel, aiType]);

  const toggleTalent = (id: string) => { setUserEditedSel(true); setSelTalents((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); };

  function parseRoles() {
    return rolesText.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
      const p = line.split('|').map((s) => s.trim());
      let name = p[0] || '';
      const is_lead = /^[★*]/.test(name);
      name = name.replace(/^[★*]\s*/, '');
      return { name, gender: p[1] || '', age: p[2] || '', personality: p[3] || '', sample_line: p[4] || '', emotion: '', is_lead };
    }).filter((r) => r.name);
  }

  async function uploadFile(raw: File) {
    setErr('');
    if (raw.size > 50 * 1024 * 1024) { setErr('檔案請勿超過 50MB,過大請放雲端用下方「貼直連抓進平台」。'); return; }
    setWorking('上傳中…');
    try {
      // 參考音只要不是 mp3(wav/mp4/m4a…)自動轉 160kbps mp3 —— 省空間,配音員載得快。
      let file = raw;
      if (needsMp3Convert(raw)) { setWorking('轉 mp3 中…'); file = await mediaToMp3(raw); setWorking('上傳中…'); }
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
    // 大檔 SOP:內嵌高解析角色圖的遊戲台詞表動輒 100MB+,線上解析吞不下 →
    // 選檔當下就擋,直接給做法(丟 Claude 本機匯 / Excel 壓縮圖片 / 要無圖版)。
    const mb = file.size / 1048576;
    if (mb > 20) {
      setErr(`這份表有 ${mb.toFixed(0)} MB,超過線上解析的安全上限(20MB),多半是內嵌高解析角色圖造成。做法擇一:① 檔案直接丟給 Claude 助理本機處理(最快);② Excel/WPS「壓縮圖片」96dpi 套用到所有圖片後另存再上傳;③ 請客戶提供無圖版。`);
      return;
    }
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
      // fields not in the editable 5-col textarea ride along from the xlsx parse
      return p ? { ...r, image: p.image, emotion: p.emotion, speed: p.speed, weight: p.weight, timbre: p.timbre, volume: p.volume, note: p.note, is_lead: r.is_lead || p.is_lead } : r;
    });
  }
  // assemble the rate note from the structured currency/amount inputs (both optional)
  function buildRateNote() {
    return rateAmt.trim() ? (rateUnit === '整案' ? `${fmtRate(rateCur, rateAmt)} · 整案` : `${fmtRate(rateCur, rateAmt)} / ${rateUnit}`) : '';
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
      title, content_type: category, language,
      gender_needs: buildGenderNeeds(maleVoices, femaleVoices), voices_needed: voicesTotal(maleVoices, femaleVoices) || null,
      has_singing: hasSinging, wants_director: wantsDirector,
      brief, rate_note: buildRateNote(), base_revisions: Number(baseRev) || 0, audition_cap: Number(cap) || 5,
      audition_deadline: auditionDeadline, audition_deadline_time: auditionDeadlineTime, recording_start: recordingStart,
      deadline_time: deadlineTime, timezone: caseTz,
      recording_methods: Object.keys(methods).filter((k) => methods[k]),
      roles, audition_script: auditionScript,
      reference_links: refLinks.map((l) => l.trim()).filter(Boolean), reference_files: refFiles,
      length: scale, deadline, media_scope: mediaScope, territory, license_term: licenseTerm,
      accent, voice_style: voiceStyle, voice_age: voiceAge, notify,
      ai_type: aiType, // ''=一般 / 'clone'=聲音變AI / 'training'=訓練素材(客戶端)
      internal_client_note: clientNote,
      // AI case → invite opted-in applicants by email (免註冊 magic-link);
      // normal case → invite online vetted talents by id (the picker).
      ...(aiType ? { invite_emails: Array.from(selEmails) } : { invite_talent_ids: Array.from(selTalents) }),
      ...(pinned.length ? { pin_invite_emails: pinned.map((p) => p.email) } : {}),
      id: fromId || undefined, // present = publish the client request in place (no duplicate)
    };
    const res = await fetch('/api/admin/casting', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(j.error || '發案失敗');
    setDone({ id: j.id, brief_number: j.brief_number, notified: j.notified });
    draft.clear();   // 發佈成功 → 清掉自動草稿
    // 發佈後重置這些「看不見會殘留」的旗標,避免同頁連續發案時帶到下一個案子。
    setHasSinging(false); setWantsDirector(false);
    setMethods({ home: false, studio: false, online: false });
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
          <p className="text-gray-500 text-sm mb-1">已註冊的配音員在「案件」就看得到了。</p>
          {done.notified ? <p className="text-green-700 text-sm mb-6">📧 已{aiType ? `寄免註冊試音連結給 ${done.notified} 位接受 AI 的報名者` : `寄信通知 ${done.notified} 位符合語言的配音員來試音`}。</p> : <p className="text-gray-400 text-sm mb-6">(未寄通知信)</p>}

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
    // Preview = the EXACT voice-actor view (dark, 立繪 cards) so what the poster
    // sees is what the talent sees. Audition controls are shown read-only.
    return (
      <main className="min-h-screen bg-black text-white px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-lg font-semibold">發佈前預覽</h1>
            <span className="text-xs text-amber-300/80">↓ 配音員會看到的畫面</span>
          </div>
          <p className="text-xs text-gray-500 mb-5">確認沒問題再發佈。</p>

          <p className="text-xs text-gray-500 font-mono mb-1">{caseCode({ content_type: category, created_at: new Date().toISOString(), brief_number: '' })}<span className="text-gray-600"> ·(發佈後配序號)</span></p>
          {title && <h2 className="text-2xl font-semibold mb-1" style={{ fontFamily: '"Songti TC","Noto Serif TC",serif' }}>{title}</h2>}
          <div className="flex flex-wrap gap-1.5 mb-3">
            <span className="text-xs bg-purple-500/15 text-purple-200 px-2 py-0.5 rounded-full">試音案</span>
            {aiType && <span className="text-xs bg-[#6FCF97]/15 text-[#6FCF97] border border-[#6FCF97]/30 px-2 py-0.5 rounded-full">{aiType === 'training' ? 'AI 訓練素材案' : 'TTS / 聲音變 AI 案'}</span>}
            {language && <span className="text-xs bg-green-500/10 text-green-200 px-2 py-0.5 rounded-full">{langLabel(language, 'zh-TW')}</span>}
            {rn && <span className="text-xs bg-amber-500/15 text-amber-200 px-2 py-0.5 rounded-full">{rn}</span>}
            {methodList.map((m) => <span key={m} className="text-xs bg-sky-500/15 text-sky-200 px-2 py-0.5 rounded-full">{methodLabel(m)}</span>)}
          </div>
          {brief && <p className="text-sm text-gray-200 whitespace-pre-wrap mb-3">{brief}</p>}
          {auditionScript && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1.5">試音方向 / 聲音方向</p>
              <div className="text-sm text-gray-200 whitespace-pre-wrap bg-black/40 border border-white/10 rounded-lg p-3">{auditionScript}</div>
            </div>
          )}
          {(refFiles.length > 0 || refLinks.some((l) => l.trim())) && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1.5">參考素材</p>
              {refFiles.map((f, i) => <div key={i} className="text-xs text-gray-400 truncate">📎 {f.name}</div>)}
              {refLinks.filter((l) => l.trim()).map((l, i) => <div key={i} className="text-xs text-sky-300 truncate">{l}</div>)}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
            {[
              { l: '報酬', v: rn || '面議', gold: true },
              { l: '試音截止', v: auditionDeadline ? `${auditionDeadline}${auditionDeadlineTime ? ' ' + auditionDeadlineTime : ''}(${tzLabel(caseTz)})` : '待定' },
              { l: '交付截止', v: deadline ? `${deadline}${deadlineTime ? ' ' + deadlineTime : ''}(${tzLabel(caseTz)})` : '待定' },
              { l: '規模', v: scale || '待定' },
            ].map((s, i) => (
              <div key={i} className="bg-[#1d1b25] border border-white/[0.08] rounded-xl p-3.5">
                <p className="text-[11px] text-gray-500">{s.l}</p>
                <p className={`text-lg font-semibold mt-0.5 ${s.gold ? 'text-[#E4CB94]' : 'text-white'}`} style={{ fontFamily: '"Songti TC","Noto Serif TC",serif' }}>{s.v}</p>
              </div>
            ))}
          </div>
          {(() => {
            const ml = (m: string) => (m === 'home' ? '在家錄' : m === 'studio' ? '錄音室' : m === 'online' ? '線上監錄' : m);
            const info = ([
              ['語言', langLabel(language, 'zh-TW')], ['需求', buildGenderNeeds(maleVoices, femaleVoices)], ['口音', accent], ['聲音風格', voiceStyle], ['聲音年齡', voiceAge],
              ['使用範圍', mediaScope], ['地區', territory], ['授權', licenseTerm], ['預計開錄', recordingStart],
              ['含修改', Number(baseRev) > 0 ? `${baseRev} 次` : ''],
              ['錄音方式', Object.keys(methods).filter((k) => methods[k]).map(ml).join(' / ')],
              // 含唱歌/聲音導演 只有 true 才顯示 —— 讓發佈前一定看得到(之前漏顯示,帶入/殘留會神不知鬼不覺發出去)。
              ['含唱歌', hasSinging ? '是 ⚠' : ''],
              ['聲音導演', wantsDirector ? '是' : ''],
            ] as [string, string][]).filter((x) => !!x[1]);
            return info.length ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-2 text-sm bg-[#1d1b25] border border-white/[0.08] rounded-xl p-4 mb-4">
                {info.map(([k, v], i) => <div key={i} className="min-w-0"><span className="text-gray-500">{k} </span><span className="text-gray-200">{v}</span></div>)}
              </div>
            ) : null;
          })()}

          <div className="border-t border-white/10 pt-4">
            {mode === 'general' ? (
              <p className="text-sm text-gray-300">一般配音案 · 配音員依案件說明 / 試音稿錄製試音並上傳 + 報價。平台不抽成。</p>
            ) : roles.length ? (
              <>
                <div className="grid sm:grid-cols-3 gap-2.5 mb-4">
                  {[
                    { t: '一角一檔 · 請勿整軌', d: '每個角色個別上傳,系統各自建檔;請勿把多角色錄在同一段音檔。' },
                    { t: '檔名自動帶入', d: '提交後系統自動命名「案號_角色_藝名」,無須自行更名。' },
                    { t: '音檔格式', d: '試音檔 MP3 / WAV / M4A 皆可(建議 MP3)。環境安靜、口齒清楚即可。' },
                  ].map((r, i) => (
                    <div key={i} className="bg-[#1d1b25] border border-white/[0.08] rounded-xl p-3.5">
                      <p className="text-sm font-medium text-[#E4CB94] mb-1">{r.t}</p>
                      <p className="text-xs text-gray-400 leading-relaxed">{r.d}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-baseline justify-between mb-1">
                  <h4 className="text-lg font-semibold text-white" style={{ fontFamily: '"Songti TC","Noto Serif TC",serif' }}>試音角色</h4>
                  <span className="text-xs text-gray-500">{`共 ${roles.length} 角 · 男 ${roles.filter((r) => (r.gender || '').includes('男')).length} / 女 ${roles.filter((r) => (r.gender || '').includes('女')).length}`}</span>
                </div>
                <p className="text-xs text-gray-400 mb-3">挑角色 → 唸出它的台詞、錄音 → 上傳 + 報價。可試多角,平台不抽成、你報多少拿多少。</p>
                <div className="space-y-3">
                  {roles.map((r, i) => {
                    const meta = [r.gender, r.age].filter(Boolean).join(' · ');
                    return (
                      <div key={i} className={`flex rounded-2xl overflow-hidden bg-[#1d1b25] border ${r.is_lead ? 'border-[#C9A86A]/50' : 'border-white/[0.08]'}`}>
                        <div className="w-28 sm:w-36 shrink-0 relative bg-[#14131a]">
                          {r.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.image} alt={r.name} className="absolute inset-0 w-full h-full object-cover object-top" />
                          ) : <div className="absolute inset-0 flex items-center justify-center text-3xl text-gray-600">🎭</div>}
                          {r.is_lead && <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded font-medium z-10" style={{ color: '#1a160c', background: 'linear-gradient(180deg,#E4CB94,#C9A86A)' }}>★ 主角</span>}
                        </div>
                        <div className="flex-1 min-w-0 p-4 space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-lg font-semibold text-white leading-tight" style={{ fontFamily: '"Songti TC","Noto Serif TC",serif' }}>{r.name}</span>
                            {meta && <span className="text-xs px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0" style={{ color: '#7fb2e8', background: 'rgba(127,178,232,.14)' }}>{meta}</span>}
                          </div>
                          {r.timbre && <p className="text-sm text-[#C9A86A] leading-snug">聲線 · {r.timbre}</p>}
                          {r.personality && <p className="text-sm text-gray-400 leading-snug">{r.personality}</p>}
                          {(r.emotion || r.speed || r.volume) && (
                            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                              {r.emotion && <span><span className="text-gray-500">台詞情緒 </span><span className="text-gray-200">{r.emotion}</span></span>}
                              {r.speed && <span><span className="text-gray-500">語速 </span><span className="text-gray-200">{r.speed}</span></span>}
                              {r.volume && <span><span className="text-gray-500">台詞量 </span><span className="text-gray-200">{r.volume}</span></span>}
                            </div>
                          )}
                          {r.note && <p className="text-sm text-gray-400 leading-snug"><span className="text-gray-500">備註 </span>{r.note}</p>}
                          {r.sample_line && (
                            <div className="bg-[#14131a] border border-white/[0.08] rounded-xl px-3.5 py-3">
                              <span className="inline-block text-[11px] tracking-[0.18em] text-[#C9A86A] mb-1">試音樣詞</span>
                              <p className="text-[15px] leading-relaxed text-gray-100 whitespace-pre-wrap">{r.sample_line}</p>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">0 人已試</span>
                            <span className="text-sm rounded-xl px-4 py-2" style={{ color: '#1a160c', background: 'linear-gradient(180deg,#E4CB94,#C9A86A)', fontWeight: 600 }}>試這個角色 →</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-sm text-amber-300">⚠ 還沒有角色 —— 返回上傳 xlsx 或手動填角色。</p>
            )}
          </div>

          {/* Publish-time invite picker — only ONLINE (vetted) talents appear (the gate) */}
          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-sm font-semibold text-gray-200">{aiType ? '邀請(接受 AI 的報名者)' : '邀請配音員試音'}</p>
              <span className="text-xs text-amber-300">已選 {aiType ? selEmails.size : selTalents.size} 位</span>
            </div>
            {aiType ? (
              // AI case: invite everyone who filled the form + opted into AI (incl.
              // not-yet-approved), by email → 免註冊 magic-link. Default all selected.
              <>
                <p className="text-xs text-[#6FCF97] mb-3">🟢 AI 案 —— 列出所有「填過報名表 + 已同意{aiType === 'training' ? '錄製 AI 訓練素材' : '聲音製成 AI'}」的人({aiPool.length} 位),不限是否已上線審核。預設勾選<span className="font-medium">符合語系</span>的人(不符語系邀了也沒用);發佈時寄免註冊試音連結給勾選的人。完全的一般人(沒報名)用下方公開連結。</p>
                {aiPoolErr ? <p className="text-xs text-red-400">{aiPoolErr}</p> : aiPool.length === 0 ? (
                  <p className="text-xs text-gray-400">目前沒有「接受 AI」的報名者 —— 可用下方公開連結招人(對方點開就能試、等於當場同意)。</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <input value={talentSearch} onChange={(e) => setTalentSearch(e.target.value)} placeholder="搜尋 email / 名字…" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#6FCF97]/60 max-w-[200px]" />
                      <label className="text-xs text-gray-400 flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={langOnly} onChange={(e) => setLangOnly(e.target.checked)} className="accent-[#6FCF97]" />只顯示符合語系</label>
                      <div className="inline-flex rounded-lg overflow-hidden border border-white/10 text-xs">
                        {([['all', '全部性別'], ['male', '男'], ['female', '女']] as const).map(([g, label]) => (
                          <button key={g} type="button" onClick={() => setGenderFilter(g)} className={`px-2.5 py-1 ${genderFilter === g ? 'bg-[#6FCF97]/25 text-[#6FCF97]' : 'text-gray-300 hover:bg-white/10'}`}>{label}</button>
                        ))}
                      </div>
                      <button type="button" onClick={() => { setUserEditedEmails(true); setSelEmails(new Set(aiShown.map((p) => p.email))); }} className="text-xs bg-[#6FCF97]/15 hover:bg-[#6FCF97]/25 text-[#6FCF97] rounded px-2.5 py-1">全選目前清單</button>
                      <button type="button" onClick={() => { setUserEditedEmails(true); setSelEmails(new Set()); }} className="text-xs bg-white/10 hover:bg-white/15 text-gray-200 rounded px-2.5 py-1">清除</button>
                    </div>
                    <div className="max-h-56 overflow-y-auto rounded-lg border border-white/10 divide-y divide-white/5">
                      {aiShown.length === 0 && <p className="text-xs text-gray-500 p-3">沒有符合的報名者{langOnly || genderFilter !== 'all' ? '(可放寬「語系 / 性別」篩選看更多)' : ''}。</p>}
                      {aiShown.slice(0, 500).map((p) => (
                        <label key={p.email} className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-white/[0.03]">
                          <input type="checkbox" checked={selEmails.has(p.email)} onChange={() => { setUserEditedEmails(true); setSelEmails((s) => { const n = new Set(s); if (n.has(p.email)) n.delete(p.email); else n.add(p.email); return n; }); }} className="accent-[#6FCF97]" />
                          <span className="text-gray-100">{p.name}</span>
                          {p.gender && <span className="text-[10px] text-gray-400 bg-white/10 px-1 rounded">{p.gender === 'male' ? '男' : '女'}</span>}
                          {matchesLang(p) && <span className="text-[10px] text-green-400/80">符合語系</span>}
                          <span className="ml-auto text-[11px] text-gray-500 truncate max-w-[45%]">{p.email}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              // Normal case: online vetted voice actors only (the vetting gate).
              <>
                <p className="text-xs text-gray-500 mb-3">只列已上線(審核過)的配音員 —— 這是平台的把關。指定配音員已自動勾選;可「該語系全選」或自行挑選,發佈時會寄試音邀請給勾選的人。</p>
                {rosterErr ? <p className="text-xs text-red-400">{rosterErr}</p> : (
                  <>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <input value={talentSearch} onChange={(e) => setTalentSearch(e.target.value)} placeholder="搜尋配音員…" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-400/60 max-w-[200px]" />
                      <label className="text-xs text-gray-400 flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={langOnly} onChange={(e) => setLangOnly(e.target.checked)} className="accent-amber-500" />只顯示符合語系</label>
                      <div className="inline-flex rounded-lg overflow-hidden border border-white/10 text-xs">
                        {([['all', '全部性別'], ['male', '男'], ['female', '女']] as const).map(([g, label]) => (
                          <button key={g} type="button" onClick={() => setGenderFilter(g)} className={`px-2.5 py-1 ${genderFilter === g ? 'bg-amber-500/25 text-amber-200' : 'text-gray-300 hover:bg-white/10'}`}>{label}</button>
                        ))}
                      </div>
                      <button type="button" onClick={() => { setUserEditedSel(true); setSelTalents(new Set(rosterShown.map((t) => t.id))); }} className="text-xs bg-white/10 hover:bg-white/15 text-gray-200 rounded px-2.5 py-1">全選目前清單</button>
                      <button type="button" onClick={() => { setUserEditedSel(true); setSelTalents(new Set()); }} className="text-xs bg-white/10 hover:bg-white/15 text-gray-200 rounded px-2.5 py-1">清除</button>
                    </div>
                    {(() => {
                      const ordered = rosterShown;
                      return (
                        <div className="max-h-56 overflow-y-auto rounded-lg border border-white/10 divide-y divide-white/5">
                          {ordered.length === 0 && <p className="text-xs text-gray-500 p-3">沒有符合的上線配音員{langOnly || genderFilter !== 'all' ? '(可放寬「語系 / 性別」篩選看更多)' : ''}。</p>}
                          {ordered.slice(0, 200).map((t) => (
                            <label key={t.id} className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-white/[0.03]">
                              <input type="checkbox" checked={selTalents.has(t.id)} onChange={() => toggleTalent(t.id)} className="accent-amber-500" />
                              <span className="text-gray-100">{t.name}</span>
                              {t.gender && <span className="text-[10px] text-gray-400 bg-white/10 px-1 rounded">{t.gender === 'male' ? '男' : '女'}</span>}
                              {isRequested(t) && <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">🎯 指定</span>}
                              {matchesLang(t) && <span className="text-[10px] text-green-400/80">符合語系</span>}
                              <span className="ml-auto text-[11px] text-gray-500 truncate max-w-[40%]">{t.langs}</span>
                            </label>
                          ))}
                        </div>
                      );
                    })()}
                    {reqName && roster.length > 0 && !roster.some(isRequested) && <p className="text-[11px] text-amber-400/80 mt-1.5">⚠ 指定配音員「{fromClient?.requested_talent}」不在上線名單中,無法寄送(僅發給已上線者)。</p>}
                  </>
                )}
              </>
            )}
          </div>

          {/* 指定邀請(可含未上線)—— 按名字點名任何已核准的人,系統用它存的 email 免註冊發 */}
          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-sm font-semibold text-gray-200">指定邀請(可含未上線)</p>
              <span className="text-xs text-amber-300">已點名 {pinned.length} 位</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">打名字搜任何已核准的配音員(含未上線),點一下加入。發佈時系統自動用他存的 email 寄免註冊試音連結 —— 你不用碰 email。</p>
            {pinned.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {pinned.map((p) => (
                  <span key={p.email} className="inline-flex items-center gap-1.5 text-xs bg-amber-500/15 text-amber-200 border border-amber-500/30 rounded-full pl-2.5 pr-1 py-1">
                    {p.name}{!p.active && <span className="text-[10px] text-gray-400">未上線</span>}
                    <button type="button" onClick={() => setPinned((s) => s.filter((x) => x.email !== p.email))} className="w-4 h-4 rounded-full hover:bg-white/10 flex items-center justify-center" aria-label="移除">✕</button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <input value={pinQ} onChange={(e) => { setPinQ(e.target.value); setPinOpen(true); }} onFocus={() => setPinOpen(true)} onBlur={() => setTimeout(() => setPinOpen(false), 150)}
                placeholder="打名字搜配音員…" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-400/60 w-full max-w-[280px]" />
              {pinOpen && pinQ.trim() && (() => {
                const q = pinQ.trim().toLowerCase();
                const picked = new Set(pinned.map((p) => p.email));
                const hits = directory.filter((d) => !picked.has(d.email) && d.name.toLowerCase().includes(q)).slice(0, 20);
                return (
                  <div className="absolute z-30 left-0 mt-1 w-full max-w-[280px] max-h-56 overflow-y-auto rounded-lg border border-white/10 bg-[#161616] shadow-xl divide-y divide-white/5">
                    {hits.length === 0 && <p className="text-xs text-gray-500 p-3">找不到「{pinQ}」</p>}
                    {hits.map((d) => (
                      <button key={d.email} type="button" onMouseDown={(e) => { e.preventDefault(); setPinned((s) => [...s, { email: d.email, name: d.name, active: d.active }]); setPinQ(''); setPinOpen(false); }}
                        className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-white/[0.05] text-gray-100">
                        <span>{d.name}</span>
                        {d.gender && <span className="text-[10px] text-gray-400 bg-white/10 px-1 rounded">{d.gender === 'male' ? '男' : '女'}</span>}
                        {!d.active && <span className="text-[10px] text-amber-300/80">未上線</span>}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          {err && <p className="text-red-400 text-sm mt-4">{err}</p>}
          <div className="flex gap-3 mt-4">
            <button onClick={() => setPreviewing(false)} className="bg-white/10 hover:bg-white/15 text-white rounded-lg px-5 py-2.5 text-sm">← 返回修改</button>
            <button onClick={submit} disabled={busy} className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold rounded-lg px-5 py-2.5 text-sm">{busy ? '發布中…' : '✓ 確認發佈'}</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-12 text-gray-900">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold">{fromId ? '完成客戶請求 → 發佈試音案' : '發案 · 人聲試音案'}</h1>
        <p className="text-gray-500 text-sm">填好後先預覽,確認沒問題再發佈。填寫過程會自動存草稿,沒空寫完直接關頁,回來可續。</p>
        <DraftBanner draft={draft} />

        {fromClient && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
            <p className="text-amber-900 font-medium mb-1">📥 來自客戶請求 —— 已帶入下方欄位,補上角色 + 配音員報酬即可發佈</p>
            <p className="text-amber-800/90 text-xs leading-relaxed">
              {[fromClient.name, fromClient.company, fromClient.email].filter(Boolean).join(' · ')}
              {fromClient.budget ? ` · 客戶預算 ${fromClient.budget_type || ''} ${fromClient.budget}` : ''}
            </p>
            {(fromClient.has_singing || fromClient.wants_director || fromClient.wants_live_session) && (
              <p className="text-amber-800/90 text-xs mt-1">
                {[fromClient.has_singing && '含唱歌', fromClient.wants_director && '聲音導演', fromClient.wants_live_session && '線上監錄'].filter(Boolean).join(' · ')}
              </p>
            )}
            {(fromClient.gender_needs || fromClient.requested_talent || fromClient.local_studio_region || fromClient.script_file_url) && (
              <div className="text-amber-900/90 text-xs mt-1.5 space-y-0.5 border-t border-amber-200/70 pt-1.5">
                {fromClient.requested_talent && <p>🎯 指定配音員:{fromClient.requested_talent}</p>}
                {fromClient.gender_needs && <p>需求人數:{fromClient.gender_needs}</p>}
                {fromClient.local_studio_region && <p>當地錄音室:{fromClient.local_studio_region}</p>}
                {fromClient.script_file_url && <p>客戶稿件:<a href={fromClient.script_file_url} target="_blank" rel="noopener noreferrer" className="underline">下載檔案</a></p>}
              </div>
            )}
            <p className="text-amber-700/70 text-[11px] mt-1.5">💡 「報酬」填的是給配音員看的金額(可低於客戶預算,差額是你的利潤);發佈後此筆會直接上線,不會新增重複案。</p>
          </div>
        )}

        <Field label="標題 *"><input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例:遊戲角色配音 · 女王百貨" /></Field>
        <Field label="客戶(內部備註,配音員和前台都看不到)"><input className={input} value={clientNote} onChange={(e) => setClientNote(e.target.value)} placeholder="例:WeChat 客戶 王經理 · 上海XX網絡 · 微信ID xxx" /></Field>

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
            : '配音員依案件說明 / 試音稿錄製試音並上傳 + 報價(不分角色;廣告 / 旁白 / 有聲書 / TTS 等)。'}
        </p>

        {/* When the 類別 is TTS / AI, this case is client-side voice→AI: pick the
            sub-type (clone/training). It's INVITE-GATED — only talents who opted into
            the matching consent are invited / can see it; they sign the CLIENT's
            authorization, not Onyx's. Choosing a non-AI category clears this. */}
        {category === AI_CATEGORY && (
          <div className="rounded-lg p-3 border bg-[#6FCF97]/[0.07] border-[#6FCF97]/40">
            <p className="text-sm text-gray-800 mb-2"><span className="font-medium">TTS / AI 案(客戶端)</span> —— 配音員的聲音會被製成 AI。請選類型:</p>
            <div className="space-y-1.5">
              {([['clone', '聲音製成 AI(會用到本人聲音)', '例:客戶要拿錄音做成 TTS 合成模型 → 篩「接受聲音變 AI」的配音員'],
                 ['training', 'AI 訓練素材(不會用到本人聲音)', '例:只是錄泛用語料餵模型,聲音不會被複製 → 篩「接受錄訓練素材」的配音員']] as const).map(([k, l, hint]) => (
                <label key={k} className="flex items-start gap-2 cursor-pointer">
                  <input type="radio" name="aiType" className="mt-0.5 accent-[#6FCF97]" checked={aiType === k} onChange={() => setAiType(k)} />
                  <span className="text-sm text-gray-700">{l}<span className="block text-[11px] text-gray-400">{hint}</span></span>
                </label>
              ))}
            </div>
            <p className="text-[11px] text-[#4b9c6e] pt-2">🟢 開放給所有「已同意」的人(不限是否已上線審核、不限配音員身分,一般人也能試);沒同意的看不到。接案後另簽<span className="font-medium">客戶的授權書</span>。</p>
          </div>
        )}

        <Field label="語言">
          <div className="relative">
            <input
              className={input}
              value={langOpen ? langQ : (LANGUAGES.some((o) => o.v === language) ? langLabel(language, 'zh-TW') : language)}
              placeholder="打字搜尋或點選(中文 / 英文皆可)…"
              onFocus={() => { setLangOpen(true); setLangQ(''); }}
              onChange={(e) => { setLangQ(e.target.value); setLangOpen(true); }}
              onBlur={() => setTimeout(() => setLangOpen(false), 150)}
            />
            {langOpen && (() => {
              const q = langQ.trim().toLowerCase();
              const list = q ? LANGUAGES.filter((o) => o.tw.toLowerCase().includes(q) || o.cn.toLowerCase().includes(q) || o.v.toLowerCase().includes(q)) : LANGUAGES;
              return (
                <div className="absolute z-30 left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl">
                  {list.length === 0 && <p className="px-3 py-2 text-sm text-gray-400">找不到「{langQ}」</p>}
                  {list.map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); setLanguage(o.v); setLangOpen(false); setLangQ(''); }}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-gray-100 ${o.v === language ? 'bg-green-50 text-green-700' : 'text-gray-800'}`}
                    >
                      <span>{o.tw}</span>
                      <span className="text-[11px] text-gray-400 shrink-0">{o.v}</span>
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>
        </Field>
        <Field label="需求(人數 / 性別)">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600">男聲
              <select className={input} value={maleVoices} onChange={(e) => setMaleVoices(e.target.value)}>{VOICE_COUNTS.map((v) => <option key={v} value={v}>{countLabel(v)}</option>)}</select>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600">女聲
              <select className={input} value={femaleVoices} onChange={(e) => setFemaleVoices(e.target.value)}>{VOICE_COUNTS.map((v) => <option key={v} value={v}>{countLabel(v)}</option>)}</select>
            </label>
          </div>
          {buildGenderNeeds(maleVoices, femaleVoices) && <p className="text-[11px] text-gray-400 mt-1">需求:{buildGenderNeeds(maleVoices, femaleVoices)}</p>}
        </Field>
        <Field label="報酬(客戶預算,給配音員看 · 台幣/美金二選一)">
          <div className="flex items-center gap-2">
            <select className={`${input} w-28`} value={rateCur} onChange={(e) => setRateCur(e.target.value)}>
              {CCYS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="number" min="0" className={input} value={rateAmt} onChange={(e) => setRateAmt(e.target.value)} placeholder="金額" />
            <span className="text-gray-500 text-sm">/</span>
            <select className={`${input} w-28`} value={rateUnit} onChange={(e) => setRateUnit(e.target.value)}>
              {RATE_UNITS.map((u) => <option key={u} value={u}>{u === '整案' ? '整案' : `每${u}`}</option>)}
            </select>
          </div>
        </Field>
        <Field label="案件說明 *"><textarea className={`${input} min-h-[90px] resize-y`} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="全劇共 X 條台詞… 先試音,通過後正式錄。試音範圍…" /></Field>

        <div className="grid grid-cols-4 gap-3">
          <Field label="試音截止">
            <div className="flex gap-2">
              <input type="date" className={`${input} [color-scheme:light]`} value={auditionDeadline} onChange={(e) => setAuditionDeadline(e.target.value)} />
              <input type="time" className={`${input} [color-scheme:light] w-32`} value={auditionDeadlineTime} onChange={(e) => setAuditionDeadlineTime(e.target.value)} title="時間(選填;不填=當天 23:59)" />
            </div>
          </Field>
          <Field label="案件時區(所有時間以它為準,配音員端會自動換算並標明)">
            <select className={input} value={caseTz} onChange={(e) => setCaseTz(e.target.value)}>
              {CASE_TIMEZONES.map((z) => <option key={z.v} value={z.v}>{z.label}</option>)}
            </select>
          </Field>
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
        <Field label="其他需求(可複選)">
          <div className="flex gap-4 text-sm text-gray-700">
            <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={hasSinging} onChange={(e) => setHasSinging(e.target.checked)} /> 含唱歌</label>
            <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={wantsDirector} onChange={(e) => setWantsDirector(e.target.checked)} /> 需要聲音導演</label>
          </div>
        </Field>

        {/* Voices-style case data (all optional). Shown on the casting card; ads
            care most about 使用範圍/秒數, games about 句數, audiobooks about 時數. */}
        <p className="text-xs text-gray-400 -mb-1 pt-1">案件資料(選填,會顯示在配音員看到的卡上)</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="規模(句數 / 字數 / 秒數 / 時數)"><input className={input} value={scale} onChange={(e) => setScale(e.target.value)} placeholder="例:全劇 129 句 / 30 秒 / 5 小時" /></Field>
          <Field label="交付截止(最終交件)">
            <div className="flex gap-2">
              <input type="date" className={`${input} [color-scheme:light]`} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              <input type="time" className={`${input} [color-scheme:light] w-32`} value={deadlineTime} onChange={(e) => setDeadlineTime(e.target.value)} title="時間(選填;不填=當天 23:59)" />
            </div>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="使用範圍"><select className={input} value={mediaScope} onChange={(e) => setMediaScope(e.target.value)}>{optsWith(USAGE_OPTS, mediaScope).map(optEl)}</select></Field>
          <Field label="地區"><select className={input} value={territory} onChange={(e) => setTerritory(e.target.value)}>{optsWith(TERRITORY_OPTS, territory).map(optEl)}</select></Field>
          <Field label="授權期"><select className={input} value={licenseTerm} onChange={(e) => setLicenseTerm(e.target.value)}>{optsWith(LICENSE_OPTS, licenseTerm).map(optEl)}</select></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="口音"><select className={input} value={accent} onChange={(e) => setAccent(e.target.value)}>{optsWith(ACCENT_OPTS, accent).map(optEl)}</select></Field>
          <Field label="聲音風格"><select className={input} value={voiceStyle} onChange={(e) => setVoiceStyle(e.target.value)}>{optsWith(STYLE_OPTS, voiceStyle).map(optEl)}</select></Field>
          <Field label="聲音年齡"><select className={input} value={voiceAge} onChange={(e) => setVoiceAge(e.target.value)}>{optsWith(AGE_OPTS, voiceAge).map(optEl)}</select></Field>
        </div>

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
        <Field label={category === AI_CATEGORY ? '試音稿 / 聲音方向(配音員只能線上看、不能下載)' : '試音方向 / 聲音方向(選填,配音員只能線上看)'}>
          <textarea className={`${input} min-h-[100px] resize-y`} value={auditionScript} onChange={(e) => setAuditionScript(e.target.value)}
            placeholder={category === AI_CATEGORY ? '貼上完整試音稿(基礎發音 / 表現力 / 問句 / 長句 / 對話…);配音員只能線上看、不能下載' : '情緒、語速、聲音方向…(或共用樣詞)'} />
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
            className="block w-full text-xs text-gray-500 mb-1 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 file:text-xs" />
          <p className="text-[11px] text-gray-400 mb-2">單檔 50MB 內;過大請放雲端,貼直連到下方欄位抓進平台。</p>
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

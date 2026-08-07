'use client';

/*
  客戶端 AI 發案「Aria」(/hire 預設模式,Wing 2026-08-06 Phase 2B)——
  照 Fiverr Mira 的三階段流程 × Onyx 黑白極簡:
  ① 開場:置中大字 + 單一輸入框 + 範例提示
  ② 對話:單欄置中,Aria 身分列 + 黑色「工作進度」卡;回覆打字機式浮現
  ③ 需求單:右欄「緩慢滑出」變兩頁 —— 預設是文件檢視(只列已填內容,新內容打字機式
     一行行浮現,像有人在寫文件),點任一行或「編輯」切到完整表單(欄位=傳統表單全集);
     中間進度軌 n/8 點開看必備/選填清單。完成可下載 PDF。
  送出走既有 /api/hire 管線(客戶請求 → 審核後發佈)。
*/

import { useState, useRef, useEffect } from 'react';
import { Send, ArrowRight, RotateCcw, CheckCircle2, Circle, Download, PencilLine, FileText, Paperclip } from 'lucide-react';
import { LANGUAGES } from '@/lib/languages';
import { supabase } from '@/lib/supabase';

const SCRIPT_EXT = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'pages', 'md'];

type Msg = { role: 'user' | 'assistant'; content: string };
type Draft = Record<string, unknown>;

type Opt = { v: string; tw: string; cn: string };
const CONTENT_TYPES: Opt[] = [
  { v: 'Commercial', tw: '廣告', cn: '广告' }, { v: 'Narration', tw: '旁白 / 解說', cn: '旁白 / 解说' },
  { v: 'Audiobook', tw: '有聲書', cn: '有声书' }, { v: 'Corporate', tw: '企業簡介 / 形象', cn: '企业简介 / 形象' },
  { v: 'E-Learning', tw: '教育 / 課程', cn: '教育 / 课程' }, { v: 'Game', tw: '遊戲', cn: '游戏' },
  { v: 'Animation', tw: '動畫 / 卡通', cn: '动画 / 卡通' }, { v: 'Film / Drama', tw: '戲劇 / 影視', cn: '戏剧 / 影视' },
  { v: 'Documentary', tw: '紀錄片', cn: '纪录片' }, { v: 'Podcast', tw: 'Podcast / 訪談', cn: '播客 / 访谈' },
  { v: 'IVR', tw: '電話語音 (IVR)', cn: '电话语音 (IVR)' }, { v: 'Other', tw: '其他', cn: '其他' },
];
const MEDIA: Opt[] = [
  { v: 'TV (Broadcast)', tw: '單一電視', cn: '单一电视' }, { v: 'Radio (Broadcast)', tw: '單一廣播', cn: '单一广播' },
  { v: 'All Digital', tw: '全數位媒體', cn: '全数字媒体' }, { v: 'All Media (TV + Digital)', tw: '全媒體(電視+數位)', cn: '全媒体(电视+数字)' },
];
const TERRITORY: Opt[] = [
  { v: 'Global', tw: '全球', cn: '全球' }, { v: 'Single region', tw: '單一地區(台灣)', cn: '单一地区(台湾)' }, { v: 'Other', tw: '其他指定', cn: '其他指定' },
];
const LICENSE: Opt[] = [
  { v: '1 year', tw: '一年', cn: '一年' }, { v: '3 years', tw: '三年', cn: '三年' }, { v: '5 years', tw: '五年', cn: '五年' },
  { v: 'Perpetual / Buyout', tw: '永久 / 買斷', cn: '永久 / 买断' }, { v: 'Other', tw: '其他', cn: '其他' },
];

const FIELD_LABELS: Record<string, [string, string, string]> = {
  title: ['標題', '标题', 'Title'], content_type: ['類型', '类型', 'Type'], language: ['語言', '语言', 'Language'],
  accent: ['口音', '口音', 'Accent'], male_voices: ['男聲', '男声', 'Male voices'], female_voices: ['女聲', '女声', 'Female voices'],
  length: ['份量', '份量', 'Length'], budget: ['預算', '预算', 'Budget'], budget_currency: ['幣別', '币别', 'Currency'],
  audition_deadline: ['試音截止', '试音截止', 'Audition deadline'], deadline: ['交付期限', '交付期限', 'Delivery'],
  voice_style: ['聲音風格', '声音风格', 'Style'], voice_age: ['聲齡', '声龄', 'Voice age'],
  brief: ['需求說明', '需求说明', 'Brief'], script_text: ['稿件', '稿件', 'Script'],
  name: ['稱呼', '称呼', 'Name'], company: ['公司', '公司', 'Company'], email: ['Email', 'Email', 'Email'],
  media_scope: ['播放媒體', '播放媒体', 'Media'], territory: ['播放地區', '播放地区', 'Territory'],
  license_term: ['授權期間', '授权期间', 'License'], recording_start: ['預計開錄日', '预计开录日', 'Recording start'],
  script_type: ['稿件類型', '稿件类型', 'Script type'], local_studio_region: ['實體錄音室地區', '实体录音室地区', 'Local studio'],
  reference_links: ['參考聲音', '参考声音', 'Reference audio'], script_link: ['稿件連結', '稿件链接', 'Script link'],
  script_file_name: ['稿件檔案', '稿件档案', 'Script file'], website: ['官網', '官网', 'Website'],
  company_note: ['公司簡介', '公司简介', 'About company'], budget_type: ['預算型態', '预算型态', 'Budget type'],
  budget_unit: ['計價單位', '计价单位', 'Unit'], has_singing: ['唱歌', '唱歌', 'Singing'],
  wants_director: ['聲音導演', '声音导演', 'Director'], wants_live_session: ['線上監錄', '线上监录', 'Live session'],
};

// 文件檢視分節(只顯示已填的行)
const DOC_SECTIONS: { t: [string, string, string]; keys: string[] }[] = [
  { t: ['基本資訊', '基本信息', 'BASICS'], keys: ['content_type', 'language', 'accent', 'male_voices', 'female_voices', 'length', 'voice_style', 'voice_age'] },
  { t: ['播放與授權', '播放与授权', 'USAGE & LICENSE'], keys: ['media_scope', 'territory', 'license_term'] },
  { t: ['時程', '时程', 'TIMELINE'], keys: ['audition_deadline', 'recording_start', 'deadline'] },
  { t: ['預算', '预算', 'BUDGET'], keys: ['budget_type', 'budget', 'budget_unit'] },
  { t: ['錄製需求', '录制需求', 'SESSION'], keys: ['wants_director', 'wants_live_session', 'local_studio_region', 'has_singing'] },
  { t: ['稿件', '稿件', 'SCRIPT'], keys: ['script_type', 'script_link', 'script_file_name'] },
  { t: ['參考聲音', '参考声音', 'REFERENCES'], keys: ['reference_links'] },
  { t: ['聯絡方式', '联系方式', 'CONTACT'], keys: ['name', 'company', 'website', 'company_note', 'email'] },
];

// 打字機文字:新內容一個字一個字浮現(長文加速),尾端游標閃爍
function TypeText({ text, delay = 0 }: { text: string; delay?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    let id: ReturnType<typeof setInterval> | undefined;
    const t = setTimeout(() => {
      // 短欄位(2-6字)用 Chat 速度會一瞬間閃完 → 依長度調速:短欄一字一字蹦、長段=Chat 節奏
      const speed = text.length <= 12 ? 85 : text.length <= 60 ? 45 : 20;
      const step = text.length > 400 ? 3 : 1;             // 超長段落(需求說明)加速不拖戲
      id = setInterval(() => setN((x) => {
        const nx = x + step;
        if (nx >= text.length) { if (id) clearInterval(id); return text.length; }
        return nx;
      }), speed);
    }, delay);
    return () => { clearTimeout(t); if (id) clearInterval(id); };
  }, [text, delay]);
  return <span>{text.slice(0, n)}{n < text.length && <span className="hire-ai-caret" />}</span>;
}

// 文件檢視的欄位顯示順序(排隊打字用:照這順序一欄接一欄打出來)
const DOC_KEY_ORDER = ['title', ...DOC_SECTIONS.flatMap((sec) => sec.keys), 'brief', 'script_text'];

export default function HireAi({ locale, onClassic, onSuccess }: { locale: string; onClassic: () => void; onSuccess: () => void }) {
  const isZh = locale.startsWith('zh');
  const isCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isCN ? cn : isZh ? tw : en);
  const fl = (k: string) => { const v = FIELD_LABELS[k]; return v ? (isCN ? v[1] : isZh ? v[0] : v[2]) : k; };
  const optLabel = (list: Opt[], v: string) => { const o = list.find((x) => x.v === v); return o ? (isCN ? o.cn : isZh ? o.tw : o.v) : v; };

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [complete, setComplete] = useState(false);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [recent, setRecent] = useState<Set<string>>(new Set()); // 這一輪 AI 新寫入的欄位 → 打字機呈現
  const [recentOrder, setRecentOrder] = useState<string[]>([]); // 依文件順序排隊打字
  const [typeBase, setTypeBase] = useState(0);                  // 首次滑出要等面板浮現才開打
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [formMode, setFormMode] = useState(false); // false=文件檢視(預設) true=完整表單編輯
  const [scriptUploading, setScriptUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const siteFetched = useRef('');
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);

  // 🚨 draft 一律經 setDraftAll(ref 鏡像):差異計算絕不放 setState 回呼裡
  //(React 只在佇列空時才同步跑 updater → changed 時有時無 → 打字機時靈時不靈的根因)
  const draftRef = useRef<Draft | null>(null);
  const setDraftAll = (d: Draft | null) => { draftRef.current = d; setDraft(d); };
  const setF = (k: string, v: unknown) => setDraftAll({ ...(draftRef.current || {}), [k]: v });
  const sv = (k: string) => String((draft?.[k] as string | number | undefined) ?? '');
  const started = msgs.length > 0;
  const refLinks = Array.isArray(draft?.reference_links) ? (draft?.reference_links as string[]) : [];
  // 服務分流:非真人配音 → 對話裡給對應入口(現成表單/頁面),需求單面板不跳出
  const SERVICE_ROUTES: Record<string, { path: string; label: [string, string, string] }> = {
    ai_voice: { path: '/voice', label: ['AI 配音工作室', 'AI 配音工作室', 'AI Voice Studio'] },
    orchestra: { path: '/music/orchestra', label: ['現場弦樂錄製', '现场弦乐录制', 'Live Strings'] },
  };
  const serviceRoute = SERVICE_ROUTES[String(draft?.service ?? '')] || null;
  // 諮詢單服務(dubbing/music/data):Aria 就地完成,送 /api/contact/send(與各 brief 頁同 source)
  const isInquiry = ['dubbing', 'music', 'data'].includes(sv('service'));
  // 需求單面板:任一實質欄位有值才滑出(照 Mira 的兩頁式);被分流去其他服務時不滑出
  const panelOpen = !serviceRoute && !!draft && Object.keys(FIELD_LABELS).some((k) => {
    const v = draft[k];
    return v !== '' && v !== null && v !== undefined && v !== 0 && v !== false && !(Array.isArray(v) && v.length === 0);
  });

  // 文件檢視的顯示值(選項值 → 中文標籤;空=不顯示該行)
  function dispVal(k: string): string {
    if (k === 'content_type') return optLabel(CONTENT_TYPES, sv(k));
    if (k === 'media_scope') return optLabel(MEDIA, sv(k));
    if (k === 'territory') return optLabel(TERRITORY, sv(k));
    if (k === 'license_term') return optLabel(LICENSE, sv(k));
    if (k === 'language') { const l = LANGUAGES.find((x) => x.v === sv(k)); return l ? (isCN ? l.cn : isZh ? l.tw : l.v) : sv(k); }
    if (k === 'male_voices' || k === 'female_voices') { const num = Number(draft?.[k] ?? 0) || 0; return num > 0 ? `${num} ${tx('位', '位', '')}`.trim() : ''; }
    if (k === 'budget') { const amt = sv('budget').trim(); return amt ? `${sv('budget_currency') || 'USD'} ${amt}` : ''; }
    if (k === 'budget_type') return sv('budget').trim() ? (sv(k) === 'Fixed' ? tx('固定預算', '固定预算', 'Fixed') : sv(k) ? tx('預算上限', '预算上限', 'Up to') : '') : '';
    if (k === 'budget_unit') return sv('budget').trim() ? sv(k) : '';
    if (k === 'script_type') return sv(k) === 'final' ? tx('正式稿', '正式稿', 'Final') : sv(k) === 'audition' ? tx('試音稿', '试音稿', 'Audition') : '';
    if (k === 'reference_links') return refLinks.filter((u) => u.trim()).join('\n');
    if (typeof draft?.[k] === 'boolean') return draft[k] ? tx('需要', '需要', 'Yes') : '';
    return sv(k);
  }

  // 中間進度軌:必備資料(還差多少)
  const voicesOk = (Number(draft?.male_voices ?? 0) || 0) + (Number(draft?.female_voices ?? 0) || 0) > 0;
  const REQUIRED: { label: [string, string, string]; done: boolean }[] = isInquiry ? [
    { label: ['需求說明', '需求说明', 'Brief'], done: !!sv('brief').trim() },
    { label: ['份量/規模', '份量/规模', 'Scope'], done: !!sv('length').trim() || complete },
    { label: ['期限', '期限', 'Timeline'], done: !!sv('deadline') || complete },
    { label: ['聯絡方式', '联系方式', 'Contact'], done: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sv('email').trim()) },
  ] : [
    { label: ['內容類型', '内容类型', 'Content type'], done: !!sv('content_type') },
    { label: ['語言', '语言', 'Language'], done: !!sv('language') },
    { label: ['聲別與人數', '声别与人数', 'Voices needed'], done: voicesOk },
    { label: ['份量(長度/字數)', '份量(长度/字数)', 'Length'], done: !!sv('length').trim() },
    { label: ['需求說明', '需求说明', 'Brief'], done: !!sv('brief').trim() },
    { label: ['預算(可先聽報價)', '预算(可先听报价)', 'Budget (or quote me)'], done: !!sv('budget').trim() || complete },
    { label: ['期限', '期限', 'Timeline'], done: !!sv('deadline') || !!sv('audition_deadline') || complete },
    { label: ['聯絡方式', '联系方式', 'Contact'], done: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sv('email').trim()) },
  ];
  const OPTIONAL: { label: [string, string, string]; done: boolean }[] = [
    { label: ['口音/地區腔', '口音/地区腔', 'Accent'], done: !!sv('accent').trim() },
    { label: ['聲音風格與聲齡', '声音风格与声龄', 'Style & voice age'], done: !!sv('voice_style').trim() || !!sv('voice_age').trim() },
    { label: ['播放媒體/地區/授權', '播放媒体/地区/授权', 'Media / territory / license'], done: !!sv('media_scope') || !!sv('territory') || !!sv('license_term') },
    { label: ['試音截止/開錄日', '试音截止/开录日', 'Audition / recording dates'], done: !!sv('audition_deadline') || !!sv('recording_start') },
    { label: ['稿件', '稿件', 'Script'], done: !!sv('script_text').trim() || !!sv('script_link').trim() || !!sv('script_file_url') },
    { label: ['參考連結', '参考链接', 'Reference links'], done: refLinks.length > 0 },
    { label: ['錄製需求(導演/監錄/錄音室)', '录制需求(导演/监录/录音室)', 'Session needs'], done: !!draft?.wants_director || !!draft?.wants_live_session || !!sv('local_studio_region').trim() },
    { label: ['唱歌', '唱歌', 'Singing'], done: !!draft?.has_singing },
  ];
  const reqDone = REQUIRED.filter((r) => r.done).length;

  // 稿件檔上傳(沿用傳統表單管線:/api/hire/script-upload → casting bucket signed upload)
  async function uploadScript(file: File) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!SCRIPT_EXT.includes(ext)) { setErr(tx('稿件檔案格式不支援(pdf / doc / docx / txt / rtf 等);影音請改貼連結。', '稿件档案格式不支持(pdf / doc / docx / txt / rtf 等);影音请改贴链接。', 'Unsupported file type (pdf / doc / docx / txt / rtf …) — link audio/video instead.')); return; }
    if (file.size > 25 * 1024 * 1024) { setErr(tx('稿件檔案請勿超過 25MB', '稿件档案请勿超过 25MB', 'Script file must be under 25MB')); return; }
    setScriptUploading(true); setErr('');
    try {
      const u = await fetch('/api/hire/script-upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name }) });
      const uj = await u.json().catch(() => ({}));
      if (!u.ok) throw new Error(uj.error || 'upload prep failed');
      const { error: upErr } = await supabase.storage.from('casting').uploadToSignedUrl(uj.path, uj.token, file);
      if (upErr) throw new Error(upErr.message);
      setDraftAll({ ...(draftRef.current || {}), script_file_url: uj.publicUrl, script_file_name: file.name });
      setMsgs((m) => [...m, { role: 'assistant', content: `${tx('稿件已收到:', '稿件已收到:', 'Script received: ')}${file.name}` }]);
    } catch (e) { setErr(e instanceof Error ? e.message : tx('稿件上傳失敗,請重試', '稿件上传失败,请重试', 'Script upload failed')); }
    finally { setScriptUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  // 客戶給官網 → 自動抓公司名稱/簡介帶入需求單
  useEffect(() => {
    const w = sv('website').trim();
    if (!w || siteFetched.current === w) return;
    siteFetched.current = w;
    fetch('/api/hire/site-info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: w }) })
      .then((r) => r.json()).then((j) => {
        const cur = { ...(draftRef.current || {}) };
        if (j?.name && !String(cur.company || '').trim()) cur.company = j.name;
        if (j?.description && !String(cur.company_note || '').trim()) cur.company_note = j.description;
        setDraftAll(cur);
      }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.website]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setMsgs((m) => [...m, { role: 'user', content }]); setInput(''); setBusy(true); setErr('');
    const apiMsgs: Msg[] = [...msgs, { role: 'user', content: draft ? `${content}\n\n[目前草稿狀態:${JSON.stringify(draft)}]` : content }];
    try {
      const res = await fetch('/api/hire/ai-draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMsgs, locale }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || tx('AI 回覆失敗', 'AI 回复失败', 'AI failed to reply'));
      let changed: string[] = [];
      if (j.draft && typeof j.draft === 'object') {
        const prev = draftRef.current || {};
        const merged: Draft = { ...(j.draft as Draft) };
        for (const [k, v] of Object.entries(prev)) {
          const nv = merged[k];
          const emptyNv = nv === '' || nv === null || nv === undefined || (Array.isArray(nv) && nv.length === 0);
          const emptyPrev = v === '' || v === null || v === undefined || (Array.isArray(v) && v.length === 0);
          if (emptyNv && !emptyPrev) merged[k] = v;
        }
        changed = Object.keys(merged).filter((k) => k in FIELD_LABELS && JSON.stringify(merged[k]) !== JSON.stringify(prev[k]) && merged[k] !== '' && merged[k] !== 0);
        setDraftAll(merged);
      }
      setComplete(!!j.complete);
      if (changed.length) {
        setFlash(new Set(changed));
        setRecent(new Set(changed));
        setRecentOrder(DOC_KEY_ORDER.filter((k) => changed.includes(k)));
        setTypeBase(panelOpen ? 300 : 3400);   // 面板已開=稍停就打;剛滑出=等 3.2s 完全浮現才開打
        setTimeout(() => setFlash(new Set()), 1600);
      }
      const q = String(j.question || '').trim();
      const note = changed.length ? `✓ ${tx('已更新', '已更新', 'Updated')}:${changed.map(fl).join(tx('、', '、', ', '))}` : '';
      const bodyText = q || tx('需求都齊了 —— 請確認右側需求單,沒問題就按「確認送出需求」。', '需求都齐了 —— 请确认右侧需求单,没问题就按「确认送出需求」。', "All set — review the brief on the right and hit 'Submit brief'.");
      setMsgs((m) => [...m, { role: 'assistant', content: note ? `${bodyText}\n\n${note}` : bodyText }]);
    } catch (e) { setErr(e instanceof Error ? e.message : tx('失敗', '失败', 'Failed')); }
    finally { setBusy(false); }
  }

  async function submit() {
    if (!draft) return;
    const email = sv('email').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr(tx('請填有效的 Email(需求單「聯絡方式」欄位)。', '请填有效的 Email(需求单「联系方式」栏位)。', 'Please enter a valid email in the contact section.')); return; }
    if (!sv('brief').trim() && !sv('title').trim()) { setErr(tx('需求說明還是空的,請先與 Aria 對話或直接填寫需求單。', '需求说明还是空的,请先与 Aria 对话或直接填写需求单。', 'The brief is empty — chat with Aria or fill it in directly.')); return; }
    if (isInquiry) {
      setSubmitting(true); setErr('');
      try {
        const L = ({ dubbing: ['影片配音', '影片配音', 'Dubbing'], music: ['音樂製作', '音乐制作', 'Music production'], data: ['語音數據', '语音数据', 'Speech data'] } as Record<string, [string, string, string]>)[sv('service')];
        const lines: string[] = [`【Aria ${tx('需求單', '需求单', 'brief')}|${isCN ? L[1] : isZh ? L[0] : L[2]}】`];
        const push = (label: string, val: string) => { if (val.trim()) lines.push(`${label}: ${val.trim()}`); };
        push(fl('title'), sv('title'));
        push(fl('language'), dispVal('language')); push(fl('accent'), sv('accent'));
        push(fl('length'), sv('length'));
        push(fl('deadline'), sv('deadline')); push(fl('recording_start'), sv('recording_start'));
        push(fl('budget'), sv('budget').trim() ? `${sv('budget_currency') || 'USD'} ${sv('budget')}` : '');
        const links = refLinks.map((u) => u.trim()).filter(Boolean);
        if (links.length) lines.push(`${fl('reference_links')}:\n${links.map((u) => `  ${u}`).join('\n')}`);
        push(fl('script_link'), sv('script_link')); push(fl('script_file_name'), sv('script_file_url'));
        lines.push('', sv('brief').trim(), '');
        push(fl('company'), sv('company')); push(fl('website'), sv('website')); push(fl('company_note'), sv('company_note'));
        const r = await fetch('/api/contact/send', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: sv('name').trim() || email.split('@')[0], email,
            message: lines.join('\n'), department: 'PRODUCTION', source: `${sv('service')}-brief`,
          }),
        });
        const d = await r.json();
        if (!r.ok || !d.success) throw new Error(d.error || tx('送出失敗,請重試', '送出失败,请重试', 'Submission failed'));
        onSuccess();
      } catch (e) { setErr(e instanceof Error ? e.message : tx('送出失敗', '送出失败', 'Submission failed')); }
      finally { setSubmitting(false); }
      return;
    }
    setSubmitting(true); setErr('');
    try {
      const male = Number(draft.male_voices ?? 0) || 0, female = Number(draft.female_voices ?? 0) || 0;
      const genderParts: string[] = [];
      if (male > 0) genderParts.push(`${tx('男聲', '男声', 'Male')} ${male}`);
      if (female > 0) genderParts.push(`${tx('女聲', '女声', 'Female')} ${female}`);
      const budgetAmt = sv('budget').trim();
      const cur = sv('budget_currency') || 'USD';
      const r = await fetch('/api/hire', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: sv('title'), name: sv('name'), company: sv('company'), email,
          content_type: sv('content_type'), categories: sv('content_type') ? [sv('content_type')] : [],
          language: sv('language'), accent: sv('accent'),
          voice_style: sv('voice_style'), voice_age: sv('voice_age'),
          length: sv('length'), voices_needed: male + female || null, gender_needs: genderParts.join(tx('、', '、', ', ')),
          budget: budgetAmt ? `${cur} ${budgetAmt}` : '', budget_currency: cur,
          budget_type: sv('budget_type') || 'Up to', budget_unit: sv('budget_unit') || '整案',
          audition_deadline: sv('audition_deadline'), deadline: sv('deadline'),
          media_scope: sv('media_scope'), territory: sv('territory'), license_term: sv('license_term'),
          recording_start: sv('recording_start'), local_studio_region: sv('local_studio_region'),
          reference_links: refLinks.map((u) => String(u).trim()).filter((u) => /^https?:\/\//i.test(u)),
          has_singing: !!draft.has_singing, wants_director: !!draft.wants_director, wants_live_session: !!draft.wants_live_session,
          script_type: sv('script_type') || (sv('script_text').trim() || sv('script_file_url') || sv('script_link') ? 'audition' : ''), script_text: sv('script_text'),
          script_file_url: sv('script_file_url') || (/^https?:\/\//i.test(sv('script_link').trim()) ? sv('script_link').trim() : ''),
          brief: (sv('brief') || sv('title'))
            + (sv('company_note').trim() ? `\n\n【${tx('公司背景', '公司背景', 'About the client')}】${sv('company_note').trim()}` : '')
            + (sv('website').trim() ? `\n${tx('官網', '官网', 'Website')}:${sv('website').trim()}` : ''), locale,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || tx('送出失敗,請重試', '送出失败,请重试', 'Submission failed'));
      onSuccess();
    } catch (e) { setErr(e instanceof Error ? e.message : tx('送出失敗', '送出失败', 'Submission failed')); }
    finally { setSubmitting(false); }
  }

  // 下載 PDF:開新視窗印需求單(瀏覽器另存 PDF)
  function downloadPdf() {
    if (!draft) return;
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
    const row = (label: string, val: string) => (val.trim() ? `<div class="row"><div class="lbl">${esc(label)}</div><div class="val">${esc(val)}</div></div>` : '');
    const male = Number(draft.male_voices ?? 0) || 0, female = Number(draft.female_voices ?? 0) || 0;
    const voices = [male > 0 ? `${fl('male_voices')} ${male}` : '', female > 0 ? `${fl('female_voices')} ${female}` : ''].filter(Boolean).join(' · ');
    const extras = [draft.has_singing ? fl('has_singing') : '', draft.wants_director ? fl('wants_director') : '', draft.wants_live_session ? fl('wants_live_session') : '', sv('local_studio_region').trim() ? `${fl('local_studio_region')}:${sv('local_studio_region')}` : ''].filter(Boolean).join(' · ');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(sv('title') || 'Onyx Studios Brief')}</title><style>
      body{font-family:-apple-system,'PingFang TC','Microsoft JhengHei',sans-serif;color:#111;max-width:720px;margin:40px auto;padding:0 24px;}
      .brand{font-size:11px;letter-spacing:.25em;color:#888;} h1{font-size:26px;margin:8px 0 4px;} .badge{font-size:11px;color:#666;letter-spacing:.15em;}
      hr{border:none;border-top:1px solid #ddd;margin:18px 0;} .row{display:flex;padding:7px 0;border-bottom:1px solid #f0f0f0;font-size:13px;}
      .lbl{width:150px;color:#777;flex-shrink:0;} .val{white-space:pre-wrap;} .sec{font-size:11px;letter-spacing:.2em;color:#999;margin:22px 0 6px;}
    </style></head><body>
      <p class="brand">ONYX STUDIOS · ARIA</p><h1>${esc(sv('title') || tx('配音案件需求單', '配音案件需求单', 'Voiceover Project Brief'))}</h1>
      <p class="badge">${tx('案件需求單', '案件需求单', 'PROJECT BRIEF')}</p><hr>
      ${row(fl('content_type'), dispVal('content_type'))}${row(fl('language'), dispVal('language'))}${row(fl('accent'), sv('accent'))}
      ${row(tx('聲別與人數', '声别与人数', 'Voices'), voices)}${row(fl('length'), sv('length'))}${row(fl('voice_style'), sv('voice_style'))}${row(fl('voice_age'), sv('voice_age'))}
      ${row(fl('media_scope'), dispVal('media_scope'))}${row(fl('territory'), dispVal('territory'))}${row(fl('license_term'), dispVal('license_term'))}
      ${row(fl('budget'), sv('budget') ? `${sv('budget_currency') || 'USD'} ${sv('budget')}` : tx('由 Onyx 報價', '由 Onyx 报价', 'Quote requested'))}
      ${row(fl('audition_deadline'), sv('audition_deadline'))}${row(fl('recording_start'), sv('recording_start'))}${row(fl('deadline'), sv('deadline'))}${row(tx('其他', '其他', 'Extras'), extras)}
      ${refLinks.length ? row(fl('reference_links'), refLinks.join('\n')) : ''}
      <p class="sec">${tx('需求說明', '需求说明', 'BRIEF')}</p><div class="val" style="font-size:13px;line-height:1.8">${esc(sv('brief'))}</div>
      ${sv('script_text').trim() ? `<p class="sec">${tx('稿件', '稿件', 'SCRIPT')}</p><div class="val" style="font-size:12px;line-height:1.7">${esc(sv('script_text'))}</div>` : ''}
      <p class="sec">${tx('聯絡方式', '联系方式', 'CONTACT')}</p>${row(fl('name'), sv('name'))}${row(fl('company'), sv('company'))}${row('Email', sv('email'))}
    </body></html>`;
    const w = window.open('', '_blank'); if (!w) return;
    w.document.write(html); w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 350);
  }

  const inputD = 'w-full rounded-md border border-transparent hover:border-white/15 focus:border-white/50 px-2 py-1.5 text-sm bg-transparent text-white outline-none transition-colors placeholder:text-gray-600';
  const lblD = 'block text-[10px] font-medium tracking-[0.14em] text-gray-500 mb-1';
  const flashCls = (k: string) => (flash.has(k) ? ' hire-ai-flash' : '');
  const typeDur = (t: string) => { const sp = t.length <= 12 ? 85 : t.length <= 60 ? 45 : 20; return (t.length > 400 ? Math.ceil(t.length / 3) : t.length) * sp; };
  const delayFor = (k: string) => {
    const idx = recentOrder.indexOf(k);
    if (idx < 0) return typeBase;
    let d = typeBase;
    for (let i = 0; i < idx; i++) d += typeDur(dispVal(recentOrder[i])) + 280;
    return d;
  };
  const secD = 'pt-4 text-[10px] font-semibold tracking-[0.2em] text-gray-500 border-t border-white/10';
  const optionCls = 'bg-zinc-900';

  const EXAMPLES = [
    tx('我要做一支 60 秒的品牌形象影片旁白,台灣國語男聲,成熟穩重,兩週內要。', '我要做一支 60 秒的品牌形象影片旁白,普通话男声,成熟稳重,两周内要。', 'I need a 60-second brand film narration, US English male, warm and confident, within two weeks.'),
    tx('手遊要配 5 個角色,中文,男女都有,大概 300 句,預算想先聽你們報。', '手游要配 5 个角色,中文,男女都有,大概 300 句,预算想先听你们报。', 'Mobile game, 5 characters, mixed genders, ~300 lines — quote me.'),
  ];

  const selOpts = (list: Opt[], current: string) => (
    <>
      <option value="" className={optionCls}>—</option>
      {list.map((o) => <option key={o.v} value={o.v} className={optionCls}>{isCN ? o.cn : isZh ? o.tw : o.v}</option>)}
      {current && !list.some((o) => o.v === current) && <option value={current} className={optionCls}>{current}</option>}
    </>
  );

  return (
    <div>
      <input ref={fileRef} type="file" accept={SCRIPT_EXT.map((e) => `.${e}`).join(',')} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadScript(f); }} />
      {/* 微動畫:訊息淡入/打字點點/欄位閃光/面板緩慢滑出/進度步驟/打字機游標 */}
      <style>{`
        @keyframes hireAiIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .hire-ai-msg { animation: hireAiIn .28s ease-out both; }
        @keyframes hireAiDot { 0%, 80%, 100% { transform: scale(.6); opacity: .4; } 40% { transform: scale(1); opacity: 1; } }
        .hire-ai-dot { animation: hireAiDot 1.2s infinite ease-in-out; }
        @keyframes hireAiFlash { 0% { background-color: rgba(255,255,255,.14); } 100% { background-color: transparent; } }
        .hire-ai-flash { animation: hireAiFlash 1.5s ease-out both; border-radius: 8px; }
        /* 兩段式:0-40% 先無形讓出空間(版面平滑推開),40-100% 面板才漸漸浮出(淡入+微縮放) */
        @keyframes hireAiPanel {
          0%   { max-width: 0;    opacity: 0; transform: translateX(64px) scale(.985); }
          40%  { max-width: 100%; opacity: 0; transform: translateX(48px) scale(.985); }
          100% { max-width: 100%; opacity: 1; transform: translateX(0) scale(1); }
        }
        .hire-ai-panel { animation: hireAiPanel 3.2s cubic-bezier(.45,.05,.25,1) both; }
        @keyframes hireAiStep { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
        .hire-ai-step { animation: hireAiStep .4s ease-out both; }
        @keyframes hireAiPulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
        .hire-ai-pulse { animation: hireAiPulse 1.4s infinite ease-in-out; }
        @keyframes hireAiBlink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }
        .hire-ai-caret { display: inline-block; width: .55em; height: 1.1em; background: #e5e5e5; margin-left: 1px; vertical-align: -0.15em; animation: hireAiBlink .9s steps(1) infinite; }
        .hire-doc-line:hover .hire-doc-edit { opacity: 1; }
      `}</style>

      {/* ── 階段①:開場 ── */}
      {!started && (
        <div className="max-w-3xl mx-auto text-center pt-4 pb-10 hire-ai-msg">
          <p className="text-[11px] tracking-[0.3em] text-gray-500 mb-6">ARIA · ONYX STUDIOS</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight">{tx('您需要什麼樣的聲音?', '您需要什么样的声音?', 'What voice do you need?')}</h1>
          <p className="mt-3 text-gray-400 text-[15px] leading-7 max-w-xl mx-auto">{tx('我是 Aria,Onyx 的 AI 發案助理。真人配音、AI 配音、影片翻配、音樂與弦樂、語音數據都可以 —— 描述您的專案,我會確認細節、整理成正式需求單,或帶您到對應的服務入口。', '我是 Aria,Onyx 的 AI 发案助理。真人配音、AI 配音、影片翻配、音乐与弦乐、语音数据都可以 —— 描述您的项目,我会确认细节、整理成正式需求单,或带您到对应的服务入口。', 'I’m Aria, Onyx’s AI project assistant. Human voiceover, AI voices, dubbing, music and live strings, speech data — describe your project and I’ll build the brief or route you to the right studio.')}</p>
          <div className="mt-8 rounded-3xl border border-white/15 bg-white/[0.04] p-4 text-left focus-within:border-white/40 transition-colors shadow-[0_8px_40px_rgba(0,0,0,.35)]">
            <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={3}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={tx('例如:企業形象影片旁白,台灣國語女聲,約 90 秒,月底前交付…', '例如:企业形象影片旁白,普通话女声,约 90 秒,月底前交付…', 'e.g. Corporate film narration, US English female, ~90 seconds, due end of month…')}
              className="w-full resize-none bg-transparent text-[15px] leading-7 text-white outline-none placeholder:text-gray-600" />
            <div className="flex items-center justify-between mt-2">
              <button onClick={() => fileRef.current?.click()} disabled={scriptUploading}
                className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40">
                <Paperclip className="w-3.5 h-3.5" /> {scriptUploading ? tx('上傳中…', '上传中…', 'Uploading…') : tx('上傳稿件(文字檔;影音請貼連結)', '上传稿件(文字档;影音请贴链接)', 'Attach script (docs only — link audio/video)')}
              </button>
              <button onClick={() => send()} disabled={!input.trim()}
                className="inline-flex items-center gap-2 rounded-full bg-white hover:bg-gray-200 text-black text-sm font-semibold px-5 py-2.5 disabled:opacity-30 transition-colors">
                {tx('建立需求單', '建立需求单', 'Build my brief')} <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
            {EXAMPLES.map((s) => (
              <button key={s} onClick={() => send(s)}
                className="rounded-full border border-white/10 px-4 py-2 text-[12.5px] text-gray-400 hover:text-gray-200 hover:border-white/25 transition-colors max-w-full truncate">
                {s}
              </button>
            ))}
          </div>
          <button onClick={onClassic} className="mt-8 inline-flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-300 transition-colors">
            <PencilLine className="w-3.5 h-3.5" /> {tx('改用傳統表單填寫', '改用传统表单填写', 'Prefer the classic form?')}
          </button>
        </div>
      )}

      {/* ── 階段②/③:對話 → 需求單緩慢滑出變兩頁 ── */}
      {started && (
        <div className="flex flex-col lg:flex-row gap-6 items-stretch transition-[padding] duration-[1400ms] ease-[cubic-bezier(.45,.05,.25,1)]"
          style={{ paddingLeft: panelOpen ? '0px' : 'max(0px, calc((100% - 48rem) / 2))', paddingRight: panelOpen ? '0px' : 'max(0px, calc((100% - 48rem) / 2))' }}>
          {/* 對話欄 */}
          <div className="flex-1 min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] flex flex-col h-[72vh] min-h-[460px]">
            <div className="border-b border-white/10 px-5 py-4 flex items-center gap-2.5 shrink-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[11px] font-bold text-black">A</div>
              <div>
                <p className="text-sm font-semibold text-white leading-none">Aria</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{tx('Onyx 發案助理', 'Onyx 发案助理', 'Onyx project assistant')}</p>
              </div>
              <span className="ml-auto text-[10px] tracking-[0.2em] text-gray-600 hidden sm:block">{tx('案件需求單建立', '案件需求单建立', 'PROJECT BRIEF BUILDER')}</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-5">
              {msgs.map((m, i) => (
                m.role === 'user' ? (
                  <div key={i} className="flex justify-end hire-ai-msg">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-white text-black px-4 py-2.5 text-[15px] whitespace-pre-wrap leading-7">{m.content}</div>
                  </div>
                ) : (
                  <div key={i} className="flex items-start gap-2.5 pr-6 hire-ai-msg">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-black">A</div>
                    <div className="text-[15px] text-gray-100 whitespace-pre-wrap leading-7">
                      {i === msgs.length - 1 ? <TypeText text={m.content} /> : m.content}
                    </div>
                  </div>
                )
              ))}
              {serviceRoute && !busy && (
                <div className="ml-9 max-w-sm rounded-xl border border-white/15 bg-black/50 px-4 py-3.5 hire-ai-msg">
                  <p className="text-[12px] text-gray-400 mb-2.5">{tx('這類需求有專屬流程,點下方直接前往:', '这类需求有专属流程,点下方直接前往:', 'This request has its own flow — jump straight in:')}</p>
                  <a href={`/${locale}${serviceRoute.path}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white text-black text-[13px] font-semibold px-4 py-2 hover:bg-gray-200 transition-colors">
                    {isCN ? serviceRoute.label[1] : isZh ? serviceRoute.label[0] : serviceRoute.label[2]} <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
              {busy && (
                <div className="ml-9 max-w-sm rounded-xl border border-white/10 bg-black/50 px-4 py-3 hire-ai-msg">
                  <p className="flex items-center gap-2 text-[12.5px] font-medium text-gray-200">
                    <span className="hire-ai-pulse h-2 w-2 rounded-full bg-white" />
                    {tx('Aria 正在整理您的需求', 'Aria 正在整理您的需求', 'Aria is working on your brief')}
                  </p>
                  <div className="mt-2 space-y-1.5 text-[11.5px] text-gray-500">
                    {[
                      tx('閱讀並理解您的訊息', '阅读并理解您的消息', 'Reading your message'),
                      tx('整理需求重點與結構', '整理需求重点与结构', 'Structuring the brief'),
                      tx('更新需求單欄位', '更新需求单栏位', 'Updating brief fields'),
                    ].map((s, i) => (
                      <p key={s} className="hire-ai-step flex items-center gap-2" style={{ animationDelay: `${0.5 + i * 0.9}s` }}>
                        <span className="h-1 w-1 rounded-full bg-gray-600" />{s}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {err && <p className="text-xs text-red-400 hire-ai-msg">{err}</p>}
              <div ref={endRef} />
            </div>
            <div className="border-t border-white/10 p-4 shrink-0">
              <div className="flex items-end gap-2 rounded-2xl border border-white/15 bg-black/40 px-3 py-2 focus-within:border-white/40 transition-colors">
                <button onClick={() => fileRef.current?.click()} disabled={scriptUploading} title={tx('上傳稿件(文字檔)', '上传稿件(文字档)', 'Attach script (docs)')}
                  className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40">
                  <Paperclip className="w-4 h-4" />
                </button>
                <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder={tx('回覆 Aria…', '回复 Aria…', 'Reply to Aria…')}
                  className="flex-1 resize-none bg-transparent text-sm text-white outline-none placeholder:text-gray-600" />
                <button onClick={() => send()} disabled={busy || !input.trim()}
                  className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black hover:bg-gray-200 disabled:opacity-30 transition-colors">
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-2.5 flex items-center gap-4">
                <button onClick={onClassic} className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300 transition-colors">
                  <PencilLine className="w-3 h-3" /> {tx('改用傳統表單', '改用传统表单', 'Classic form')}
                </button>
                <button onClick={() => { setMsgs([]); setDraftAll(null); setComplete(false); setErr(''); setShowChecklist(false); setFormMode(false); setRecent(new Set()); setRecentOrder([]); }}
                  className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300 transition-colors">
                  <RotateCcw className="w-3 h-3" /> {tx('重新開始', '重新开始', 'Start over')}
                </button>
              </div>
            </div>
          </div>

          {/* 中間進度軌 */}
          {panelOpen && (
            <div className="hidden lg:flex relative z-30 flex-col items-center py-2 hire-ai-panel shrink-0">
              <button onClick={() => setShowChecklist((v) => !v)} className="flex flex-col items-center gap-2 h-full group" title={tx('需求單進度', '需求单进度', 'Brief progress')}>
                <span className="text-[11px] font-semibold text-gray-300 rounded-full bg-black/70 border border-white/15 px-2 py-1 group-hover:border-white/40 transition-colors">{reqDone}/{REQUIRED.length}</span>
                <span className="flex-1 w-1.5 rounded-full bg-white/10 overflow-hidden flex flex-col justify-end">
                  <span className="w-full bg-white rounded-full transition-all duration-700" style={{ height: `${(reqDone / REQUIRED.length) * 100}%` }} />
                </span>
              </button>
              {showChecklist && (
                <div className="absolute top-10 left-1/2 -translate-x-1/2 z-20 w-64 rounded-2xl bg-zinc-950 border border-white/15 p-4 shadow-2xl hire-ai-msg">
                  <p className="text-[13px] font-semibold text-white mb-3">{tx('需求單進度', '需求单进度', 'Brief progress')}</p>
                  <p className="text-[10px] tracking-[0.18em] text-gray-500 mb-1.5">{tx('必備資料', '必备资料', 'REQUIRED')}</p>
                  <div className="space-y-1.5 mb-3">
                    {REQUIRED.map((r) => (
                      <p key={r.label[0]} className="flex items-center gap-2 text-[12px]">
                        {r.done ? <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" /> : <Circle className="w-3.5 h-3.5 text-gray-600 shrink-0" />}
                        <span className={r.done ? 'text-gray-200' : 'text-gray-500'}>{isCN ? r.label[1] : isZh ? r.label[0] : r.label[2]}</span>
                      </p>
                    ))}
                  </div>
                  {isInquiry && <p className="text-[11px] text-gray-500">{tx('服務細節由 Aria 整理進「需求說明」,右側可直接檢查與修改。', '服务细节由 Aria 整理进「需求说明」,右侧可直接检查与修改。', 'Service details are compiled into the brief — review and edit them on the right.')}</p>}
                  {!isInquiry && <><p className="text-[10px] tracking-[0.18em] text-gray-500 mb-1.5">{tx('選填', '选填', 'OPTIONAL')}</p>
                  <div className="space-y-1.5">
                    {OPTIONAL.map((r) => (
                      <p key={r.label[0]} className="flex items-center gap-2 text-[12px]">
                        {r.done ? <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" /> : <Circle className="w-3.5 h-3.5 text-gray-600 shrink-0" />}
                        <span className={r.done ? 'text-gray-200' : 'text-gray-500'}>{isCN ? r.label[1] : isZh ? r.label[0] : r.label[2]}</span>
                      </p>
                    ))}
                  </div></>}
                </div>
              )}
            </div>
          )}

          {/* 需求單:文件檢視(預設,像 Mira 一行行寫出來)⇄ 完整表單編輯 */}
          {panelOpen && (
            <div className="lg:w-[46%] shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] flex flex-col h-[72vh] min-h-[460px] hire-ai-panel">
              <div className="border-b border-white/10 px-6 py-4 flex items-center gap-2 shrink-0">
                {complete
                  ? <span className="inline-flex items-center gap-1.5 text-[11px] tracking-[0.15em] text-gray-200"><CheckCircle2 className="w-3.5 h-3.5" /> {tx('需求單已完成', '需求单已完成', 'BRIEF READY')}</span>
                  : <span className="inline-flex items-center gap-1.5 text-[11px] tracking-[0.15em] text-gray-400"><span className="hire-ai-pulse h-1.5 w-1.5 rounded-full bg-white" /> {tx('草稿', '草稿', 'DRAFT')}</span>}
                <div className="ml-auto flex items-center gap-1.5">
                  <button onClick={() => setFormMode((v) => !v)}
                    className={`inline-flex items-center gap-1.5 h-8 rounded-full border px-3 text-[11px] transition-colors ${formMode ? 'border-white/40 text-white' : 'border-white/15 text-gray-400 hover:text-white hover:border-white/30'}`}>
                    {formMode ? <><FileText className="w-3.5 h-3.5" /> {tx('完成編輯', '完成编辑', 'Done')}</> : <><PencilLine className="w-3.5 h-3.5" /> {tx('編輯', '编辑', 'Edit')}</>}
                  </button>
                  <button onClick={downloadPdf} title={tx('下載 PDF', '下载 PDF', 'Download PDF')}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-gray-400 hover:text-white hover:border-white/30 transition-colors">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-7 py-6">
                {/* ── 文件檢視:只列已填內容,新內容打字機浮現;點任一行進編輯 ── */}
                {!formMode && (
                  <div className="space-y-1">
                    <h2 className="text-3xl font-bold text-white leading-snug mb-2 cursor-text" onClick={() => setFormMode(true)}>
                      {sv('title')
                        ? (recent.has('title') ? <TypeText text={sv('title')} delay={delayFor('title')} /> : sv('title'))
                        : <span className="text-gray-600">{tx('案件標題', '案件标题', 'Project title')}</span>}
                    </h2>
                    {DOC_SECTIONS.map((sec) => {
                      const rows = sec.keys.filter((k) => dispVal(k) !== '');
                      if (!rows.length) return null;
                      return (
                        <div key={sec.t[0]} className="pt-4">
                          <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-400 border-t border-white/10 pt-4 mb-1">{isCN ? sec.t[1] : isZh ? sec.t[0] : sec.t[2]}</p>
                          {rows.map((k) => (
                            <div key={k} onClick={() => setFormMode(true)}
                              style={recent.has(k) ? { animationDelay: `${delayFor(k)}ms` } : undefined}
                              className={`hire-doc-line group flex items-baseline gap-3 py-1.5 rounded-md cursor-text hire-ai-step${flashCls(k)}`}>
                              <span className="w-32 shrink-0 text-[12px] text-gray-400">{fl(k)}</span>
                              <span className="text-[15px] leading-7 text-white whitespace-pre-wrap">
                                {recent.has(k) ? <TypeText text={dispVal(k)} delay={delayFor(k)} /> : dispVal(k)}
                              </span>
                              <PencilLine className="hire-doc-edit w-3 h-3 text-gray-600 opacity-0 transition-opacity shrink-0 self-center" />
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    {!!sv('brief').trim() && (
                      <div className="pt-4">
                        <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-400 border-t border-white/10 pt-4 mb-2">{tx('需求說明', '需求说明', 'BRIEF')}</p>
                        <div onClick={() => setFormMode(true)} className={`hire-doc-line cursor-text rounded-md text-[15px] leading-8 text-gray-50 whitespace-pre-wrap${flashCls('brief')}`}>
                          {recent.has('brief') ? <TypeText text={sv('brief')} delay={delayFor('brief')} /> : sv('brief')}
                        </div>
                      </div>
                    )}
                    {!!sv('script_text').trim() && (
                      <div className="pt-4">
                        <p className="text-[11px] font-semibold tracking-[0.2em] text-gray-400 border-t border-white/10 pt-4 mb-2">{tx('稿件', '稿件', 'SCRIPT')}</p>
                        <div onClick={() => setFormMode(true)} className="cursor-text rounded-md text-[13.5px] leading-7 text-gray-200 whitespace-pre-wrap max-h-40 overflow-y-auto">{sv('script_text')}</div>
                      </div>
                    )}
                    <p className="pt-6 text-[12px] text-gray-500">{tx('點任一行即可修改;缺的資料繼續跟 Aria 說即可。', '点任一行即可修改;缺的资料继续跟 Aria 说即可。', 'Click any line to edit — or just keep telling Aria.')}</p>
                  </div>
                )}

                {/* ── 完整表單編輯(欄位=傳統表單全集) ── */}
                {formMode && (
                  <div className="space-y-4">
                    <div className={flashCls('title')}>
                      <input className="w-full rounded-md border border-transparent hover:border-white/15 focus:border-white/50 px-2 py-1.5 text-2xl font-bold text-white bg-transparent outline-none transition-colors"
                        placeholder={tx('案件標題', '案件标题', 'Project title')} value={sv('title')} onChange={(e) => setF('title', e.target.value)} />
                    </div>
                    <p className={secD}>{tx('基本資訊', '基本信息', 'BASICS')}</p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className={flashCls('content_type')}><label className={lblD}>{fl('content_type')}</label>
                        <select className={inputD} value={sv('content_type')} onChange={(e) => setF('content_type', e.target.value)}>{selOpts(CONTENT_TYPES, sv('content_type'))}</select></div>
                      <div className={flashCls('language')}><label className={lblD}>{fl('language')}</label>
                        <select className={inputD} value={sv('language')} onChange={(e) => setF('language', e.target.value)}>
                          <option value="" className={optionCls}>—</option>{LANGUAGES.map((l) => <option key={l.v} value={l.v} className={optionCls}>{isCN ? l.cn : isZh ? l.tw : l.v}</option>)}
                        </select></div>
                      <div className={flashCls('accent')}><label className={lblD}>{fl('accent')}</label><input className={inputD} value={sv('accent')} onChange={(e) => setF('accent', e.target.value)} /></div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className={flashCls('male_voices')}><label className={lblD}>{fl('male_voices')}</label><input type="number" min={0} className={inputD} value={Number(draft?.male_voices ?? 0)} onChange={(e) => setF('male_voices', Number(e.target.value) || 0)} /></div>
                        <div className={flashCls('female_voices')}><label className={lblD}>{fl('female_voices')}</label><input type="number" min={0} className={inputD} value={Number(draft?.female_voices ?? 0)} onChange={(e) => setF('female_voices', Number(e.target.value) || 0)} /></div>
                      </div>
                      <div className={flashCls('length')}><label className={lblD}>{fl('length')}</label><input className={inputD} value={sv('length')} onChange={(e) => setF('length', e.target.value)} placeholder={tx('60 秒 / 800 字…', '60 秒 / 800 字…', '60s / 800 words…')} /></div>
                      <div className={flashCls('voice_style')}><label className={lblD}>{fl('voice_style')}</label><input className={inputD} value={sv('voice_style')} onChange={(e) => setF('voice_style', e.target.value)} /></div>
                      <div className={flashCls('voice_age')}><label className={lblD}>{fl('voice_age')}</label><input className={inputD} value={sv('voice_age')} onChange={(e) => setF('voice_age', e.target.value)} placeholder={tx('如:30-40 歲感', '如:30-40 岁感', 'e.g. sounds 30-40')} /></div>
                    </div>
                    <p className={secD}>{tx('播放與授權', '播放与授权', 'USAGE & LICENSE')}</p>
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className={flashCls('media_scope')}><label className={lblD}>{fl('media_scope')}</label>
                        <select className={inputD} value={sv('media_scope')} onChange={(e) => setF('media_scope', e.target.value)}>{selOpts(MEDIA, sv('media_scope'))}</select></div>
                      <div className={flashCls('territory')}><label className={lblD}>{fl('territory')}</label>
                        <select className={inputD} value={sv('territory')} onChange={(e) => setF('territory', e.target.value)}>{selOpts(TERRITORY, sv('territory'))}</select></div>
                      <div className={flashCls('license_term')}><label className={lblD}>{fl('license_term')}</label>
                        <select className={inputD} value={sv('license_term')} onChange={(e) => setF('license_term', e.target.value)}>{selOpts(LICENSE, sv('license_term'))}</select></div>
                    </div>
                    <p className={secD}>{tx('預算與時程', '预算与时程', 'BUDGET & TIMELINE')}</p>
                    <div className="grid grid-cols-4 gap-2.5">
                      <div className={flashCls('budget_currency')}><label className={lblD}>{fl('budget_currency')}</label>
                        <select className={inputD} value={sv('budget_currency') || 'USD'} onChange={(e) => setF('budget_currency', e.target.value)}>
                          {['USD', 'TWD', 'HKD', 'CNY'].map((c) => <option key={c} className={optionCls}>{c}</option>)}
                        </select></div>
                      <div className={flashCls('budget_type')}><label className={lblD}>{fl('budget_type')}</label>
                        <select className={inputD} value={sv('budget_type') || 'Up to'} onChange={(e) => setF('budget_type', e.target.value)}>
                          <option value="Up to" className={optionCls}>{tx('預算上限', '预算上限', 'Up to')}</option>
                          <option value="Fixed" className={optionCls}>{tx('固定預算', '固定预算', 'Fixed')}</option>
                        </select></div>
                      <div className={flashCls('budget')}><label className={lblD}>{fl('budget')}{tx('(空=請報價)', '(空=请报价)', ' (blank = quote)')}</label><input className={inputD} value={sv('budget')} onChange={(e) => setF('budget', e.target.value)} /></div>
                      <div className={flashCls('budget_unit')}><label className={lblD}>{fl('budget_unit')}</label>
                        <select className={inputD} value={sv('budget_unit') || '整案'} onChange={(e) => setF('budget_unit', e.target.value)}>
                          {['整案', '句', '字', '分鐘', '小時'].map((u) => <option key={u} className={optionCls}>{u}</option>)}
                        </select></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className={flashCls('audition_deadline')}><label className={lblD}>{fl('audition_deadline')}</label><input type="date" className={inputD} value={sv('audition_deadline')} onChange={(e) => setF('audition_deadline', e.target.value)} /></div>
                      <div className={flashCls('recording_start')}><label className={lblD}>{fl('recording_start')}</label><input type="date" className={inputD} value={sv('recording_start')} onChange={(e) => setF('recording_start', e.target.value)} /></div>
                      <div className={flashCls('deadline')}><label className={lblD}>{fl('deadline')}</label><input type="date" className={inputD} value={sv('deadline')} onChange={(e) => setF('deadline', e.target.value)} /></div>
                    </div>
                    <p className={secD}>{tx('錄製需求', '录制需求', 'SESSION')}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-300 items-center">
                      {([['has_singing', fl('has_singing')], ['wants_director', fl('wants_director')], ['wants_live_session', fl('wants_live_session')]] as const).map(([k, label]) => (
                        <label key={k} className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" className="accent-white" checked={!!draft?.[k]} onChange={(e) => setF(k, e.target.checked)} />{label}
                        </label>
                      ))}
                      <div className={`flex items-center gap-1.5${flashCls('local_studio_region')}`}>
                        <span className="text-gray-500">{fl('local_studio_region')}:</span>
                        <input className="rounded-md border border-transparent hover:border-white/15 focus:border-white/50 px-2 py-1 text-xs bg-transparent text-white outline-none transition-colors w-28" placeholder={tx('不需要留空', '不需要留空', 'Optional')} value={sv('local_studio_region')} onChange={(e) => setF('local_studio_region', e.target.value)} />
                      </div>
                    </div>
                    <p className={secD}>{tx('需求說明', '需求说明', 'BRIEF')}</p>
                    <div className={flashCls('brief')}>
                      <textarea rows={6} className="w-full rounded-xl border border-transparent hover:border-white/15 focus:border-white/50 bg-white/5 focus:bg-white/[0.08] px-3.5 py-3 text-[13.5px] leading-6 text-gray-100 outline-none transition-colors resize-y" value={sv('brief')} onChange={(e) => setF('brief', e.target.value)} /></div>
                    <div className="grid grid-cols-[110px_1fr] gap-2.5 items-start">
                      <div className={flashCls('script_type')}><label className={lblD}>{fl('script_type')}</label>
                        <select className={inputD} value={sv('script_type')} onChange={(e) => setF('script_type', e.target.value)}>
                          <option value="" className={optionCls}>—</option>
                          <option value="audition" className={optionCls}>{tx('試音稿', '试音稿', 'Audition')}</option>
                          <option value="final" className={optionCls}>{tx('正式稿', '正式稿', 'Final')}</option>
                        </select></div>
                      <div className={flashCls('script_text')}><label className={lblD}>{fl('script_text')}{tx('(選填)', '(选填)', ' (optional)')}</label>
                        <textarea rows={3} className="w-full rounded-xl border border-transparent hover:border-white/15 focus:border-white/50 bg-white/5 focus:bg-white/[0.08] px-3.5 py-3 text-[13.5px] leading-6 text-gray-100 outline-none transition-colors resize-y" value={sv('script_text')} onChange={(e) => setF('script_text', e.target.value)} /></div>
                    </div>
                    <div className="grid grid-cols-[1fr_auto] gap-2.5 items-end">
                      <div className={flashCls('script_link')}><label className={lblD}>{fl('script_link')}{tx('(雲端連結)', '(云端链接)', ' (cloud link)')}</label>
                        <input className={inputD} placeholder="https://drive.google.com/…" value={sv('script_link')} onChange={(e) => setF('script_link', e.target.value)} /></div>
                      <button onClick={() => fileRef.current?.click()} disabled={scriptUploading}
                        className="inline-flex items-center gap-1.5 h-9 rounded-full border border-white/15 px-3.5 text-[11px] text-gray-400 hover:text-white hover:border-white/30 transition-colors disabled:opacity-40">
                        <Paperclip className="w-3.5 h-3.5" /> {scriptUploading ? tx('上傳中…', '上传中…', 'Uploading…') : (sv('script_file_name') || tx('上傳稿件檔', '上传稿件档', 'Upload file'))}
                      </button>
                    </div>
                    <div className={flashCls('reference_links')}><label className={lblD}>{fl('reference_links')}{tx('(一行一條;YouTube/樣音/影片)', '(一行一条;YouTube/样音/视频)', ' (one per line — YouTube / samples)')}</label>
                      <textarea rows={2} className="w-full rounded-xl border border-transparent hover:border-white/15 focus:border-white/50 bg-white/5 focus:bg-white/[0.08] px-3.5 py-2.5 text-[12.5px] leading-6 text-gray-100 outline-none transition-colors resize-y" placeholder="https://…" value={refLinks.join('\n')} onChange={(e) => setF('reference_links', e.target.value.split('\n'))} /></div>
                    <p className={secD}>{tx('聯絡方式', '联系方式', 'CONTACT')}</p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className={flashCls('name')}><label className={lblD}>{fl('name')}</label><input className={inputD} value={sv('name')} onChange={(e) => setF('name', e.target.value)} /></div>
                      <div className={flashCls('email')}><label className={lblD}>{fl('email')} *</label><input type="email" className={inputD} value={sv('email')} onChange={(e) => setF('email', e.target.value)} /></div>
                      <div className={flashCls('company')}><label className={lblD}>{fl('company')}</label><input className={inputD} value={sv('company')} onChange={(e) => setF('company', e.target.value)} /></div>
                      <div className={flashCls('website')}><label className={lblD}>{fl('website')}{tx('(填了自動帶入公司資料)', '(填了自动带入公司资料)', ' (auto-fills company info)')}</label><input className={inputD} placeholder="https://…" value={sv('website')} onChange={(e) => setF('website', e.target.value)} /></div>
                    </div>
                    {!!sv('company_note').trim() && (
                      <div className={flashCls('company_note')}><label className={lblD}>{fl('company_note')}{tx('(自官網擷取,可改)', '(自官网撷取,可改)', ' (fetched from site — editable)')}</label>
                        <textarea rows={2} className="w-full rounded-xl border border-transparent hover:border-white/15 focus:border-white/50 bg-white/5 focus:bg-white/[0.08] px-3.5 py-2.5 text-[12.5px] leading-6 text-gray-300 outline-none transition-colors resize-y" value={sv('company_note')} onChange={(e) => setF('company_note', e.target.value)} /></div>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 px-6 py-4 flex items-center gap-2 shrink-0">
                <button onClick={submit} disabled={submitting}
                  className="inline-flex items-center gap-1.5 text-sm bg-white hover:bg-gray-200 text-black font-semibold rounded-full px-5 py-2.5 disabled:opacity-30 transition-colors">
                  {submitting ? tx('送出中…', '送出中…', 'Submitting…') : tx('確認送出需求', '确认送出需求', 'Submit brief')} <ArrowRight className="w-4 h-4" />
                </button>
                <p className="text-[11px] text-gray-600 ml-auto hidden sm:block">{tx('送出後由 Onyx 審核並為您配對配音員', '送出后由 Onyx 审核并为您配对配音员', 'Onyx reviews and matches voices after submission')}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

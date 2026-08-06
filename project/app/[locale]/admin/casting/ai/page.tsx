'use client';

/*
  後台「AI 發案」v2 —— Fiverr(Mira)式雙欄:左邊對話、右邊「即時草稿表單」。
  AI 每輪都回傳目前已知的草稿(漸進式),右側欄位邊聊邊填;Wing 也可直接改右側,
  下一輪對話會把手動修改帶給 AI(不會被退回)。完成後「帶入發案表單」→
  /admin/casting/new 按「恢復草稿」全帶入,照常檢查發佈。(Wing 2026-08-05 v2)
*/

import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, ArrowRight, RotateCcw, CheckCircle2, ClipboardList } from 'lucide-react';
import { LANGUAGES } from '@/lib/languages';

type Msg = { role: 'user' | 'assistant'; content: string };
type Draft = Record<string, unknown>;

const ROLES_CATS = ['遊戲 Video Game', '動畫 Animation', '戲劇·角色 Drama', '角色配唱 Character Singing'];
const CATEGORIES = ['廣告 Commercial', '旁白 Narration', '有聲書 Audiobook', '工商簡介 Corporate', '教育教學 E-Learning', '紀錄片 Documentary', '電視 TV', '廣播電台 Radio', '電影預告 Trailer', '網路影片 Web Video', 'Podcast', '來電語音 IVR', '語音助理 Voice Assistant', '新聞播報 News', '流行歌配唱 Pop Singing', '遊戲 Video Game', '動畫 Animation', '戲劇·角色 Drama', '角色配唱 Character Singing', 'TTS / AI 語音'];

// AI 草稿 → 發案表單 useFormDraft 快照(鍵名/預設值與 casting/new 的 snapshot 一致)
function draftToSnapshot(d: Draft) {
  const s = (k: string) => String(d[k] ?? '');
  const n = (k: string) => String(Number(d[k] ?? 0) || 0);
  return {
    title: s('title'), category: s('category') || '廣告 Commercial',
    mode: ROLES_CATS.includes(s('category')) ? 'roles' : 'general',
    language: s('language') || 'Mandarin · Taiwan',
    maleVoices: n('male_voices'), femaleVoices: n('female_voices'),
    hasSinging: !!d.has_singing, wantsDirector: !!d.wants_director,
    brief: s('brief'),
    rateCur: s('rate_currency') || 'TWD', rateMode: s('rate_mode') || 'fixed',
    rateAmt: s('rate_amount'), rateAmt2: s('rate_amount2'), rateUnit: s('rate_unit') || '整案',
    scale: s('scale'), deadline: s('delivery_deadline'), mediaScope: s('media_scope'),
    territory: s('territory'), licenseTerm: s('license_term'), accent: s('accent'),
    voiceStyle: s('voice_style'), voiceAge: s('voice_age'),
    baseRev: s('base_revisions') || '1', cap: s('revision_cap') || '5',
    auditionDeadline: s('audition_deadline'), recordingStart: '',
    methods: (d.methods && typeof d.methods === 'object') ? d.methods : { home: false, studio: false, online: false },
    rolesText: '', parsedRoles: [], auditionScript: s('audition_script'),
    refLinks: [''], refFiles: [], aiType: s('ai_type'),
    clientNote: s('client_note'), licenseSummary: '',
    deadlineTime: s('delivery_deadline_time'), auditionDeadlineTime: s('audition_deadline_time'),
    caseTz: s('timezone') || 'Asia/Taipei',
  };
}

const FIELD_LABELS: Record<string, string> = {
  title: '標題', category: '類別', language: '語言', accent: '口音', male_voices: '男聲人數', female_voices: '女聲人數',
  brief: '案件說明', audition_script: '試音稿', rate_mode: '報酬型態', rate_currency: '幣別', rate_amount: '金額',
  rate_amount2: '金額上限', rate_unit: '計價單位', scale: '份量', audition_deadline: '試音截止', audition_deadline_time: '試音截止時間',
  delivery_deadline: '交付截止', timezone: '時區', media_scope: '使用範圍', territory: '授權地區', license_term: '授權期間',
  voice_style: '聲音風格', voice_age: '聲齡', methods: '錄音方式', ai_type: 'AI 型態', client_note: '客戶備註', summary: '摘要',
};

export default function AiCastingPage() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [complete, setComplete] = useState(false);
  const [err, setErr] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!busy) { setElapsed(0); return; }
    const t = setInterval(() => setElapsed((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);
  const STEPS = ['已讀你的需求', '比對平台欄位與語言標準', '更新右側草稿', '整理下一個問題'];
  const stepIdx = Math.min(Math.floor(elapsed / 7), STEPS.length - 1);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);

  // 手動改右側欄位 → 更新草稿;下一輪對話會把現值帶給 AI。
  const setF = (k: string, v: unknown) => setDraft((d) => ({ ...(d || {}), [k]: v }));
  const sv = (k: string) => String((draft?.[k] as string | number | undefined) ?? '');

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setMsgs((m) => [...m, { role: 'user', content }]); setInput(''); setBusy(true); setErr('');
    // API 訊息 = 顯示訊息 + 尾端附上右側草稿現值(含手動修改),讓 AI 以現值為基底更新。
    const apiMsgs: Msg[] = [...msgs, { role: 'user', content: draft ? `${content}\n\n[目前草稿狀態:${JSON.stringify(draft)}]` : content }];
    try {
      const res = await fetch('/api/admin/casting/ai-draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ messages: apiMsgs }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'AI 回覆失敗');
      let changed: string[] = [];
      if (j.draft && typeof j.draft === 'object') {
        // 防退化:AI 回空值、但先前(含手動)有值 → 保留舊值;同時記錄這輪真的變了哪些欄位。
        setDraft((prev) => {
          const merged: Draft = { ...(j.draft as Draft) };
          for (const [k, v] of Object.entries(prev || {})) {
            const nv = merged[k];
            if ((nv === '' || nv === null || nv === undefined) && v !== '' && v !== null && v !== undefined) merged[k] = v;
          }
          changed = Object.keys(merged).filter((k) => k in FIELD_LABELS && JSON.stringify(merged[k]) !== JSON.stringify((prev || {})[k]) && merged[k] !== '' && merged[k] !== 0);
          return merged;
        });
      }
      setComplete(!!j.complete);
      const q = String(j.question || '').trim();
      const note = changed.length ? `✓ 已更新:${changed.map((k) => FIELD_LABELS[k]).join('、')}` : '';
      const bodyText = q || '資訊齊了,右側草稿已完成 —— 檢查一下,沒問題就按「帶入發案表單」。要調整直接改右側或跟我說。';
      setMsgs((m) => [...m, { role: 'assistant', content: note ? `${bodyText}\n\n${note}` : bodyText }]);
    } catch (e) { setErr(e instanceof Error ? e.message : '失敗'); }
    finally { setBusy(false); }
  }

  function applyDraft() {
    if (!draft) return;
    try {
      localStorage.setItem('onyx-draft:casting-new', JSON.stringify({ savedAt: Date.now(), data: draftToSnapshot(draft) }));
      window.location.href = '/admin/casting/new?ai=1';   // ai=1 → 表單自動恢復草稿,不用再按
    } catch { setErr('寫入草稿失敗'); }
  }

  const inputCls = 'w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-gray-900 bg-white transition-colors';
  const lbl = 'block text-[10px] font-medium tracking-[0.06em] text-gray-400 mb-1';
  const methods = (draft?.methods && typeof draft.methods === 'object' ? draft.methods : { home: false, studio: false, online: false }) as Record<string, boolean>;

  return (
    <div className="p-4 lg:p-8 max-w-[1200px]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Sparkles className="w-6 h-6 text-violet-600" /> AI 發案</h1>
        <p className="text-sm text-gray-500 mt-1">左邊聊,右邊草稿即時生成 —— 右側欄位也可以直接改,改完繼續聊 AI 會接著你的版本調。</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* 左:對話 */}
        <div className="rounded-2xl border border-gray-100 shadow-sm bg-white flex flex-col h-[74vh]">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
            {msgs.length === 0 && (
              <div className="text-sm text-gray-500 space-y-2">
                <p>描述你的案子,例如:</p>
                <button onClick={() => send('我要發一個台灣國語女聲的電話語音案,大概 800 字,預算 NT$3,000 整案,下週五截止試音,居家錄音就可以。')}
                  className="block text-left w-full rounded-xl border border-gray-200 px-3.5 py-2.5 hover:bg-gray-50 hover:border-gray-300 text-gray-600 text-xs leading-relaxed">
                  「台灣國語女聲電話語音,800 字,NT$3,000 整案,下週五截止試音,居家錄音。」
                </button>
                <button onClick={() => send('客戶要做四川話的 TTS 對話語料 5 小時,跟之前上海話那批一樣的規格,讓配音員自己報價,九月底截止。')}
                  className="block text-left w-full rounded-xl border border-gray-200 px-3.5 py-2.5 hover:bg-gray-50 hover:border-gray-300 text-gray-600 text-xs leading-relaxed">
                  「四川話 TTS 對話語料 5 小時,規格同上海話那批,自報價,九月底截止。」
                </button>
              </div>
            )}
            {msgs.map((m, i) => (
              m.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gray-900 text-white px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed">{m.content}</div>
                </div>
              ) : (
                <div key={i} className="flex items-start gap-2.5 pr-6">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">AI</div>
                  <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{m.content}</div>
                </div>
              )
            ))}
            {busy && (
              <div className="ml-8 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 space-y-1.5">
                {STEPS.map((st, i) => (
                  <div key={st} className={`flex items-center gap-2 text-xs ${i < stepIdx ? 'text-gray-400' : i === stepIdx ? 'text-violet-700 font-medium' : 'text-gray-300'}`}>
                    {i < stepIdx ? <span>✓</span> : i === stepIdx ? <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" /> : <span className="inline-block h-3 w-3 rounded-full border border-gray-300" />}
                    <span>{st}</span>
                  </div>
                ))}
                <p className="text-[11px] text-gray-400 pt-1">思考中… {elapsed}s(通常 20-40 秒)</p>
              </div>
            )}
            {err && <p className="text-xs text-red-600">{err}</p>}
            <div ref={endRef} />
          </div>
          <div className="border-t border-gray-100 p-3 shrink-0">
            <div className="flex items-end gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-sm focus-within:border-gray-400">
              <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="描述你的案子…(Enter 送出,Shift+Enter 換行)"
                className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-gray-400" />
              <button onClick={() => send()} disabled={busy || !input.trim()}
                className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-30">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 右:即時草稿 */}
        <div className="rounded-2xl border border-gray-100 shadow-sm bg-white flex flex-col h-[74vh]">
          <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
            <p className="text-sm font-semibold text-gray-900 inline-flex items-center gap-1.5"><ClipboardList className="w-4 h-4 text-gray-500" /> 案件草稿(即時)</p>
            {draft ? (complete
              ? <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200"><CheckCircle2 className="w-3 h-3" /> 資訊已齊</span>
              : <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">收集中…</span>)
              : <span className="text-[11px] text-gray-400">開始對話後這裡會即時出現</span>}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {!draft && <p className="text-sm text-gray-400 pt-8 text-center">草稿會隨對話即時填入,也可以直接在這裡修改。</p>}
            {draft && (
              <div className="space-y-3">
                <div><label className={lbl}>標題</label><input className={inputCls} value={sv('title')} onChange={(e) => setF('title', e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={lbl}>類別</label>
                    <select className={inputCls} value={sv('category')} onChange={(e) => setF('category', e.target.value)}>
                      <option value="">—</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select></div>
                  <div><label className={lbl}>語言</label>
                    <select className={inputCls} value={sv('language')} onChange={(e) => setF('language', e.target.value)}>
                      <option value="">—</option>{LANGUAGES.map((l) => <option key={l.v} value={l.v}>{l.tw}</option>)}
                    </select></div>
                  <div><label className={lbl}>口音</label><input className={inputCls} value={sv('accent')} onChange={(e) => setF('accent', e.target.value)} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={lbl}>男聲</label><input type="number" min={0} className={inputCls} value={Number(draft.male_voices ?? 0)} onChange={(e) => setF('male_voices', Number(e.target.value) || 0)} /></div>
                    <div><label className={lbl}>女聲</label><input type="number" min={0} className={inputCls} value={Number(draft.female_voices ?? 0)} onChange={(e) => setF('female_voices', Number(e.target.value) || 0)} /></div>
                  </div>
                  <div><label className={lbl}>份量</label><input className={inputCls} value={sv('scale')} onChange={(e) => setF('scale', e.target.value)} placeholder="180 句 / 5 完成小時" /></div>
                  <div><label className={lbl}>AI 型態</label>
                    <select className={inputCls} value={sv('ai_type')} onChange={(e) => setF('ai_type', e.target.value)}>
                      <option value="">一般真人案</option><option value="clone">AI 聲音(clone)</option><option value="training">訓練資料</option>
                    </select></div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div><label className={lbl}>幣別</label>
                    <select className={inputCls} value={sv('rate_currency')} onChange={(e) => setF('rate_currency', e.target.value)}>
                      {['TWD', 'USD', 'HKD', 'CNY', 'EUR', 'GBP', 'JPY'].map((c) => <option key={c}>{c}</option>)}
                    </select></div>
                  <div><label className={lbl}>型態</label>
                    <select className={inputCls} value={sv('rate_mode') || 'fixed'} onChange={(e) => setF('rate_mode', e.target.value)}>
                      <option value="fixed">固定</option><option value="range">區間</option><option value="upto">最高</option><option value="plus">起價</option>
                    </select></div>
                  <div><label className={lbl}>金額(空=自報價)</label><input className={inputCls} value={sv('rate_amount')} onChange={(e) => setF('rate_amount', e.target.value)} /></div>
                  <div><label className={lbl}>單位</label>
                    <select className={inputCls} value={sv('rate_unit') || '整案'} onChange={(e) => setF('rate_unit', e.target.value)}>
                      {['整案', '句', '字', '分鐘', '小時'].map((u) => <option key={u}>{u}</option>)}
                    </select></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className={lbl}>試音截止</label><input type="date" className={inputCls} value={sv('audition_deadline')} onChange={(e) => setF('audition_deadline', e.target.value)} /></div>
                  <div><label className={lbl}>時間</label><input type="time" className={inputCls} value={sv('audition_deadline_time')} onChange={(e) => setF('audition_deadline_time', e.target.value)} /></div>
                  <div><label className={lbl}>時區</label>
                    <select className={inputCls} value={sv('timezone') || 'Asia/Taipei'} onChange={(e) => setF('timezone', e.target.value)}>
                      {['Asia/Taipei', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Tokyo', 'Europe/London', 'America/New_York', 'America/Los_Angeles'].map((t) => <option key={t}>{t}</option>)}
                    </select></div>
                </div>
                <div>
                  <label className={lbl}>錄音方式</label>
                  <div className="flex gap-3 text-xs text-gray-700">
                    {([['home', '居家'], ['studio', '錄音室'], ['online', '線上監錄']] as const).map(([k, label]) => (
                      <label key={k} className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" className="accent-violet-600" checked={!!methods[k]} onChange={(e) => setF('methods', { ...methods, [k]: e.target.checked })} />{label}
                      </label>
                    ))}
                  </div>
                </div>
                <div><label className={lbl}>案件說明(對配音員展示)</label>
                  <textarea rows={8} className={`${inputCls} resize-y`} value={sv('brief')} onChange={(e) => setF('brief', e.target.value)} /></div>
                <div><label className={lbl}>試音稿(選填;空 = 用 demo 應徵)</label>
                  <textarea rows={3} className={`${inputCls} resize-y`} value={sv('audition_script')} onChange={(e) => setF('audition_script', e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={lbl}>聲音風格</label><input className={inputCls} value={sv('voice_style')} onChange={(e) => setF('voice_style', e.target.value)} /></div>
                  <div><label className={lbl}>內部客戶備註</label><input className={inputCls} value={sv('client_note')} onChange={(e) => setF('client_note', e.target.value)} /></div>
                </div>

                {/* 其他條件(交付/授權/修改)—— 與發案表單一一對應,帶入後不再有沒看過的欄位 */}
                <p className="pt-1 text-[10px] font-semibold tracking-[0.08em] text-gray-400 border-t border-gray-100">其他條件</p>
                {sv('rate_mode') === 'range' && (
                  <div><label className={lbl}>金額上限(區間)</label><input className={inputCls} value={sv('rate_amount2')} onChange={(e) => setF('rate_amount2', e.target.value)} /></div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <div><label className={lbl}>交付截止(選填)</label><input type="date" className={inputCls} value={sv('delivery_deadline')} onChange={(e) => setF('delivery_deadline', e.target.value)} /></div>
                  <div><label className={lbl}>時間</label><input type="time" className={inputCls} value={sv('delivery_deadline_time')} onChange={(e) => setF('delivery_deadline_time', e.target.value)} /></div>
                  <div><label className={lbl}>聲齡</label><input className={inputCls} value={sv('voice_age')} onChange={(e) => setF('voice_age', e.target.value)} placeholder="青年 / 熟齡…" /></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className={lbl}>使用範圍</label><input className={inputCls} value={sv('media_scope')} onChange={(e) => setF('media_scope', e.target.value)} placeholder="網路廣告 / 全媒體…" /></div>
                  <div><label className={lbl}>授權地區</label><input className={inputCls} value={sv('territory')} onChange={(e) => setF('territory', e.target.value)} placeholder="全球 / 台灣…" /></div>
                  <div><label className={lbl}>授權期間</label><input className={inputCls} value={sv('license_term')} onChange={(e) => setF('license_term', e.target.value)} placeholder="1 年 / 永久…" /></div>
                </div>
                <div className="grid grid-cols-4 gap-2 items-end">
                  <div><label className={lbl}>含修改次數</label><input type="number" min={0} className={inputCls} value={sv('base_revisions') || '1'} onChange={(e) => setF('base_revisions', e.target.value)} /></div>
                  <div><label className={lbl}>修改上限</label><input type="number" min={0} className={inputCls} value={sv('revision_cap') || '5'} onChange={(e) => setF('revision_cap', e.target.value)} /></div>
                  <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer pb-1.5"><input type="checkbox" className="accent-violet-600" checked={!!draft.has_singing} onChange={(e) => setF('has_singing', e.target.checked)} />需要唱歌</label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer pb-1.5"><input type="checkbox" className="accent-violet-600" checked={!!draft.wants_director} onChange={(e) => setF('wants_director', e.target.checked)} />線上監錄導演</label>
                </div>
                <details className="text-[11px] text-gray-400"><summary className="cursor-pointer">原始草稿 JSON(除錯用)</summary><pre className="whitespace-pre-wrap break-all mt-1">{JSON.stringify(draft, null, 1)}</pre></details>
              </div>
            )}
          </div>
          <div className="border-t border-gray-200 p-3 flex items-center gap-2 shrink-0">
            <button onClick={applyDraft} disabled={!draft || !sv('title')}
              className="inline-flex items-center gap-1.5 text-sm bg-gray-900 hover:bg-gray-700 text-white font-semibold rounded-full px-5 py-2.5 disabled:opacity-30 transition-colors">
              帶入發案表單發佈 <ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={() => { setMsgs([]); setDraft(null); setComplete(false); }} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 px-2">
              <RotateCcw className="w-3.5 h-3.5" /> 重來
            </button>
            <p className="text-[11px] text-gray-400 ml-auto">到發案表單點「恢復草稿」即帶入,角色列表/檔案在那邊補</p>
          </div>
        </div>
      </div>
    </div>
  );
}

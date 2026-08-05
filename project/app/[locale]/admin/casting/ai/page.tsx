'use client';

/*
  後台「AI 發案」(Wing 專用,Fiverr 式)—— 用講的/貼需求,AI 追問缺的欄位,
  齊了產出草稿 → 寫入發案表單的草稿槽(onyx-draft:casting-new)→ 前往
  /admin/casting/new 按「恢復草稿」全帶入,照常檢查後發佈。發案管線零改動。
*/

import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, ArrowRight, RotateCcw } from 'lucide-react';

type Msg = { role: 'user' | 'assistant'; content: string };
type Draft = Record<string, unknown> & { summary?: string; title?: string };

const ROLES_CATS = ['遊戲 Video Game', '動畫 Animation', '戲劇·角色 Drama', '角色配唱 Character Singing'];

// AI 草稿 → 發案表單 useFormDraft 快照(鍵名/預設值須與 casting/new 的 snapshot 一致)
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

export default function AiCastingPage() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  // Fiverr 式等待進度:純前端輪播(思考型模型 20-40s,給使用者「它在做事」的感覺)
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!busy) { setElapsed(0); return; }
    const t = setInterval(() => setElapsed((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);
  const STEPS = ['已讀你的需求', '比對平台欄位與語言標準', '檢查還缺哪些關鍵資訊', '整理回覆與文案'];
  const stepIdx = Math.min(Math.floor(elapsed / 7), STEPS.length - 1);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, draft, busy]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', content }];
    setMsgs(next); setInput(''); setBusy(true); setErr('');
    try {
      const res = await fetch('/api/admin/casting/ai-draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ messages: next }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'AI 回覆失敗');
      if (j.draft) {
        setDraft(j.draft as Draft);
        // 草稿轉述成 AI 的話留在對話裡 —— Wing 繼續打字就能請 AI 修改再出一版。
        setMsgs((m) => [...m, { role: 'assistant', content: `我已產出發案草稿(摘要:${(j.draft as Draft).summary || (j.draft as Draft).title})。要調整直接跟我說;沒問題就按下方「寫入發案表單」。\n\n草稿內容:${JSON.stringify(j.draft)}` }]);
      } else {
        setMsgs((m) => [...m, { role: 'assistant', content: String(j.reply || '') }]);
      }
    } catch (e) { setErr(e instanceof Error ? e.message : '失敗'); setMsgs(msgs); }
    finally { setBusy(false); }
  }

  function applyDraft() {
    if (!draft) return;
    try {
      localStorage.setItem('onyx-draft:casting-new', JSON.stringify({ savedAt: Date.now(), data: draftToSnapshot(draft) }));
      window.location.href = '/admin/casting/new';
    } catch { setErr('寫入草稿失敗'); }
  }

  return (
    <div className="p-6 lg:p-10 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Sparkles className="w-6 h-6 text-violet-600" /> AI 發案</h1>
        <p className="text-sm text-gray-500 mt-1">用講的就好 —— 把需求丟給 AI,它問齊缺的資訊後產出草稿,帶入發案表單,你檢查後照常發佈。</p>
      </div>

      {/* 對話區 */}
      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="h-[58vh] min-h-[320px] overflow-y-auto p-4 space-y-3">
          {msgs.length === 0 && (
            <div className="text-sm text-gray-500 space-y-2">
              <p>例如直接貼:</p>
              <button onClick={() => send('我要發一個台灣國語女聲的電話語音案,大概 800 字,預算 NT$3,000 整案,下週五截止試音,居家錄音就可以。')}
                className="block text-left w-full rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50 text-gray-600 text-xs">
                「我要發一個台灣國語女聲的電話語音案,大概 800 字,預算 NT$3,000 整案,下週五截止試音,居家錄音就可以。」
              </button>
              <button onClick={() => send('客戶要做四川話的 TTS 對話語料 5 小時,跟之前上海話那批一樣的規格,讓配音員自己報價,九月底截止。')}
                className="block text-left w-full rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50 text-gray-600 text-xs">
                「客戶要做四川話的 TTS 對話語料 5 小時,跟之前上海話那批一樣的規格,讓配音員自己報價,九月底截止。」
              </button>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                {/* 草稿 JSON 不整段展示,截到「草稿內容:」前 */}
                {m.content.split('\n\n草稿內容:')[0]}
              </div>
            </div>
          ))}
          {busy && (
            <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3 space-y-1.5">
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

        {/* 草稿卡 */}
        {draft && (
          <div className="border-t border-gray-200 bg-violet-50/60 p-4">
            <p className="text-sm font-semibold text-gray-900">📋 {String(draft.title || '')}</p>
            <p className="text-xs text-gray-600 mt-1">{String(draft.summary || '')}</p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-gray-600">
              {['category', 'language', 'accent', 'scale', 'audition_deadline'].map((k) => draft[k] ? <span key={k} className="px-2 py-0.5 rounded-full bg-white border border-gray-200">{String(draft[k])}</span> : null)}
              {draft.rate_amount ? <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200">{String(draft.rate_currency)} {String(draft.rate_amount)}{draft.rate_amount2 ? `–${draft.rate_amount2}` : ''} / {String(draft.rate_unit)}</span> : <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200">自報價</span>}
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={applyDraft} className="inline-flex items-center gap-1.5 text-sm bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg px-4 py-2">
                寫入發案表單 <ArrowRight className="w-4 h-4" />
              </button>
              <button onClick={() => { setMsgs([]); setDraft(null); }} className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 px-2">
                <RotateCcw className="w-3.5 h-3.5" /> 重來
              </button>
            </div>
            <p className="text-[11px] text-gray-500 mt-2">按下後到發案表單點「恢復草稿」即可全部帶入;要改哪裡也可以直接在上面跟 AI 說。</p>
          </div>
        )}

        {/* 輸入列 */}
        <div className="border-t border-gray-200 p-3 flex gap-2">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={3}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="描述你的案子…(Enter 送出,Shift+Enter 換行)"
            className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-violet-500" />
          <button onClick={() => send()} disabled={busy || !input.trim()}
            className="self-end inline-flex items-center gap-1.5 text-sm bg-gray-900 hover:bg-gray-700 text-white rounded-lg px-4 py-2 disabled:opacity-40">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

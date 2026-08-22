'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquare, X, ChevronLeft, Send, Check } from 'lucide-react';
import { getClientFaqs, getTalentFaqs, type FaqItem } from '@/lib/faq-data';

/*
  右下角客服泡泡(Phase 2,Wing 2026-08-06)——「Aria」對話式客服,像真人:
  開場自我介紹 + 客戶直接打字問。回答走「本地 FAQ 模糊比對」(知識庫=lib/faq-data.ts,
  字元 bigram 重疊計分),不經 LLM API(Wing 拍板:FAQ 量小,本地即可,零成本零濫用風險);
  轉真人=最後手段(Wing 2026-08-06:客服泡泡要降真人負擔):比對不到先「追問澄清」
  +附候選問題籤;連續第二次仍答不了才建議轉真人;轉真人時整段對話自動帶進詢問單
  (source='help_widget'),客戶只需留稱呼+email 不用重講。
  答完附最多 2 個「相關問題」小籤,不再把整排主題丟給客戶點。後台/配音員/儀表板不顯示。
*/

type Msg = { role: 'user' | 'assistant'; content: string; handoff?: boolean; related?: FaqItem[] };

// 查詢廢詞(禮貌語/功能詞)—— 這些 bigram 誰都沾邊,會把排序帶歪,比對前先剔除
const STOP_TOKENS = new Set(['我要', '我想', '請問', '请问', '怎麼', '怎么', '如何', '可以', '什麼', '什么', '我們', '我们', '你們', '你们', '一下', '需要', '沒有', '没有', '是不', '不是', '這個', '这个', '那個', '那个', '有沒', '有没']);
// 意圖加權:常見講法 → 對應主題的題目直接加分(例:「我要發案」→ 含「發案」的題)
const INTENT_BOOST: { keys: string[]; target: string[] }[] = [
  { keys: ['發案', '发案', '找配音員', '找配音员', '委託', '委托', '下單', '下单', 'post a project', 'hire'], target: ['發案', '发案', 'post a'] },
  { keys: ['費用', '费用', '價格', '价格', '報價', '报价', '多少錢', '多少钱', '收費', '收费', 'price', 'cost', 'pricing'], target: ['費用', '费用', 'cost'] },
  { keys: ['加入', '應徵', '应征', '成為配音員', '成为配音员', '報名', '报名', 'join', 'become'], target: ['加入', 'join'] },
  // 配音員「交件/上傳成品」→ 導到後台交件那題,不能被「發案」「檔案格式」的 bigram
  // 帶去客戶端 /hire(2026-08-22 吳球球案例:問 5 次交件,4 次 fallback、2 次被導去發案頁)
  { keys: ['交件', '交付', '上傳', '上传', '繳交', '缴交', 'deliver my', 'upload my', 'hand in'], target: ['交件', 'deliver my finished'] },
];

// 本地 FAQ 模糊比對:中文用字元 bigram、英文用小寫單詞,對題目(權重高)+答案計重疊分
function tokens(s: string): string[] {
  const clean = s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ');
  const out: string[] = [];
  for (const w of clean.split(' ').filter(Boolean)) {
    if (/^[a-z0-9]+$/.test(w)) { if (w.length > 2) out.push(w); }
    else { for (let i = 0; i < w.length - 1; i++) out.push(w.slice(i, i + 2)); if (w.length === 1) out.push(w); }
  }
  return out;
}
function matchFaqs(query: string, items: FaqItem[]): { item: FaqItem; score: number }[] {
  const qt = new Set(tokens(query).filter((t) => !STOP_TOKENS.has(t)));
  const ql = query.toLowerCase();
  const boosts = INTENT_BOOST.filter((b) => b.keys.some((k) => ql.includes(k)));
  if (!qt.size && !boosts.length) return [];
  return items
    .map((item) => {
      const inQ = tokens(item.q).filter((t) => qt.has(t)).length;
      const inA = tokens(item.a).filter((t) => qt.has(t)).length;
      const boost = boosts.some((b) => b.target.some((tg) => item.q.toLowerCase().includes(tg))) ? 8 : 0;
      return { item, score: inQ * 3 + Math.min(inA, 8) + boost };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

export default function HelpWidget({ locale }: { locale: string }) {
  const pathname = usePathname() || '';
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'chat' | 'contact' | 'sent'>('chat');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const missRef = useRef(0);   // 連續答不出次數:第 1 次→追問澄清,第 2 次→才轉真人
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy, open]);

  // 後台 / 配音員 / 客戶儀表板不掛(那些地方走平台徽章,不需要對外客服泡泡)。
  if (/\/(admin|talent|dashboard)(\/|$)/.test(pathname)) return null;

  const tx = (tw: string, cn: string, en: string) => (locale === 'zh-CN' ? cn : locale.startsWith('zh') ? tw : en);

  const T = {
    title: 'Aria',
    sub: tx('Onyx 線上助理', 'Onyx 在线助理', 'Onyx assistant'),
    greeting: tx('您好,我是 Aria,Onyx 的線上助理。請問有什麼可以幫您?', '您好,我是 Aria,Onyx 的在线助理。请问有什么可以帮您?', "Hi, I'm Aria — Onyx's assistant. What can I help you with today?"),
    human: tx('找真人客服', '找真人客服', 'Talk to a human'),
    handoff: tx('這題我幫您轉給團隊處理 —— 剛剛的對話我會一併附上,您只要留下稱呼和 email,不用重打一次,我們一個工作日內回覆。', '这题我帮您转给团队处理 —— 刚刚的对话我会一并附上,您只要留下称呼和 email,不用重打一次,我们一个工作日内回复。', "I'll pass this to our team with our conversation attached — just leave your name and email (no need to retype anything) and we'll reply within one business day."),
    clarify: tx('想幫您答得準一點 —— 您問的比較接近下面哪一個?也可以描述得更具體,例如「AI 配音的費用」「真人配音怎麼發案」「配音員接案後怎麼交件」。', '想帮您答得准一点 —— 您问的比较接近下面哪一个?也可以描述得更具体,例如「AI 配音的费用」「真人配音怎么发案」「配音员接案后怎么交件」。', 'Help me pin this down — is it close to one of these? You can also be more specific, e.g. “AI voiceover pricing”, “how to post a human VO project”, or “how do I deliver my finished audio”.'),
    placeholder: tx('輸入您的問題…', '输入您的问题…', 'Type your question…'),
    back: tx('返回', '返回', 'Back'),
    name: tx('你的稱呼', '你的称呼', 'Your name'),
    email: tx('你的 Email', '你的 Email', 'Your email'),
    msg: tx('你的問題', '你的问题', 'Your question'),
    send: tx('送出', '发送', 'Send'),
    sentTitle: tx('已收到,謝謝!', '已收到,谢谢!', 'Got it — thank you!'),
    sentBody: tx('我們會盡快回覆你(通常一個工作日內)。', '我们会尽快回复你(通常一个工作日内)。', "We'll get back to you shortly, usually within one business day."),
    done: tx('完成', '完成', 'Done'),
  };

  const goContact = (prefill?: string) => {
    setForm((f) => ({ ...f, message: prefill ?? f.message }));
    setView('contact');
  };

  const allItems = [...getClientFaqs(tx), ...getTalentFaqs(tx)].flatMap((c) => c.items);

  function ask(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setMsgs((m) => [...m, { role: 'user', content }]); setInput(''); setBusy(true);
    setTimeout(() => {
      const hits = matchFaqs(content, allItems);
      const strong = hits.filter((h) => h.score >= 6);
      const weak = hits.slice(0, 3).map((h) => h.item);
      if (strong.length) {
        missRef.current = 0;
        setMsgs((m) => [...m, { role: 'assistant', content: strong[0].item.a, related: strong.slice(1, 3).map((h) => h.item) }]);
      } else if (missRef.current === 0) {   // 第一次答不出:一律先澄清(有候選附候選,沒有就請他講具體)
        missRef.current = 1;   // 先追問澄清,不急著轉真人
        setMsgs((m) => [...m, { role: 'assistant', content: T.clarify, related: weak }]);
        logMiss(content, hits[0]);
      } else {
        missRef.current = 0;
        setMsgs((m) => [...m, { role: 'assistant', content: T.handoff, handoff: true }]);
        logMiss(content, hits[0]);
      }
      setBusy(false);
    }, 450);
  }

  // 漏答上報:答不出的問題存檔(Wing 滾動式補 FAQ 用),失敗不影響前端
  function logMiss(query: string, top?: { item: FaqItem; score: number }) {
    fetch('/api/support/missed', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, locale, top_match: top?.item.q || '', score: top?.score ?? 0 }),
    }).catch(() => {});
  }

  // 點「相關問題」籤:直接秀該題答案
  function pick(item: FaqItem) {
    if (busy) return;
    missRef.current = 0;
    setMsgs((m) => [...m, { role: 'user', content: item.q }]); setBusy(true);
    setTimeout(() => { setMsgs((m) => [...m, { role: 'assistant', content: item.a }]); setBusy(false); }, 450);
  }

  // 詢問單自動帶入整段對話(客戶不用重講;Aria 的回答截短留脈絡)
  const transcript = () => {
    if (!msgs.length) return '';
    const who = (r: string) => (r === 'user' ? tx('客戶', '客户', 'Client') : 'Aria');
    const lines = msgs.map((m) => `${who(m.role)}:${m.role === 'user' ? m.content : m.content.slice(0, 80) + (m.content.length > 80 ? '…' : '')}`);
    return (tx('【Aria 對話紀錄】', '【Aria 对话记录】', '[Aria chat log]') + '\n' + lines.join('\n')).slice(0, 1800);
  };

  return (
    <>
      {/* 浮動按鈕 */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={T.title}
        className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-purple-600 text-white shadow-lg shadow-purple-900/40 transition hover:bg-purple-500 hover:scale-105"
      >
        {open ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-[60] flex h-[min(560px,calc(100vh-8rem))] w-[min(370px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 text-white shadow-2xl">
          {/* 頭:Aria 身分列 */}
          <div className="shrink-0 border-b border-white/10 bg-gradient-to-b from-purple-600/20 to-transparent px-4 py-3.5 flex items-center gap-2.5">
            {view === 'contact' && (
              <button onClick={() => setView('chat')} className="mr-0.5 inline-flex items-center text-gray-400 hover:text-white">
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-[12px] font-bold text-white">A</div>
            <div>
              <p className="text-sm font-semibold leading-none">{T.title}</p>
              <p className="mt-0.5 text-[11px] text-gray-400">{T.sub}</p>
            </div>
            <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] text-gray-500"><span className="h-1.5 w-1.5 rounded-full bg-green-400" />{tx('線上', '在线', 'Online')}</span>
          </div>

          {/* 對話 */}
          {view === 'chat' && (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5 space-y-3">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-600 text-[10px] font-bold text-white">A</div>
                  <p className="text-[13px] leading-relaxed text-gray-200">{T.greeting}</p>
                </div>
                {msgs.length === 0 && (
                  <div className="pl-8 flex flex-wrap gap-1.5">
                    {allItems.slice(0, 2).map((it) => (
                      <button key={it.q} onClick={() => pick(it)}
                        className="rounded-full border border-white/15 px-3 py-1.5 text-[12px] text-gray-300 hover:border-white/30 hover:text-white transition-colors text-left">
                        {it.q}
                      </button>
                    ))}
                  </div>
                )}
                {msgs.map((m, i) => (
                  m.role === 'user' ? (
                    <div key={i} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-purple-600 px-3.5 py-2 text-[13px] leading-relaxed whitespace-pre-wrap">{m.content}</div>
                    </div>
                  ) : (
                    <div key={i} className="flex items-start gap-2">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-600 text-[10px] font-bold text-white">A</div>
                      <div className="min-w-0">
                        <p className="text-[13px] leading-relaxed text-gray-200 whitespace-pre-wrap">{m.content}</p>
                        {!!m.related?.length && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {m.related.map((it) => (
                              <button key={it.q} onClick={() => pick(it)}
                                className="rounded-full border border-white/15 px-2.5 py-1 text-[11.5px] text-gray-400 hover:border-white/30 hover:text-white transition-colors text-left">
                                {it.q}
                              </button>
                            ))}
                          </div>
                        )}
                        {m.handoff && (
                          <button onClick={() => goContact(transcript())}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-purple-500/40 px-3 py-1.5 text-[12px] font-medium text-purple-300 hover:bg-purple-500/10">
                            <MessageSquare className="h-3.5 w-3.5" />{T.human}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                ))}
                {busy && (
                  <div className="pl-8 flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="inline-block h-1.5 w-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                )}
                <div ref={endRef} />
              </div>
              <div className="shrink-0 border-t border-white/10 p-2.5">
                <div className="flex items-end gap-1.5 rounded-xl border border-white/15 bg-black/30 px-2.5 py-1.5 focus-within:border-purple-500/60 transition-colors">
                  <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }}
                    placeholder={T.placeholder}
                    className="flex-1 resize-none bg-transparent text-[13px] leading-6 outline-none placeholder:text-gray-500" />
                  <button onClick={() => ask()} disabled={busy || !input.trim()}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-600 hover:bg-purple-500 disabled:opacity-30 transition-colors">
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button onClick={() => goContact(transcript())} className="mt-1.5 text-[11px] text-gray-500 hover:text-gray-300 transition-colors">
                  {T.human}
                </button>
              </div>
            </>
          )}

          {/* 真人客服表單(原詢問單流程) */}
          {view === 'contact' && (
            <div className="min-h-0 flex-1 overflow-y-auto space-y-2.5 px-3.5 py-3">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={T.name}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-gray-500 focus:border-purple-500/60" />
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={T.email} type="email"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-gray-500 focus:border-purple-500/60" />
              <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder={T.msg} rows={4}
                className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-gray-500 focus:border-purple-500/60" />
              {err && <p className="text-xs text-red-400">{err}</p>}
              <button disabled={sending} onClick={async () => {
                if (!form.name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email) || !form.message.trim()) {
                  setErr(tx('請填姓名、正確 email 與問題內容。', '请填姓名、正确 email 与问题内容。', 'Please enter your name, a valid email, and your message.'));
                  return;
                }
                setSending(true); setErr('');
                try {
                  const res = await fetch('/api/contact/send', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: form.name.trim(), email: form.email.trim(), message: form.message.trim(), department: 'HELLO', source: 'help_widget' }),
                  });
                  if (!res.ok) throw new Error();
                  setView('sent');
                } catch {
                  setErr(tx('送出失敗,請稍後再試或來信 hello@onyxstudios.ai。', '发送失败,请稍后再试或来信 hello@onyxstudios.ai。', 'Could not send — please try again or email hello@onyxstudios.ai.'));
                } finally { setSending(false); }
              }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50">
                <Send className="h-4 w-4" />{sending ? '…' : T.send}
              </button>
            </div>
          )}

          {view === 'sent' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-600/20"><Check className="h-6 w-6 text-purple-300" /></div>
              <p className="text-sm font-semibold text-white">{T.sentTitle}</p>
              <p className="text-xs text-gray-400">{T.sentBody}</p>
              <button onClick={() => { setOpen(false); setView('chat'); }} className="mt-2 rounded-lg bg-white/10 px-4 py-2 text-xs font-medium hover:bg-white/15">{T.done}</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

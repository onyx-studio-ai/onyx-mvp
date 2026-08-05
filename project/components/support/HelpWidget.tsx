'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquare, X, ChevronRight, ChevronLeft, Send, Check } from 'lucide-react';
import { getClientFaqs, getTalentFaqs, type FaqCategory } from '@/lib/faq-data';

/*
  右下角求助 / 客服浮動視窗(Phase 1)。
  純選單樹:分類 → 問題 → 答案,任何一層都能「找真人客服」→ 送出詢問單
  (POST /api/contact/send,source='help_widget')→ 後台「詢問單」徽章。
  資料源 = lib/faq-data.ts(與 FAQ 頁共用)。登入後台/配音員/客戶儀表板不顯示。
  之後 Phase 2 可把自由提問接上 AI(見記憶 project_onyx),此版不含 LLM。
*/
export default function HelpWidget({ locale }: { locale: string }) {
  const pathname = usePathname() || '';
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'home' | 'questions' | 'answer' | 'contact' | 'sent'>('home');
  const [cat, setCat] = useState(0);
  const [qi, setQi] = useState(0);
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');

  // 後台 / 配音員 / 客戶儀表板不掛(那些地方走平台徽章,不需要對外客服泡泡)。
  if (/\/(admin|talent|dashboard)(\/|$)/.test(pathname)) return null;

  const tx = (tw: string, cn: string, en: string) => (locale === 'zh-CN' ? cn : locale.startsWith('zh') ? tw : en);
  const cats: FaqCategory[] = [...getClientFaqs(tx), ...getTalentFaqs(tx)];

  const reset = () => { setView('home'); setForm({ name: '', email: '', message: '' }); setErr(''); };
  const goContact = (prefill?: string) => {
    setForm((f) => ({ ...f, message: prefill || f.message }));
    setView('contact');
  };

  async function submit() {
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
  }

  const T = {
    title: tx('有什麼可以幫你?', '有什么可以帮你?', 'How can we help?'),
    sub: tx('選一個主題,或直接找真人客服。', '选一个主题,或直接找真人客服。', 'Pick a topic, or reach a human.'),
    human: tx('找真人客服', '找真人客服', 'Talk to a human'),
    more: tx('沒有你要的答案?找真人客服', '没有你要的答案?找真人客服', "Didn't find your answer? Talk to a human"),
    back: tx('返回', '返回', 'Back'),
    name: tx('你的稱呼', '你的称呼', 'Your name'),
    email: tx('你的 Email', '你的 Email', 'Your email'),
    msg: tx('你的問題', '你的问题', 'Your question'),
    send: tx('送出', '发送', 'Send'),
    sentTitle: tx('已收到,謝謝!', '已收到,谢谢!', 'Got it — thank you!'),
    sentBody: tx('我們會盡快回覆你(通常一個工作日內)。', '我们会尽快回复你(通常一个工作日内)。', "We'll get back to you shortly, usually within one business day."),
    done: tx('完成', '完成', 'Done'),
  };

  return (
    <>
      {/* 浮動按鈕 */}
      <button
        onClick={() => { setOpen((o) => !o); if (!open) reset(); }}
        aria-label={T.title}
        className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-purple-600 text-white shadow-lg shadow-purple-900/40 transition hover:bg-purple-500 hover:scale-105"
      >
        {open ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-[60] flex max-h-[70vh] w-[min(360px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 text-white shadow-2xl">
          {/* 頭 */}
          <div className="shrink-0 border-b border-white/10 bg-gradient-to-b from-purple-600/20 to-transparent px-4 py-4">
            {view !== 'home' && (
              <button onClick={() => setView(view === 'answer' ? 'questions' : view === 'questions' ? 'home' : 'home')}
                className="mb-2 inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white">
                <ChevronLeft className="h-3.5 w-3.5" />{T.back}
              </button>
            )}
            <p className="text-base font-semibold">{view === 'home' ? T.title : cats[cat]?.category}</p>
            {view === 'home' && <p className="mt-0.5 text-xs text-gray-400">{T.sub}</p>}
          </div>

          {/* 內容 */}
          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            {view === 'home' && (
              <>
                {cats.map((c, i) => (
                  <button key={i} onClick={() => { setCat(i); setView('questions'); }}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-gray-200 hover:bg-white/5">
                    <span>{c.category}</span><ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
                  </button>
                ))}
                <button onClick={() => goContact()}
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-purple-500/40 px-3 py-2.5 text-sm font-medium text-purple-300 hover:bg-purple-500/10">
                  <MessageSquare className="h-4 w-4" />{T.human}
                </button>
              </>
            )}

            {view === 'questions' && (
              <>
                {cats[cat]?.items.map((it, i) => (
                  <button key={i} onClick={() => { setQi(i); setView('answer'); }}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-gray-200 hover:bg-white/5">
                    <span>{it.q}</span><ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
                  </button>
                ))}
                <button onClick={() => goContact()}
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-purple-500/40 px-3 py-2.5 text-sm font-medium text-purple-300 hover:bg-purple-500/10">
                  <MessageSquare className="h-4 w-4" />{T.human}
                </button>
              </>
            )}

            {view === 'answer' && (
              <div className="px-2 py-1">
                <p className="mb-2 text-sm font-semibold text-white">{cats[cat]?.items[qi]?.q}</p>
                <p className="whitespace-pre-line text-[13px] leading-relaxed text-gray-300">{cats[cat]?.items[qi]?.a}</p>
                <button onClick={() => goContact(tx(`我想問:${cats[cat]?.items[qi]?.q}\n\n`, `我想问:${cats[cat]?.items[qi]?.q}\n\n`, `My question about: ${cats[cat]?.items[qi]?.q}\n\n`))}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-purple-500/40 px-3 py-2.5 text-xs font-medium text-purple-300 hover:bg-purple-500/10">
                  <MessageSquare className="h-4 w-4" />{T.more}
                </button>
              </div>
            )}

            {view === 'contact' && (
              <div className="space-y-2.5 px-2 py-2">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={T.name}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-gray-500 focus:border-purple-500/60" />
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={T.email} type="email"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-gray-500 focus:border-purple-500/60" />
                <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder={T.msg} rows={4}
                  className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-gray-500 focus:border-purple-500/60" />
                {err && <p className="text-xs text-red-400">{err}</p>}
                <button disabled={sending} onClick={submit}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50">
                  <Send className="h-4 w-4" />{sending ? '…' : T.send}
                </button>
              </div>
            )}

            {view === 'sent' && (
              <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-600/20"><Check className="h-6 w-6 text-purple-300" /></div>
                <p className="text-sm font-semibold text-white">{T.sentTitle}</p>
                <p className="text-xs text-gray-400">{T.sentBody}</p>
                <button onClick={() => setOpen(false)} className="mt-2 rounded-lg bg-white/10 px-4 py-2 text-xs font-medium hover:bg-white/15">{T.done}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

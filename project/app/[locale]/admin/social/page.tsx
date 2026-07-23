'use client';

/*
  社群發文 · X —— Onyx 官方 X(@onyxstudiosai)一鍵發推文後台頁。
  策略:主文純文字(省錢);導流連結另發成第一則回覆(reply)以規避帶連結加價。
  打 /api/admin/social/x(admin 頁沿用 credentials:'include' 慣例,非 talent 的 authedFetch)。
  金鑰全在後端環境變數,前端只送 text / linkReply。
*/

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { Send, ExternalLink, AlertCircle } from 'lucide-react';
import { AdminHeader } from '@/components/admin/list-ui';

const MAX_LEN = 280;

export default function AdminSocialPage() {
  const locale = useLocale();
  const isZhTW = locale === 'zh-TW';
  const t = isZhTW
    ? {
        title: '社群發文 · X',
        subtitle: '發到 Onyx 官方 X(@onyxstudiosai)。主文純文字,導流連結會發成第一則回覆。',
        mainLabel: '主文',
        mainPlaceholder: '寫下要發的推文…',
        linkLabel: '導流連結',
        linkHint: '會發成第一則回覆(reply);留空則只發主文。',
        linkPlaceholder: 'https://onyxstudios.ai/…',
        send: '發到 X',
        sending: '發送中…',
        over: '超過 280 字',
        emptyMain: '請先輸入主文',
        successTitle: '已發到 X',
        viewTweet: '看這則推文',
        replyPosted: '導流連結已發成回覆',
        errTitle: '發送失敗',
      }
    : {
        title: 'Social Post · X',
        subtitle:
          'Post to the official Onyx X account (@onyxstudiosai). Main tweet is plain text; the link goes out as the first reply.',
        mainLabel: 'Main tweet',
        mainPlaceholder: 'Write your tweet…',
        linkLabel: 'Link',
        linkHint: 'Posted as the first reply. Leave empty to post the main tweet only.',
        linkPlaceholder: 'https://onyxstudios.ai/…',
        send: 'Post to X',
        sending: 'Posting…',
        over: 'Over 280 characters',
        emptyMain: 'Enter the main tweet first',
        successTitle: 'Posted to X',
        viewTweet: 'View this tweet',
        replyPosted: 'Link posted as a reply',
        errTitle: 'Failed to post',
      };

  const [text, setText] = useState('');
  const [linkReply, setLinkReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tweetUrl: string; replyId?: string } | null>(null);
  const [error, setError] = useState('');
  const [diag, setDiag] = useState<Record<string, unknown> | null>(null);

  // 以 Unicode code point 計長度,和後端一致(避免 emoji 被算成 2)
  const len = [...text].length;
  const over = len > MAX_LEN;

  async function send() {
    if (!text.trim()) {
      toast.error(t.emptyMain);
      return;
    }
    if (over) {
      toast.error(t.over);
      return;
    }
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/admin/social/x', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), linkReply: linkReply.trim() || undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || t.errTitle);
      setResult({ tweetUrl: j.tweetUrl, replyId: j.replyId });
      toast.success(t.successTitle);
      setText('');
      setLinkReply('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : t.errTitle;
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  // 連線診斷:打 GET,檢查金鑰狀態 + X 讀取測試(不發推文)
  async function runDiag() {
    setBusy(true);
    setDiag(null);
    try {
      const res = await fetch('/api/admin/social/x', { method: 'GET', credentials: 'include' });
      const j = await res.json().catch(() => ({}));
      setDiag(j);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'diag failed');
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    'w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-amber-300 focus:outline-none';

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <AdminHeader title={t.title} subtitle={t.subtitle} />

      <div className="max-w-2xl space-y-5">
        {/* 主文 */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-gray-700">{t.mainLabel}</label>
            <span className={`text-xs tabular-nums ${over ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
              {len} / {MAX_LEN}
            </span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.mainPlaceholder}
            rows={5}
            className={`${inputCls} resize-y ${over ? 'border-red-400 focus:border-red-400' : ''}`}
          />
        </div>

        {/* 導流連結 → 第一則回覆 */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1.5">{t.linkLabel}</label>
          <input
            type="url"
            value={linkReply}
            onChange={(e) => setLinkReply(e.target.value)}
            placeholder={t.linkPlaceholder}
            className={inputCls}
          />
          <p className="text-xs text-gray-500 mt-1.5">{t.linkHint}</p>
        </div>

        {/* 發送 */}
        <button
          onClick={send}
          disabled={busy || !text.trim() || over}
          className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Send className="w-4 h-4" />
          {busy ? t.sending : t.send}
        </button>

        {/* 連線診斷(除錯用,不發推文) */}
        <button
          onClick={runDiag}
          disabled={busy}
          className="ml-3 inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
        >
          {isZhTW ? '連線診斷' : 'Diagnose'}
        </button>

        {diag && (
          <pre className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-800 overflow-x-auto whitespace-pre-wrap break-words">
            {JSON.stringify(diag, null, 2)}
          </pre>
        )}

        {/* 結果:成功 */}
        {result && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-800">{t.successTitle}</p>
            <a
              href={result.tweetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 text-sm text-green-700 hover:text-green-900 underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t.viewTweet}
            </a>
            {result.replyId && <p className="text-xs text-green-700 mt-1.5">{t.replyPosted}</p>}
          </div>
        )}

        {/* 結果:失敗 */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800">{t.errTitle}</p>
              <p className="text-sm text-red-700 mt-1 break-words">{error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

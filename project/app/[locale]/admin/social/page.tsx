'use client';

/*
  社群發文 —— Onyx 官方多平台一鍵發文後台頁(X / FB 粉專 / IG)。

  一個共用主文框 + 平台勾選(可多選),發布時對每個勾選平台各打各的 route,
  分別顯示成功連結 / 失敗訊息。金鑰全在後端環境變數,前端只送文字與媒體 URL。

  各平台規則(UI 有標清楚):
    - X  :主文純文字(省錢);導流連結會發成第一則回覆(reply)。不吃圖(本頁不對 X 送圖)。
    - FB :純文字或帶連結;若有上傳圖片,改用 /photos 帶圖發(caption=主文)。
    - IG :🚨 強制要媒體(圖或影片),不能純文字;caption=主文。

  媒體上傳:先傳到 social-media 公開 bucket 拿 public URL,再交給 FB 的 imageUrl /
  IG 的 mediaUrl(Meta API 只吃公開可訪問的 URL)。

  admin 頁沿用 credentials:'include' 慣例(非 talent 的 authedFetch)。
*/

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { Send, ExternalLink, AlertCircle, Upload, X as XIcon, CheckCircle2 } from 'lucide-react';
import { AdminHeader } from '@/components/admin/list-ui';

const X_MAX_LEN = 280;

type Platform = 'x' | 'fb' | 'ig';

// 單一平台的發布結果(成功給連結 / 失敗給訊息)
type PlatformResult = {
  platform: Platform;
  ok: boolean;
  url?: string;
  message?: string;
};

export default function AdminSocialPage() {
  const locale = useLocale();
  const isZhTW = locale === 'zh-TW';
  const t = isZhTW
    ? {
        title: '社群發文',
        subtitle: '一次發到 Onyx 官方 X / FB 粉專 / IG。勾選要發的平台,寫一次主文,各平台按各自規則發送。',
        platforms: '發布平台',
        xName: 'X(@onyxstudiosai)',
        xRule: '主文純文字;導流連結發成第一則回覆。不送圖片。',
        fbName: 'FB 粉專',
        fbRule: '純文字或帶連結;有上傳圖片則帶圖發(圖說=主文)。',
        igName: 'Instagram',
        igRule: '⚠️ 必須附圖片或影片,不能純文字(圖說=主文)。',
        mainLabel: '主文 / 圖說',
        mainPlaceholder: '寫下要發的內容…',
        linkLabel: '導流連結(X 的回覆 / FB 的連結)',
        linkPlaceholder: 'https://onyxstudios.ai/…',
        mediaLabel: '媒體(圖片 / 影片)',
        mediaHint: 'FB 帶圖 / IG 必附。上傳後給 FB 與 IG 使用;X 不送圖。',
        uploading: '上傳中…',
        chooseFile: '選擇圖片或影片',
        removeMedia: '移除媒體',
        uploadedImage: '已上傳圖片',
        uploadedVideo: '已上傳影片',
        send: '發布',
        sending: '發布中…',
        xOver: `X 主文超過 ${X_MAX_LEN} 字`,
        noPlatform: '請至少勾選一個平台',
        emptyMain: '請先輸入主文',
        igNeedsMedia: 'IG 需要圖片或影片,請先上傳媒體',
        xNeedsText: 'X 需要主文文字',
        fbNeedsContent: 'FB 需要主文或圖片',
        resultsTitle: '發布結果',
        viewPost: '看這則貼文',
        diagnose: 'X 連線診斷',
        errTitle: '發送失敗',
      }
    : {
        title: 'Social Post',
        subtitle:
          'Post to the official Onyx X / FB Page / IG at once. Check the platforms, write once, each posts by its own rules.',
        platforms: 'Platforms',
        xName: 'X (@onyxstudiosai)',
        xRule: 'Plain-text tweet; link goes out as the first reply. No image.',
        fbName: 'FB Page',
        fbRule: 'Text or with a link; if an image is uploaded, posts with the image (caption = main text).',
        igName: 'Instagram',
        igRule: '⚠️ Requires an image or video, no text-only (caption = main text).',
        mainLabel: 'Main text / Caption',
        mainPlaceholder: 'Write your post…',
        linkLabel: 'Link (X reply / FB link)',
        linkPlaceholder: 'https://onyxstudios.ai/…',
        mediaLabel: 'Media (image / video)',
        mediaHint: 'FB with image / IG required. Used by FB and IG after upload; X gets no image.',
        uploading: 'Uploading…',
        chooseFile: 'Choose image or video',
        removeMedia: 'Remove media',
        uploadedImage: 'Image uploaded',
        uploadedVideo: 'Video uploaded',
        send: 'Publish',
        sending: 'Publishing…',
        xOver: `X tweet over ${X_MAX_LEN} characters`,
        noPlatform: 'Select at least one platform',
        emptyMain: 'Enter the main text first',
        igNeedsMedia: 'IG needs an image or video — upload media first',
        xNeedsText: 'X needs main text',
        fbNeedsContent: 'FB needs text or an image',
        resultsTitle: 'Results',
        viewPost: 'View this post',
        diagnose: 'X diagnostics',
        errTitle: 'Failed to post',
      };

  const [platforms, setPlatforms] = useState<Record<Platform, boolean>>({ x: true, fb: false, ig: false });
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaKind, setMediaKind] = useState<'image' | 'video' | ''>('');
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<PlatformResult[]>([]);
  const [diag, setDiag] = useState<Record<string, unknown> | null>(null);

  // X 以 Unicode code point 計長度,和後端一致(避免 emoji 被算成 2)
  const xLen = [...text].length;
  const xOver = xLen > X_MAX_LEN;

  const platformName: Record<Platform, string> = { x: t.xName, fb: t.fbName, ig: t.igName };

  function toggle(p: Platform) {
    setPlatforms((prev) => ({ ...prev, [p]: !prev[p] }));
  }

  // 媒體上傳:傳到 social-media 公開 bucket,拿 public URL 給 FB/IG 用
  async function uploadMedia(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set('file', file);
      const res = await fetch('/api/admin/social/media', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'upload failed');
      setMediaUrl(j.publicUrl);
      setMediaKind(j.kind === 'video' ? 'video' : 'image');
      toast.success(j.kind === 'video' ? t.uploadedVideo : t.uploadedImage);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'upload failed');
    } finally {
      setUploading(false);
    }
  }

  function clearMedia() {
    setMediaUrl('');
    setMediaKind('');
  }

  // 各平台的發布器:回傳統一的 PlatformResult
  async function postX(): Promise<PlatformResult> {
    try {
      // X route 一字不動:沿用 { text, linkReply }
      const res = await fetch('/api/admin/social/x', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), linkReply: link.trim() || undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || t.errTitle);
      return { platform: 'x', ok: true, url: j.tweetUrl };
    } catch (e) {
      return { platform: 'x', ok: false, message: e instanceof Error ? e.message : t.errTitle };
    }
  }

  async function postFB(): Promise<PlatformResult> {
    try {
      const res = await fetch('/api/admin/social/fb', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          link: link.trim() || undefined,
          // 只有圖片才給 FB imageUrl;影片本頁不走 FB(FB 影片是另一套上傳流程)
          imageUrl: mediaKind === 'image' ? mediaUrl : undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || t.errTitle);
      return { platform: 'fb', ok: true, url: j.url };
    } catch (e) {
      return { platform: 'fb', ok: false, message: e instanceof Error ? e.message : t.errTitle };
    }
  }

  async function postIG(): Promise<PlatformResult> {
    try {
      const res = await fetch('/api/admin/social/ig', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption: text.trim(),
          mediaUrl,
          mediaType: mediaKind || 'image',
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || t.errTitle);
      return { platform: 'ig', ok: true, url: j.permalink };
    } catch (e) {
      return { platform: 'ig', ok: false, message: e instanceof Error ? e.message : t.errTitle };
    }
  }

  async function send() {
    const selected = (Object.keys(platforms) as Platform[]).filter((p) => platforms[p]);
    if (selected.length === 0) {
      toast.error(t.noPlatform);
      return;
    }
    if (!text.trim() && !mediaUrl) {
      toast.error(t.emptyMain);
      return;
    }
    // 各平台前置檢查(把不合規的平台擋在打 API 之前,給明確提示)
    if (platforms.x) {
      if (!text.trim()) return toast.error(t.xNeedsText);
      if (xOver) return toast.error(t.xOver);
    }
    if (platforms.ig && !mediaUrl) return toast.error(t.igNeedsMedia);
    if (platforms.fb && !text.trim() && mediaKind !== 'image') return toast.error(t.fbNeedsContent);

    setBusy(true);
    setResults([]);
    try {
      const jobs: Promise<PlatformResult>[] = [];
      if (platforms.x) jobs.push(postX());
      if (platforms.fb) jobs.push(postFB());
      if (platforms.ig) jobs.push(postIG());
      const res = await Promise.all(jobs);
      setResults(res);

      const okCount = res.filter((r) => r.ok).length;
      const failCount = res.length - okCount;
      if (failCount === 0) toast.success(isZhTW ? `全部發布成功(${okCount})` : `All published (${okCount})`);
      else if (okCount === 0) toast.error(isZhTW ? '全部發布失敗' : 'All failed');
      else toast.warning(isZhTW ? `部分成功:${okCount} 成功 / ${failCount} 失敗` : `${okCount} ok / ${failCount} failed`);
    } finally {
      setBusy(false);
    }
  }

  // X 連線診斷:打 X route 的 GET(不發推文)
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

  const platformMeta: { key: Platform; name: string; rule: string }[] = [
    { key: 'x', name: t.xName, rule: t.xRule },
    { key: 'fb', name: t.fbName, rule: t.fbRule },
    { key: 'ig', name: t.igName, rule: t.igRule },
  ];

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <AdminHeader title={t.title} subtitle={t.subtitle} />

      <div className="max-w-2xl space-y-5">
        {/* 平台勾選 */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">{t.platforms}</label>
          <div className="space-y-2">
            {platformMeta.map(({ key, name, rule }) => (
              <label
                key={key}
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  platforms[key] ? 'border-amber-300 bg-amber-50/50' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={platforms[key]}
                  onChange={() => toggle(key)}
                  className="mt-0.5 h-4 w-4 accent-gray-900"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-900">{name}</span>
                  <span className="block text-xs text-gray-500 mt-0.5">{rule}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* 主文 / 圖說 */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-gray-700">{t.mainLabel}</label>
            {platforms.x && (
              <span className={`text-xs tabular-nums ${xOver ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                X {xLen} / {X_MAX_LEN}
              </span>
            )}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.mainPlaceholder}
            rows={5}
            className={`${inputCls} resize-y ${platforms.x && xOver ? 'border-red-400 focus:border-red-400' : ''}`}
          />
        </div>

        {/* 導流連結(X reply / FB link) */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1.5">{t.linkLabel}</label>
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder={t.linkPlaceholder}
            className={inputCls}
          />
        </div>

        {/* 媒體上傳 */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1.5">{t.mediaLabel}</label>
          {!mediaUrl ? (
            <label className="flex items-center gap-2 w-fit cursor-pointer px-4 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors">
              <Upload className="w-4 h-4" />
              {uploading ? t.uploading : t.chooseFile}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadMedia(f);
                  e.target.value = ''; // 允許重選同一檔
                }}
              />
            </label>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <span className="text-sm text-gray-700">
                  {mediaKind === 'video' ? t.uploadedVideo : t.uploadedImage}
                </span>
                <button
                  onClick={clearMedia}
                  className="ml-auto inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600"
                >
                  <XIcon className="w-3.5 h-3.5" />
                  {t.removeMedia}
                </button>
              </div>
              {mediaKind === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl} alt="" className="max-h-40 rounded border border-gray-200" />
              ) : (
                <video src={mediaUrl} controls className="max-h-40 rounded border border-gray-200" />
              )}
            </div>
          )}
          <p className="text-xs text-gray-500 mt-1.5">{t.mediaHint}</p>
        </div>

        {/* 發布 */}
        <div className="flex items-center gap-3">
          <button
            onClick={send}
            disabled={busy || uploading}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
            {busy ? t.sending : t.send}
          </button>

          <button
            onClick={runDiag}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
          >
            {t.diagnose}
          </button>
        </div>

        {diag && (
          <pre className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-800 overflow-x-auto whitespace-pre-wrap break-words">
            {JSON.stringify(diag, null, 2)}
          </pre>
        )}

        {/* 各平台發布結果 */}
        {results.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">{t.resultsTitle}</p>
            {results.map((r) => (
              <div
                key={r.platform}
                className={`rounded-xl border p-4 ${
                  r.ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                }`}
              >
                {r.ok ? (
                  <div>
                    <p className="text-sm font-semibold text-green-800">{platformName[r.platform]}</p>
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-1 text-sm text-green-700 hover:text-green-900 underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {t.viewPost}
                      </a>
                    ) : (
                      <p className="text-xs text-green-700 mt-1">{isZhTW ? '已發布' : 'Published'}</p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-red-800">{platformName[r.platform]}</p>
                      <p className="text-sm text-red-700 mt-0.5 break-words">{r.message}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

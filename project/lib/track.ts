/**
 * 前端流量埋點小工具 —— 只在瀏覽器跑,失敗一律靜默(不能影響前台流程)。
 *
 * 用法:
 *   import { track, getVisitorId } from '@/lib/track';
 *   track('hire_submit');                 // 事件埋點(送出成功後補一行)
 *   track('pageview', { path, locale });  // pageview beacon(TrackPageView 用)
 *
 * visitorId:匿名隨機 uuid,存在 localStorage(非個資),用來算「不重複訪客數」。
 */

export type TrackEvent = 'pageview' | 'hire_submit' | 'quote_submit' | 'apply_submit';

const VISITOR_KEY = 'onyx_visitor_id';

/** 取匿名訪客 id;沒有就生一個存起來。SSR / 無 localStorage 環境回空字串。 */
export function getVisitorId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = window.localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      window.localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

/**
 * 送一筆埋點到 /api/track。優先用 sendBeacon(不阻塞、頁面關掉也送得出去),
 * 不支援就退回 fetch(keepalive)。全程 try/catch 靜默,失敗不拋錯。
 *
 * path/locale 不給時,自動從 window.location 推斷(事件埋點通常不用傳)。
 */
export function track(event: TrackEvent, opts?: { path?: string; locale?: string }): void {
  if (typeof window === 'undefined') return;
  try {
    const path = opts?.path ?? window.location.pathname;
    // 從路徑第一段推語系(/zh-TW/... /zh-CN/... /en 隱含),推不到就留空。
    const seg = window.location.pathname.split('/')[1];
    const locale = opts?.locale ?? (['en', 'zh-TW', 'zh-CN'].includes(seg) ? seg : '');

    const payload = JSON.stringify({ path, locale, event, visitorId: getVisitorId() });

    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([payload], { type: 'application/json' }));
    } else {
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* 靜默:埋點失敗不可影響前台 */
  }
}

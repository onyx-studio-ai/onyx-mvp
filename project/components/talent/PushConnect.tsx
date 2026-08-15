'use client';

// 「開啟瀏覽器通知」chip(網頁推播,不裝任何 app)。與 Telegram/LINE chip 同款樣式。
// server 沒設 VAPID 金鑰就不渲染。iOS 需先把網站加到主畫面才支援推播,偵測到
// iOS Safari 未安裝 PWA 時顯示提示。使用者按過「封鎖」的話瀏覽器不會再跳允許視窗,
// 顯示解鎖指引。

import { useState, useEffect, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { authedFetch } from '@/lib/authed-fetch';

type State = { configured: boolean; publicKey: string | null; subscriptions: string[] };

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function PushConnect({ tx }: { tx: (a: string, b: string, c: string) => string }) {
  const [state, setState] = useState<State | null>(null);
  const [thisDevice, setThisDevice] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const r = await authedFetch('/api/talent/push');
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return;
    setState(j as State);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = await reg?.pushManager.getSubscription();
      setThisDevice(!!sub && (j as State).subscriptions.includes(sub.endpoint));
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!state?.configured || !state.publicKey) return null; // dormant until VAPID keys set

  const chip = 'inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full transition';

  async function enable() {
    setBusy(true);
    try {
      // iOS Safari 未加入主畫面 → Notification 不存在,先給指引
      if (typeof Notification === 'undefined') {
        alert(tx('iPhone 請先用 Safari 開啟本站 → 分享 → 加入主畫面,再從主畫面開啟後回來按這裡。',
          'iPhone 请先用 Safari 打开本站 → 分享 → 添加到主屏幕,再从主屏幕打开后回来点这里。',
          'On iPhone: open this site in Safari → Share → Add to Home Screen, then open from the Home Screen and tap here again.'));
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        if (perm === 'denied') alert(tx('通知權限已被封鎖 — 請到瀏覽器網站設定把「通知」改回允許,再回來按一次。',
          '通知权限已被封锁 — 请到浏览器网站设置把「通知」改回允许,再回来点一次。',
          'Notifications are blocked — allow them in your browser site settings, then tap again.'));
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(state!.publicKey!) });
      const r = await authedFetch('/api/talent/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) });
      if (r.ok) setThisDevice(true);
    } catch { /* subscribe 失敗(私密視窗等)— 靜默 */ }
    finally { setBusy(false); load(); }
  }

  async function disable() {
    if (!window.confirm(tx('關閉此裝置的瀏覽器通知?', '关闭此设备的浏览器通知?', 'Turn off notifications on this device?'))) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await authedFetch('/api/talent/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      setThisDevice(false);
    } finally { setBusy(false); load(); }
  }

  if (thisDevice) {
    return (
      <button type="button" onClick={disable} disabled={busy}
        title={tx('此裝置已開啟瀏覽器通知 — 點擊關閉', '此设备已开启浏览器通知 — 点击关闭', 'Notifications on — click to turn off')}
        className={`${chip} bg-white/10 text-gray-400 hover:bg-white/15`}>
        <Bell className="w-3 h-3" /> {tx('瀏覽器通知已開', '浏览器通知已开', 'Notifications on')}
      </button>
    );
  }
  return (
    <button type="button" onClick={enable} disabled={busy}
      title={tx('不裝 app 也能收到案件通知(瀏覽器推播)', '不装 app 也能收到案件通知(浏览器推播)', 'Get job alerts without any app (browser push)')}
      className={`${chip} bg-amber-500 text-white hover:bg-amber-400 font-medium`}>
      <Bell className="w-3 h-3" /> {busy ? '…' : tx('開啟瀏覽器通知', '开启浏览器通知', 'Enable notifications')}
    </button>
  );
}

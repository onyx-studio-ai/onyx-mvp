/* Onyx Web Push service worker — 收推播顯示通知,點通知開後台。 */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'Onyx Studios';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/favicon-192.png',
    badge: '/favicon-192.png',
    data: { url: data.url || '/talent/opportunities' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/talent/opportunities';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if (c.url.includes('/talent') && 'focus' in c) return c.focus();
    }
    return clients.openWindow(url);
  }));
});

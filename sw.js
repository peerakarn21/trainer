// Trainer service worker — ใช้แค่แสดงการแจ้งเตือน "หมดเวลาพัก" (ไม่ได้แคชหน้าเว็บ)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

async function restInfo() {
  try {
    const c = await caches.open('trainer-rest');
    const r = await c.match('rest.json');
    return r ? await r.json() : null;
  } catch (e) { return null; }
}

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    const info = await restInfo();
    const next = info && info.next ? String(info.next).replace(/^(ท่าต่อไป|ต่อไป):\s*/, '') : '';
    await self.registration.showNotification('ถึงเวลาเล่นแล้ว 💪', {
      body: next ? `หมดเวลาพัก — ${next}` : 'หมดเวลาพัก ไปเซ็ตต่อไปได้เลย',
      tag: 'trainer-rest',
      renotify: true,
      requireInteraction: true,
      vibrate: [300, 150, 300, 150, 300],
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      data: { url: self.registration.scope + '#today' },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.registration.scope)) { try { await c.focus(); c.postMessage({ type: 'rest-open' }); return; } catch (e) {} }
    }
    await self.clients.openWindow(url);
  })());
});

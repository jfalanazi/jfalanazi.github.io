/* ورد التدبر — يعمل بدون إنترنت بعد أول فتح */
const CACHE = 'wird-v1';
const SHELL = [
  './', 'index.html', 'app.js', 'manifest.webmanifest',
  'icon.svg',
  'data/quran.json', 'data/lessons.json', 'data/teacher.json', 'data/similar.json',
];
const FONTS = [
  'https://cdn.jsdelivr.net/npm/@fontsource/amiri-quran@5.3.0/files/amiri-quran-arabic-400-normal.woff2',
  'https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-sans-arabic@5.3.0/files/ibm-plex-sans-arabic-arabic-400-normal.woff2',
  'https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-sans-arabic@5.3.0/files/ibm-plex-sans-arabic-arabic-600-normal.woff2',
  'https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-sans-arabic@5.3.0/files/ibm-plex-sans-arabic-arabic-700-normal.woff2',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // لا تُفشل التثبيت كلّه بسبب ملف واحد
    await Promise.all(SHELL.map(u => c.add(u).catch(() => {})));
    // خزّن الخطوط مرّة واحدة ليعمل المصحف بلا إنترنت
    await Promise.all(FONTS.map(u =>
      fetch(u, { mode: 'cors', credentials: 'omit' })
        .then(r => r.ok && c.put(u, r)).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);

  // لا تتدخّل في نداء واجهة المعلّم
  if (url.hostname === 'api.anthropic.com') return;

  // الخطوط: من المخزن أولًا، وإن لم تكن فيه فمن الشبكة مع تخزينها
  if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = await c.match(r);
      if (hit) return hit;
      try { const res = await fetch(r); if (res && res.ok) c.put(r, res.clone()); return res; }
      catch (err) { return new Response('', { status: 504 }); }
    })());
    return;
  }

  if (url.origin !== location.origin) return;

  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(r, { ignoreSearch: true });
    if (hit) {
      // حدّث في الخلفية
      fetch(r).then(res => { if (res && res.ok) c.put(r, res.clone()); }).catch(() => {});
      return hit;
    }
    try {
      const res = await fetch(r);
      if (res && res.ok) c.put(r, res.clone());
      return res;
    } catch (err) {
      const fallback = await c.match('index.html');
      return fallback || new Response('غير متصل', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
  })());
});

/* جاهز لإشعارات الويب المستقلة لاحقًا */
self.addEventListener('push', e => {
  let d = { title: 'ورد التدبر', body: 'حان وقت وردك اليوم.' };
  try { if (e.data) d = Object.assign(d, e.data.json()); } catch (err) {}
  e.waitUntil(self.registration.showNotification(d.title, {
    body: d.body, icon: 'icon.svg', badge: 'icon.svg',
    lang: 'ar', dir: 'rtl', tag: 'wird-daily',
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) if ('focus' in c) return c.focus();
    if (clients.openWindow) return clients.openWindow('./');
  })());
});

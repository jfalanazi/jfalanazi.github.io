/* ورد التدبر انتقل إلى https://wird-app.rubma777.workers.dev/
   هذا الملف يُبقي عنوانه القديم ليزيل نفسه من الأجهزة التي ثبّتت النسخة القديمة:
   يمسح مخزنها، يلغي تسجيله، ثم يعيد تحميل الصفحة لتظهر صفحة الانتقال. */
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    await self.registration.unregister();
    var clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(function (c) { c.navigate(c.url).catch(function () {}); });
  })());
});

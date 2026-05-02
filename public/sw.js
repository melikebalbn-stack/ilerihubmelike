/**
 * Self-destruct service worker.
 *
 * 29 Nis 2026 PWA incident sonrasi: PWA disable edildi, mevcut browser'larda
 * yuklu olan eski Workbox-tabanli SW'ler poll endpoint'lerini cache'leyip
 * kuyruk yaratiyordu. Bu kill switch eski SW'leri update mekanizmasi uzerinden
 * deregister eder, acik sayfalari reload ile temiz duruma getirir.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => {
        try {
          client.navigate(client.url);
        } catch (e) {
          // navigate engellenirse manuel reload
        }
      });
    })()
  );
});

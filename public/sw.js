// ILERIHub Service Worker — vanilla, incident-safe
// Versiyon: PR-PWA-2 (3 May 2026)
//
// Cache stratejisi:
//   - Navigation (HTML): NetworkOnly
//   - /api/*: NetworkOnly
//   - /_next/static/*: CacheFirst (immutable)
//   - /icons/*, /images/*, fonts: StaleWhileRevalidate
//   - Diğer: NetworkOnly default
//
// Push notification: subscribe edilmiş kullanıcılara push gönderildiğinde
// notification gösterir, click'te uygulamayı açar.

const CACHE_VERSION = "ilerihub-v1-2026-05-03";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;

// Install — yeni SW'yi hemen aktif et
self.addEventListener("install", () => {
  self.skipWaiting();
});

// Activate — eski cache'leri temizle, mevcut client'ları yeni SW'ye bağla
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => !name.startsWith(CACHE_VERSION))
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

// Fetch handler — kategori bazlı cache stratejisi
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Sadece GET'leri cache mantığına sok; diğer method'lar passthrough
  if (request.method !== "GET") {
    return;
  }

  // Cross-origin request'leri es geç (CDN, analytics, vs.)
  if (url.origin !== self.location.origin) {
    return;
  }

  // 1. Navigation requests (HTML page'ler) — NetworkOnly
  if (request.mode === "navigate") {
    return;
  }

  // 2. /api/* — NetworkOnly (SSE, polling dahil)
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // 3. /_next/static/* — CacheFirst (immutable build asset'leri)
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // 4. /icons/*, /images/*, font'lar — StaleWhileRevalidate
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/images/") ||
    /\.(woff2?|ttf|otf|eot)$/.test(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
    return;
  }

  // 5. Diğer her şey — NetworkOnly default
  return;
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response("", { status: 503, statusText: "Offline" });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}

// ────────────────────────────────────────────────
// Push notification handler
// ────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "ILERIHub", body: event.data.text() };
  }

  const title = payload.title || "ILERIHub";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icons/icon-192x192.png",
    badge: payload.badge || "/icons/icon-72x72.png",
    data: { url: payload.url || "/dashboard" },
    tag: payload.tag,
    renotify: !!payload.tag,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click — uygulamayı aç veya focus et
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            await client.navigate(targetUrl);
          }
          return;
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});

/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

// Push event handler - bildirim geldiğinde
self.addEventListener('push', function(event) {
  console.log('[SW] Push event received');

  if (!event.data) {
    console.log('[SW] Push event but no data');
    return;
  }

  try {
    const data = event.data.json();
    console.log('[SW] Push data:', data);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: any = {
      body: data.body || 'Yeni bildirim',
      icon: data.icon || '/icons/icon-192x192.svg',
      badge: data.badge || '/icons/icon-72x72.svg',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/messages',
        ...data.data
      },
      tag: data.tag || 'default',
      renotify: true,
      requireInteraction: false,
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'ILERIHub', options)
    );
  } catch (error) {
    console.error('[SW] Push event parse error:', error);
  }
});

// Notification click handler - bildirime tıklandığında
self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification clicked');
  event.notification.close();

  const urlToOpen = (event.notification.data?.url as string) || '/messages';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Zaten açık bir pencere varsa ona odaklan
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          client.focus();
          (client as WindowClient).navigate(urlToOpen);
          return;
        }
      }
      // Yoksa yeni pencere aç
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Notification close handler
self.addEventListener('notificationclose', function(event) {
  console.log('[SW] Notification closed:', event.notification.tag);
});

export {};

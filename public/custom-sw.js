// Custom Service Worker for Push Notifications

// Push event handler - bildirim geldiğinde
self.addEventListener('push', function(event) {
  if (!event.data) {
    console.log('Push event but no data')
    return
  }

  try {
    const data = event.data.json()

    const options = {
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
      actions: [
        { action: 'open', title: 'Aç' },
        { action: 'close', title: 'Kapat' }
      ]
    }

    event.waitUntil(
      self.registration.showNotification(data.title || 'ILERIHub', options)
    )
  } catch (error) {
    console.error('Push event parse error:', error)
  }
})

// Notification click handler - bildirime tıklandığında
self.addEventListener('notificationclick', function(event) {
  event.notification.close()

  if (event.action === 'close') {
    return
  }

  const urlToOpen = event.notification.data?.url || '/messages'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Zaten açık bir pencere varsa ona odaklan
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          client.focus()
          client.navigate(urlToOpen)
          return
        }
      }
      // Yoksa yeni pencere aç
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})

// Notification close handler
self.addEventListener('notificationclose', function(event) {
  console.log('Notification closed:', event.notification.tag)
})

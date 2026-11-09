/* Service worker de MyBrain finance: recibe notificaciones push y las muestra.
   No cachea nada a propósito: así nunca se ve una versión antigua de la app. */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (error) {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Aviso'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/app-icon/rounded/192',
      badge: '/app-icon/rounded/192',
      tag: data.tag || undefined,
      data: { url: data.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ('focus' in client) {
          client.navigate(target)
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    })
  )
})

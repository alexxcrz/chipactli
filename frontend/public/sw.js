self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // No-op service worker placeholder
});

self.addEventListener('push', (event) => {
  const data = (() => {
    try {
      return event.data ? event.data.json() : {};
    } catch {
      return { mensaje: event.data ? String(event.data.text() || '') : '' };
    }
  })();

  const titulo = String(data?.titulo || 'CHIPACTLI').trim() || 'CHIPACTLI';
  const mensaje = String(data?.mensaje || data?.body || 'Tienes una nueva notificación').trim();
  const tag = String(data?.tag || '').trim() || undefined;
  const url = String(data?.url || '/').trim() || '/';

  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: mensaje,
      tag,
      data: { url },
      icon: '/images/logo.png',
      badge: '/images/logo.png'
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = String(event?.notification?.data?.url || '/').trim() || '/';
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existente = allClients.find((client) => client.url.includes('/') && 'focus' in client);
    if (existente) {
      await existente.focus();
      return;
    }
    if (clients.openWindow) {
      await clients.openWindow(destino);
    }
  })());
});

// Service Worker para PWA - Chipactli

const CACHE_NAME = 'chipactli-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/main.js',
  '/app.js',
  '/config.js',
  '/modules/inventario.js',
  '/modules/recetas.js',
  '/modules/produccion.js',
  '/modules/ventas.js',
  '/modules/utensilios.js',
  '/modules/alertas.js',
  '/utils/api.js',
  '/utils/modales.js',
  '/utils/notificaciones.js',
  '/utils/websocket.js',
  '/images/favicon.ico',
  '/images/logo.PNG'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache abierto');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Error al cachear archivos:', error);
      })
  );
  self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Estrategia: Network First, fallback a Cache
self.addEventListener('fetch', (event) => {
  // Solo cachear peticiones GET
  if (event.request.method !== 'GET') {
    return;
  }

  // No cachear peticiones a la API, WebSocket, ni extensiones
  if (event.request.url.includes('/api/') || event.request.url.includes('ws://') || event.request.url.includes('wss://') || !event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Si la respuesta es válida, actualizar cache
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Si falla la red, intentar con cache
        return caches.match(event.request).then((response) => {
          if (response) {
            return response;
          }
          // Si no está en cache y es HTML, devolver index.html
          if (event.request.headers.get('accept').includes('text/html')) {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// Manejo de mensajes desde el cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Service Worker minimal pour permettre l'installation PWA
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pas de mise en cache complexe pour l'instant pour éviter les conflits avec Vercel/Vite
  event.respondWith(fetch(event.request));
});

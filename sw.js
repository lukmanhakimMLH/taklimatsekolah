// Service worker ringkas – membolehkan "Add to Home Screen". Tiada cache (sentiasa versi terkini).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});

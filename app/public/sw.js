// Service worker ringkas – membolehkan "Add to Home Screen". Tiada cache data (sentiasa ambil dari server).
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => self.clients.claim());
self.addEventListener('fetch', () => {});

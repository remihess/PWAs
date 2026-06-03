const CACHE_NAME = 'turnier-cache-v3';
const urlsToCache = [
  './index.html',
  './manifest.json',
  './icon.png'
];

// Installieren und Daten in den Cache laden
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Dateien werden gecacht');
        return cache.addAll(urlsToCache);
      })
  );
});

// Anfragen abfangen und aus dem Cache beantworten (Offline-Modus)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache-Treffer -> gib die gecachte Version zurück
        if (response) {
          return response;
        }
        // Kein Treffer -> lade aus dem Internet
        return fetch(event.request);
      })
  );
});
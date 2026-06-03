// ============================================================
// AuGusteau Service Worker
// Strategie: Network-First + Sofort-Aktivierung
// → Schließen & Neu öffnen der App lädt IMMER die neueste Version
// ============================================================

const CACHE_NAME = 'augusteau-cache-v8';

const ASSETS = [
    './',
    './index.html',
    './manifest.json'
];

// ── INSTALL ──────────────────────────────────────────────────
// Neue Version cachen und sofort aktivieren (kein Warten auf
// das Schließen aller Tabs nötig).
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
            .then(() => self.skipWaiting()) // ← Sofort in den "active"-Zustand
    );
});

// ── ACTIVATE ─────────────────────────────────────────────────
// Alte Caches löschen und sofort alle offenen Clients übernehmen.
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) =>
                Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => caches.delete(name))
                )
            )
            .then(() => self.clients.claim()) // ← Übernimmt laufende Seiten sofort
    );
});

// ── FETCH ────────────────────────────────────────────────────
// Network-First: immer vom Server laden, Fallback auf Cache
// (funktioniert auch offline nach dem ersten Laden).
self.addEventListener('fetch', (event) => {
    // Nur GET-Requests behandeln; API-Calls (POST etc.) immer durchlassen
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // Erfolgreiche Netzwerkantwort auch im Cache aktualisieren
                if (networkResponse && networkResponse.ok) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            })
            .catch(() => caches.match(event.request)) // Offline-Fallback
    );
});

// ── MESSAGE ──────────────────────────────────────────────────
// Ermöglicht der App, einen sofortigen SW-Wechsel zu erzwingen
// (wird beim controllerchange-Reload in index.html genutzt).
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
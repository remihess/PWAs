// GymBuddy Service Worker — Dynamic Cache (kein manuelles Versionieren nötig)
//
// Strategie: Stale-While-Revalidate
// ┌─────────────────────────────────────────────────────────────────────┐
// │  1. Anfrage kommt rein                                              │
// │  2. Antwort sofort aus dem Cache liefern (App startet blitzschnell) │
// │  3. GLEICHZEITIG im Hintergrund vom Server neu laden                │
// │  4. Cache mit der frischen Version überschreiben                    │
// │  5. → Nächster App-Start hat automatisch die aktuellen Dateien      │
// └─────────────────────────────────────────────────────────────────────┘
//
// Für index.html gilt Network-First (nicht Stale-While-Revalidate):
// Die HTML wird immer zuerst vom Server geholt und sofort angezeigt.
// Nur bei Offline-Nutzung greift der Cache als Fallback.
//
// Konsequenz: Du musst sw.js NIE mehr anfassen, wenn du index.html,
// CSS oder Icons änderst. App schließen → neu öffnen → fertig.

const CACHE_NAME = 'gymbuddy-dynamic';

// ── Install ─────────────────────────────────────────────────────────────
// Minimalst-Präcaching: Nur das HTML wird vorab gecacht, damit die App
// sofort offline-fähig ist. Der Rest kommt beim ersten Laden automatisch rein.
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.add('./index.html'))
            .then(() => self.skipWaiting())
    );
});

// ── Activate ─────────────────────────────────────────────────────────────
// Sofortige Kontrolle übernehmen. Kein Cache-Cleanup nötig — wir nutzen
// einen einzigen, immer aktuell gehaltenen Cache.
self.addEventListener('activate', event => {
    event.waitUntil(self.clients.claim());
});

// ── Fetch ─────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Externe Anfragen (GitHub API, etc.) komplett ignorieren — kein Caching
    if (url.origin !== self.location.origin) return;

    // ── HTML-Navigation: Network-First ──────────────────────────────────
    // Immer die aktuellste index.html vom Server holen.
    // Bei schlechtem Netz: gecachte Version als Fallback.
    if (request.mode === 'navigate' || request.destination === 'document') {
        event.respondWith(
            fetch(request)
                .then(networkResponse => {
                    if (networkResponse.ok) {
                        // Frische Version sofort in den Cache schreiben
                        const clone = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                    }
                    return networkResponse;
                })
                .catch(() =>
                    // Offline: Cache-Fallback (oder generisch index.html)
                    caches.match(request).then(r => r || caches.match('./index.html'))
                )
        );
        return;
    }

    // ── Alle anderen Assets: Stale-While-Revalidate ─────────────────────
    // (sw.js, manifest.json, Icons, Fonts, …)
    event.respondWith(staleWhileRevalidate(request));
});

// ── Stale-While-Revalidate Helper ────────────────────────────────────────
function staleWhileRevalidate(request) {
    return caches.open(CACHE_NAME).then(cache =>
        cache.match(request).then(cachedResponse => {

            // Hintergrund-Fetch: immer, unabhängig davon ob wir schon etwas im Cache haben
            const networkFetch = fetch(request).then(networkResponse => {
                if (networkResponse.ok) {
                    // Cache still-schweigend aktualisieren
                    cache.put(request, networkResponse.clone());
                }
                return networkResponse;
            }).catch(() => {
                // Netz nicht verfügbar – kein Problem, wir haben den Cache
            });

            // Wenn wir etwas im Cache haben: sofort liefern, Netz läuft im Hintergrund
            if (cachedResponse) {
                return cachedResponse;
            }

            // Noch nichts im Cache (erster Aufruf): auf den Netz-Request warten
            return networkFetch;
        })
    );
}

// ── Nachrichten vom Client ────────────────────────────────────────────────
self.addEventListener('message', event => {
    const data = event.data || {};

    if (data.type === 'SHOW_TIMER_NOTIFICATION') {
        self.registration.showNotification('⏰ Pause vorbei!', {
            body: data.body || 'Auf zum nächsten Set!',
            icon: './icon-192.png',
            badge: './icon-192.png',
            tag: 'gymbuddy-timer',
            renotify: true,
            requireInteraction: false,
            vibrate: [200, 100, 200, 100, 400],
            data: { url: './index.html' }
        });
    }

    if (data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// ── Notification-Klick ───────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
    event.notification.close();
    const targetUrl = (event.notification.data && event.notification.data.url) || './';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientList => {
                for (const client of clientList) {
                    if ('focus' in client) return client.focus();
                }
                if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
            })
    );
});
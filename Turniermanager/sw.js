const scope = self.registration.scope;
const CACHE_PREFIX = 'turniermanager-' + scope + '-';
const CACHE_NAME = CACHE_PREFIX + 'v4';
const INDEX_URL = new URL('index.html', scope).href;
const APP_SHELL = ['index.html', 'tournament.js', 'manifest.json', 'icon.png']
    .map(path => new URL(path, scope).href);

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(APP_SHELL.map(url => new Request(url, { cache: 'reload' })));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names.filter(name => name === 'turnier-cache-v3' ||
            (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)).map(name => caches.delete(name)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    const path = url.origin + url.pathname;
    const entry = request.mode === 'navigate' && (path === scope || path === INDEX_URL);
    if (!entry && !APP_SHELL.includes(path)) return;

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(entry ? INDEX_URL : path)) || fetch(request);
    })());
});

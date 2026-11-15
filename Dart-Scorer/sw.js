const CACHE_NAME = 'dartpro-cache-dynamic-v6';
const APP_FILES = ['./', './index.html', './manifest.json', './icon.png', './dartpro-data.json'];
const APP_URLS = new Set(APP_FILES.map(path => new URL(path, self.registration.scope).href));

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key.startsWith('dartpro-cache-dynamic-') && key !== CACHE_NAME)
            .map(key => caches.delete(key)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    const navigation = request.mode === 'navigate' && url.href.startsWith(self.registration.scope);
    if (request.method !== 'GET' || (!navigation && !APP_URLS.has(url.href))) return;

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        let response;
        try {
            response = await fetch(request, { cache: 'no-cache' });
            if (response.ok) {
                try { await cache.put(request, response.clone()); } catch (error) {}
                return response;
            }
        } catch (error) {}
        return await cache.match(request)
            || (navigation && await cache.match('./index.html'))
            || response
            || Response.error();
    })());
});

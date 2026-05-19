const CACHE_NAME = 'flor-app-v2';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './manifest.json',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap'
];

// Instalação do Service Worker - Fazer cache dos ficheiros críticos
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Cache Aberto');
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
    self.skipWaiting(); // Força o SW a ativar-se imediatamente
});

// Ativação e Limpeza de caches antigas
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('Service Worker: A limpar cache antiga', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// Estratégia de Fetch: Stale-While-Revalidate
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            const fetchPromise = fetch(event.request).then(networkResponse => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                console.log('SW: Modo offline ativado. Falha de rede mitigada.');
            });

            // Retorna imediatamente da cache se existir, em paralelo atualiza a cache com a versão da net
            return cachedResponse || fetchPromise;
        })
    );
});

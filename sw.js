const CACHE_NAME = 'flor-app-v1';
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

// Estratégia de Fetch: Cache First, fallback to Network (100% Offline Focus)
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Se encontrar na cache, devolve
                if (response) {
                    return response;
                }
                
                // Se não encontrar, tenta buscar na rede (e adiciona à cache opcionalmente)
                return fetch(event.request).then(
                    function(response) {
                        // Verifica se a resposta é válida
                        if(!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        var responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(function(cache) {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    }
                );
            }).catch(() => {
                // Fallback de emergência (ex: se tentar aceder a ficheiros de rede sem internet e não estiver em cache)
                console.log('Service Worker: Fetch falhou, modo estritamente offline.');
            })
    );
});

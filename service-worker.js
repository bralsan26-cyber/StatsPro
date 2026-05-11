/* StatsPro — Service Worker
   Cache strategy: Cache First para assets estáticos
   Network First para o HTML principal (dados sempre frescos)
*/

const CACHE_NAME = 'statspro-v1';
const CACHE_STATIC = [
  '/StatsPro/',
  '/StatsPro/index.html',
  '/StatsPro/manifest.json',
  '/StatsPro/icon-192.svg',
  '/StatsPro/icon-512.svg',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600;700;800&display=swap',
];

// Instala e faz cache dos assets estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching static assets...');
      return cache.addAll(CACHE_STATIC.map(url => new Request(url, { mode: 'no-cors' })));
    })
  );
  self.skipWaiting();
});

// Ativa e limpa caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      )
    )
  );
  self.clients.claim();
});

// Estratégia: Network First para o HTML (dados sempre atualizados)
// Cache First para fontes e outros assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // HTML principal — tenta rede primeiro, cai no cache se offline
  if (event.request.mode === 'navigate' ||
      url.pathname.endsWith('.html') ||
      url.pathname === '/StatsPro/') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Atualiza cache com versão mais recente
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // Offline — retorna do cache
          return caches.match(event.request).then(cached => {
            if (cached) return cached;
            // Fallback offline page
            return new Response(
              `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
               <meta name="viewport" content="width=device-width,initial-scale=1">
               <title>StatsPro — Offline</title>
               <style>
                 body{margin:0;background:#0a0c10;color:#e8eaf0;font-family:sans-serif;
                      display:flex;flex-direction:column;align-items:center;
                      justify-content:center;height:100vh;text-align:center;padding:24px}
                 h1{color:#00e5a0;font-size:48px;letter-spacing:4px;margin-bottom:8px}
                 p{color:#5a6278;font-size:16px;max-width:320px;line-height:1.6}
               </style></head>
               <body>
                 <h1>STATSPRO</h1>
                 <p>Você está offline.<br>Conecte-se à internet para acessar os dados mais recentes.</p>
               </body></html>`,
              { headers: { 'Content-Type': 'text/html' } }
            );
          });
        })
    );
    return;
  }

  // Outros assets — Cache First
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});

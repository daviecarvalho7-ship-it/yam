// Ao publicar mudanças, aumente a versão para limpar o cache antigo.
const CACHE_NAME = "yam-cache-v24";
const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./familia.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  "./favicon-32.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE.map(file => new Request(file, { cache: "reload" }))))
  );
  // Ativa a nova versão sem esperar todas as abas fecharem.
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Rede primeiro: com internet, sempre pega a versão mais nova e atualiza o cache.
// Sem internet, usa o que estiver salvo.
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  // só cuida dos arquivos do próprio app (Firebase e afins vão direto para a rede)
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request, { cache: "no-cache" }) // sempre confere com o servidor se há versão nova
      .then(response => {
        if (response.ok && new URL(event.request.url).origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request, { ignoreSearch: true })
          .then(cached => cached || caches.match("./index.html"))
      )
  );
});

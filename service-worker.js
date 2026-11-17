// O YAM mudou para https://jogo-yam.github.io/
// Este service worker só existe para apagar o cache do app antigo e se desligar.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", evento => {
  evento.waitUntil((async () => {
    for (const chave of await caches.keys()) await caches.delete(chave);
    await self.registration.unregister();
  })());
});

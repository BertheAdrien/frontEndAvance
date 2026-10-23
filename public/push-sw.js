// Chargé par le service worker généré (workbox.importScripts dans vite.config.ts).
// Affiche les notifications « nouveau niveau débloqué » envoyées par le serveur.

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // Charge utile illisible : notification générique.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Breach Academy', {
      body: payload.body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      lang: 'fr',
      data: { url: payload.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Seuls les chemins du site sont ouverts : une URL absolue venue de la charge utile est ignorée.
  const url = new URL(event.notification.data?.url || '/', self.location.origin);
  const target = url.origin === self.location.origin ? url.href : self.location.origin;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url.startsWith(self.location.origin));
      return open ? open.navigate(target).then((client) => client?.focus()) : self.clients.openWindow(target);
    }),
  );
});

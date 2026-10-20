// Service worker de Routines : rappels (Web Push) et fonctionnement hors ligne.
// Réseau d'abord : à chaque ouverture, la dernière version publiée est chargée ;
// la copie en cache ne sert que sans connexion.

const CACHE = "routines-cache";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.status === 200) {
          const copie = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copie));
        }
        return res;
      })
      .catch(async () => (await caches.match(req)) || (req.mode === "navigate" ? caches.match("/") : Response.error())),
  );
});

self.addEventListener("push", (e) => {
  let d = { title: "Routines", body: "", url: "/" };
  try {
    d = { ...d, ...e.data.json() };
  } catch {}
  e.waitUntil(
    self.registration.showNotification(d.title, {
      body: d.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: d.url },
    }),
  );
});

// Toucher la notification ouvre l'appli sur l'onglet concerné.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "/", self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (fenetres) => {
      for (const f of fenetres) {
        try {
          // Pas de navigation : un rechargement garderait la base verrouillée un instant.
          // L'appli reçoit l'adresse et change d'écran elle-même (lib/pwa-web.ts).
          await f.focus();
          return f.postMessage({ ouvrir: new URL(url).pathname });
        } catch {}
      }
      return self.clients.openWindow(url);
    }),
  );
});

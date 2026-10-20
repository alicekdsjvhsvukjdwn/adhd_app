/**
 * Démarrage de la version web : service worker (rappels, hors ligne, mises à jour)
 * et demande de stockage persistant pour que le navigateur ne vide pas la base.
 */
export function demarrerPwa(ouvrir: (chemin: string) => void): void {
  // navigator.storage.persist() : sans effet visible si déjà accordé ou refusé en silence.
  navigator.storage?.persist?.().catch(() => {});

  // Toucher une notification, appli ouverte : le service worker nous dit où aller.
  navigator.serviceWorker?.addEventListener("message", (e) => {
    if (typeof e.data?.ouvrir === "string") ouvrir(e.data.ouvrir);
  });

  // Pas de service worker en développement : il garderait d'anciennes pages en cache.
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker
    .register("/sw.js")
    .then((reg) => {
      // À chaque retour dans l'appli, on regarde si une nouvelle version est publiée.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update().catch(() => {});
      });
    })
    .catch(() => {});
}

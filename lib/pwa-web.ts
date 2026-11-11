/**
 * Démarrage de la version web : service worker (rappels, hors ligne, mises à jour)
 * et demande de stockage persistant pour que le navigateur ne vide pas la base.
 */
/**
 * iPhone, appli installée : la page est plus haute que la fenêtre, de la hauteur de la barre d'état
 * (voir scripts/build-web.mjs). Quand un champ de saisie prend le focus, Safari fait défiler la page pour
 * le montrer et la laisse décalée une fois le clavier fermé : le haut de l'écran (« ← Retour », le titre)
 * reste sous la barre d'état. On remet la page en place dès qu'aucun champ n'a plus le focus.
 */
function garderLaPageEnHaut(): void {
  const saisieEnCours = () => ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName ?? "");
  const remettre = () => {
    if (!saisieEnCours() && (window.scrollY !== 0 || window.scrollX !== 0)) window.scrollTo(0, 0);
  };
  // Le délai laisse le focus passer d'un champ au suivant sans faire sauter la page.
  document.addEventListener("focusout", () => setTimeout(remettre, 100));
  window.addEventListener("scroll", remettre, { passive: true });
  window.visualViewport?.addEventListener("resize", remettre);
}

export function demarrerPwa(ouvrir: (chemin: string) => void): void {
  garderLaPageEnHaut();

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

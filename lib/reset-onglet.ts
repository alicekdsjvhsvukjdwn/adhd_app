import { useEffect, useState } from "react";

/**
 * Toucher l'onglet déjà ouvert le ramène à son accueil. Le layout des onglets appelle
 * `resetOnglet(nom)` ; chaque écran d'onglet se remonte quand sa clé change (feuilles fermées,
 * première sous-partie, haut de page). Changer d'onglet ne passe pas par ici : l'état est gardé.
 */
const abonnes = new Map<string, Set<() => void>>();

export function resetOnglet(nom: string): void {
  abonnes.get(nom)?.forEach((f) => f());
}

/** Clé à poser sur le contenu de l'onglet : elle change à chaque retour à l'accueil. */
export function useCleReset(nom: string): number {
  const [cle, setCle] = useState(0);
  useEffect(() => {
    const f = () => setCle((c) => c + 1);
    if (!abonnes.has(nom)) abonnes.set(nom, new Set());
    abonnes.get(nom)!.add(f);
    return () => {
      abonnes.get(nom)?.delete(f);
    };
  }, [nom]);
  return cle;
}

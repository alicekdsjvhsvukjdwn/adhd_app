/**
 * Minuteur de « Je commence », sans accès au téléphone : testable seul
 * (tests/etape3b.test.mjs).
 *
 * Tout se calcule à partir d'instants (millisecondes) : l'heure de départ et
 * l'heure de fin prévue. Aucun compteur n'est décrémenté, donc rien ne se perd
 * quand l'appli passe en arrière-plan ou que l'écran se verrouille.
 */

/** Sans durée connue : 5 minutes, « juste pour voir ». */
export const DUREE_PAR_DEFAUT_MIN = 5;
/** « Encore un peu » : petit, comme le démarrage. */
export const PROLONGATION_MIN = 5;
const DUREES_DE_BASE = [5, 15, 25];

const MINUTE = 60_000;

/** Comment la session s'est terminée, enregistré tel quel dans event_log. */
export type Sortie = "fait" | "arret" | "retour";

export function dureeParDefaut(dureeTacheMin: number | null): number {
  return dureeTacheMin != null && dureeTacheMin > 0
    ? dureeTacheMin
    : DUREE_PAR_DEFAUT_MIN;
}

/** Puces proposées : 5, 15, 25, plus la durée de la tâche si elle est autre. */
export function dureesProposees(dureeTacheMin: number | null): number[] {
  const d = dureeParDefaut(dureeTacheMin);
  return [...new Set([...DUREES_DE_BASE, d])].sort((a, b) => a - b);
}

export function finPrevue(debutMs: number, dureeMin: number): number {
  return debutMs + dureeMin * MINUTE;
}

/** Temps restant, jamais négatif. */
export function restantMs(finMs: number, maintenantMs: number): number {
  return Math.max(0, finMs - maintenantMs);
}

/**
 * « Encore un peu » : 5 minutes de plus à partir de maintenant si la fin est
 * passée, à partir de la fin prévue sinon (on ne perd pas le temps restant).
 */
export function prolonger(finMs: number, maintenantMs: number): number {
  return Math.max(finMs, maintenantMs) + PROLONGATION_MIN * MINUTE;
}

/** Durée réellement passée, arrondie à la minute (0 pour un arrêt rapide). */
export function minutesEcoulees(debutMs: number, maintenantMs: number): number {
  return Math.max(0, Math.round((maintenantMs - debutMs) / MINUTE));
}

/** « 4:05 ». Arrondi à la seconde supérieure : 0:00 seulement quand c'est fini. */
export function formatRestant(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

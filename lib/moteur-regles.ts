/**
 * Règles du moteur sans accès à la base : testables seules
 * (tests/etape2.test.mjs).
 */

/** Poids de départ. Somme = 1, donc le score reste dans [0, 1]. */
export const POIDS = {
  importance: 0.25,
  moment: 0.2,
  equilibre: 0.2,
  etat: 0.15,
  urgence: 0.12,
  negligence: 0.08,
} as const;

/**
 * Le moteur ne lit aucune énergie : la composante État est constante.
 * Elle garde son poids pour que les scores restent comparables à ceux
 * déjà enregistrés dans decision_log, et ne change pas l'ordre du classement.
 */
export const ETAT_NEUTRE = 0.5;

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export type ComposantesScore = Record<keyof typeof POIDS, number>;

export function scoreTotal(c: ComposantesScore): number {
  return (Object.keys(POIDS) as (keyof typeof POIDS)[]).reduce(
    (s, k) => s + c[k] * POIDS[k],
    0,
  );
}

/** Raison affichée quand aucune composante ne se distingue. */
export const RAISON_PAR_DEFAUT = "À faire quand tu peux";

/**
 * Phrase courte « pourquoi celle-là », tirée de la composante qui pèse le plus.
 * La composante État, constante, n'est jamais une raison.
 */
export function raisonDominante(c: ComposantesScore): string {
  const contributions: [number, string][] = [
    [c.urgence * POIDS.urgence, "Échéance proche"],
    [c.importance * POIDS.importance, "Important pour toi"],
    [c.moment * POIDS.moment, "C'est le bon moment"],
    [c.equilibre * POIDS.equilibre, "Pour varier les domaines"],
    [c.negligence * POIDS.negligence, "Pas fait depuis un moment"],
  ];
  contributions.sort((a, b) => b[0] - a[0]);
  return contributions[0][0] > 0 ? contributions[0][1] : RAISON_PAR_DEFAUT;
}

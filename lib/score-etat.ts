/**
 * Composante « État » du moteur, sans accès à la base : testable seule
 * (tests/etape1.test.mjs).
 *
 * Plus de difficulté saisie par tâche : le coût d'une tâche se lit
 * seulement dans sa durée estimée, facultative. Sans durée, neutre.
 */

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Coût d'une tâche dans [0, 1] : 1 h ou plus = plein. Neutre (0.5) sans durée. */
export function coutTache(dureeMin: number | null): number {
  if (dureeMin == null) return 0.5;
  return clamp01(dureeMin / 60);
}

/**
 * Adéquation entre le coût de la tâche et l'énergie du moment (1 à 3, ou null).
 * Tant que le coût tient dans la capacité, score plein ; au-delà, on pénalise l'écart.
 */
export function scoreEtat(dureeMin: number | null, energie: number | null): number {
  const energieNorm = energie == null ? 0.5 : clamp01((energie - 1) / 2);
  return clamp01(1 - Math.max(0, coutTache(dureeMin) - energieNorm));
}

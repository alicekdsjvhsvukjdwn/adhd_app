/**
 * Requête de modification d'un item, sans accès à la base : testable seule
 * contre une vraie base SQLite (tests/etape3.test.mjs).
 *
 * Seule la table items est touchée : complétions, étapes et observations
 * restent attachées à l'item.
 */

/** Champs qu'on peut corriger depuis l'écran de modification. */
export const CHAMPS_MODIFIABLES = [
  "nom",
  "type",
  "statut",
  "recurrence",
  "categorie",
  "moment",
  "duree_min",
  "premiere_action",
  "importance",
  "echeance",
  "version_courte",
  "version_longue",
  "effort",
  "ancre_id",
  "ancre_position",
] as const;

export type ChampModifiable = (typeof CHAMPS_MODIFIABLES)[number];

/** null si aucun champ autorisé n'est passé (rien à écrire). */
export function requeteModification(
  id: number,
  champs: Partial<Record<ChampModifiable, string | number | null>>,
  horodatage: string,
): { sql: string; params: (string | number | null)[]; cles: ChampModifiable[] } | null {
  const cles = CHAMPS_MODIFIABLES.filter((c) => c in champs);
  if (cles.length === 0) return null;
  return {
    sql: `UPDATE items SET ${cles.map((c) => `${c} = ?`).join(", ")}, maj_le = ? WHERE id = ?`,
    params: [...cles.map((c) => champs[c] ?? null), horodatage, id],
    cles,
  };
}

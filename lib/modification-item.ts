/**
 * Requêtes de modification et de suppression d'un item, sans accès à la
 * base : testables seules contre une vraie base SQLite (tests/etape3.test.mjs).
 *
 * Une modification ne touche que la table items : complétions, étapes et
 * observations restent attachées à l'item.
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
  "effort",
  "ancre_id",
  "ancre_position",
  "liste_id",
  "jours",
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

/**
 * Nom d'une routine après un changement de variante du catalogue : celui
 * de la nouvelle variante, sauf si la personne l'avait renommée.
 */
export function nomApresVariante(
  nomActuel: string,
  libelleActuel: string | null,
  libelleCible: string,
): string {
  return libelleActuel !== null && nomActuel.trim() === libelleActuel.trim()
    ? libelleCible
    : nomActuel;
}

/**
 * Supprimer un item (paramètre : son id). Gardés pour l'analyse :
 * completions, decision_log, event_log.
 */
export const SQL_SUPPRESSION_ITEM = [
  "DELETE FROM etapes_cochees WHERE item_id = ?",
  "DELETE FROM etapes WHERE item_id = ?",
  "DELETE FROM notes WHERE item_id = ?",
  "DELETE FROM suggestions WHERE item_id = ?",
  "DELETE FROM sessions WHERE item_id = ?",
  "DELETE FROM items WHERE id = ?",
] as const;

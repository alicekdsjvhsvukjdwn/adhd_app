import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";

/**
 * « Jour difficile » = l'énergie du jour choisie à 🪫 sur Routines.
 * Une seule clé (meta energie_routines:AAAA-MM-JJ), écrite par energie.ts :
 * le lendemain, rien n'est choisi.
 *
 * Effets (dans les écrans) : étapes essentielles seulement, routines
 * exigeantes mises de côté, une seule tâche proposée, pas de suggestion.
 * Les anciennes clés jour_difficile:… restent en base comme historique.
 */

export const cleEnergie = (date: string = getAujourdhui()) => `energie_routines:${date}`;

export async function estJourDifficile(jour?: string): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ valeur: string }>(
    "SELECT valeur FROM meta WHERE cle = ?",
    cleEnergie(jour),
  );
  return row?.valeur === "1";
}

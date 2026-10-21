import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";

export type Composantes = {
  urgence: number;
  importance: number;
  moment: number;
  equilibre: number;
  etat: number;
  negligence: number;
  /**
   * Retard de la liste sur son objectif (0 à 1), pour l'analyse. Hors poids :
   * il ne compte qu'à travers l'urgence (plafonné), et pas un jour difficile.
   * Absent si la liste n'a pas d'objectif.
   */
  retard_liste?: number;
  /** Poids utilisés pour « Mes 3 » (curseurs échéance / priorité), quand la décision vient de là. */
  poids_trois?: Record<string, number>;
};

export type Decision = {
  itemId: number;
  score: number;
  composantes: Composantes;
  rang: number;
  propose: boolean;
  exploration: boolean;
  raison: string;
};

/**
 * Enregistre ce que le moteur a proposé et pourquoi.
 * Sans ce journal, impossible de déboguer le tri ni de mesurer s'il aide.
 */
export async function logDecisions(
  decisions: Decision[],
  etatEnergie: number | null = null,
) {
  const db = await getDatabase();
  const horodatage = new Date().toISOString();
  const date = getAujourdhui();

  for (const d of decisions) {
    await db.runAsync(
      `INSERT INTO decision_log (
        horodatage, date, item_id, score, composantes,
        rang, propose, exploration, raison, etat_energie
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      horodatage,
      date,
      d.itemId,
      d.score,
      JSON.stringify(d.composantes),
      d.rang,
      d.propose ? 1 : 0,
      d.exploration ? 1 : 0,
      d.raison,
      etatEnergie,
    );
  }
}


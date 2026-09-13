import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";

export type Composantes = {
  urgence: number;
  importance: number;
  moment: number;
  etat: number;
  negligence: number;
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

/**
 * Métrique principale : parmi ce qui a été proposé dans le top 3,
 * quelle proportion a effectivement été faite le jour même.
 */
export async function tauxReussiteDesPropositions(jours = 14): Promise<number> {
  const db = await getDatabase();
  const debut = new Date(Date.now() - jours * 86400000)
    .toISOString()
    .split("T")[0];

  const row = await db.getFirstAsync<{ proposes: number; faits: number }>(
    `SELECT
       COUNT(DISTINCT d.date || '-' || d.item_id) AS proposes,
       COUNT(DISTINCT CASE WHEN c.id IS NOT NULL
             THEN d.date || '-' || d.item_id END) AS faits
     FROM decision_log d
     LEFT JOIN completions c ON c.item_id = d.item_id AND c.date = d.date
     WHERE d.propose = 1 AND d.date >= ?`,
    debut,
  );

  if (!row || row.proposes === 0) return 0;
  return row.faits / row.proposes;
}

/** Ce que le moteur a proposé aujourd'hui, pour l'explication "pourquoi celui-là". */
export async function decisionsDuJour() {
  const db = await getDatabase();
  return db.getAllAsync<{
    item_id: number;
    score: number;
    composantes: string;
    rang: number;
    raison: string;
    exploration: number;
  }>(
    `SELECT item_id, score, composantes, rang, raison, exploration
     FROM decision_log
     WHERE date = ? AND propose = 1
     ORDER BY horodatage DESC, rang`,
    getAujourdhui(),
  );
}

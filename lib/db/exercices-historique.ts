import type { Exercice } from "../exercices";
import { getDatabase } from "./client";

/**
 * Mon historique d'un exercice : ce qui a été noté dans les séries (une série = ce que j'ai vraiment fait)
 * et les séances guidées où il est passé. Les séries d'un skill portent le nom de l'exercice quand c'est le
 * même mouvement ; le reste se remplit avec les séances.
 */

export type SeanceExercice = { date: string; series: number; meilleure: number };

export type HistoriqueExercice = {
  unite: "reps" | "s";
  /** Les plus récentes d'abord. */
  dernieres: SeanceExercice[];
  /** Meilleure série jamais notée. */
  record: { valeur: number; date: string } | null;
  /** Le meilleur de chaque séance, de la plus ancienne à la plus récente (8 au plus). */
  courbe: { date: string; valeur: number }[];
  /** Séances guidées où l'exercice est passé. */
  guidees: { fois: number; derniere: string | null };
};

export async function historiqueExercice(e: Exercice): Promise<HistoriqueExercice> {
  const db = await getDatabase();
  const lignes = await db.getAllAsync<{ date: string; realise: number; unite: string }>(
    `SELECT COALESCE(se.fin, se.debut, se.date) AS quand, se.date AS date, s.realise AS realise, s.unite AS unite
     FROM series s JOIN seances se ON se.id = s.seance_id
     WHERE s.exercice = ? AND s.realise > 0
     ORDER BY se.date, s.seance_id, s.numero`,
    e.nom,
  );
  const parJour = new Map<string, number[]>();
  for (const l of lignes) parJour.set(l.date, [...(parJour.get(l.date) ?? []), l.realise]);
  const seances: SeanceExercice[] = [...parJour.entries()]
    .map(([date, v]) => ({ date, series: v.length, meilleure: Math.max(...v) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const meilleure = seances.reduce<SeanceExercice | null>((m, s) => (!m || s.meilleure > m.meilleure ? s : m), null);

  const guidees = await db.getAllAsync<{ date: string }>(
    "SELECT date FROM seances_guidees WHERE (',' || exercices || ',') LIKE ? ORDER BY date",
    `%,${e.id},%`,
  );
  return {
    unite: e.mode === "s" ? "s" : "reps",
    dernieres: [...seances].reverse().slice(0, 5),
    record: meilleure ? { valeur: meilleure.meilleure, date: meilleure.date } : null,
    courbe: seances.slice(-8).map((s) => ({ date: s.date, valeur: s.meilleure })),
    guidees: { fois: guidees.length, derniere: guidees.at(-1)?.date ?? null },
  };
}

import type { Exercice } from "../exercices";
import { faitMieux, meilleurePerf, type Perf } from "../seances-sport";
import { getDatabase } from "./client";

/**
 * Mon historique d'un exercice : ce qui a été noté dans les séries (une série = ce que j'ai vraiment fait,
 * avec son poids) et les séances guidées où il est passé. Les séries d'un skill portent le nom de l'exercice
 * quand c'est le même mouvement : elles comptent aussi.
 */

export type SeanceExercice = { date: string; series: number; meilleure: number; poids: number | null };

export type HistoriqueExercice = {
  unite: "reps" | "s";
  /** Les plus récentes d'abord. */
  dernieres: SeanceExercice[];
  /** Meilleure performance jamais notée : la plus lourde, puis la plus longue. */
  record: { valeur: number; poids: number | null; date: string } | null;
  /** Le meilleur de chaque séance (le poids pour un exercice avec poids), de la plus ancienne à la plus récente (8 au plus). */
  courbe: { date: string; valeur: number }[];
  /** Séances guidées où l'exercice est passé. */
  guidees: { fois: number; derniere: string | null };
};

export async function historiqueExercice(e: Exercice): Promise<HistoriqueExercice> {
  const db = await getDatabase();
  const lignes = await db.getAllAsync<{ date: string; realise: number; poids: number | null }>(
    `SELECT se.date AS date, s.realise AS realise, s.poids AS poids
     FROM series s JOIN seances se ON se.id = s.seance_id
     WHERE (s.exercice_id = ? OR (s.exercice_id = '' AND s.exercice = ?)) AND s.realise > 0
     ORDER BY se.date, s.seance_id, s.numero`,
    e.id,
    e.nom,
  );
  const parJour = new Map<string, Perf[]>();
  for (const l of lignes) parJour.set(l.date, [...(parJour.get(l.date) ?? []), { realise: l.realise, poids: l.poids }]);
  const seances = [...parJour.entries()]
    .map(([date, perfs]) => {
      const m = meilleurePerf(perfs)!;
      return { date, series: perfs.length, meilleure: m.realise, poids: m.poids };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const record = seances.reduce<SeanceExercice | null>((m, s) => (!m || faitMieux({ realise: s.meilleure, poids: s.poids }, { realise: m.meilleure, poids: m.poids }) ? s : m), null);

  const guidees = await db.getAllAsync<{ date: string }>(
    "SELECT date FROM seances_guidees WHERE (',' || exercices || ',') LIKE ? ORDER BY date",
    `%,${e.id},%`,
  );
  return {
    unite: e.mode === "s" ? "s" : "reps",
    dernieres: [...seances].reverse().slice(0, 5),
    record: record ? { valeur: record.meilleure, poids: record.poids, date: record.date } : null,
    courbe: seances.slice(-8).map((s) => ({ date: s.date, valeur: e.mode === "reps_poids" && s.poids ? s.poids : s.meilleure })),
    guidees: { fois: guidees.length, derniere: guidees.at(-1)?.date ?? null },
  };
}

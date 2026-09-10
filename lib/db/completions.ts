import { getDatabase } from "./client";

export type RoutineAvecStatut = {
  id: number;
  nom: string;
  faitAujourdhui: boolean;
  ancre_id: number | null;
  ancre_nom: string | null;
  ancre_moment: string | null;
  ancre_position: "avant" | "apres" | null;
};

export async function initCompletions() {
  const db = await getDatabase();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      routine_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      statut TEXT NOT NULL DEFAULT 'complet',
      UNIQUE(routine_id, date)
    );
  `);
}

export function getAujourdhui(): string {
  return new Date().toISOString().split("T")[0];
}

export async function getRoutinesAvecStatutDuJour(): Promise<
  RoutineAvecStatut[]
> {
  await initCompletions();
  const db = await getDatabase();
  const aujourdhui = getAujourdhui();
  const rows = await db.getAllAsync<{
    id: number;
    nom: string;
    date: string | null;
    ancre_id: number | null;
    ancre_nom: string | null;
    ancre_moment: string | null;
    ancre_position: "avant" | "apres" | null;
  }>(
    `SELECT r.id, r.nom, r.ancre_id, r.ancre_position, a.nom as ancre_nom, a.moment as ancre_moment, c.date
     FROM routines r
     LEFT JOIN ancres a ON a.id = r.ancre_id
     LEFT JOIN completions c ON c.routine_id = r.id AND c.date = ?
     ORDER BY
       CASE a.moment
         WHEN 'matin' THEN 1
         WHEN 'midi' THEN 2
         WHEN 'apres_midi' THEN 3
         WHEN 'soir' THEN 4
         ELSE 5
       END,
       r.id`,
    aujourdhui,
  );
  return rows.map((r) => ({
    id: r.id,
    nom: r.nom,
    faitAujourdhui: r.date !== null,
    ancre_id: r.ancre_id,
    ancre_nom: r.ancre_nom,
    ancre_moment: r.ancre_moment,
    ancre_position: r.ancre_position,
  }));
}

export async function toggleCompletionAujourdhui(
  routineId: number,
  estActuellementFaite: boolean,
) {
  await initCompletions();
  const db = await getDatabase();
  const aujourdhui = getAujourdhui();
  const heure = new Date().getHours();
  const jourSemaine = new Date().getDay();

  if (estActuellementFaite) {
    await db.runAsync(
      "DELETE FROM completions WHERE routine_id = ? AND date = ?",
      routineId,
      aujourdhui,
    );
    const { addPoints } = await import("./stats");
    await addPoints(-10);
    const { logEvent } = await import("./events");
    await logEvent("routine_decochee", routineId, { heure, jourSemaine });
  } else {
    await db.runAsync(
      "INSERT OR IGNORE INTO completions (routine_id, date, statut) VALUES (?, ?, ?)",
      routineId,
      aujourdhui,
      "complet",
    );
    const { addPoints } = await import("./stats");
    await addPoints(10);
    const { logEvent } = await import("./events");
    await logEvent("routine_completee", routineId, { heure, jourSemaine });
  }
}

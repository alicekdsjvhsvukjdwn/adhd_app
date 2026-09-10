import { getDatabase } from "./client";

export type RoutineAvecStatut = {
  id: number;
  nom: string;
  faitAujourdhui: boolean;
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
  }>(
    `SELECT r.id, r.nom, c.date
     FROM routines r
     LEFT JOIN completions c ON c.routine_id = r.id AND c.date = ?`,
    aujourdhui,
  );
  return rows.map((r) => ({
    id: r.id,
    nom: r.nom,
    faitAujourdhui: r.date !== null,
  }));
}

export async function toggleCompletionAujourdhui(
  routineId: number,
  estActuellementFaite: boolean,
) {
  await initCompletions();
  const db = await getDatabase();
  const aujourdhui = getAujourdhui();
  if (estActuellementFaite) {
    await db.runAsync(
      "DELETE FROM completions WHERE routine_id = ? AND date = ?",
      routineId,
      aujourdhui,
    );
    const { addPoints } = await import("./stats");
    await addPoints(-10);
  } else {
    await db.runAsync(
      "INSERT OR IGNORE INTO completions (routine_id, date, statut) VALUES (?, ?, ?)",
      routineId,
      aujourdhui,
      "complet",
    );
    const { addPoints } = await import("./stats");
    await addPoints(10);
  }
}

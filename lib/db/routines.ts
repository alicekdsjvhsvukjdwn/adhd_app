import { getDatabase } from "./client";

export type Routine = {
  id: number;
  nom: string;
  fait: number;
  ancre_id: number | null;
  ancre_position: "avant" | "apres" | null;
};

export type RoutineAvecAncre = Routine & {
  ancre_nom: string | null;
  ancre_moment: string | null;
};

export async function initRoutines() {
  const db = await getDatabase();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS routines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      fait INTEGER NOT NULL DEFAULT 0,
      ancre_id INTEGER
    );
  `);
  try {
    await db.execAsync("ALTER TABLE routines ADD COLUMN ancre_id INTEGER");
  } catch {
    // La colonne existe déjà
  }
  try {
    await db.execAsync(
      "ALTER TABLE routines ADD COLUMN ancre_position TEXT DEFAULT 'apres'",
    );
  } catch {
    // La colonne existe déjà
  }
  const existing = await db.getAllAsync<Routine>("SELECT * FROM routines");
  if (existing.length === 0) {
    await db.runAsync(
      "INSERT INTO routines (nom, fait) VALUES (?, ?)",
      "Boire un verre d'eau",
      0,
    );
    await db.runAsync(
      "INSERT INTO routines (nom, fait) VALUES (?, ?)",
      "Faire le lit",
      0,
    );
    await db.runAsync(
      "INSERT INTO routines (nom, fait) VALUES (?, ?)",
      "Sortir 10 min",
      0,
    );
  }
}

export async function getRoutines(): Promise<Routine[]> {
  const db = await getDatabase();
  return db.getAllAsync<Routine>("SELECT * FROM routines");
}

export async function getRoutinesAvecAncre(): Promise<RoutineAvecAncre[]> {
  const db = await getDatabase();
  return db.getAllAsync<RoutineAvecAncre>(
    `SELECT r.*, a.nom as ancre_nom, a.moment as ancre_moment
     FROM routines r
     LEFT JOIN ancres a ON a.id = r.ancre_id`,
  );
}

export async function addRoutine(
  nom: string,
  ancreId: number | null = null,
  position: "avant" | "apres" = "apres",
) {
  const db = await getDatabase();
  const result = await db.runAsync(
    "INSERT INTO routines (nom, fait, ancre_id, ancre_position) VALUES (?, ?, ?, ?)",
    nom,
    0,
    ancreId,
    position,
  );
  const { logEvent } = await import("./events");
  await logEvent("routine_ajoutee", result.lastInsertRowId, {
    nom,
    ancre_id: ancreId,
    position,
  });
}

export async function updateRoutineAncre(
  id: number,
  ancreId: number | null,
  position: "avant" | "apres",
) {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE routines SET ancre_id = ?, ancre_position = ? WHERE id = ?",
    ancreId,
    position,
    id,
  );
  const { logEvent } = await import("./events");
  await logEvent("routine_ajoutee", id, {
    ancre_id: ancreId,
    position,
    modification: true,
  });
}

export async function deleteRoutine(id: number) {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM routines WHERE id = ?", id);
  const { logEvent } = await import("./events");
  await logEvent("routine_supprimee", id);
}

export async function toggleRoutine(id: number, fait: number) {
  const db = await getDatabase();
  await db.runAsync("UPDATE routines SET fait = ? WHERE id = ?", fait, id);
}

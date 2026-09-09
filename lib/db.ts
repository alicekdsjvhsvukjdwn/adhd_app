import * as SQLite from "expo-sqlite";

export type Routine = {
  id: number;
  nom: string;
  fait: number; // SQLite n'a pas de vrai booléen : 0 ou 1
};

let db: SQLite.SQLiteDatabase | null = null;

async function getDb() {
  if (!db) {
    db = await SQLite.openDatabaseAsync("routines.db");
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS routines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        fait INTEGER NOT NULL DEFAULT 0
      );
    `);
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
  return db;
}

export async function getRoutines(): Promise<Routine[]> {
  const database = await getDb();
  return database.getAllAsync<Routine>("SELECT * FROM routines");
}

export async function toggleRoutine(id: number, fait: number) {
  const database = await getDb();
  await database.runAsync(
    "UPDATE routines SET fait = ? WHERE id = ?",
    fait,
    id,
  );
}

export async function addRoutine(nom: string) {
  const database = await getDb();
  await database.runAsync(
    "INSERT INTO routines (nom, fait) VALUES (?, ?)",
    nom,
    0,
  );
}

export async function deleteRoutine(id: number) {
  const database = await getDb();
  await database.runAsync("DELETE FROM routines WHERE id = ?", id);
}

async function initCompletions() {
  const database = await getDb();
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      routine_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      statut TEXT NOT NULL DEFAULT 'complet',
      UNIQUE(routine_id, date)
    );
  `);
}

function getAujourdhui(): string {
  return new Date().toISOString().split("T")[0]; // format YYYY-MM-DD
}

export type RoutineAvecStatut = {
  id: number;
  nom: string;
  faitAujourdhui: boolean;
};

export async function getRoutinesAvecStatutDuJour(): Promise<
  RoutineAvecStatut[]
> {
  await initCompletions();
  const database = await getDb();
  const aujourdhui = getAujourdhui();
  const rows = await database.getAllAsync<{
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
  const database = await getDb();
  const aujourdhui = getAujourdhui();
  if (estActuellementFaite) {
    await database.runAsync(
      "DELETE FROM completions WHERE routine_id = ? AND date = ?",
      routineId,
      aujourdhui,
    );
  } else {
    await database.runAsync(
      "INSERT OR IGNORE INTO completions (routine_id, date, statut) VALUES (?, ?, ?)",
      routineId,
      aujourdhui,
      "complet",
    );
  }
}

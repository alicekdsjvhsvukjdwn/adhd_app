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

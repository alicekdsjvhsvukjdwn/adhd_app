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

async function initStats() {
  const database = await getDb();
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      points_total INTEGER NOT NULL DEFAULT 0,
      best_streak INTEGER NOT NULL DEFAULT 0
    );
  `);
  await database.runAsync(
    "INSERT OR IGNORE INTO stats (id, points_total, best_streak) VALUES (1, 0, 0)",
  );
}

async function addPoints(delta: number) {
  await initStats();
  const database = await getDb();
  await database.runAsync(
    "UPDATE stats SET points_total = MAX(0, points_total + ?) WHERE id = 1",
    delta,
  );
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

async function computeCurrentStreak(): Promise<number> {
  const database = await getDb();
  const rows = await database.getAllAsync<{ date: string }>(
    "SELECT DISTINCT date FROM completions ORDER BY date DESC",
  );
  const dateSet = new Set(rows.map((r) => r.date));
  const today = getAujourdhui();

  let streak = 0;
  const cursor = new Date(today + "T00:00:00");

  if (dateSet.has(formatDate(cursor))) {
    streak = 1;
    cursor.setDate(cursor.getDate() - 1);
  } else {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (dateSet.has(formatDate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export type Stats = {
  points: number;
  niveau: number;
  currentStreak: number;
  bestStreak: number;
};

export async function getStats(): Promise<Stats> {
  await initStats();
  const database = await getDb();
  const row = await database.getFirstAsync<{
    points_total: number;
    best_streak: number;
  }>("SELECT points_total, best_streak FROM stats WHERE id = 1");
  const currentStreak = await computeCurrentStreak();

  const points = row?.points_total ?? 0;
  const bestStreakEnBase = row?.best_streak ?? 0;

  if (currentStreak > bestStreakEnBase) {
    await database.runAsync(
      "UPDATE stats SET best_streak = ? WHERE id = 1",
      currentStreak,
    );
  }

  return {
    points,
    niveau: Math.floor(points / 100) + 1,
    currentStreak,
    bestStreak: Math.max(bestStreakEnBase, currentStreak),
  };
}

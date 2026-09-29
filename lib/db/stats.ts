import { decalerJours } from "../dates";
import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";

export type Stats = {
  points: number;
  niveau: number;
  currentStreak: number;
  bestStreak: number;
};

export type ConfigRappel = {
  actif: boolean;
  heure: number;
  minute: number;
};

export async function initStats() {
  const db = await getDatabase();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      points_total INTEGER NOT NULL DEFAULT 0,
      best_streak INTEGER NOT NULL DEFAULT 0,
      rappel_actif INTEGER NOT NULL DEFAULT 0,
      rappel_heure INTEGER NOT NULL DEFAULT 20,
      rappel_minute INTEGER NOT NULL DEFAULT 0
    );
  `);
  await db.runAsync("INSERT OR IGNORE INTO stats (id) VALUES (1)");
  // Migrations (au cas où la table existait déjà sans ces colonnes)
  try {
    await db.execAsync(
      "ALTER TABLE stats ADD COLUMN rappel_actif INTEGER NOT NULL DEFAULT 0",
    );
  } catch {}
  try {
    await db.execAsync(
      "ALTER TABLE stats ADD COLUMN rappel_heure INTEGER NOT NULL DEFAULT 20",
    );
  } catch {}
  try {
    await db.execAsync(
      "ALTER TABLE stats ADD COLUMN rappel_minute INTEGER NOT NULL DEFAULT 0",
    );
  } catch {}
}

export async function addPoints(delta: number) {
  await initStats();
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE stats SET points_total = MAX(0, points_total + ?) WHERE id = 1",
    delta,
  );
}

/**
 * Nombre de jours consécutifs avec au moins une complétion.
 * Aujourd'hui compte s'il y a déjà quelque chose ; sinon la série court
 * encore depuis hier, puisque la journée n'est pas finie.
 * Calcul sur les dates du calendrier (dates.ts), sans passer par une heure :
 * c'est ce qui décalait la série d'un jour à cause de l'UTC.
 */
async function computeCurrentStreak(): Promise<number> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ date: string }>(
    "SELECT DISTINCT date FROM completions",
  );
  const jours = new Set(rows.map((r) => r.date));
  const aujourdhui = getAujourdhui();

  let jour = jours.has(aujourdhui) ? aujourdhui : decalerJours(aujourdhui, -1);
  let serie = 0;
  while (jours.has(jour)) {
    serie++;
    jour = decalerJours(jour, -1);
  }
  return serie;
}

export async function getStats(): Promise<Stats> {
  await initStats();
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    points_total: number;
    best_streak: number;
  }>("SELECT points_total, best_streak FROM stats WHERE id = 1");
  const currentStreak = await computeCurrentStreak();

  const points = row?.points_total ?? 0;
  const bestStreakEnBase = row?.best_streak ?? 0;

  if (currentStreak > bestStreakEnBase) {
    await db.runAsync(
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

export async function getConfigRappel(): Promise<ConfigRappel> {
  await initStats();
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    rappel_actif: number;
    rappel_heure: number;
    rappel_minute: number;
  }>(
    "SELECT rappel_actif, rappel_heure, rappel_minute FROM stats WHERE id = 1",
  );
  return {
    actif: (row?.rappel_actif ?? 0) === 1,
    heure: row?.rappel_heure ?? 20,
    minute: row?.rappel_minute ?? 0,
  };
}

export async function setConfigRappel(config: ConfigRappel) {
  await initStats();
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE stats SET rappel_actif = ?, rappel_heure = ?, rappel_minute = ? WHERE id = 1",
    config.actif ? 1 : 0,
    config.heure,
    config.minute,
  );
}

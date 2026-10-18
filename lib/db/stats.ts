import { decalerJours } from "../dates";
import { niveauDePoints, SQL_AJOUTER_POINTS } from "../regles-taches";
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

export async function addPoints(delta: number) {
  const db = await getDatabase();
  await db.runAsync(SQL_AJOUTER_POINTS, delta);
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
    niveau: niveauDePoints(points),
    currentStreak,
    bestStreak: Math.max(bestStreakEnBase, currentStreak),
  };
}

export async function getConfigRappel(): Promise<ConfigRappel> {
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
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE stats SET rappel_actif = ?, rappel_heure = ?, rappel_minute = ? WHERE id = 1",
    config.actif ? 1 : 0,
    config.heure,
    config.minute,
  );
}

import { getDatabase } from './client';
import { getAujourdhui } from './completions';

export type Stats = {
  points: number;
  niveau: number;
  currentStreak: number;
  bestStreak: number;
};

export async function initStats() {
  const db = await getDatabase();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      points_total INTEGER NOT NULL DEFAULT 0,
      best_streak INTEGER NOT NULL DEFAULT 0
    );
  `);
  await db.runAsync('INSERT OR IGNORE INTO stats (id, points_total, best_streak) VALUES (1, 0, 0)');
}

export async function addPoints(delta: number) {
  await initStats();
  const db = await getDatabase();
  await db.runAsync('UPDATE stats SET points_total = MAX(0, points_total + ?) WHERE id = 1', delta);
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

async function computeCurrentStreak(): Promise<number> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ date: string }>(
    'SELECT DISTINCT date FROM completions ORDER BY date DESC'
  );
  const dateSet = new Set(rows.map(r => r.date));
  const today = getAujourdhui();

  let streak = 0;
  const cursor = new Date(today + 'T00:00:00');

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

export async function getStats(): Promise<Stats> {
  await initStats();
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ points_total: number; best_streak: number }>(
    'SELECT points_total, best_streak FROM stats WHERE id = 1'
  );
  const currentStreak = await computeCurrentStreak();

  const points = row?.points_total ?? 0;
  const bestStreakEnBase = row?.best_streak ?? 0;

  if (currentStreak > bestStreakEnBase) {
    await db.runAsync('UPDATE stats SET best_streak = ? WHERE id = 1', currentStreak);
  }

  return {
    points,
    niveau: Math.floor(points / 100) + 1,
    currentStreak,
    bestStreak: Math.max(bestStreakEnBase, currentStreak),
  };
}

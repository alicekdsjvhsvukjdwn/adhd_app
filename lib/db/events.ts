import { getDatabase } from "./client";

export type TypeEvenement =
  | "routine_completee"
  | "routine_decochee"
  | "routine_ajoutee"
  | "routine_supprimee";

export type EventLog = {
  id: number;
  type: TypeEvenement;
  routine_id: number | null;
  timestamp: string;
  contexte: string | null;
};

export async function initEvents() {
  const db = await getDatabase();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS event_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      routine_id INTEGER,
      timestamp TEXT NOT NULL,
      contexte TEXT
    );
  `);
}

export async function logEvent(
  type: TypeEvenement,
  routineId: number | null,
  contexte?: Record<string, any>,
) {
  await initEvents();
  const db = await getDatabase();
  const timestamp = new Date().toISOString();
  const contexteJson = contexte ? JSON.stringify(contexte) : null;
  await db.runAsync(
    "INSERT INTO event_log (type, routine_id, timestamp, contexte) VALUES (?, ?, ?, ?)",
    type,
    routineId,
    timestamp,
    contexteJson,
  );
}

export async function getRecentEvents(limit: number = 50): Promise<EventLog[]> {
  await initEvents();
  const db = await getDatabase();
  return db.getAllAsync<EventLog>(
    "SELECT * FROM event_log ORDER BY timestamp DESC LIMIT ?",
    limit,
  );
}

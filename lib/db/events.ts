import { getDatabase } from "./client";

export type TypeEvenement =
  // completions
  | "item_complete"
  | "item_decoche"
  // cycle de vie d'un item
  | "item_ajoute"
  | "item_modifie"
  | "item_pause"
  | "item_repris"
  | "item_archive"
  | "item_supprime"
  // adaptation d'intensité
  | "variante_descendue"
  | "variante_montee"
  // hérités (routines avant unification)
  | "routine_completee"
  | "routine_decochee"
  | "routine_ajoutee"
  | "routine_supprimee"
  | "routine_modifiee"
  // bilan de la journée (et anciens check-ins)
  | "etat_enregistre"
  // interrupteur « Jour difficile » : garde l'historique des jours difficiles
  | "jour_difficile_active"
  | "jour_difficile_desactive"
  // « Je commence » : début et sortie exacte d'une session
  | "session_demarree"
  | "session_terminee"
  // notifications
  | "notification_recue"
  | "notification_tapee"
  | "rappel_programme";

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

import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";

export type TypeSession = "focus" | "regulation";

export type Session = {
  id: number;
  type: TypeSession;
  item_id: number | null;
  libelle: string | null;
  estimation_min: number | null;
  reelle_min: number | null;
  debut: string;
  fin: string | null;
  date: string;
  terminee: number;
};

export async function demarrerSession(params: {
  type: TypeSession;
  itemId?: number | null;
  libelle?: string | null;
  estimationMin?: number | null;
}): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO sessions (type, item_id, libelle, estimation_min, debut, date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    params.type,
    params.itemId ?? null,
    params.libelle ?? null,
    params.estimationMin ?? null,
    new Date().toISOString(),
    getAujourdhui(),
  );

  const { logEvent } = await import("./events");
  await logEvent("session_demarree", params.itemId ?? null, {
    type: params.type,
    estimationMin: params.estimationMin ?? null,
  });

  return result.lastInsertRowId;
}

/**
 * Clôt une session. `terminee` distingue « allée au bout du minuteur »
 * de « arrêtée avant » — l'arrêt anticipé n'est pas un échec, mais
 * c'est une information utile au moteur.
 */
export async function terminerSession(
  sessionId: number,
  reelleMin: number,
  terminee: boolean,
) {
  const db = await getDatabase();

  await db.runAsync(
    "UPDATE sessions SET fin = ?, reelle_min = ?, terminee = ? WHERE id = ?",
    new Date().toISOString(),
    reelleMin,
    terminee ? 1 : 0,
    sessionId,
  );

  const session = await db.getFirstAsync<Session>(
    "SELECT * FROM sessions WHERE id = ?",
    sessionId,
  );

  // Le temps passé s'accumule sur l'item, pour la répartition en séances.
  if (session?.item_id) {
    await db.runAsync(
      "UPDATE items SET temps_passe_min = temps_passe_min + ? WHERE id = ?",
      Math.round(reelleMin),
      session.item_id,
    );
  }

  const { addPoints } = await import("./stats");
  await addPoints(5);

  const { logEvent } = await import("./events");
  await logEvent("session_terminee", session?.item_id ?? null, {
    type: session?.type ?? null,
    estimationMin: session?.estimation_min ?? null,
    reelleMin: Math.round(reelleMin),
    terminee,
  });
}

/**
 * Écart systématique entre estimation et durée réelle.
 * Un ratio de 2 signifie « tu mets deux fois plus de temps que prévu ».
 * Retourne null tant qu'il n'y a pas assez de sessions pour que ce soit parlant.
 */
export async function ratioEstimation(
  minSessions = 5,
): Promise<{ ratio: number; n: number } | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ n: number; ratio: number | null }>(
    `SELECT COUNT(*) AS n, AVG(reelle_min * 1.0 / estimation_min) AS ratio
     FROM sessions
     WHERE type = 'focus'
       AND estimation_min IS NOT NULL AND estimation_min > 0
       AND reelle_min IS NOT NULL`,
  );

  if (!row || row.n < minSessions || row.ratio === null) return null;
  return { ratio: row.ratio, n: row.n };
}

/** Durée de session réellement tenue : sert à calibrer les propositions. */
export async function dureeSessionTypique(): Promise<number | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ mediane: number | null }>(
    `SELECT AVG(reelle_min) AS mediane
     FROM sessions
     WHERE type = 'focus' AND reelle_min IS NOT NULL AND terminee = 1`,
  );
  return row?.mediane ?? null;
}

export async function sessionsDuJour(): Promise<Session[]> {
  const db = await getDatabase();
  return db.getAllAsync<Session>(
    "SELECT * FROM sessions WHERE date = ? ORDER BY debut DESC",
    getAujourdhui(),
  );
}

export async function tempsFocusDuJour(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(reelle_min) AS total FROM sessions
     WHERE date = ? AND type = 'focus' AND reelle_min IS NOT NULL`,
    getAujourdhui(),
  );
  return Math.round(row?.total ?? 0);
}

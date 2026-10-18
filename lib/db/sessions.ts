import type { Sortie } from "../minuteur";
import { getDatabase } from "./client";
import { logEvent } from "./events";
import { getAujourdhui } from "./completions";

/**
 * 'creneau' = « Je commence » : un créneau pour se lancer, pas une estimation.
 * Il est exclu des calculs d'estimation (qui ne lisent que 'focus').
 */
export type TypeSession = "focus" | "regulation" | "creneau";

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
  await logEvent("session_demarree", params.itemId ?? null, {
    type: params.type,
    estimationMin: params.estimationMin ?? null,
  });

  return result.lastInsertRowId;
}

/**
 * Clôt une session. `alleeAuBout` (colonne terminee) dit si le minuteur est
 * arrivé à zéro ; `sortie` dit ce que la personne a choisi. Aucun des deux
 * n'est un verdict : rien de tout ça n'est affiché.
 *
 * Pas de points : « Je commence » est un outil. Seule la tâche ou l'étape
 * cochée rapporte, comme d'habitude.
 */
export async function terminerSession(
  sessionId: number,
  bilan: {
    reelleMin: number;
    alleeAuBout: boolean;
    sortie: Sortie;
    prolongations: number;
  },
) {
  const db = await getDatabase();
  const { reelleMin, alleeAuBout } = bilan;

  await db.runAsync(
    "UPDATE sessions SET fin = ?, reelle_min = ?, terminee = ? WHERE id = ?",
    new Date().toISOString(),
    reelleMin,
    alleeAuBout ? 1 : 0,
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
  await logEvent("session_terminee", session?.item_id ?? null, {
    type: session?.type ?? null,
    estimationMin: session?.estimation_min ?? null,
    reelleMin: Math.round(reelleMin),
    alleeAuBout,
    // 'fait' | 'arret' (J'arrête là) | 'retour' (écran quitté)
    sortie: bilan.sortie,
    fait: bilan.sortie === "fait",
    prolongee: bilan.prolongations > 0,
    prolongations: bilan.prolongations,
  });
}


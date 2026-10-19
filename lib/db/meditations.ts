import { POINTS_MEDITATION } from "../meditations";
import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";
import { addPoints } from "./stats";

/**
 * Séances de méditation faites (terminées, ou arrêtées après 1 min).
 * Aucune autre partie de l'appli ne lit cette table.
 */
export async function enregistrerMeditation(
  seance: string,
  duree_s: number,
  terminee: boolean,
): Promise<number> {
  const db = await getDatabase();
  const date = getAujourdhui();
  const dejaPayee = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM meditations WHERE date = ? AND points_donnes > 0",
    date,
  );
  const points = (dejaPayee?.n ?? 0) > 0 ? 0 : POINTS_MEDITATION;
  await db.runAsync(
    `INSERT INTO meditations (date, seance, duree_s, terminee, points_donnes, horodatage)
     VALUES (?, ?, ?, ?, ?, ?)`,
    date,
    seance,
    duree_s,
    terminee ? 1 : 0,
    points,
    new Date().toISOString(),
  );
  if (points > 0) await addPoints(points);
  return points;
}

/** Méditations des 7 derniers jours (pour la carte du Suivi). */
export async function meditationsRecentes(depuis: string): Promise<number> {
  const db = await getDatabase();
  const r = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM meditations WHERE date >= ?",
    depuis,
  );
  return r?.n ?? 0;
}

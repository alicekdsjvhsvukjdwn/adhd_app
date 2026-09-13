import { getDatabase } from "./client";
import { rafraichirObservations, reinitialiserPropositionSansAction } from "./items";

export type StatutCompletion = "complet" | "partiel";

/**
 * Forme conservée à l'identique pour ne pas casser l'UI existante
 * (useRoutines, écran Aujourd'hui).
 */
export type RoutineAvecStatut = {
  id: number;
  nom: string;
  faitAujourdhui: boolean;
  statutDuJour: StatutCompletion | null;
  premiere_action: string | null;
  duree_min: number | null;
  ancre_id: number | null;
  ancre_nom: string | null;
  ancre_moment: string | null;
  ancre_position: "avant" | "apres" | null;
};

export function getAujourdhui(): string {
  return new Date().toISOString().split("T")[0];
}

const ORDRE_MOMENT = `
  CASE COALESCE(a.moment, i.moment)
    WHEN 'reveil' THEN 1
    WHEN 'matin' THEN 2
    WHEN 'midi' THEN 3
    WHEN 'apres_midi' THEN 4
    WHEN 'apres-midi' THEN 4
    WHEN 'soir' THEN 5
    WHEN 'coucher' THEN 6
    ELSE 7
  END`;

export async function getRoutinesAvecStatutDuJour(): Promise<RoutineAvecStatut[]> {
  const db = await getDatabase();
  const aujourdhui = getAujourdhui();

  const rows = await db.getAllAsync<{
    id: number;
    nom: string;
    statut_jour: StatutCompletion | null;
    premiere_action: string | null;
    duree_min: number | null;
    ancre_id: number | null;
    ancre_nom: string | null;
    ancre_moment: string | null;
    ancre_position: "avant" | "apres" | null;
  }>(
    `SELECT i.id, i.nom, i.premiere_action, i.duree_min,
            i.ancre_id, i.ancre_position,
            a.nom AS ancre_nom, a.moment AS ancre_moment,
            c.statut AS statut_jour
     FROM items i
     LEFT JOIN ancres a ON a.id = i.ancre_id
     LEFT JOIN completions c ON c.item_id = i.id AND c.date = ?
     WHERE i.type = 'routine' AND i.statut = 'actif'
     ORDER BY ${ORDRE_MOMENT}, i.id`,
    aujourdhui,
  );

  return rows.map((r) => ({
    id: r.id,
    nom: r.nom,
    faitAujourdhui: r.statut_jour !== null,
    statutDuJour: r.statut_jour,
    premiere_action: r.premiere_action,
    duree_min: r.duree_min,
    ancre_id: r.ancre_id,
    ancre_nom: r.ancre_nom,
    ancre_moment: r.ancre_moment,
    ancre_position: r.ancre_position,
  }));
}

/** Points par statut. La monnaie ne se perd jamais hors annulation immédiate. */
const POINTS: Record<StatutCompletion, number> = {
  complet: 10,
  partiel: 5,
};

export async function completer(
  itemId: number,
  statut: StatutCompletion = "complet",
  dureeReelleMin?: number,
) {
  const db = await getDatabase();
  const date = getAujourdhui();
  const now = new Date();
  const heure = now.getHours();

  const existante = await db.getFirstAsync<{ statut: StatutCompletion }>(
    "SELECT statut FROM completions WHERE item_id = ? AND date = ?",
    itemId,
    date,
  );

  await db.runAsync(
    `INSERT INTO completions (item_id, date, statut, heure, duree_reelle_min, horodatage)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(item_id, date) DO UPDATE SET
       statut = excluded.statut,
       heure = excluded.heure,
       duree_reelle_min = COALESCE(excluded.duree_reelle_min, completions.duree_reelle_min)`,
    itemId,
    date,
    statut,
    heure,
    dureeReelleMin ?? null,
    now.toISOString(),
  );

  const { addPoints } = await import("./stats");
  const delta = POINTS[statut] - (existante ? POINTS[existante.statut] : 0);
  if (delta !== 0) await addPoints(delta);

  const { logEvent } = await import("./events");
  await logEvent("item_complete", itemId, {
    statut,
    heure,
    jourSemaine: now.getDay(),
    dureeReelleMin: dureeReelleMin ?? null,
  });

  await reinitialiserPropositionSansAction(itemId);
  await rafraichirObservations(itemId);
}

export async function annulerCompletion(itemId: number) {
  const db = await getDatabase();
  const date = getAujourdhui();

  const existante = await db.getFirstAsync<{ statut: StatutCompletion }>(
    "SELECT statut FROM completions WHERE item_id = ? AND date = ?",
    itemId,
    date,
  );
  if (!existante) return;

  await db.runAsync(
    "DELETE FROM completions WHERE item_id = ? AND date = ?",
    itemId,
    date,
  );

  const { addPoints } = await import("./stats");
  await addPoints(-POINTS[existante.statut]);

  const { logEvent } = await import("./events");
  await logEvent("item_decoche", itemId, { heure: new Date().getHours() });

  await rafraichirObservations(itemId);
}

/** Conservé pour compatibilité avec l'UI existante. */
export async function toggleCompletionAujourdhui(
  itemId: number,
  estActuellementFaite: boolean,
) {
  if (estActuellementFaite) {
    await annulerCompletion(itemId);
  } else {
    await completer(itemId, "complet");
  }
}

/**
 * Taux de complétion sur une fenêtre glissante, utilisé pour le plafond
 * de routines actives (> 70 % : proposer un ajout ; < 50 % : ne rien proposer).
 */
export async function tauxCompletion(jours = 14): Promise<number> {
  const db = await getDatabase();
  const debut = new Date(Date.now() - jours * 86400000)
    .toISOString()
    .split("T")[0];

  const actives = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM items WHERE type = 'routine' AND statut = 'actif'",
  );
  if (!actives || actives.n === 0) return 0;

  const faites = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM completions
     WHERE date >= ? AND statut IN ('complet', 'partiel')`,
    debut,
  );

  const attendu = actives.n * jours;
  return attendu === 0 ? 0 : Math.min(1, (faites?.n ?? 0) / attendu);
}

/** Historique d'un item, pour l'écran Progression. N'affiche que ce qui a été fait. */
export async function historiqueItem(itemId: number, jours = 30) {
  const db = await getDatabase();
  const debut = new Date(Date.now() - jours * 86400000)
    .toISOString()
    .split("T")[0];
  return db.getAllAsync<{
    date: string;
    statut: StatutCompletion;
    heure: number | null;
  }>(
    `SELECT date, statut, heure FROM completions
     WHERE item_id = ? AND date >= ?
     ORDER BY date DESC`,
    itemId,
    debut,
  );
}

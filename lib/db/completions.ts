import type { Categorie } from "../catalogue";
import { dateLocale, jourDeCreation } from "../dates";
import { categorieEffective } from "./categories";
import { getDatabase } from "./client";
import { logEvent } from "./events";
import {
  rafraichirObservations,
  reinitialiserPropositionSansAction,
} from "./items";

export type StatutCompletion = "complet" | "partiel";

/**
 * Forme conservée pour l'UI (useRoutines, écran Aujourd'hui), enrichie
 * de la catégorie (pour la pastille) et du moment propre à l'item
 * (pour le regroupement matin/aprem/soir même sans ancre).
 */
export type RoutineAvecStatut = {
  id: number;
  nom: string;
  faitAujourdhui: boolean;
  statutDuJour: StatutCompletion | null;
  premiere_action: string | null;
  duree_min: number | null;
  /** Difficulté : 1 facile, 2 moyenne, 3 exigeante. */
  effort: number | null;
  categorie: Categorie | null;
  moment: string | null;
  template_id: string | null;
  variante_rang: number | null;
  ancre_id: number | null;
  ancre_nom: string | null;
  ancre_moment: string | null;
  ancre_position: "avant" | "apres" | null;
};

/** Date du jour en heure locale (la journée bascule à minuit). */
export function getAujourdhui(): string {
  return dateLocale();
}

/**
 * Une routine est-elle attendue ce jour-là ? Règle unique, utilisée par
 * l'accueil (quoi afficher) et par Progression (quoi compter).
 * - jamais avant sa création
 * - toujours le jour de sa création, pour la voir dès qu'on l'a ajoutée
 * - 'jours:1,3,5' : ces jours de la semaine (0 = dimanche, convention JS)
 * - 'hebdo' : le même jour de la semaine que sa création
 * - sinon (quotidien) : tous les jours
 */
export function routineAttendueLe(
  recurrence: string | null,
  depuis: string,
  iso: string,
): boolean {
  if (iso < depuis) return false;
  if (iso === depuis) return true;
  const jourDe = (d: string) => new Date(d + "T00:00:00Z").getUTCDay();
  const r = recurrence ?? "quotidien";
  if (r.startsWith("jours:")) {
    return r.slice(6).split(",").map(Number).includes(jourDe(iso));
  }
  if (r === "hebdo") return jourDe(iso) === jourDe(depuis);
  return true;
}

const ORDRE_MOMENT = `
  CASE COALESCE(a.moment, i.moment)
    WHEN 'reveil' THEN 1
    WHEN 'matin' THEN 2
    WHEN 'midi' THEN 3
    WHEN 'apres_midi' THEN 4
    WHEN 'soir' THEN 5
    WHEN 'coucher' THEN 6
    ELSE 7
  END`;

export async function getRoutinesAvecStatutDuJour(): Promise<
  RoutineAvecStatut[]
> {
  const db = await getDatabase();
  const aujourdhui = getAujourdhui();

  const rows = await db.getAllAsync<{
    id: number;
    nom: string;
    statut_jour: StatutCompletion | null;
    premiere_action: string | null;
    duree_min: number | null;
    effort: number | null;
    categorie: string | null;
    template_id: string | null;
    moment: string | null;
    recurrence: string | null;
    cree_le: string;
    variante_rang: number | null;
    ancre_id: number | null;
    ancre_nom: string | null;
    ancre_moment: string | null;
    ancre_position: "avant" | "apres" | null;
  }>(
    `SELECT i.id, i.nom, i.premiere_action, i.duree_min, i.effort,
            i.categorie, i.template_id, i.moment,
            i.recurrence, i.cree_le,
            i.variante_rang,
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

  // Une routine « lun, mer, ven » n'apparaît que ces jours-là
  // (et le jour de sa création, pour la voir tout de suite).
  const duJour = rows.filter((r) =>
    routineAttendueLe(r.recurrence, jourDeCreation(r.cree_le), aujourdhui),
  );

  return duJour.map((r) => ({
    id: r.id,
    nom: r.nom,
    faitAujourdhui: r.statut_jour !== null,
    statutDuJour: r.statut_jour,
    premiere_action: r.premiere_action,
    duree_min: r.duree_min,
    effort: r.effort,
    categorie: categorieEffective(r.categorie, r.template_id),
    moment: r.moment,
    template_id: r.template_id,
    variante_rang: r.variante_rang,
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

/** Points donnés pour une complétion : la colonne points, sinon le barème (anciennes lignes). */
const pointsDe = (c: { statut: StatutCompletion; points: number | null }) =>
  c.points ?? POINTS[c.statut];

export async function completer(
  itemId: number,
  statut: StatutCompletion = "complet",
  dureeReelleMin?: number,
  /** completions.version : 'normale', ou le palier d'une routine à étapes ('essentielles' | 'toutes'). */
  version?: string,
  /** Points de cette complétion, si ce n'est pas le barème du statut (routines à étapes). */
  points?: number,
  /** Jour concerné, si ce n'est pas aujourd'hui (séance notée pour hier). */
  jour?: string,
) {
  const db = await getDatabase();
  const date = jour ?? getAujourdhui();
  const now = new Date();
  const heure = now.getHours();

  const existante = await db.getFirstAsync<{
    statut: StatutCompletion;
    points: number | null;
  }>(
    "SELECT statut, points FROM completions WHERE item_id = ? AND date = ?",
    itemId,
    date,
  );
  const vaut = points ?? POINTS[statut];

  await db.runAsync(
    `INSERT INTO completions (item_id, date, statut, heure, duree_reelle_min, horodatage, version, points)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(item_id, date) DO UPDATE SET
       statut = excluded.statut,
       heure = excluded.heure,
       points = excluded.points,
       version = COALESCE(excluded.version, completions.version),
       duree_reelle_min = COALESCE(excluded.duree_reelle_min, completions.duree_reelle_min)`,
    itemId,
    date,
    statut,
    heure,
    dureeReelleMin ?? null,
    now.toISOString(),
    version ?? null,
    vaut,
  );

  // Une tâche ponctuelle faite est terminée : elle ne revient pas le lendemain.
  // Les routines, elles, restent actives (récurrentes).
  // Une tâche « x fois par semaine / par mois » (recurrence renseignée) reste active.
  if (statut === "complet") {
    await db.runAsync(
      "UPDATE items SET statut = 'termine', maj_le = ? WHERE id = ? AND type = 'tache' AND recurrence IS NULL",
      now.toISOString(),
      itemId,
    );
  }

  const { addPoints } = await import("./stats");
  const delta = vaut - (existante ? pointsDe(existante) : 0);
  if (delta !== 0) await addPoints(delta);
  await logEvent("item_complete", itemId, {
    statut,
    heure,
    jourSemaine: now.getDay(),
    dureeReelleMin: dureeReelleMin ?? null,
  });

  await reinitialiserPropositionSansAction(itemId);
  await rafraichirObservations(itemId);
}

/**
 * Annule une complétion. Par défaut celle d'aujourd'hui ; une date passée
 * permet de corriger une tâche cochée par erreur depuis l'écran Progression.
 */
export async function annulerCompletion(
  itemId: number,
  date: string = getAujourdhui(),
) {
  const db = await getDatabase();

  const existante = await db.getFirstAsync<{
    statut: StatutCompletion;
    points: number | null;
  }>(
    "SELECT statut, points FROM completions WHERE item_id = ? AND date = ?",
    itemId,
    date,
  );
  if (!existante) return;

  await db.runAsync(
    "DELETE FROM completions WHERE item_id = ? AND date = ?",
    itemId,
    date,
  );

  // Annuler la complétion d'une tâche la remet dans la file.
  await db.runAsync(
    "UPDATE items SET statut = 'actif', maj_le = ? WHERE id = ? AND type = 'tache' AND statut = 'termine'",
    new Date().toISOString(),
    itemId,
  );

  const { addPoints } = await import("./stats");
  await addPoints(-pointsDe(existante));
  await logEvent("item_decoche", itemId, { heure: new Date().getHours() });

  await rafraichirObservations(itemId);
}


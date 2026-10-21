import { getFamille } from "../catalogue";
import {
  nomApresVariante,
  requeteModification,
  SQL_SUPPRESSION_ITEM,
  type ChampModifiable,
} from "../modification-item";
import { momentStocke } from "../moments";
import { getDatabase } from "./client";
import { logEvent } from "./events";

export type TypeItem = "routine" | "tache";
export type StatutItem = "actif" | "pause" | "archive" | "termine";
export type Position = "avant" | "apres";

export type Item = {
  id: number;
  nom: string;
  type: TypeItem;
  statut: StatutItem;
  recurrence: string | null;
  template_id: string | null;
  variante_rang: number | null;
  categorie: string | null;
  moment: string | null;
  effort: number | null;
  duree_min: number | null;
  premiere_action: string | null;
  importance: number;
  ancre_id: number | null;
  ancre_position: Position | null;
  echeance: string | null;
  temps_passe_min: number;
  duree_reelle_moy_min: number | null;
  heure_reelle_moy: number | null;
  nb_completions: number;
  nb_propositions_sans_action: number;
  cree_le: string;
  maj_le: string;
  liste_id: number | null;
};

export type NouvelItem = {
  nom: string;
  type?: TypeItem;
  recurrence?: string | null;
  template_id?: string | null;
  variante_rang?: number | null;
  categorie?: string | null;
  moment?: string | null;
  effort?: number | null;
  duree_min?: number | null;
  premiere_action?: string | null;
  importance?: number;
  ancre_id?: number | null;
  ancre_position?: Position | null;
  echeance?: string | null;
  liste_id?: number | null;
};

const maintenant = () => new Date().toISOString();

export async function getItems(
  statut: StatutItem | "tous" = "actif",
): Promise<Item[]> {
  const db = await getDatabase();
  if (statut === "tous") {
    return db.getAllAsync<Item>("SELECT * FROM items ORDER BY id");
  }
  return db.getAllAsync<Item>(
    "SELECT * FROM items WHERE statut = ? ORDER BY id",
    statut,
  );
}

export async function getItem(id: number): Promise<Item | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Item>("SELECT * FROM items WHERE id = ?", id);
}

export async function addItem(item: NouvelItem): Promise<number> {
  const db = await getDatabase();
  const ts = maintenant();

  const result = await db.runAsync(
    `INSERT INTO items (
      nom, type, statut, recurrence, template_id, variante_rang,
      categorie, moment, effort, duree_min, premiere_action, importance,
      ancre_id, ancre_position,
      echeance, liste_id,
      cree_le, maj_le
    ) VALUES (?, ?, 'actif', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    item.nom,
    item.type ?? "routine",
    item.recurrence ??
      (item.type === "routine" || !item.type ? "quotidien" : null),
    item.template_id ?? null,
    item.variante_rang ?? null,
    item.categorie ?? null,
    momentStocke(item.moment),
    item.effort ?? null,
    item.duree_min ?? null,
    item.premiere_action ?? null,
    item.importance ?? 2,
    item.ancre_id ?? null,
    item.ancre_position ?? null,
    item.echeance ?? null,
    item.liste_id ?? null,
    ts,
    ts,
  );
  await logEvent("item_ajoute", result.lastInsertRowId, {
    nom: item.nom,
    type: item.type ?? "routine",
    template_id: item.template_id ?? null,
  });

  return result.lastInsertRowId;
}

export type ModificationItem = Partial<Pick<Item, ChampModifiable>>;

/**
 * Corrige un item existant. Seuls les champs passés sont modifiés,
 * et seulement ceux de la liste autorisée : l'historique (complétions,
 * observations) reste attaché à l'item.
 */
export async function modifierItem(id: number, champs: ModificationItem) {
  const requete = requeteModification(id, champs, maintenant());
  if (!requete) return;

  const db = await getDatabase();
  await db.runAsync(requete.sql, ...requete.params);
  await logEvent("item_modifie", id, { champs: requete.cles });
}

/**
 * Texte de confirmation avant deleteItem, le même partout : dit ce qui est
 * effacé (historique, passé dans Progression, série) et ce qui reste (points).
 */
export function confirmationSuppression(
  type: "routine" | "tache",
  nom: string,
): { titre: string; message: string } {
  return {
    titre:
      type === "routine" ? "Supprimer cette routine ?" : "Supprimer cette tâche ?",
    message: `« ${nom.trim()} » disparaîtra, avec ses étapes et ses notes. Ce que tu as fait reste compté (série, points).`,
  };
}

/**
 * Suppression : l'item et ce qui ne sert qu'à lui (étapes, notes,
 * suggestions, sessions). Les complétions, decision_log et event_log
 * restent pour l'analyse : ce qui a été fait reste compté (série).
 */
export async function deleteItem(id: number) {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const sql of SQL_SUPPRESSION_ITEM) await db.runAsync(sql, id);
  });
  await logEvent("item_supprime", id);
}

/**
 * Change d'un cran l'intensité d'une routine issue du catalogue (suggestions
 * « simplifier » et « monter »). Le nom n'est remplacé que s'il est encore
 * celui de la variante du catalogue : un nom choisi à la main reste.
 * Retourne false s'il n'y a pas de variante dans ce sens.
 */
async function changerVariante(id: number, sens: -1 | 1): Promise<boolean> {
  const item = await getItem(id);
  if (!item?.template_id || item.variante_rang === null) return false;
  const famille = getFamille(item.template_id);
  if (!famille) return false;

  const actuelle = famille.variantes.find((v) => v.rang === item.variante_rang);
  const cible = famille.variantes.find((v) => v.rang === item.variante_rang! + sens);
  if (!cible) return false;

  const db = await getDatabase();
  await db.runAsync(
    `UPDATE items
     SET variante_rang = ?, nom = ?, duree_min = ?, effort = ?,
         premiere_action = ?, maj_le = ?
     WHERE id = ?`,
    cible.rang,
    nomApresVariante(item.nom, actuelle?.libelle ?? null, cible.libelle),
    cible.duree_min,
    cible.effort,
    cible.premiere_action,
    maintenant(),
    id,
  );
  await logEvent(sens < 0 ? "variante_descendue" : "variante_montee", id, {
    de: item.variante_rang,
    vers: cible.rang,
  });
  return true;
}

/** Une variante plus accessible, au lieu de laisser mourir une routine qui ne tient pas. */
export const descendreVariante = (id: number) => changerVariante(id, -1);

/** La variante suivante, quand une routine est bien installée. */
export const monterVariante = (id: number) => changerVariante(id, 1);

/**
 * Réinjecte l'observation dans les métadonnées : heure réelle et durée réelle
 * moyennes. Ce qui n'était pas renseigné à la création se remplit tout seul.
 */
export async function rafraichirObservations(id: number) {
  const db = await getDatabase();
  const stats = await db.getFirstAsync<{
    n: number;
    heure_moy: number | null;
    duree_moy: number | null;
  }>(
    `SELECT COUNT(*) AS n,
            AVG(heure) AS heure_moy,
            AVG(duree_reelle_min) AS duree_moy
     FROM completions
     WHERE item_id = ? AND statut IN ('complet', 'partiel')`,
    id,
  );
  if (!stats) return;

  await db.runAsync(
    `UPDATE items
     SET nb_completions = ?, heure_reelle_moy = ?, duree_reelle_moy_min = ?, maj_le = ?
     WHERE id = ?`,
    stats.n,
    stats.heure_moy,
    stats.duree_moy,
    maintenant(),
    id,
  );
}

export async function reinitialiserPropositionSansAction(id: number) {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE items SET nb_propositions_sans_action = 0 WHERE id = ?",
    id,
  );
}


/**
 * Place une tâche en haut ou en bas de sa liste, ou la remet dans l'ordre de l'appli (null).
 * Le rang va juste au-delà des places déjà choisies dans la même liste.
 */
export async function placerTache(id: number, ou: "haut" | "bas" | null): Promise<void> {
  const db = await getDatabase();
  if (ou === null) {
    await db.runAsync("UPDATE items SET rang_manuel = NULL WHERE id = ?", id);
    return;
  }
  const r = await db.getFirstAsync<{ pris: number | null }>(
    `SELECT ${ou === "haut" ? "MIN" : "MAX"}(j.rang_manuel) AS pris
     FROM items i JOIN items j ON j.liste_id IS i.liste_id AND j.type = 'tache' AND j.id <> i.id
     WHERE i.id = ?`,
    id,
  );
  const pris = r?.pris ?? 0;
  await db.runAsync(
    "UPDATE items SET rang_manuel = ? WHERE id = ?",
    ou === "haut" ? Math.min(pris, 0) - 1 : Math.max(pris, 0) + 1,
    id,
  );
}

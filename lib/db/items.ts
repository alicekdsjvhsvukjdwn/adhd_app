import { getDatabase } from "./client";

export type TypeItem = "routine" | "tache" | "evenement";
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
  effort_total_min: number | null;
  taille_seance_min: number | null;
  temps_passe_min: number;
  fenetre_jours: string | null;
  fenetre_debut_h: number | null;
  fenetre_fin_h: number | null;
  date_evenement: string | null;
  heure_evenement: string | null;
  duree_reelle_moy_min: number | null;
  heure_reelle_moy: number | null;
  nb_completions: number;
  nb_propositions_sans_action: number;
  cree_le: string;
  maj_le: string;
};

export type ItemAvecAncre = Item & {
  ancre_nom: string | null;
  ancre_moment: string | null;
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
  effort_total_min?: number | null;
  taille_seance_min?: number | null;
  fenetre_jours?: string | null;
  fenetre_debut_h?: number | null;
  fenetre_fin_h?: number | null;
  date_evenement?: string | null;
  heure_evenement?: string | null;
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

export async function getItemsAvecAncre(
  statut: StatutItem | "tous" = "actif",
): Promise<ItemAvecAncre[]> {
  const db = await getDatabase();
  const clause = statut === "tous" ? "" : "WHERE i.statut = ?";
  const params = statut === "tous" ? [] : [statut];
  return db.getAllAsync<ItemAvecAncre>(
    `SELECT i.*, a.nom AS ancre_nom, a.moment AS ancre_moment
     FROM items i
     LEFT JOIN ancres a ON a.id = i.ancre_id
     ${clause}
     ORDER BY i.id`,
    ...params,
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
      echeance, effort_total_min, taille_seance_min,
      fenetre_jours, fenetre_debut_h, fenetre_fin_h,
      date_evenement, heure_evenement,
      cree_le, maj_le
    ) VALUES (?, ?, 'actif', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    item.nom,
    item.type ?? "routine",
    item.recurrence ?? (item.type === "routine" || !item.type ? "quotidien" : null),
    item.template_id ?? null,
    item.variante_rang ?? null,
    item.categorie ?? null,
    item.moment ?? null,
    item.effort ?? null,
    item.duree_min ?? null,
    item.premiere_action ?? null,
    item.importance ?? 2,
    item.ancre_id ?? null,
    item.ancre_position ?? null,
    item.echeance ?? null,
    item.effort_total_min ?? null,
    item.taille_seance_min ?? null,
    item.fenetre_jours ?? null,
    item.fenetre_debut_h ?? null,
    item.fenetre_fin_h ?? null,
    item.date_evenement ?? null,
    item.heure_evenement ?? null,
    ts,
    ts,
  );

  const { logEvent } = await import("./events");
  await logEvent("item_ajoute", result.lastInsertRowId, {
    nom: item.nom,
    type: item.type ?? "routine",
    template_id: item.template_id ?? null,
  });

  return result.lastInsertRowId;
}

export async function updateItemAncre(
  id: number,
  ancreId: number | null,
  position: Position,
) {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE items SET ancre_id = ?, ancre_position = ?, maj_le = ? WHERE id = ?",
    ancreId,
    position,
    maintenant(),
    id,
  );
  const { logEvent } = await import("./events");
  await logEvent("item_modifie", id, { ancre_id: ancreId, position });
}

/**
 * Mise en pause plutôt que suppression : c'est le mécanisme de sortie
 * quand la charge est trop forte. Rien n'est perdu, reprise en un tap.
 */
export async function pauserItem(id: number, raison?: string) {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE items SET statut = 'pause', maj_le = ? WHERE id = ?",
    maintenant(),
    id,
  );
  const { logEvent } = await import("./events");
  await logEvent("item_pause", id, { raison: raison ?? null });
}

export async function reprendreItem(id: number) {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE items SET statut = 'actif', nb_propositions_sans_action = 0, maj_le = ? WHERE id = ?",
    maintenant(),
    id,
  );
  const { logEvent } = await import("./events");
  await logEvent("item_repris", id);
}

export async function archiverItem(id: number) {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE items SET statut = 'archive', maj_le = ? WHERE id = ?",
    maintenant(),
    id,
  );
  const { logEvent } = await import("./events");
  await logEvent("item_archive", id);
}

/** Suppression dure. Préférer pauserItem ou archiverItem : rien ne se perd. */
export async function deleteItem(id: number) {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM items WHERE id = ?", id);
  await db.runAsync("DELETE FROM completions WHERE item_id = ?", id);
  const { logEvent } = await import("./events");
  await logEvent("item_supprime", id);
}

/**
 * Descend d'un cran l'intensité d'une routine issue du catalogue,
 * au lieu de la laisser mourir après plusieurs échecs.
 * Retourne false s'il n'y a pas de variante plus accessible.
 */
export async function descendreVariante(id: number): Promise<boolean> {
  const item = await getItem(id);
  if (!item?.template_id || item.variante_rang === null) return false;
  if (item.variante_rang <= 1) return false;

  const { getFamille } = await import("../catalogue");
  const famille = getFamille(item.template_id);
  if (!famille) return false;

  const cible = famille.variantes.find((v) => v.rang === item.variante_rang! - 1);
  if (!cible) return false;

  const db = await getDatabase();
  await db.runAsync(
    `UPDATE items
     SET variante_rang = ?, nom = ?, duree_min = ?, effort = ?,
         premiere_action = ?, maj_le = ?
     WHERE id = ?`,
    cible.rang,
    cible.libelle,
    cible.duree_min,
    cible.effort,
    cible.premiere_action,
    maintenant(),
    id,
  );

  const { logEvent } = await import("./events");
  await logEvent("variante_descendue", id, {
    de: item.variante_rang,
    vers: cible.rang,
  });
  return true;
}

/** Idem vers le haut, quand une routine est complétée sans effort depuis longtemps. */
export async function monterVariante(id: number): Promise<boolean> {
  const item = await getItem(id);
  if (!item?.template_id || item.variante_rang === null) return false;

  const { getFamille } = await import("../catalogue");
  const famille = getFamille(item.template_id);
  if (!famille) return false;

  const cible = famille.variantes.find((v) => v.rang === item.variante_rang! + 1);
  if (!cible) return false;

  const db = await getDatabase();
  await db.runAsync(
    `UPDATE items
     SET variante_rang = ?, nom = ?, duree_min = ?, effort = ?,
         premiere_action = ?, maj_le = ?
     WHERE id = ?`,
    cible.rang,
    cible.libelle,
    cible.duree_min,
    cible.effort,
    cible.premiere_action,
    maintenant(),
    id,
  );

  const { logEvent } = await import("./events");
  await logEvent("variante_montee", id, {
    de: item.variante_rang,
    vers: cible.rang,
  });
  return true;
}

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

/** Compteur de blocage : trois propositions sans action déclenchent le diagnostic. */
export async function incrementerPropositionSansAction(id: number) {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE items SET nb_propositions_sans_action = nb_propositions_sans_action + 1 WHERE id = ?",
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

export async function getItemsBloques(seuil = 3): Promise<Item[]> {
  const db = await getDatabase();
  return db.getAllAsync<Item>(
    `SELECT * FROM items
     WHERE statut = 'actif' AND nb_propositions_sans_action >= ?`,
    seuil,
  );
}

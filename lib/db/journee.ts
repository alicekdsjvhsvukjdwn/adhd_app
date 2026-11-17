import { decalerJours } from "../dates";
import {
  nettoyerDetails,
  origineSaisie,
  ZONES_DEFAUT,
  type CleZone,
  type MomentJournee,
  type Zone,
} from "../journee-regles";
import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";

/** Ma journée : une ligne par chose faite (voir lib/journee-regles.ts). */
export type Entree = {
  id: number;
  jour: string;
  cree_le: string;
  moment: MomentJournee;
  zone: CleZone;
  texte: string;
  duree_min: number | null;
  ressenti: number | null;
  tache_id: number | null;
  points: number;
  origine: "saisie" | "tache" | "recopie";
};

type Db = Awaited<ReturnType<typeof getDatabase>>;

/** Les 7 zones par défaut, sans toucher à celles déjà là (renommées, recolorées). */
export async function semerZones(db: Db): Promise<void> {
  for (const z of ZONES_DEFAUT) {
    await db.runAsync(
      "INSERT OR IGNORE INTO zones (cle, libelle, couleur, ordre, active) VALUES (?, ?, ?, ?, ?)",
      z.cle,
      z.libelle,
      z.couleur,
      z.ordre,
      z.active,
    );
  }
}

/** Toutes les zones, actives ou non. Recrées si la table a été vidée (réinitialisation, vieille sauvegarde). */
export async function getZones(): Promise<Zone[]> {
  const db = await getDatabase();
  await semerZones(db);
  return db.getAllAsync<Zone>("SELECT cle, libelle, couleur, ordre, active FROM zones ORDER BY ordre");
}

export async function modifierZone(cle: CleZone, champs: Partial<Pick<Zone, "libelle" | "couleur" | "active">>): Promise<void> {
  const db = await getDatabase();
  if (champs.libelle !== undefined && champs.libelle.trim())
    await db.runAsync("UPDATE zones SET libelle = ? WHERE cle = ?", champs.libelle.trim(), cle);
  if (champs.couleur !== undefined) await db.runAsync("UPDATE zones SET couleur = ? WHERE cle = ?", champs.couleur, cle);
  if (champs.active !== undefined) await db.runAsync("UPDATE zones SET active = ? WHERE cle = ?", champs.active ? 1 : 0, cle);
}

const COLONNES = "id, jour, cree_le, moment, zone, texte, duree_min, ressenti, tache_id, points, origine";

export async function entreesDu(jour: string): Promise<Entree[]> {
  const db = await getDatabase();
  return db.getAllAsync<Entree>(
    `SELECT ${COLONNES} FROM journal WHERE jour = ?
     ORDER BY CASE moment WHEN 'matin' THEN 0 WHEN 'midi' THEN 1 WHEN 'apres_midi' THEN 2 ELSE 3 END, id`,
    jour,
  );
}

/** Entrées de plusieurs jours consécutifs (semaine, 30 jours). */
export async function entreesEntre(debut: string, fin: string): Promise<Entree[]> {
  const db = await getDatabase();
  return db.getAllAsync<Entree>(`SELECT ${COLONNES} FROM journal WHERE jour BETWEEN ? AND ? ORDER BY jour, id`, debut, fin);
}

/** Jours qui ont au moins une entrée : les points de la bande des jours. */
export async function joursAvecEntrees(): Promise<Set<string>> {
  const db = await getDatabase();
  const r = await db.getAllAsync<{ jour: string }>("SELECT DISTINCT jour FROM journal");
  return new Set(r.map((x) => x.jour));
}

/** Textes déjà écrits, pour l'autocomplétion (les 6 derniers mois). */
export async function textesPasses(): Promise<{ texte: string; zone: string; n: number }[]> {
  const db = await getDatabase();
  return db.getAllAsync(
    `SELECT texte, zone, COUNT(*) AS n FROM journal WHERE jour >= ?
     GROUP BY texte, zone ORDER BY n DESC LIMIT 400`,
    decalerJours(getAujourdhui(), -183),
  );
}

export type NouvelleEntree = {
  jour: string;
  moment: MomentJournee;
  zone: CleZone;
  texte: string;
  tache_id?: number | null;
  points?: number;
  /** 'tache' quand l'entrée vient d'une tâche cochée ; sinon calculée (saisie ou recopie). */
  origine?: Entree["origine"];
};

export async function ajouterEntree(e: NouvelleEntree, maintenant = new Date()): Promise<number> {
  const db = await getDatabase();
  const origine = e.origine ?? origineSaisie(e.jour, e.moment, getAujourdhui(), maintenant.getHours());
  const r = await db.runAsync(
    `INSERT INTO journal (jour, cree_le, moment, zone, texte, tache_id, points, origine) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    e.jour,
    maintenant.toISOString(),
    e.moment,
    e.zone,
    e.texte.trim(),
    e.tache_id ?? null,
    e.points ?? 0,
    origine,
  );
  return r.lastInsertRowId;
}

export async function getEntree(id: number): Promise<Entree | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Entree>(`SELECT ${COLONNES} FROM journal WHERE id = ?`, id);
}

export async function modifierEntree(
  id: number,
  champs: Partial<Pick<Entree, "texte" | "zone" | "moment" | "duree_min" | "ressenti">>,
): Promise<void> {
  const db = await getDatabase();
  if (champs.texte !== undefined && champs.texte.trim()) await db.runAsync("UPDATE journal SET texte = ? WHERE id = ?", champs.texte.trim(), id);
  if (champs.zone !== undefined) await db.runAsync("UPDATE journal SET zone = ? WHERE id = ?", champs.zone, id);
  if (champs.moment !== undefined) await db.runAsync("UPDATE journal SET moment = ? WHERE id = ?", champs.moment, id);
  if ("duree_min" in champs || "ressenti" in champs) {
    const actuelle = await getEntree(id);
    if (!actuelle) return;
    const d = nettoyerDetails({
      duree_min: "duree_min" in champs ? champs.duree_min : actuelle.duree_min,
      ressenti: "ressenti" in champs ? champs.ressenti : actuelle.ressenti,
    });
    await db.runAsync("UPDATE journal SET duree_min = ?, ressenti = ? WHERE id = ?", d.duree_min, d.ressenti, id);
  }
}

/** Supprime et rend la ligne, pour « Annuler » pendant 5 s. */
export async function supprimerEntree(id: number): Promise<Entree | null> {
  const db = await getDatabase();
  const e = await getEntree(id);
  if (e) await db.runAsync("DELETE FROM journal WHERE id = ?", id);
  return e;
}

/** Remet une entrée supprimée, avec son identifiant. */
export async function restaurerEntree(e: Entree): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO journal (${COLONNES}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    e.id,
    e.jour,
    e.cree_le,
    e.moment,
    e.zone,
    e.texte,
    e.duree_min,
    e.ressenti,
    e.tache_id,
    e.points,
    e.origine,
  );
}

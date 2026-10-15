import {
  compterDans,
  periodesRecentes,
  serieAtteinte,
  type Periode,
} from "../regles-taches";
import { couleurLibre } from "../theme-listes";
import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";

/**
 * Listes de tâches (Quotidien, Travail, Administratif…), modifiables.
 * Distinctes des domaines bien-être, qui servent à l'équilibre.
 */

export type Liste = {
  id: number;
  nom: string;
  icone: string | null;
  ordre: number;
  /** Tâches à faire dans la liste par période ; null = pas d'objectif. */
  objectif: number | null;
  objectif_periode: Periode | null;
  /** Clé de la palette de lib/theme-listes.ts. */
  couleur: string | null;
};

const COLONNES = "id, nom, icone, ordre, objectif, objectif_periode, couleur";

export async function getListes(): Promise<Liste[]> {
  const db = await getDatabase();
  return db.getAllAsync<Liste>(
    `SELECT ${COLONNES} FROM listes ORDER BY ordre, id`,
  );
}

export async function ajouterListe(nom: string, icone: string | null): Promise<number> {
  const db = await getDatabase();
  const max = await db.getFirstAsync<{ m: number | null }>(
    "SELECT MAX(ordre) AS m FROM listes",
  );
  // Une couleur encore libre : chaque liste se reconnaît d'un coup d'œil.
  const prises = (
    await db.getAllAsync<{ couleur: string | null }>("SELECT couleur FROM listes")
  ).map((x) => x.couleur);
  const r = await db.runAsync(
    "INSERT INTO listes (nom, icone, ordre, cree_le, couleur) VALUES (?, ?, ?, ?, ?)",
    nom.trim(),
    icone,
    (max?.m ?? -1) + 1,
    new Date().toISOString(),
    couleurLibre(prises),
  );
  return r.lastInsertRowId;
}

export async function modifierListe(
  id: number,
  nom: string,
  icone: string | null,
  couleur: string | null,
) {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE listes SET nom = ?, icone = ?, couleur = ? WHERE id = ?",
    nom.trim(),
    icone?.trim() || null,
    couleur,
    id,
  );
}

/** Nombre de tâches actives d'une liste. */
export async function compterTaches(id: number): Promise<number> {
  const db = await getDatabase();
  const r = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM items WHERE liste_id = ? AND type = 'tache' AND statut = 'actif'",
    id,
  );
  return r?.n ?? 0;
}

/** La liste qui recevra les tâches d'une liste supprimée (la première des autres). */
export async function listeDeRepli(id: number): Promise<Liste | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Liste>(
    `SELECT ${COLONNES} FROM listes WHERE id != ? ORDER BY ordre, id LIMIT 1`,
    id,
  );
}

/** Supprime une liste ; ses tâches passent dans la liste de repli (ou sans liste). */
export async function supprimerListe(id: number): Promise<void> {
  const db = await getDatabase();
  const repli = await listeDeRepli(id);
  await db.runAsync(
    "UPDATE items SET liste_id = ? WHERE liste_id = ?",
    repli?.id ?? null,
    id,
  );
  await db.runAsync("DELETE FROM listes WHERE id = ?", id);
}

/** Objectif de la liste : x tâches faites par semaine ou par mois ; null l'enlève. */
export async function definirObjectif(
  id: number,
  objectif: number | null,
  periode: Periode,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE listes SET objectif = ?, objectif_periode = ? WHERE id = ?",
    objectif && objectif > 0 ? objectif : null,
    objectif && objectif > 0 ? periode : null,
    id,
  );
}

export type SuiviObjectif = {
  cible: number;
  periode: Periode;
  /** De la plus ancienne à celle en cours : 8 semaines ou 6 mois. */
  periodes: { debut: string; fin: string; fait: number }[];
  /** Périodes d'affilée où l'objectif est atteint. */
  serie: number;
};

/**
 * Tâches faites dans la liste, période par période. Chaque fois qu'une
 * tâche est faite compte 1 (une tâche « 3 fois par semaine » peut compter 3).
 */
export async function suiviObjectif(l: Liste): Promise<SuiviObjectif | null> {
  if (!l.objectif || !l.objectif_periode) return null;
  const periodes = periodesRecentes(
    getAujourdhui(),
    l.objectif_periode,
    l.objectif_periode === "semaine" ? 8 : 6,
  );
  const db = await getDatabase();
  const dates = (
    await db.getAllAsync<{ date: string }>(
      `SELECT c.date FROM completions c JOIN items i ON i.id = c.item_id
       WHERE i.liste_id = ? AND i.type = 'tache' AND c.date >= ?`,
      l.id,
      periodes[0].debut,
    )
  ).map((r) => r.date);
  const avecFait = periodes.map((p) => ({ ...p, fait: compterDans(dates, p.debut, p.fin) }));
  return {
    cible: l.objectif,
    periode: l.objectif_periode,
    periodes: avecFait,
    serie: serieAtteinte(avecFait.map((p) => p.fait), l.objectif),
  };
}

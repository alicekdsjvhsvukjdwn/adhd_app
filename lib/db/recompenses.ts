import {
  POINTS_COMPLETION,
  POINTS_DERNIERE_ETAPE,
  POINTS_ESSENTIELLES,
  POINTS_ETAPE,
  POINTS_TOUTES,
} from "../regles-taches";
import { POINTS_MEDITATION } from "../meditations";
import { POINTS_MENAGE } from "../menage-regles";
import { POINTS_CUISINE } from "../cuisine-regles";
import { POINTS_PROJET_FINI, POINTS_PROJET_JOUR } from "../projets-regles";
import { POINTS_TCC } from "../tcc-points";
import { POINTS_ETAPE_SKILL, POINTS_MAITRISE } from "../skills";
import { POINTS_NUIT, POINTS_SEANCE } from "../suivi-regles";
import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";

/**
 * Récompenses réelles, achetées avec les points gagnés.
 * Le solde baisse quand on dépense ; le total gagné (et donc le niveau), non.
 */

export type Recompense = {
  id: number;
  nom: string;
  /** Clé d'ICONES_RECOMPENSES, ou un emoji des premières versions. */
  icone: string | null;
  prix: number;
  categorie: string;
};

export type Achat = {
  id: number;
  recompense_id: number | null;
  nom: string;
  icone: string | null;
  prix: number;
  date: string;
};

/** Ce que rapporte (ou reprend) chaque action, tel que le code le calcule. */
export const REGLES_POINTS: { action: string; points: string }[] = [
  { action: "Une routine faite", points: `+${POINTS_COMPLETION}` },
  {
    action: "Routine à étapes : toutes les essentielles faites",
    points: `+${POINTS_ESSENTIELLES}`,
  },
  {
    action: "Routine à étapes : toutes les étapes faites",
    points: `+${POINTS_TOUTES - POINTS_ESSENTIELLES} de plus (${POINTS_TOUTES} en tout)`,
  },
  {
    action: "Jour difficile : les essentielles d'une routine à étapes",
    points: `+${POINTS_TOUTES}`,
  },
  { action: "Une tâche faite (une fois, ou chaque fois pour « x fois par semaine / mois »)", points: `+${POINTS_COMPLETION}` },
  { action: "Une étape d'une tâche", points: `+${POINTS_ETAPE}` },
  {
    action: "La dernière étape (étape + tâche faite + bonus)",
    points: `+${POINTS_DERNIERE_ETAPE}`,
  },
  {
    action: "Une nuit complète : heures, qualité et écrans (des 7 derniers jours, une fois par nuit)",
    points: `+${POINTS_NUIT}`,
  },
  {
    action: "Une séance de sport, skills ou guidée, même partielle (une fois par jour)",
    points: `+${POINTS_SEANCE}`,
  },
  { action: "Sport : une étape d'un skill validée (une fois par étape)", points: `+${POINTS_ETAPE_SKILL}` },
  { action: "Sport : un skill maîtrisé (une fois par skill)", points: `+${POINTS_MAITRISE}` },
  {
    action: "Une méditation terminée ou d'au moins 1 min (une fois par jour)",
    points: `+${POINTS_MEDITATION}`,
  },
  {
    action: "Une exposition ou ma séance avec moi-même (TCC en autonomie), une fois par jour. Humeur et journaux : jamais de points",
    points: `+${POINTS_TCC}`,
  },
  {
    action: "« J'ai cuisiné » validé sur une recette (une fois par jour)",
    points: `+${POINTS_CUISINE}`,
  },
  {
    action: "Un projet créatif qui avance : une séance ou une étape cochée (une fois par jour)",
    points: `+${POINTS_PROJET_JOUR}`,
  },
  {
    action: "Un projet créatif qui passe en « Fini » (une seule fois par projet)",
    points: `+${POINTS_PROJET_FINI}`,
  },
  {
    action: "Une tâche de ménage due ou en retard (une fois par tâche et par échéance ; rien si elle n'était pas encore due)",
    points: `+${POINTS_MENAGE}`,
  },
  {
    action: "Décocher, annuler ou remettre à faire",
    points: "reprend ce qui avait été donné",
  },
  { action: "Changer l'énergie du jour", points: "recalcule les routines à étapes" },
];

export async function getRecompenses(): Promise<Recompense[]> {
  const db = await getDatabase();
  return db.getAllAsync<Recompense>(
    "SELECT id, nom, icone, prix, categorie FROM recompenses ORDER BY prix, id",
  );
}

export async function ajouterRecompense(
  r: Omit<Recompense, "id">,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO recompenses (nom, icone, prix, categorie, cree_le) VALUES (?, ?, ?, ?, ?)",
    r.nom.trim(),
    r.icone,
    Math.max(1, Math.round(r.prix)),
    r.categorie,
    new Date().toISOString(),
  );
}

export async function modifierRecompense(r: Recompense): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE recompenses SET nom = ?, icone = ?, prix = ?, categorie = ? WHERE id = ?",
    r.nom.trim(),
    r.icone,
    Math.max(1, Math.round(r.prix)),
    r.categorie,
    r.id,
  );
}

export async function supprimerRecompense(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM recompenses WHERE id = ?", id);
}

export async function pointsGagnes(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ points_total: number }>(
    "SELECT points_total FROM stats WHERE id = 1",
  );
  return row?.points_total ?? 0;
}

/** Points disponibles : gagnés au total, moins ce qui a été dépensé. Jamais négatif. */
export async function soldePoints(): Promise<number> {
  const db = await getDatabase();
  const gagnes = await pointsGagnes();
  const depenses = await db.getFirstAsync<{ n: number | null }>(
    "SELECT SUM(prix) AS n FROM achats",
  );
  return Math.max(0, gagnes - (depenses?.n ?? 0));
}

/** Achète une récompense si le solde suffit. Renvoie false sinon. */
export async function acheter(r: Recompense): Promise<boolean> {
  if ((await soldePoints()) < r.prix) return false;
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO achats (recompense_id, nom, icone, prix, date, horodatage)
     VALUES (?, ?, ?, ?, ?, ?)`,
    r.id,
    r.nom,
    r.icone,
    r.prix,
    getAujourdhui(),
    new Date().toISOString(),
  );
  return true;
}

/** Annule un achat (rembourse). Réservé aux achats du jour dans l'interface. */
export async function annulerAchat(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM achats WHERE id = ?", id);
}

export async function derniersAchats(limite = 20): Promise<Achat[]> {
  const db = await getDatabase();
  return db.getAllAsync<Achat>(
    `SELECT id, recompense_id, nom, icone, prix, date
     FROM achats ORDER BY horodatage DESC, id DESC LIMIT ?`,
    limite,
  );
}

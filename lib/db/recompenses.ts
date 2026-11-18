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
import { PLAFOND_ENTREES_JOUR, POINTS_BONUS_ZONES, POINTS_ENTREE, ZONES_POUR_BONUS } from "../journee-regles";
import { PIOCHES_PAR_JOUR, SEUIL_PIOCHE_DEFAUT } from "../recompenses-regles";
import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";
import { synchroniserJour } from "./journal-auto";
import { ecrireMeta, lireMeta } from "./meta";

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
    action: `Ma journée : une entrée (jusqu'à ${PLAFOND_ENTREES_JOUR} points par jour). Liée à une tâche cochée, ou créée toute seule par une autre partie de l'appli : 0, l'action a déjà ses points`,
    points: `+${POINTS_ENTREE}`,
  },
  {
    action: `Ma journée : ${ZONES_POUR_BONUS} zones du bonhomme colorées le même jour (une fois par jour)`,
    points: `+${POINTS_BONUS_ZONES}`,
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
  return (await utiliser(r)) !== null;
}

/**
 * Utiliser une récompense : les points (le solde) baissent, pas le niveau. Renvoie l'achat, ou null si le solde ne suffit pas.
 * Si c'était mon objectif, il est libéré (j'en choisis un autre). L'entrée de Ma journée suit (lib/db/journal-auto.ts).
 */
export async function utiliser(r: Recompense): Promise<number | null> {
  if ((await soldePoints()) < r.prix) return null;
  const db = await getDatabase();
  const res = await db.runAsync(
    `INSERT INTO achats (recompense_id, nom, icone, prix, date, horodatage)
     VALUES (?, ?, ?, ?, ?, ?)`,
    r.id,
    r.nom,
    r.icone,
    r.prix,
    getAujourdhui(),
    new Date().toISOString(),
  );
  if ((await lireObjectif()) === r.id) await ecrireObjectif(null);
  await synchroniserJour(getAujourdhui());
  return res.lastInsertRowId;
}

// ─── Objectif, pioche, souvenirs ────────────────────────────────────────

const CLE_OBJECTIF = "recompense_objectif";
const CLE_SEUIL = "pioche_seuil";

export async function lireObjectif(): Promise<number | null> {
  const v = Number(await lireMeta(CLE_OBJECTIF));
  return v > 0 ? v : null;
}

export async function ecrireObjectif(id: number | null): Promise<void> {
  await ecrireMeta(CLE_OBJECTIF, id ? String(id) : null);
}

export async function lireSeuilPioche(): Promise<number> {
  const v = Number(await lireMeta(CLE_SEUIL));
  return v > 0 ? v : SEUIL_PIOCHE_DEFAUT;
}

export async function ecrireSeuilPioche(n: number): Promise<void> {
  await ecrireMeta(CLE_SEUIL, String(Math.max(1, Math.round(n))));
}

/** Pioches faites aujourd'hui (la première + 2 repioches au plus). */
export async function piochesDuJour(): Promise<number> {
  const db = await getDatabase();
  return (await db.getFirstAsync<{ n: number }>("SELECT n FROM pioches WHERE jour = ?", getAujourdhui()))?.n ?? 0;
}

/** Compte une pioche ; false si les 3 du jour sont déjà faites. */
export async function compterPioche(): Promise<boolean> {
  if ((await piochesDuJour()) >= PIOCHES_PAR_JOUR) return false;
  const db = await getDatabase();
  await db.runAsync("INSERT INTO pioches (jour, n) VALUES (?, 1) ON CONFLICT(jour) DO UPDATE SET n = n + 1", getAujourdhui());
  return true;
}

export type Souvenir = { texte: string; photo: string | null; ressenti: number | null };

/** Le souvenir d'une récompense utilisée : il complète son entrée de Ma journée (texte et ressenti). */
export async function enregistrerSouvenir(achatId: number, s: Souvenir): Promise<void> {
  const db = await getDatabase();
  const ressenti = s.ressenti && s.ressenti >= 1 && s.ressenti <= 5 ? Math.round(s.ressenti) : null;
  await db.runAsync(
    "UPDATE achats SET souvenir_texte = ?, souvenir_photo_uri = ?, souvenir_ressenti = ? WHERE id = ?",
    s.texte.trim() || null,
    s.photo,
    ressenti,
    achatId,
  );
  const a = await db.getFirstAsync<{ date: string }>("SELECT date FROM achats WHERE id = ?", achatId);
  if (a) await synchroniserJour(a.date);
}

export type SouvenirAchat = Achat & {
  categorie: string | null;
  souvenir_texte: string | null;
  souvenir_photo_uri: string | null;
  souvenir_ressenti: number | null;
};

/** « Mes souvenirs » : les récompenses utilisées, la plus récente d'abord. */
export async function souvenirs(): Promise<SouvenirAchat[]> {
  const db = await getDatabase();
  return db.getAllAsync<SouvenirAchat>(
    `SELECT a.id, a.recompense_id, a.nom, a.icone, a.prix, a.date, r.categorie,
            a.souvenir_texte, a.souvenir_photo_uri, a.souvenir_ressenti
     FROM achats a LEFT JOIN recompenses r ON r.id = a.recompense_id
     ORDER BY a.horodatage DESC, a.id DESC`,
  );
}

/** Annule un achat (rembourse). Réservé aux achats du jour dans l'interface. */
export async function annulerAchat(id: number): Promise<void> {
  const db = await getDatabase();
  const a = await db.getFirstAsync<{ date: string }>("SELECT date FROM achats WHERE id = ?", id);
  await db.runAsync("DELETE FROM achats WHERE id = ?", id);
  if (a) await synchroniserJour(a.date);
}

export async function derniersAchats(limite = 20): Promise<Achat[]> {
  const db = await getDatabase();
  return db.getAllAsync<Achat>(
    `SELECT id, recompense_id, nom, icone, prix, date
     FROM achats ORDER BY horodatage DESC, id DESC LIMIT ?`,
    limite,
  );
}

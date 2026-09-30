import { getDatabase } from "./client";
import { getAujourdhui } from "./completions";
import { initStats } from "./stats";

/**
 * Récompenses réelles, achetées avec les points gagnés.
 * Le solde baisse quand on dépense ; le total gagné (et donc le niveau), non.
 */

export type Recompense = {
  id: number;
  nom: string;
  icone: string | null;
  prix: number;
};

export type Achat = {
  id: number;
  recompense_id: number | null;
  nom: string;
  icone: string | null;
  prix: number;
  date: string;
};

/** Ce que rapporte chaque action, tel que le code le calcule. */
export const REGLES_POINTS: { action: string; points: string }[] = [
  { action: "Une routine faite, quelle que soit sa version", points: "+10" },
  { action: "Une tâche terminée", points: "+10" },
  { action: "Une étape d'une grosse tâche", points: "+5" },
  { action: "Toutes les étapes finies", points: "+10 de bonus" },
  { action: "Un check-in (les 3 premiers du jour)", points: "+5" },
];

/** Idées de départ, prix calibrés sur ~60 points gagnés par jour. */
export const IDEES_RECOMPENSES: Omit<Recompense, "id">[] = [
  { icone: "☕", nom: "Aller boire un café", prix: 50 },
  { icone: "📺", nom: "Un épisode de série", prix: 60 },
  { icone: "🍰", nom: "Une pâtisserie", prix: 80 },
  { icone: "🎮", nom: "Une heure de jeu vidéo", prix: 120 },
  { icone: "🛁", nom: "Un moment cocooning", prix: 100 },
  { icone: "📚", nom: "Un nouveau livre", prix: 300 },
  { icone: "🍿", nom: "Une séance de ciné", prix: 400 },
  { icone: "🎧", nom: "Un album ou un concert", prix: 600 },
];

export async function getRecompenses(): Promise<Recompense[]> {
  const db = await getDatabase();
  return db.getAllAsync<Recompense>(
    "SELECT id, nom, icone, prix FROM recompenses ORDER BY prix, id",
  );
}

export async function ajouterRecompense(
  r: Omit<Recompense, "id">,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO recompenses (nom, icone, prix, cree_le) VALUES (?, ?, ?, ?)",
    r.nom.trim(),
    r.icone,
    Math.max(1, Math.round(r.prix)),
    new Date().toISOString(),
  );
}

export async function modifierRecompense(r: Recompense): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE recompenses SET nom = ?, icone = ?, prix = ? WHERE id = ?",
    r.nom.trim(),
    r.icone,
    Math.max(1, Math.round(r.prix)),
    r.id,
  );
}

export async function supprimerRecompense(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM recompenses WHERE id = ?", id);
}

export async function pointsGagnes(): Promise<number> {
  await initStats();
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
